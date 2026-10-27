# ADR 0009: PDF generation with PDFKit

- **Status:** Accepted, as a deviation from section 2, pending the project owner's approval
- **Recorded:** 26 October 2026 (the library was chosen in Phase 5, 24 October 2026, without an
  ADR; this record documents that choice)

## Context

Section 2 names `@react-pdf/renderer` for PDFs and asks for an ADR before the stack changes.
Section 7.3 needs two server-generated documents, both made in a route handler from data the
service has already scoped and audited:

- the approved weekly report (cover details, totals, collection table, review history);
- a monthly branch summary.

## Decision

PDFs are generated with **PDFKit** (`pdfkit` 0.20), behind a small layout layer in
`lib/pdf/document.ts`:

- A4 pages, a title block, headings, label and value lists;
- tables that continue across pages, using PDFKit's built-in `doc.table()`;
- a footer on every page with the generation details and page numbers.

The two documents, `lib/pdf/weekly-report.ts` and `lib/pdf/monthly-summary.ts`, are plain
functions from data to a `Buffer`, with no React on this path. They use the standard PDF fonts
(Helvetica), which need no font files.

Reasons, as assessed for this record:

- The documents are simple: tables and text. An imperative API with a built-in table is
  enough, and the code stays small and testable.
- Rendering is synchronous server work from plain data in a route handler. A second React
  renderer for PDFs adds a separate component model for two documents.
- PDFKit is bundled into the standalone build and runs in the Docker image. CI checks this
  (the image is 213 MB, under the 300 MB budget).

## Consequences

- **Character set.** The standard fonts cover Windows-1252 only, so Urdu typed into a note
  prints as "?". Supporting it would mean embedding a font file, which is equally true of
  `@react-pdf/renderer`. The admin area is in English (section 7.4).
- **Layout code.** Layout is written as PDFKit calls rather than JSX components. A future
  template designer would find JSX more familiar.
- **Switching later.** Moving to `@react-pdf/renderer` would replace `lib/pdf/*` only. The
  services, routes, audit entries and tests that check the PDF text would stay.
- **Owner approval.** This is recorded as a deviation in `docs/OPEN-QUESTIONS.md` for the
  owner to approve or reverse.

## Evidence

- `tests/unit/pdf.test.ts`: the renderers produce PDFs with the expected text.
- `tests/integration/pdf-exports.test.ts`: scope, approved reports only, audit entries.
- The PDF download in `e2e/report-cycle.spec.ts`.
