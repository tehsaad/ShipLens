# AI usage

The brief asks which AI tools were used, for what, and how their output was checked (rule 7:
AI tools are allowed and must be disclosed here). This file records what the project's history
and working sessions show; it claims no review that did not happen.

## Tools

| Tool                        | Used for                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code (Anthropic)     | Writing the code, tests, migrations, CI and deployment configuration, and documentation; running the checks; opening and merging pull requests and checking deploys when asked to |
| Gemini (Google), on the web | Designing the Teal and Marigold theme, the "walking together" mark and the public header (design steps 1 and 2 in `docs/design/DESIGN-SYSTEM.md`), from the brief in `GEMINI.md`  |
| GitHub Actions              | Running every automated check on each push and pull request, and calling the deploy hook                                                                                          |
| Dependabot                  | Proposing dependency updates                                                                                                                                                      |
| Playwright, axe, Lighthouse | Browser checks run by Claude Code: the end-to-end suite, accessibility scans and page-speed measurements                                                                          |

Claude Code worked in cloud sessions with access to this repository and its CI results.
Separately, with the owner's permission, it used the Render API to read deploys and logs and,
when the owner approved, to change the service's settings.

## What the AI did

Claude Code wrote nearly all of the repository:

- the bilingual landing page (pull request #1);
- the Next.js application across Phases 0 to 7:
  - the data model and database rules;
  - authentication and permissions;
  - the admin screens and the public site;
  - exports and security hardening;
  - the test suites and the documentation;
- the Dockerfile, the CI and deploy workflows, and the Render configuration.

It ran the checks itself before each commit:

- formatting, lint, types;
- unit, integration and end-to-end tests;
- the production build.

It also tested the live site after deploys (sign-ins, headers, exports, the client-IP fix).
Bugs that its own tests and checks found are recorded in the commit history, for example:

- a spoofable client IP;
- two form fields sharing one id;
- a language switcher whose screen-reader name did not match its text;
- fonts slowing the public pages.

### How Gemini's output was checked

The owner pasted Gemini's code into a Claude Code session; Gemini never had access to the
repository. Claude Code integrated it in pull request #17 and checked it before merging:

- **Read against the brief:** blocking problems were sent back to Gemini (a missing package,
  wrong message keys, a language switch that was a button with a mismatched label, a header
  turned into a client component, closed-menu links that could still take focus).
- **Fixed during integration**, each listed in the pull request: text colours that failed
  contrast, the closed menu made `inert`, a theme toggle that kept no state (it had a lint
  error), and a layout that did not fit until 1280 px.
- **Tested:** lint, types, the unit and integration suites, and the 79 end-to-end tests,
  which include axe on every public page in both languages and both themes and the
  hydration checks. Screenshots of `/en` and `/ur` in both themes are in the pull request and
  in `docs/design/screenshots/`. The live site was checked after the deploy.

## What a human did

The project owner:

- **Supplied the specification** (`docs/SPEC.md`) and created the repository.
- **Made every product decision** put to them: open questions 1–12, amendment A1 and the
  follow-up decisions in `docs/OPEN-QUESTIONS.md`.
- **Directed the work phase by phase:** asked for each phase to start, and for each pull
  request to be opened and merged.
- **Chose between the options presented.** For example:
  - deploying through a Render deploy hook;
  - keeping PDFKit and server-rendered tables, recorded as ADRs;
  - the design system for the architecture diagram;
  - how this file describes human review.
- **Provided the Render account and API access**, and approved the production configuration
  changes made with it: the client-IP header and the switch to hook deploys.

Code review was done through the automated checks above and the pull request descriptions. No
line-by-line human review of the code is recorded.

## What the commit history shows

On `main` on 27 October 2026 (108 commits):

| Author shown                                          | Commits | What they are                                                                                                                    |
| ----------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Claude                                                | 65      | Written by Claude Code                                                                                                           |
| The owner's Git name, with a Claude co-author trailer | 28      | Written by Claude Code in early sessions configured with the owner's Git name                                                    |
| The owner's Git name, no trailer                      | 1       | A local merge of the Phase 0 branch into Phase 1                                                                                 |
| The owner's GitHub name                               | 14      | The initial commit and the merge commits of the merged pull requests. GitHub records merges under the account that performs them |

## Before relying on this code

The owner should still decide on:

- **ADR 0009 and ADR 0010:** two stack deviations recorded for approval.
- **The open items in [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md):** among them the walkthrough
  video, branch protection and the deploy-hook secret.
- **A human security review:** of [docs/security.md](docs/security.md) and the permission
  matrix ([docs/permissions.md](docs/permissions.md)) before real data is stored.
