# ShipLens — volunteer landing page

Static bilingual landing page (English and Urdu) for a volunteer organisation.

- `index.html` — English, left-to-right
- `ur/index.html` — Urdu, right-to-left (`dir="rtl"`), same sections and order
- `styles.css` — shared design tokens (CSS variables), light and dark themes, responsive layout

Open either page in a browser, or serve the folder with any static server.

Placeholders to replace: `[Organisation name]`, `[000]`, `[00]`, quotes, partner logos, program copy, contact details and the year.

## Design tokens

Colours (light / dark):
- Primary: `#1F4D3A` / `#6FBF94`
- Accent (text on light): `#7A430C` / `#E9B873`; decorative accent `#C98A3D` / `#E0A458`
- Background: `#FBFAF6` / `#0F1A16`; surface `#FFFFFF` / `#17241F`
- Text: `#1B2420` / `#EAF0EC`; muted: `#4D5A54` / `#B3BFB8`

Type: Inter (body), Noto Nastaliq Urdu (Urdu), sizes 14 / 16 / 18 / 20 / 24 / 32 / 40 / 48 px.
Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px.
Radius: 6 / 12 px, pill for buttons.

Accessibility: text pairs meet WCAG AA; visible focus rings; semantic headings; reduced-motion respected.
