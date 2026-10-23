import { Geist, Inter, Noto_Nastaliq_Urdu } from "next/font/google";

/** Admin screens. */
export const geist = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

/** Public site, English (design reference: Inter body text). */
export const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

/** Public site, Urdu (section 7.4: a font suited to Urdu script). */
export const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-urdu",
  display: "swap",
});
