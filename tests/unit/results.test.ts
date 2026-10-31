import { describe, expect, it } from "vitest";
import { sniffImageType } from "@/lib/validation/results";

describe("sniffImageType", () => {
  it("recognises JPEG, PNG and WebP by their magic bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png",
    );
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("rejects anything else, including SVG and text claiming to be an image", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(sniffImageType(svg)).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("not an image"))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
    // A valid RIFF header that is not WebP (e.g. a WAV file) is refused.
    const wav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(sniffImageType(wav)).toBeNull();
  });
});
