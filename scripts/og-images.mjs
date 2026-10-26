// Renders the social preview images (public/og/en.png and public/og/ur.png, 1200 x 630) from
// an HTML template in Chromium. Next.js's ImageResponse cannot shape Urdu script, so the images
// are rendered here and committed. Run after changing the site name or tagline:
//   npm run og:images
// Needs network access for the Google Fonts stylesheet. Text comes from messages/*.json.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const LOCALES = ["en", "ur"];
const SIZE = { width: 1200, height: 630 };
const HOST = "shiplens.onrender.com";

const lens = `<svg viewBox="0 0 32 32" width="132" height="132" aria-hidden="true">
  <rect width="32" height="32" rx="7" fill="#ffffff"/>
  <circle cx="14" cy="14" r="7" fill="none" stroke="#1f4d3a" stroke-width="3"/>
  <path d="M19.5 19.5 25 25" stroke="#1f4d3a" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const escape = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function template(locale, { name, tagline }) {
  const urdu = locale === "ur";
  return `<!doctype html>
<html lang="${locale}" dir="${urdu ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=block">
<style>
  html, body { margin: 0; }
  body {
    width: ${SIZE.width}px; height: ${SIZE.height}px; box-sizing: border-box; overflow: hidden;
    padding: 72px 88px; display: flex; flex-direction: column; justify-content: space-between;
    background: #1f4d3a; color: #ffffff;
    font-family: ${urdu ? "'Noto Nastaliq Urdu'" : "Inter"}, sans-serif;
  }
  .brand { display: flex; align-items: center; gap: 40px; }
  h1 { margin: 0; font-weight: 700; font-size: ${urdu ? 76 : 84}px; line-height: ${urdu ? 1.9 : 1.1}; }
  p { margin: 0; max-width: 980px; color: #d7e6de; font-size: ${urdu ? 44 : 50}px;
      line-height: ${urdu ? 2 : 1.25}; font-weight: ${urdu ? 400 : 500}; }
  footer { display: flex; justify-content: space-between; align-items: center;
           border-top: 2px solid rgba(255,255,255,0.25); padding-top: 28px;
           font-family: Inter, sans-serif; font-size: 30px; color: #b9d2c6; }
  footer span[lang="ur"] { font-family: 'Noto Nastaliq Urdu', serif; font-size: 28px; }
</style>
</head>
<body>
  <div class="brand">${lens}<h1>${escape(name)}</h1></div>
  <p>${escape(tagline)}</p>
  <footer><span dir="ltr">${HOST}</span><span>English · <span lang="ur">اردو</span></span></footer>
</body>
</html>`;
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
try {
  await mkdir("public/og", { recursive: true });
  for (const locale of LOCALES) {
    const messages = JSON.parse(await readFile(`messages/${locale}.json`, "utf8"));
    const page = await browser.newPage({ viewport: SIZE });
    await page.setContent(template(locale, messages.site), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const file = `public/og/${locale}.png`;
    await writeFile(file, await page.screenshot({ type: "png" }));
    console.log(`wrote ${file}`);
    await page.close();
  }
} finally {
  await browser.close();
}
