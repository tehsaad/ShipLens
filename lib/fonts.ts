import { Geist, Inter, Noto_Nastaliq_Urdu } from "next/font/google";

/**
 * Admin screens. Not preloaded: the public pages share the stylesheet that declares it, so a
 * preload would make every public visitor download a font only staff see.
 */
export const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: false,
});

/** Public site, English (design reference: Inter body text). */
export const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

/**
 * Public site, Urdu (section 7.4: a font suited to Urdu script). Not preloaded: the file is
 * about 230 KB and English pages never use it. The browser fetches it once Urdu text is laid out.
 */
export const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-urdu",
  display: "swap",
  preload: false,
});
