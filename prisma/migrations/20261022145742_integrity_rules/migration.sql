-- Integrity rules enforced by PostgreSQL.
-- Sources: docs/SPEC.md sections 5, 6.1-6.4 and 8 (A04: "lock rules enforced in the database"),
-- amendment A1, and decisions 7, 7a and 8 in docs/OPEN-QUESTIONS.md.
--
-- Custom SQLSTATE codes raised here (mapped to user-facing errors by lib/db-errors.ts):
--   SL001 collection is locked (7 days passed)        SL006 correction would take total below zero
--   SL002 collection week is approved                 SL007 deletion is not allowed
--   SL003 collection date is in the future            SL008 column cannot be changed
--   SL004 branch is closed                            SL009 audit log is append-only
--   SL005 invalid correction reference                SL010 approved report is locked

-- ---------------------------------------------------------------------------
-- Check constraints
-- ---------------------------------------------------------------------------

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email")),
  ADD CONSTRAINT "users_branch_lead_has_branch" CHECK ("role" <> 'BRANCH_LEAD' OR "branch_id" IS NOT NULL),
  ADD CONSTRAINT "users_failed_login_count_non_negative" CHECK ("failed_login_count" >= 0);

ALTER TABLE "branches"
  ADD CONSTRAINT "branches_code_format" CHECK ("code" ~ '^BR-[A-Z]{3}-[0-9]{3}$');

ALTER TABLE "applications"
  ADD CONSTRAINT "applications_motivation_min_length" CHECK (char_length("motivation") >= 50),
  ADD CONSTRAINT "applications_consent_given" CHECK ("consent_given"),
  ADD CONSTRAINT "applications_decline_reason_required"
    CHECK ("status" <> 'DECLINED' OR nullif(btrim("decline_reason"), '') IS NOT NULL);

-- One open (NEW) application per email address (section 6.2).
CREATE UNIQUE INDEX "applications_open_email_key" ON "applications" (lower("email")) WHERE "status" = 'NEW';

ALTER TABLE "members"
  ADD CONSTRAINT "members_member_code_format" CHECK ("member_code" ~ '^MEM-[0-9]{6}$');

-- Amendment A1: normal entries are positive; correction entries are non-zero and carry a reason.
ALTER TABLE "collections"
  ADD CONSTRAINT "collections_amount_rules" CHECK (
    ("corrects_collection_id" IS NULL AND "amount" > 0 AND "correction_note" IS NULL)
    OR ("corrects_collection_id" IS NOT NULL AND "amount" <> 0
        AND nullif(btrim("correction_note"), '') IS NOT NULL)
  ),
  ADD CONSTRAINT "collections_not_self_correction"
    CHECK ("corrects_collection_id" IS NULL OR "corrects_collection_id" <> "id"),
  ADD CONSTRAINT "collections_routing_consistent" CHECK (("routed_at" IS NULL) = ("routed_by_id" IS NULL));

ALTER TABLE "weekly_reports"
  ADD CONSTRAINT "weekly_reports_week_start_monday" CHECK (extract(isodow FROM "week_start") = 1),
  ADD CONSTRAINT "weekly_reports_version_positive" CHECK ("version" >= 1),
  ADD CONSTRAINT "weekly_reports_returned_has_comment"
    CHECK ("status" <> 'RETURNED' OR nullif(btrim("review_comment"), '') IS NOT NULL);

ALTER TABLE "events"
  ADD CONSTRAINT "events_ends_after_starts" CHECK ("ends_at" >= "starts_at");

-- ---------------------------------------------------------------------------
-- Date helpers (business dates use Asia/Karachi, section 1)
-- ---------------------------------------------------------------------------

CREATE FUNCTION business_today() RETURNS date
LANGUAGE sql STABLE
AS $$
  SELECT (now() AT TIME ZONE 'Asia/Karachi')::date
$$;

-- Monday of the ISO week containing d.
CREATE FUNCTION week_start_of(d date) RETURNS date
LANGUAGE sql IMMUTABLE
AS $$
  SELECT d - (extract(isodow FROM d)::int - 1)
$$;

-- True when the branch's report for the week containing d is APPROVED. The report row is
-- locked FOR SHARE so a concurrent approval cannot slip past this check (decision 8).
CREATE FUNCTION collection_week_is_approved(p_branch_id uuid, p_day date) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_status "ReportStatus";
BEGIN
  SELECT r."status" INTO v_status
  FROM "weekly_reports" r
  WHERE r."branch_id" = p_branch_id AND r."week_start" = week_start_of(p_day)
  FOR SHARE;
  RETURN v_status IS NOT DISTINCT FROM 'APPROVED';
END
$$;

-- Fails unless the original plus all its corrections stays at or above zero (amendment A1).
-- p_exclude_id leaves out a correction that is being edited; p_new_amount is its new value.
CREATE FUNCTION assert_correction_total(p_original_id uuid, p_exclude_id uuid, p_new_amount numeric)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total numeric;
BEGIN
  SELECT o."amount" + coalesce((
           SELECT sum(c."amount") FROM "collections" c
           WHERE c."corrects_collection_id" = p_original_id
             AND (p_exclude_id IS NULL OR c."id" <> p_exclude_id)
         ), 0) + coalesce(p_new_amount, 0)
    INTO v_total
  FROM "collections" o
  WHERE o."id" = p_original_id;

  IF v_total < 0 THEN
    RAISE EXCEPTION 'A correction cannot reduce the original collection below zero'
      USING ERRCODE = 'SL006';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Collections: 7-day lock, approved weeks, corrections, no deletion (section 6.3)
-- ---------------------------------------------------------------------------

CREATE FUNCTION collections_before_insert() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_branch_status "BranchStatus";
  v_original "collections"%ROWTYPE;
BEGIN
  -- createdAt can be backdated (seed data) but never set in the future; lockedAt always
  -- equals createdAt + 7 days.
  IF NEW."created_at" IS NULL OR NEW."created_at" > now() THEN
    NEW."created_at" := now();
  END IF;
  NEW."locked_at" := NEW."created_at" + interval '7 days';

  SELECT b."status" INTO v_branch_status FROM "branches" b WHERE b."id" = NEW."branch_id";
  IF v_branch_status = 'CLOSED' THEN
    RAISE EXCEPTION 'A closed branch accepts no new collections' USING ERRCODE = 'SL004';
  END IF;

  IF NEW."collected_on" > business_today() THEN
    RAISE EXCEPTION 'The collection date cannot be in the future' USING ERRCODE = 'SL003';
  END IF;

  IF collection_week_is_approved(NEW."branch_id", NEW."collected_on") THEN
    RAISE EXCEPTION 'The weekly report for this date is approved; record it in the current week'
      USING ERRCODE = 'SL002';
  END IF;

  IF NEW."corrects_collection_id" IS NOT NULL THEN
    -- Lock the original so concurrent corrections are checked one at a time.
    SELECT * INTO v_original FROM "collections" WHERE "id" = NEW."corrects_collection_id" FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The collection being corrected does not exist' USING ERRCODE = 'SL005';
    END IF;
    IF v_original."branch_id" <> NEW."branch_id" THEN
      RAISE EXCEPTION 'A correction must belong to the same branch as the original'
        USING ERRCODE = 'SL005';
    END IF;
    IF v_original."corrects_collection_id" IS NOT NULL THEN
      RAISE EXCEPTION 'A correction must reference an original entry, not another correction'
        USING ERRCODE = 'SL005';
    END IF;
    PERFORM assert_correction_total(v_original."id", NULL, NEW."amount");
  END IF;

  RETURN NEW;
END
$$;

CREATE FUNCTION collections_before_update() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."branch_id" IS DISTINCT FROM OLD."branch_id"
     OR NEW."entered_by_id" IS DISTINCT FROM OLD."entered_by_id"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
     OR NEW."locked_at" IS DISTINCT FROM OLD."locked_at"
     OR NEW."corrects_collection_id" IS DISTINCT FROM OLD."corrects_collection_id" THEN
    RAISE EXCEPTION 'This collection field cannot be changed' USING ERRCODE = 'SL008';
  END IF;

  -- Updates that change nothing except the routing fields (routedAt, routedById,
  -- routingReference) are always allowed: FINANCE_REVIEWER uses them on locked rows.
  IF NEW."amount" IS NOT DISTINCT FROM OLD."amount"
     AND NEW."collected_on" IS NOT DISTINCT FROM OLD."collected_on"
     AND NEW."purpose" IS NOT DISTINCT FROM OLD."purpose"
     AND NEW."description" IS NOT DISTINCT FROM OLD."description"
     AND NEW."correction_note" IS NOT DISTINCT FROM OLD."correction_note" THEN
    RETURN NEW;
  END IF;

  IF now() >= OLD."locked_at" THEN
    RAISE EXCEPTION 'This collection is locked and can no longer be edited' USING ERRCODE = 'SL001';
  END IF;

  IF collection_week_is_approved(OLD."branch_id", OLD."collected_on")
     OR collection_week_is_approved(OLD."branch_id", NEW."collected_on") THEN
    RAISE EXCEPTION 'The weekly report for this date is approved' USING ERRCODE = 'SL002';
  END IF;

  IF NEW."collected_on" > business_today() THEN
    RAISE EXCEPTION 'The collection date cannot be in the future' USING ERRCODE = 'SL003';
  END IF;

  IF NEW."amount" IS DISTINCT FROM OLD."amount" THEN
    IF OLD."corrects_collection_id" IS NOT NULL THEN
      PERFORM 1 FROM "collections" WHERE "id" = OLD."corrects_collection_id" FOR UPDATE;
      PERFORM assert_correction_total(OLD."corrects_collection_id", OLD."id", NEW."amount");
    ELSE
      -- Editing an original: its corrections must still leave the total at or above zero.
      PERFORM assert_correction_total(OLD."id", NULL, NEW."amount" - OLD."amount");
    END IF;
  END IF;

  RETURN NEW;
END
$$;

CREATE FUNCTION reject_delete() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Rows in % cannot be deleted', TG_TABLE_NAME USING ERRCODE = 'SL007';
END
$$;

CREATE TRIGGER "collections_before_insert" BEFORE INSERT ON "collections"
  FOR EACH ROW EXECUTE FUNCTION collections_before_insert();
CREATE TRIGGER "collections_before_update" BEFORE UPDATE ON "collections"
  FOR EACH ROW EXECUTE FUNCTION collections_before_update();
CREATE TRIGGER "collections_no_delete" BEFORE DELETE ON "collections"
  FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER "collections_no_truncate" BEFORE TRUNCATE ON "collections"
  FOR EACH STATEMENT EXECUTE FUNCTION reject_delete();

-- ---------------------------------------------------------------------------
-- Members: a CLOSED branch accepts no new members (section 6.1)
-- ---------------------------------------------------------------------------

CREATE FUNCTION members_branch_not_closed() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW."branch_id" IS DISTINCT FROM OLD."branch_id" THEN
    IF EXISTS (SELECT 1 FROM "branches" WHERE "id" = NEW."branch_id" AND "status" = 'CLOSED') THEN
      RAISE EXCEPTION 'A closed branch accepts no new members' USING ERRCODE = 'SL004';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."member_code" IS DISTINCT FROM OLD."member_code" THEN
    RAISE EXCEPTION 'The member code cannot be changed' USING ERRCODE = 'SL008';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "members_branch_not_closed" BEFORE INSERT OR UPDATE ON "members"
  FOR EACH ROW EXECUTE FUNCTION members_branch_not_closed();

-- ---------------------------------------------------------------------------
-- Weekly reports: APPROVED is terminal and locked (section 6.4)
-- ---------------------------------------------------------------------------

CREATE FUNCTION weekly_reports_approved_locked() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'APPROVED' THEN
    RAISE EXCEPTION 'An approved weekly report is locked' USING ERRCODE = 'SL010';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "weekly_reports_approved_locked" BEFORE UPDATE OR DELETE ON "weekly_reports"
  FOR EACH ROW EXECUTE FUNCTION weekly_reports_approved_locked();

-- ---------------------------------------------------------------------------
-- Audit log: append-only (section 5)
-- ---------------------------------------------------------------------------

CREATE FUNCTION audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'The audit log is append-only' USING ERRCODE = 'SL009';
END
$$;

CREATE TRIGGER "audit_logs_no_update_delete" BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
CREATE TRIGGER "audit_logs_no_truncate" BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only();

-- ---------------------------------------------------------------------------
-- Application database role (section 5: "the database role used by the app has no UPDATE or
-- DELETE privilege on this table"). Migrations run as the schema owner; the running app
-- connects as a login role that is a member of shiplens_app (see README). If the migration
-- user may not create roles, this step is skipped and the triggers above still apply.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiplens_app') THEN
    CREATE ROLE shiplens_app NOLOGIN;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Role shiplens_app not created (insufficient privilege); triggers still protect the data';
END
$$;

DO $$
DECLARE
  v_schema text := current_schema();
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shiplens_app') THEN
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO shiplens_app', v_schema);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA %I TO shiplens_app', v_schema);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO shiplens_app', v_schema);
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO shiplens_app', v_schema);
    -- Removing a member from a team is the only delete the application performs.
    EXECUTE format('GRANT DELETE ON %I."member_teams" TO shiplens_app', v_schema);
    -- Append-only audit log: read and insert only.
    EXECUTE format('REVOKE UPDATE ON %I."audit_logs" FROM shiplens_app', v_schema);
    -- The migration history is not the application's business.
    IF to_regclass(format('%I."_prisma_migrations"', v_schema)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON %I."_prisma_migrations" FROM shiplens_app', v_schema);
    END IF;
    -- Future tables created by migrations get the same baseline (no DELETE, no TRUNCATE).
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE ON TABLES TO shiplens_app',
      v_schema);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO shiplens_app',
      v_schema);
  END IF;
END
$$;
