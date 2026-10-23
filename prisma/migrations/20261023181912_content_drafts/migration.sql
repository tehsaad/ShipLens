-- Section 7.2: "Edits to a published entry save as DRAFT until republished". Pending edits of
-- a PUBLISHED entry are kept beside the live title and body, which the public site keeps
-- showing until the entry is republished.
ALTER TABLE "content_entries" ADD COLUMN "draft_title" TEXT,
ADD COLUMN "draft_body" TEXT;

-- A pending draft has both parts, and only a published entry has one.
ALTER TABLE "content_entries"
  ADD CONSTRAINT "content_entries_draft_complete" CHECK (("draft_title" IS NULL) = ("draft_body" IS NULL)),
  ADD CONSTRAINT "content_entries_draft_only_when_published"
    CHECK ("draft_title" IS NULL OR "status" = 'PUBLISHED');
