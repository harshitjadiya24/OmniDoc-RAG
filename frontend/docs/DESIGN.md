# Design: Evidence Grade

A calm, dark-first reading room with a warm paper light theme. The brand colour is the verification system itself: green supported, amber partial, rose unsupported, slate unchecked or missing. Authority comes from type (Instrument Serif display, Geist UI, Geist Mono for IDs and numbers) and hairlines, not decoration.

## Tokens

Defined once in `src/app/globals.css` on `:root` and `.dark`, exposed to Tailwind through `@theme inline`. `*-fill` colours are for fills, rings and glows; `*-text` colours are the AA-checked variants for text.

| Role | Light | Dark |
|---|---|---|
| Background / surface / surface-2 / surface-3 | `#F5F2EB` / `#FFFFFF` / `#FBFAF6` / `#EFEBE2` | `#0A0B0D` / `#111317` / `#171A1F` / `#1F232A` |
| Ink / muted / subtle | `#0E1014` / `#4A4F59` / `#5F6570` | `#EDEEF0` / `#A3A8B3` / `#868C98` |
| Verified fill / text | `#3DDC97` / `#08693F` | `#3DDC97` / `#4BE3A2` |
| Partial fill / text | `#F5B840` / `#8A5A00` | `#F5B840` / `#F7C35E` |
| Unsupported fill / text | `#FF6B6B` / `#B4232F` | `#FF6B6B` / `#FF8A8A` |
| Neutral fill / text | `#94A3B8` / `#4A5568` | `#94A3B8` / `#AAB4C3` |
| Superseded fill / text | `#E8A23B` / `#8F5200` | `#E8A23B` / `#F0B45C` |

Radius: 6 px controls, 10 to 16 px panels, pills for status badges. z-index tokens: raised 10, sticky 20, header 30, panel 40, overlay 50, popover 60, toast 70, tooltip 80.

## Contrast (WCAG 2.2 AA, computed)

Washes are blended over the page background and over a surface; the lower figure is shown.

| Pairing | Light | Dark |
|---|---|---|
| ink on any surface | ≥ 16.0 | ≥ 13.6 |
| muted on any surface | ≥ 6.9 | ≥ 6.6 |
| subtle on any surface | ≥ 4.9 | ≥ 4.7 |
| verified text on its wash | 5.6 | 9.1 |
| partial text on its wash | 4.9 | 9.1 |
| unsupported text on its wash | 5.2 | 7.0 |
| neutral text on its wash | 6.0 | 7.4 |
| superseded text on its wash | 5.1 | 8.3 |
| label on the verified button | 10.6 | 10.6 |

`prefers-contrast: more` swaps hairlines for the strong line colour and subtle text for muted, and removes the grain. Forced colours hide the grain layer.

## Status is never colour alone

Every verdict and status has an icon and a word: supported (check), partial (half circle), unsupported (warning triangle), page missing (file with question mark), unchecked (dashed circle), superseded (history), current version (check). A refusal uses a calm info icon, never an error cross.

## Motion

Tokens in `src/lib/motion.ts` (90 / 160 / 240 / 400 / 700 ms, out-expo easing, snappy, drawer and pop springs, 40 ms stagger capped at 400 ms). Continuous animation uses transform and opacity only. `MotionConfig reducedMotion="user"` at the root; scripted demos jump to their finished frame under reduced motion, and only run while on screen and the tab is visible. Lenis smooth scroll is limited to the landing page and off under reduced motion. Buttons scale 1.02 on hover and 0.98 on press; citation chips never scale (they sit in running text), they change ring and fill.

## Honesty rules for the landing page

Every scripted demo carries a visible label ("Sample replay", "Illustrative ranks · real formula", "Live scoring · fictional page", "Illustration · fictional documents"). The numbers in the facts strip are properties of the code (stage, mode, verdict and type counts). The verification explainer includes a claim that scores "supported" while contradicting its page, to show the limit of word overlap.
