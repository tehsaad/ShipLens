# AI usage

Section 13 asks which AI tools were used, for what, and what a human reviewed or changed. This
file records what the project's history and working sessions show; it claims no review that
did not happen.

## Tools

| Tool                        | Used for                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code (Anthropic)     | Writing the code, tests, migrations, CI and deployment configuration, and documentation; running the checks; opening and merging pull requests and checking deploys when asked to |
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

On `main` before Phase 7 (82 commits):

| Author shown                                          | Commits | What they are                                                                                                                           |
| ----------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Claude                                                | 43      | Written by Claude Code                                                                                                                  |
| The owner's Git name, with a Claude co-author trailer | 28      | Written by Claude Code in early sessions configured with the owner's Git name                                                           |
| The owner's Git name, no trailer                      | 1       | A local merge of the Phase 0 branch into Phase 1                                                                                        |
| The owner's GitHub name                               | 10      | The initial commit and the merge commits of pull requests #1–#6 and #11–#13. GitHub records merges under the account that performs them |

Phase 7 adds further commits by Claude.

## Before relying on this code

The owner should still decide on:

- **ADR 0009 and ADR 0010:** two stack deviations recorded for approval.
- **The open items in [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md):** among them the walkthrough
  video, branch protection and the deploy-hook secret.
- **A human security review:** of [docs/security.md](docs/security.md) and the permission
  matrix ([docs/permissions.md](docs/permissions.md)) before real data is stored.
