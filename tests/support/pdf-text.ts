import { inflateSync } from "node:zlib";

/**
 * The text drawn in a PDF made with the standard fonts: PDFKit writes it as hex strings in
 * TJ operators, in drawing order. Compressed content streams are inflated first.
 */
export function pdfTextOf(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  const streams: string[] = [];
  const pattern = /<<([^]*?)>>\s*stream\r?\n([^]*?)\r?\nendstream/g;
  for (const match of raw.matchAll(pattern)) {
    const data = Buffer.from(match[2]!, "latin1");
    streams.push(
      match[1]!.includes("/FlateDecode") ? inflateSync(data).toString("latin1") : match[2]!,
    );
  }
  const parts: string[] = [];
  for (const stream of streams) {
    for (const operator of stream.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      const hex = [...operator[1]!.matchAll(/<([0-9a-fA-F]*)>/g)].map((m) => m[1]).join("");
      parts.push(Buffer.from(hex, "hex").toString("latin1"));
    }
  }
  return parts.join("\n");
}
