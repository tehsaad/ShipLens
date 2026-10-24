import PDFDocument from "pdfkit";

/**
 * A small layout layer over PDFKit for the server-generated PDFs (section 7.3): A4 pages
 * with a title block, headings, label/value lists and tables that continue across pages, and
 * a footer with the generation details and page numbers.
 *
 * The documents use the standard PDF fonts (Helvetica), which need no font files and cover
 * the Windows-1252 character set. Other characters, such as Urdu script, are printed as "?".
 * The admin area is in English (section 7.4), so this affects only free text typed in another
 * script; the screens and CSV exports show it in full.
 */

export type PdfCell = string | number | null | undefined;

export type PdfOptions = {
  title: string;
  subtitle: string;
  /** Shown in every page footer: who generated the document and when. */
  footer: string;
  createdAt: Date;
  /** Compressed streams by default; tests turn it off to read the text. */
  compress?: boolean;
};

const WINDOWS_1252_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** Text the standard fonts can print: characters outside Windows-1252 become "?". */
export function pdfText(value: PdfCell): string {
  if (value === null || value === undefined) return "";
  return Array.from(String(value), (char) =>
    char.codePointAt(0)! <= 0xff || WINDOWS_1252_EXTRAS.has(char) ? char : "?",
  ).join("");
}

const MARGIN = 50;
const MUTED = "#555555";
const RULE = "#bbbbbb";
const HEADER_FILL = "#eeeeee";

export class PdfReport {
  private readonly doc: PDFKit.PDFDocument;
  private readonly footer: string;

  constructor(options: PdfOptions) {
    this.footer = pdfText(options.footer);
    this.doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      bufferPages: true,
      compress: options.compress ?? true,
      info: {
        Title: pdfText(options.title),
        Author: "ShipLens",
        Creator: "ShipLens",
        CreationDate: options.createdAt,
      },
    });
    this.doc.font("Helvetica-Bold").fontSize(18).text(pdfText(options.title));
    this.doc.font("Helvetica").fontSize(11).fillColor(MUTED).text(pdfText(options.subtitle));
    this.doc.fillColor("black").moveDown(0.5);
  }

  heading(text: string): this {
    this.doc.moveDown(0.8).font("Helvetica-Bold").fontSize(13).text(pdfText(text));
    this.doc.moveDown(0.3).font("Helvetica").fontSize(10);
    return this;
  }

  paragraph(text: string, options: { muted?: boolean } = {}): this {
    this.doc
      .moveDown(0.3)
      .font("Helvetica")
      .fontSize(10)
      .fillColor(options.muted ? MUTED : "black")
      .text(pdfText(text))
      .fillColor("black");
    return this;
  }

  /** Label and value pairs, two per line on a borderless grid. */
  fields(pairs: [label: string, value: PdfCell][]): this {
    const rows: { text: string; font?: { family: string } }[][] = pairs.map(([label, value]) => [
      { text: pdfText(label), font: { family: "Helvetica-Bold" } },
      { text: pdfText(value) || "-" },
    ]);
    this.doc.fontSize(10).table({
      columnStyles: [140, "*"],
      defaultStyle: { border: 0, padding: [2, 4] },
      data: rows,
    });
    this.doc.x = MARGIN;
    return this;
  }

  /** A table with a shaded header row; `align` right-aligns numeric columns. */
  table(
    header: string[],
    rows: PdfCell[][],
    options: { widths?: (number | string)[]; right?: number[]; empty?: string } = {},
  ): this {
    if (rows.length === 0) return this.paragraph(options.empty ?? "None.", { muted: true });
    const right = new Set(options.right ?? []);
    const cell = (value: PdfCell, column: number) => ({
      text: pdfText(value),
      align: { x: right.has(column) ? ("right" as const) : ("left" as const), y: "top" as const },
    });
    this.doc.fontSize(9).table({
      columnStyles: options.widths ?? header.map(() => "*"),
      defaultStyle: { border: 0.5, borderColor: RULE, padding: [3, 4] },
      data: [
        header.map((label, column) => ({
          ...cell(label, column),
          type: "TH" as const,
          backgroundColor: HEADER_FILL,
          font: { family: "Helvetica-Bold" },
        })),
        ...rows.map((row) => row.map(cell)),
      ],
    });
    this.doc.x = MARGIN;
    this.doc.fontSize(10);
    return this;
  }

  /** Ends the document, adding the footer to every page. */
  async toBuffer(): Promise<Buffer> {
    const chunks: Buffer[] = [];
    this.doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<void>((resolve, reject) => {
      this.doc.on("end", resolve);
      this.doc.on("error", reject);
    });
    const { start, count } = this.doc.bufferedPageRange();
    for (let index = start; index < start + count; index++) {
      this.doc.switchToPage(index);
      const page = this.doc.page;
      const bottom = page.margins.bottom;
      // Writing inside the bottom margin would otherwise start a new page.
      page.margins.bottom = 0;
      this.doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          `${this.footer} · Page ${index - start + 1} of ${count}`,
          MARGIN,
          page.height - bottom + 15,
          { width: page.width - 2 * MARGIN, align: "center", lineBreak: false },
        );
      page.margins.bottom = bottom;
    }
    this.doc.end();
    await done;
    return Buffer.concat(chunks);
  }
}
