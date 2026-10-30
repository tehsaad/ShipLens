import {
  Bricolage_Grotesque,
  Geist,
  Instrument_Sans,
  JetBrains_Mono,
  Noto_Nastaliq_Urdu,
} from "next/font/google";

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

/**
 * Public site body text. Instrument Sans: a clean, slightly condensed humanist sans with a
 * little more character than Inter, which keeps long Urdu-adjacent English paragraphs legible.
 */
export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * Public site display type. Bricolage Grotesque gives the headings their heavy, confident
 * voice. Preloaded with the body font because every public page shows a heading above the fold.
 */
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

/**
 * Public site technical labels: eyebrows, counters, branch codes and the river's milestone
 * numerals. JetBrains Mono keeps those small, uppercase strings crisp and evenly spaced.
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "700"],
});

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
