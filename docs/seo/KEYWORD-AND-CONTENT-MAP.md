# Keyword and content map

One page per search intent, so the pages support rather than compete with each other. The
topics are **hypotheses** drawn from what the site is for (volunteering with a branch in
Pakistan). No search volumes, difficulty scores, rankings or competitor data were used,
because none were available; validate them with Search Console queries after launch
([POST-DEPLOYMENT.md](POST-DEPLOYMENT.md)).

Titles and descriptions below are the ones now in `messages/en.json` and `messages/ur.json`.
"Facts needed" are statements the page must be able to make truthfully; items marked
**owner** cannot be written from the repository and must come from the organisation.

## Avoiding overlap

| Intent                                     | Page that answers it | Pages that only link to it                    |
| ------------------------------------------ | -------------------- | --------------------------------------------- |
| Who is ShipLens Volunteers?                | About                | Home (hero summary), header navigation        |
| What do the branches do?                   | Programs             | Home (three-program preview), About           |
| Is there a branch in my city?              | Branches             | Home (active branch count), Get Involved      |
| What is happening and when?                | Events               | Home (next three events)                      |
| How do I volunteer, and what happens next? | Get Involved         | Home (main button), Programs, Branches, About |
| How do I ask a question?                   | Contact              | Get Involved (last question), Branches        |

Home targets the organisation's name and the overall offer; it must not try to rank for
"volunteer application" (Get Involved) or a city's branch (Branches).

## Pages

### Home (`/en`, `/ur`)

- **Intent:** navigational and introductory: someone who heard the name, or is looking for
  volunteer branches in Pakistan.
- **Focus:** ShipLens Volunteers. **Supporting:** volunteer branches across Pakistan; what
  branches do; how to join.
- **Audience:** prospective volunteers, families of volunteers, partners.
- **Title:** ShipLens Volunteers: volunteer branches across Pakistan /
  شپ لینز رضاکار: پاکستان بھر میں رضاکار شاخیں
- **Description:** "ShipLens Volunteers connects volunteer branches across Pakistan to one
  head office. Our branches run tutoring, food and clothing drives and community events."
- **Facts in place:** tagline, hero text, active branch count, latest programs and events.
- **Links:** Get Involved (button), Programs, Branches, Events.
- **Urdu:** complete for interface text; content previews fall back to English where no Urdu
  entry exists.
- **Owner gaps:** a one-paragraph factual introduction (year founded, number of volunteers or
  people served) only if the organisation can state them; do not estimate.

### About (`/about`)

- **Intent:** informational: "what is ShipLens Volunteers", mission, how it is organised.
- **Focus:** about ShipLens Volunteers. **Supporting:** mission; vision; history; how head
  office supports branches; what "branch", "branch lead" and "head office" mean.
- **Title:** About us · ShipLens Volunteers / ہمارے بارے میں · شپ لینز رضاکار
- **Description:** "About ShipLens Volunteers: we connect volunteer branches across Pakistan to
  one head office, which supports every branch."
- **Facts in place:** one published sentence.
- **Links (now):** Programs, Branches, Get Involved.
- **Urdu:** the entry exists in both languages.
- **Owner gaps (the biggest content gap on the site):** mission and vision statements; a short
  factual history; who runs head office (roles, not personal details unless agreed); how a
  branch is formed (section 6.1: FORMING, ACTIVE, PAUSED, CLOSED). Write in the content
  manager in both languages.

### Programs (`/programs`)

- **Intent:** informational: what volunteers actually do.
- **Focus:** volunteer programs. **Supporting:** tutoring; food and clothing drives;
  community events.
- **Title:** Programs · ShipLens Volunteers / پروگرام · شپ لینز رضاکار
- **Description:** "What ShipLens Volunteers branches do week after week: tutoring, food and
  clothing drives and community events."
- **Facts in place:** two sample entries ("Program One", "Program Two") with one sentence
  each; Program Two has no Urdu version.
- **Links (now):** Branches, Events, Get Involved.
- **Owner gaps:** real program names; for each, who it serves, where and how often, what a
  volunteer does, and how to join; Urdu versions. A program page per program is worth adding
  only once each program has enough to say.

### Branches (`/branches`)

- **Intent:** local: "volunteer in Lahore", "is there a branch near me".
- **Focus:** branches by city. **Supporting:** branch codes; contact emails; cities served.
- **Title:** Branches · ShipLens Volunteers / شاخیں · شپ لینز رضاکار
- **Description:** "Active ShipLens Volunteers branches across Pakistan, with each branch's
  code, city and contact email. Filter the list by city."
- **Facts in place:** active branches with code, city and contact email (structured data
  lists the same).
- **Links (now):** Get Involved, Events, Contact.
- **Owner gaps:** whether a branch may publish a meeting place or area served. Do **not**
  create one page per city with repeated text; a city page is justified only with content
  unique to that branch (its activities, schedule, meeting place).

### Events (`/events`)

- **Intent:** time-bound: "volunteer events this month", a specific event's date and place.
- **Focus:** upcoming events. **Supporting:** past events; branch events; head office events.
- **Title:** Events · ShipLens Volunteers / تقریبات · شپ لینز رضاکار
- **Description:** "Upcoming and past events of ShipLens Volunteers branches and head office,
  with the date, time and place of each."
- **Facts in place:** title (English, optional Urdu), start and end, location, branch.
  Upcoming events are described in structured data.
- **Links (now):** Branches, Get Involved.
- **Owner gaps:** an event description field (what happens, who it is for, whether to
  register) would make events useful in search; it needs a schema change and is not part of
  this work. Urdu titles for every event.

### Get Involved (`/get-involved`)

- **Intent:** transactional: "how to volunteer", "volunteer application Pakistan".
- **Focus:** volunteering with ShipLens Volunteers. **Supporting:** the three steps; what
  happens after applying; unpaid volunteering; no national ID needed; who sees your details.
- **Title:** Get involved · ShipLens Volunteers / شامل ہوں · شپ لینز رضاکار
- **Description:** "How to volunteer with ShipLens Volunteers: apply online and choose a
  branch, our HR team reads every application, and if you are accepted your branch lead
  contacts you."
- **Facts in place:** the steps, the form, and the answers (now on the page) from published
  Privacy and Terms text.
- **Links (now):** Contact (in the last answer), Branches, Programs, Events.
- **Owner gaps:** who can apply (minimum age, any requirements), how much time volunteering
  takes, and whether volunteers from outside a branch city are welcome. Add them as
  questions only when the organisation has an answer.

### Contact (`/contact`)

- **Intent:** navigational: contact head office.
- **Focus:** contact ShipLens Volunteers. **Supporting:** questions about volunteering, a
  branch or an event; reply by email.
- **Title:** Contact · ShipLens Volunteers / رابطہ · شپ لینز رضاکار
- **Description:** "Questions about volunteering, a branch or an event? Send ShipLens
  Volunteers head office a message and we will reply by email."
- **Links (now):** Get Involved, Branches.
- **Owner gaps:** a published head office email, phone or address, if the organisation wants
  them public; they would then also go in the structured data (`ContactPoint`).

### Privacy and Terms (`/privacy`, `/terms`)

- **Intent:** trust and policy. Not search targets; indexable because they help visitors.
- **Owner gaps:** legal review of both texts. They were not machine-translated or changed by
  this work.

## Terms the site should use consistently

| Term        | Meaning on this site                                               | Urdu          |
| ----------- | ------------------------------------------------------------------ | ------------- |
| Head office | The central team that supports every branch                        | ہیڈ آفس       |
| Branch      | A local volunteer group in a city, with a branch code (BR-KAR-001) | شاخ           |
| Branch lead | The volunteer who runs a branch                                    | شاخ کے سربراہ |
| Program     | A recurring activity branches run                                  | پروگرام       |
| Member      | An accepted volunteer belonging to a branch                        | رکن           |

Defining these on the About page would help readers and answer engines alike.
