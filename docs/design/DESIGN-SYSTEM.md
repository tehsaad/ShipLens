# Hamqadam design system: Teal and Marigold

The visual language of the public site, and later of the staff area. Theme and layout are
designed with Gemini; they are implemented and checked in this repository against the rules
in [`GEMINI.md`](../../GEMINI.md). Tokens live in [`app/globals.css`](../../app/globals.css).

## Brand

- **Name:** Hamqadam Volunteers / ہم قدم رضاکار ("walking together").
- **Mark:** a person walking: a marigold head over a teal stride (`app/icon.svg`, the header
  logo, `public/og/*.png`). Never a map.
- **Voice:** warm, plain, factual. No slogans that the content cannot back up.

## Colour tokens

Use the semantic names in components (`bg-primary`, `text-muted-foreground`), never raw hex.

| Token (`--…`)         | Light     | Dark      | Use                                                  |
| --------------------- | --------- | --------- | ---------------------------------------------------- |
| `background`          | `#FFFBF2` | `#061E1D` | Page (warm ivory / deep teal night)                  |
| `card` (`surface`)    | `#FFFFFF` | `#0B2E2C` | Cards, panels, menus                                 |
| `foreground` (`ink`)  | `#0B1F1E` | `#E6F4F1` | Body text and headings                               |
| `muted-foreground`    | `#4A5D5B` | `#9FB7B3` | Secondary text                                       |
| `muted`, `secondary`  | `#F3EEE2` | `#0F3633` | Quiet fills                                          |
| `accent`              | `#FDF3DC` | `#12403C` | Highlight fills (marigold tint)                      |
| `border`              | `#E7E1D3` | `#1F4542` | Dividers, card borders                               |
| `input`               | `#8F8775` | `#5D8A85` | Form control borders (3:1 against the surface)       |
| `primary`             | `#0F766E` | `#2DD4BF` | Links, secondary buttons, active navigation          |
| `primary-foreground`  | `#FFFFFF` | `#042F2E` | Text on `primary`                                    |
| `marigold`            | `#F59E0B` | `#FBBF24` | Main call to action, highlights (a fill, never text) |
| `marigold-foreground` | `#1C1917` | `#1C1917` | Text on `marigold`                                   |
| `marigold-ink`        | `#B45309` | `#FBBF24` | Marigold-coloured text on the page background        |
| `teal-deep`           | `#134E4A` | `#042F2E` | Dark bands (footer, hero backdrop)                   |
| `focus-ring`          | `#B45309` | `#FBBF24` | Keyboard focus outline                               |

Every text pair above meets WCAG 2.1 AA (4.5:1); the axe checks in CI verify the pages in both
themes. White text on marigold fails contrast, so marigold always carries dark text.

## Typography

- **English:** Inter (`--font-sans`), loaded with `next/font`. Headings 600–700, tracking
  −0.015em, balanced wrapping.
- **Urdu:** Noto Nastaliq Urdu (`--font-urdu`), line height 2 to 2.1; never letter-spaced
  (spacing breaks the letter joins). English inside Urdu pages keeps Inter.
- Scale (Tailwind): page title `text-3xl`/`text-4xl`, section `text-2xl`, card title
  `text-lg`, body `text-base`, meta `text-sm`.

## Shape and space

- Radius: 12 px for controls (`rounded-xl` on buttons), 16 px for cards.
- Touch targets at least 44 px (`h-11`).
- Content width `max-w-6xl`, side padding 16 px on phones.

## Components (so far)

- **Primary call to action:** `bg-marigold text-marigold-foreground`, bold, 44 px high, lifts
  2 px on hover.
- **Secondary:** teal (`bg-primary text-primary-foreground`) or teal outline.
- **Header:** sticky, translucent background with blur, the mark and name, the navigation
  with an animated underline for the current page, the language switcher, the theme toggle
  and the call to action. Below 1280 px, a menu button opens a panel; the closed panel is
  `inert`, Escape closes it and returns focus to the button.
- **Focus:** `focus-ring-marigold`, a 3 px outline offset by 2 px, on every interactive
  element.

## Motion

| Kind               | Duration   | Easing   |
| ------------------ | ---------- | -------- |
| Interface feedback | 150–250 ms | ease-out |
| Panels and menus   | 300 ms     | ease-out |
| Reveals on scroll  | 400–700 ms | ease-out |

- Animate `transform` and `opacity` only; nothing that moves layout.
- Under `prefers-reduced-motion`, transitions collapse to instant changes and elements with
  `motion-reduce-fade` keep colour feedback without moving.
- The largest element above the fold (the hero heading) is never hidden behind a load
  animation.
- Directional motion mirrors in Urdu (right to left).

## Roadmap

1. Tokens, typography, mark and share images. **Done.**
2. Public shell: header, menu, language switcher, theme toggle. **Done.**
3. Public pages: hero with the "walking together" motion graphic, cards, forms, filters.
4. Admin shell and sign-in.
5. Admin screens: dashboard, tables, the report workflow.
6. Motion polish.
