# Cooky design language

The complete visual system of Cooky (the debate editor), written so another app can adopt it. Every value here is taken from Cooky's source (`src/editor/lucas-theme.css`, `accent.ts`, `splash.ts`, `welcome.ts`, the icon generator). The last section, **Applying it to ReadRx**, says what to keep, what to change for ReadRx's users, and gives ready-to-paste Tailwind tokens.

---

## 1. The idea in one paragraph

Inspired by Arc. The window is a **frame**: a cool, softly lit gradient with a slow-drifting field of color and fine film grain. Content sits on **floating cards** (rounded, layered shadow, a faint colored bloom underneath). Controls are **tinted glass**, not solid fills: a translucent wash of the accent color, a thin inner ring, and a soft glow on hover. States deepen the tint and the glow; they never turn into an opaque slab. Motion uses a **spring** that overshoots slightly and settles. The brand mark is a **glass orb** filled with fluid cyan, blue, violet and pink.

Five rules hold it together:
1. **One accent drives everything.** Tints, rings, glows and the frame's light are all derived from one RGB value.
2. **Light comes from color, not lines.** Separation comes from shadow and tint, and borders are 1px hairlines at about 8% ink.
3. **Glass, not paint.** A control is a wash plus a ring plus an optional glow, at every state.
4. **Weighted motion.** Spring in, ease out, and only `transform` and `opacity` animate.
5. **Readable first.** The accent's text shade is computed per theme to pass contrast, whatever color the user picks.

---

## 2. Color

### 2.1 The accent

Default accent: **cyan `#22d3ee`** (RGB `34, 211, 238`). The user can change it. Presets:

| Name | Hex |
|---|---|
| Cyan (default) | `#22d3ee` |
| Blue | `#3b82f6` |
| Violet | `#8b5cf6` |
| Pink | `#ec4899` |
| Red | `#ef4444` |
| Orange | `#f97316` |
| Gold | `#eab308` |
| Green | `#22c55e` |

The base accent is **never used as text**. It's for washes, rings, glows and dots. Text in the accent color uses a **deep shade** computed for legibility:

```ts
// Mix toward black (light theme) or white (dark theme) in 4% steps until the
// color passes the contrast target against the card.
deepLight    = legibleOn(accent, '#fbfdfe', toward: black, min: 4.8)   // light-theme accent text
deepDark     = legibleOn(accent, '#141820', toward: white, min: 7)     // dark-theme accent text
tintTextDark = legibleOn(mix(accent, white, 0.45), '#141820', toward: white, min: 9) // text on dark tinted chips
```

For cyan this gives `#0b6b82` on light (5.9:1) and `#67e8f9` on dark (12.3:1). Expose the accent as CSS custom properties:

```css
--accent-rgb: 34, 211, 238;           /* the one input */
--accent: #22d3ee;                     /* washes, dots, glows */
--accent-deep: #0b6b82;                /* accent TEXT on light (computed) */
--accent-soft: rgba(var(--accent-rgb), 0.12);  /* 0.14 in dark */
--accent-glow: rgba(var(--accent-rgb), 0.5);   /* 0.45 in dark */
```

### 2.2 Neutrals: light theme

| Token | Value | Use |
|---|---|---|
| ink | `#13212b` | body text |
| text-strong | `#08131a` | headings |
| text-secondary | `#3e4f5a` | secondary text |
| text-muted | `#5a6b76` | captions, inactive tabs |
| text-faint | `#8696a1` | labels, hints (decorative only, not for essential text) |
| card | `#fbfdfe` | floating cards |
| sheet | `#ffffff` | paper, inputs, active tab |
| raised | `rgba(255,255,255,0.7)` | button islands |
| surface | `#edf4f7` | quiet fills |
| surface-alt | `#e2ecf0` | |
| border | `#cfdde3` | |
| border-soft | `#dce7ec` | |
| divider | `#e0e9ed` | |
| hairline | `rgba(19,33,43,0.08)` | 1px rings around cards |
| hover | `rgba(19,33,43,0.055)` | hover wash |
| press | `rgba(19,33,43,0.09)` | pressed wash |

### 2.3 Neutrals: dark theme

| Token | Value |
|---|---|
| ink | `#e9f2f5` |
| text-strong | `#ffffff` |
| text-secondary | `#c3d0d7` |
| text-muted | `#94a5b0` |
| text-faint | `#6f808b` |
| card | `#141820` |
| raised surfaces | `#1b212b` (inputs, result cards), `#232a35` (active tab) |
| surface | `#1a202a` |
| surface-alt | `#212833` |
| border | `#2f3946` |
| border-soft | `#28313c` |
| divider | `#252d38` |
| hairline | `rgba(233,242,245,0.08)` |
| hover | `rgba(233,242,245,0.07)` |
| press | `rgba(233,242,245,0.11)` |
| text on accent | `#0c1016` |

### 2.4 Semantic and role colors (RGB triplets, used as `rgba(var(--x), a)`)

| Role | RGB | Notes |
|---|---|---|
| Uniqueness | `34, 211, 238` | cyan |
| Link | `242, 201, 76` | gold |
| Internal link | `251, 146, 60` | orange |
| Impact | `239, 68, 68` | red |
| Missing / needs attention | `244, 63, 133` | pink, with text `#be185d` |
| Tile blooms | accent, `96,165,250` blue, `45,212,191` teal, `167,139,250` violet | |

Pattern: every role color is stored as a bare triplet so one value produces the ring (0.45–0.8), the wash (0.05–0.12), the glow (0.3–0.9) and the dot (solid).

### 2.5 The frame (window background)

Light base, painted once on `html, body`:
```css
background: linear-gradient(140deg, #f3fafc 0%, #ecf6f9 50%, #e3f0f5 100%) fixed;
```
Dark base:
```css
background: linear-gradient(140deg, #0c1016 0%, #0f141b 50%, #101922 100%) fixed;
```
On top of the base sits one fixed layer (`.ambient`, `z-index:-1`, `pointer-events:none`) with two pseudo-elements: a drifting color **mesh** (`::before`) and **grain** (`::after`).

```css
/* Light mesh */
--mesh:
  radial-gradient(38% 48% at 18% 22%, rgba(var(--accent-rgb), 0.5), transparent 70%),
  radial-gradient(34% 44% at 82% 26%, rgba(96, 165, 250, 0.38), transparent 70%),
  radial-gradient(44% 50% at 62% 86%, rgba(168, 85, 247, 0.3), transparent 70%),
  radial-gradient(30% 40% at 12% 88%, rgba(244, 114, 182, 0.26), transparent 70%);
/* Dark mesh: same positions, alphas 0.24 / 0.2 (rgb 59,130,246) / 0.18 (139,92,246) / 0.12 (236,72,153) */

.ambient::before { inset: -25%; background: var(--mesh); animation: mesh-drift 32s ease-in-out infinite alternate; }
@keyframes mesh-drift {
  0%   { transform: translate(0, 0) rotate(0deg) scale(1); }
  33%  { transform: translate(6%, -4%) rotate(8deg) scale(1.08); }
  66%  { transform: translate(-5%, 5%) rotate(-6deg) scale(1.04); }
  100% { transform: translate(3%, 6%) rotate(10deg) scale(1.12); }
}
```

**Grain.** Fractal noise as an inline SVG, so there's no image file to ship:
```css
--grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
.ambient::after { inset: -60px; background-image: var(--grain); background-size: 240px 240px;
  opacity: 0.22; mix-blend-mode: soft-light; }      /* dark: 0.16, overlay */
```
On hero screens (the first-launch welcome) the field runs faster (14s) and more saturated (`filter: saturate(1.25)`). The grain also moves like film: `steps(6)` jitter of ±20px every 0.9s at 1.4× opacity.

---

## 3. Typography

- **Family:** Inter (variable), falling back to `-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif`.
- **Features:** `font-feature-settings: 'cv11', 'ss01'`, `-webkit-font-smoothing: antialiased`, and body letter-spacing `-0.003em`.
- Weights are used precisely. Variable weights like 550, 560, 650 and 720 are deliberate:

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Intro wordmark | 46px | 700 | -0.035em |
| Screen title | 34px | 720 | -0.03em |
| Dialog title | 24px | 720 | -0.025em |
| Section heading | 15px | 650 | -0.01em |
| Tile title | 15px | 650 | -0.015em |
| Body / controls | 13px | 400–600 | 0 |
| Toolbar chip | 11.5px | 600 | 0 |
| Overline label | 11px | 600 | +0.06em, UPPERCASE, faint |
| Hint | 12px | 450 | faint |

Headlines are **tight** (negative tracking) and labels are **wide** (positive tracking, uppercase). That contrast is part of the look.

---

## 4. Shape and space

| Token | Value |
|---|---|
| radius-sm | 7px (buttons, list rows, tabs) |
| radius | 10px (inputs, cards in lists, segmented track) |
| radius-lg | 14px (floating cards, dialogs, menus) |
| tile radius | 16px |
| dialog card | 20px |
| pills | 999px (toasts, chips, small badges) |
| glyph tiles | 11px on a 36px square |
| base gap | 10px between floating cards |
| list gap | 2px (rows), 10–14px (cards, tiles) |

Paddings in use: chips `4px 9px`, small buttons `6px 12px`, buttons `9px 15px`, inputs `10px 12px`, tiles `18px`, dialog `28px 28px 22px`.

---

## 5. Elevation (shadows)

Every shadow has **four layers**: a 1px hairline ring, a contact shadow, a depth shadow, and (on cards) a colored bloom.

```css
--shadow-sm:   0 0 0 1px var(--hairline), 0 1px 2px rgba(19,33,43,.06), 0 2px 6px -2px rgba(19,33,43,.08);
--shadow-md:   0 0 0 1px var(--hairline), 0 2px 4px rgba(19,33,43,.05), 0 10px 28px -10px rgba(19,33,43,.22);
--shadow-card: 0 0 0 1px var(--hairline), 0 1px 2px rgba(19,33,43,.05),
               0 12px 32px -14px rgba(19,33,43,.25),
               0 40px 90px -40px rgba(var(--accent-rgb), .45);      /* the colored bloom */
--shadow-sheet:0 0 0 1px rgba(19,33,43,.05), 0 1px 3px rgba(19,33,43,.08), 0 18px 44px -18px rgba(19,33,43,.3);
--ring:        0 0 0 1px rgba(var(--accent-rgb), .7), 0 0 0 4px rgba(var(--accent-rgb), .22);   /* focus */
```
Dark theme: the same shapes with black at 0.35–0.8 and the bloom at 0.28. Overlays (menus, dialogs) add `0 30px 80px -30px rgba(19,33,43,.35)` on top of `--shadow-md`.

Hover lift on cards: `transform: translateY(-1px)` (tiles `-2px`) and step up one shadow level.

---

## 6. Tinted glass, the control recipe

This one recipe is used for every button in every state:

```css
/* light */
--tint:      linear-gradient(180deg, rgba(255,255,255,.8), rgba(var(--accent-rgb), .12));
--tint-on:   linear-gradient(180deg, rgba(var(--accent-rgb), .16), rgba(var(--accent-rgb), .26));
--tint-ring: rgba(var(--accent-rgb), .45);
--tint-text: var(--accent-deep);
/* dark */
--tint:      linear-gradient(180deg, rgba(var(--accent-rgb), .1), rgba(var(--accent-rgb), .05));
--tint-on:   linear-gradient(180deg, rgba(var(--accent-rgb), .24), rgba(var(--accent-rgb), .14));
--tint-ring: rgba(var(--accent-rgb), .4);
--tint-text: #a5f3fc;  /* computed tintTextDark */
```

| State | Background | Box-shadow |
|---|---|---|
| Rest (primary) | `--tint` | `inset 0 0 0 1px var(--tint-ring), inset 0 1px 0 rgba(255,255,255,.5)` |
| Rest (quiet) | transparent | none |
| Hover | `--tint` (quiet) or `--tint-on` (primary) | ring + `0 6px 18px -8px var(--accent-glow)` |
| On / pressed | `--tint-on` | `inset 0 0 0 1px rgba(var(--accent-rgb),.6), 0 0 14px -2px var(--accent-glow)` |
| Active (press-down) | — | `transform: translateY(1px)` |
| Disabled | — | `opacity: .55` |
| Focus-visible | — | `var(--ring)` (never a default outline) |

Transitions: `box-shadow 160ms ease, background 160ms ease, color 120ms ease, transform 120ms ease`.

Text on tinted controls is always `--tint-text`, never white and never the base accent.

---

## 7. Components

**Button islands** (groups of related controls): a `raised` background, `radius`, `padding: 4px`, `gap: 4px`, `shadow-sm`. Chips inside are quiet until hovered.

**Segmented control / tabs:** a track with `background: var(--hover)`, `padding 3px`, `radius 10px`, `gap 2px`. Segments are `radius 7px` with weight 560 in muted color. The **active tab** is a white `sheet` with `shadow-sm` and ink text (dark: `#232a35`). The **active segment** (for a mode choice) is `--tint-on` with the strong ring and glow.

**Inputs:** a `sheet` background, `radius 10px`, no border, `shadow-sm`. On focus: `var(--ring), 0 6px 20px -8px var(--accent-glow)`.

**Chips / legend:** pill, `11px/600`, `background: rgba(c,.1)`, `inset 0 0 0 1px rgba(c,.45)`, with a 7px dot (`rgb(c)`, `0 0 6px rgba(c,.9)` glow) before the text.

**Status dots:** 8px circles with a matching glow (`0 0 8px rgba(c,.85)`).

**Cards in lists:** a `sheet` background, `radius 10px`, `padding 12–13px`, `shadow-sm`. On hover: `shadow-md` and `translateY(-1px)`.

**Launch tiles:** a `card` background, `radius 16px`, `padding 18px`, min-height 150px, `shadow-md`. Each tile has a 220px radial **bloom** of its own color in the bottom-right corner (`radial-gradient(closest-side, rgba(t,.3), transparent)`, `inset: auto -30% -55% auto`). The glyph is a 36px glass tile: `linear-gradient(160deg, rgba(255,255,255,.85), rgba(t,.16))`, ring `rgba(t,.5)`, glow `0 6px 16px -8px rgba(t,.8)`. Hover: lift 2px, `0 18px 40px -16px rgba(t,.6)` and ring `rgba(t,.45)`.

**"Needs attention" box:** a dashed `1.5px` border in pink at 0.8, `radius 12px`, a soft pink radial wash from the top-left, and a glow `0 0 20px -4px rgba(pink,.35)`. The header is an uppercase overline in pink. Its button is a pink tinted-glass pill.

**Toasts:** a pill (999px) in **inverted** colors (`ink` background, `card` text), weight 500, `shadow-md`, an accent ring at 0.4 and an accent glow.

**Dialogs:** `radius 14–20px`, `card` background, `shadow-card`. They enter with `translateY(16px) scale(.97)` to rest on the spring, over 0.6s. The backdrop is `rgba(10,16,24,.28)` with `blur(14px) saturate(130%)`, or the full grainy mesh on hero screens.

**Color swatches:** 26px circles with `inset 0 0 0 1px rgba(0,0,0,.12)` and a glow in their own color. Selected: `0 0 0 2px card, 0 0 0 4px color`. Hover: `scale(1.08)`. The custom picker is a conic rainbow ring.

**Scrollbars:** 11px wide on a transparent track. The thumb is a pill with a 3px transparent border at `rgba(90,110,125,.28)` (0.45 on hover).

**Progress:** an 8px accent dot that pulses (`opacity .35, scale .8` at 50%, 1s loop) with an accent glow.

**Quotes and callouts:** a 2px accent left border, 8px padding, deep-accent text.

---

## 8. Motion

**Spring curve** (overshoots about 16%, then settles):
```css
--spring: linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121,
  1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%,
  0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1);
```

| Use | Duration | Curve |
|---|---|---|
| Hover color/bg | 120ms | ease |
| Shadow/glow | 160ms | ease |
| Lift | 160–180ms | ease |
| Dialog in | 600ms | spring |
| Fade in / out | 300 / 260ms | ease-out / ease-in |
| Exit of a large surface | 650ms | `cubic-bezier(.65,0,.35,1)` |
| Ambient drift | 32s (14s on hero) | ease-in-out, alternate |

**Smoothness rule:** anything that moves animates **only `transform` and `opacity`**, so the compositor runs it on the GPU. No animated filters, blur or blend modes on moving layers. Soft color comes from gradients painted once.

**Reduced motion:** `prefers-reduced-motion: reduce` turns off drift, grain jitter, hover lifts, pulses and staggers. The intro becomes the finished mark plus a 0.25s fade.

---

## 9. The startup intro

On a dark stage (`radial-gradient(60% 55% at 50% 45%, #121a29 0%, #0a0e14 70%)` plus static grain at 0.07):

1. **0.12s:** the orb grows from `scale(.04)` to 1 on the spring over 1.05s.
2. **0.72s:** the wordmark's letters rise in one at a time: `translateY(22px) scale(.92)` to rest on the spring over 0.7s, 55ms apart.
3. **1.15s:** the tagline fades up 8px over 0.8s. Style: 14px/500, +0.02em, 70% white.
4. **1.45s:** the "by arjun" pill pops in: 11px/600, accent wash 0.14, accent ring 0.3.
5. **2.05s:** reveal. The orb scales to 14× and fades to 0.5 over 0.65s (`cubic-bezier(.7,0,.84,0)`). The text lifts 10px and fades out, and the stage fades out.

Any key or click skips it. The decision to play it is made in a head script before first paint, so it animates while the app loads underneath.

**The orb** (200px, `overflow:hidden; border-radius:50%`):
- Base: `#1a2238`.
- Field A, rotating 7s: four radial blobs: accent at (30%,32%), `#3b82f6` at (72%,36%), `#a855f7` at (46%,74%), `#f472b6` at (72%,72%).
- Field B, 0.7 opacity, rotating 11s in reverse: `#67e8f9`, `#ec4899`, `#6366f1`.
- Sheen: white at 0.6 from (32%,24%), a faint bounce from below, and a 1px inner ring at 0.22.
- Glow: `0 0 60px 6px rgba(accent,.45), 0 0 140px 30px rgba(139,92,246,.28), inset 0 0 40px rgba(255,255,255,.15)`.

**Sound** (Web Audio, no audio files):
- Master gain 0.5, then a lowpass at 7kHz, plus a 230ms feedback delay (feedback 0.32, wet 0.3) for air.
- As the orb grows: a band-passed noise whoosh sweeping 260Hz to 3.2kHz, panning left to right.
- As the name lands: an A-major add9 pad (220, 329.6, 440, 493.9, 554.4Hz; sine with triangle doubling, slightly detuned) with four sparkle notes (1318–2637Hz, 70ms apart).
- On the reveal: a downward whoosh and a soft 880Hz ping.

---

## 10. Logo

The mark is the **glass orb**: a conic field (cyan, blue, violet, pink, cyan) starting at 210°, melted with screen-blended blobs of the same colors and Gaussian-blurred so it never pinches.

Shading:
- **Sphere shading:** up to 28% darker toward the bottom-right.
- **Sheen:** a top-left highlight at 0.7.
- **Bounce light:** at the bottom, 0.18.
- **Rim light:** 3px at 0.35.
- **Halo:** cyan at the top, violet at the bottom, sigma 46px at 0.32.
- **Grain:** fine, at ±1.75%.

It sits on a white tile shaded `#ffffff` to `#eef4f8` (top to bottom). On macOS that tile is a squircle (exponent 5, 824px in a 1024px canvas) with a soft drop shadow. On iOS and web it's full-bleed, and the system rounds the corners.

**ReadRx's mark** uses the same recipe in a **tilted capsule** (40°, cyan cap at the upper left, pink at the lower right, a faint seam between the halves). It shows the family resemblance while saying "medicine". The generator is `design/make_readrx_icon.py`:
```bash
python3 design/make_readrx_icon.py out.png            # full-bleed (iOS, web, maskable)
python3 design/make_readrx_icon.py out.png --rounded  # macOS-style tile with shadow
```

---

## 11. Voice

Short, plain, second person. Buttons are verbs ("Find evidence", "Save .docx"). Taglines are three short phrases joined by middots ("Cut cards · Write cites · Find evidence"). Empty and missing states say what's missing and offer the fix in the same box. The credit is lowercase: "by arjun".

---

## 12. Applying it to ReadRx

ReadRx's users are older adults, people with low vision, and people reading in a second language. The look carries over, but a few Cooky habits would hurt them. **Keep the frame, cards, glass, orb and motion. Change the sizes, the contrast floor and the type.**

### Keep
- The frame gradient, drifting mesh and grain behind screens. Keep the grain subtle: 0.12–0.16 instead of 0.22, because grain behind text reduces legibility for low vision.
- Floating cards with the four-layer shadow and colored bloom: a medicine card, the pill-check result.
- Tinted-glass buttons, including the rest/hover/on states and the ring.
- The spring for sheets and cards, the GPU-only rule, and reduced-motion handling.
- A startup intro with the capsule mark, 1.5–2s, skippable. It must be skippable for people who open the app often.

### Change
| Cooky | ReadRx |
|---|---|
| Inter at 13px | **Keep Atkinson Hyperlegible Next.** It's built for low vision. Base 18px (21px "large"), body never under 18px |
| 11px uppercase faint labels | 15px+ labels, sentence case, `text-muted` (`#4e5a60`-level contrast). No faint text for anything essential |
| Buttons 28px tall | **At least 48px tall**, full-width primary actions on phone, 12–16px radius |
| Accent text at 4.8:1 | Accent text at **7:1 or more**, including on pressed buttons: `#095566` for cyan |
| Thin 1px tint ring as the only edge | Keep the ring, but add a visible label or icon: a control can't be recognizable only by a faint ring |
| Glow as state | The state also changes text weight or an icon. Glow alone is invisible to many users |
| 1px focus ring | 3px focus ring: `0 0 0 3px rgba(var(--accent-rgb), .55)` plus the deep accent outline |
| User-picked accent | Fixed accent (cyan), so warnings stay unambiguous |

### Safety colors stay separate from the brand
ReadRx's meanings must never be confused with decoration. Keep its semantic pairs and give them the same glass treatment:

| Meaning | Text | Wash | Ring/glow |
|---|---|---|---|
| OK / matches | `#115a37` | `#e4f1e9` | `rgba(19,104,63,.35)` |
| Stop / doesn't match | `#98201a` | `#fbe9e7` | `rgba(179,38,30,.35)` |
| Caution / read aloud highlight | `#7d3c06` | `#f6ebe0` | `rgba(154,74,8,.3)` |

These are ReadRx's current colors (`#13683f`, `#b3261e`, `#9a4a08`) deepened slightly so each reaches 7:1 on its own wash; the current ones measure 6.1–6.7:1.

Cyan is the brand and for navigation and actions. Green, red and amber are used only for these meanings.

### Tailwind v4 tokens (paste into `src/index.css`)

```css
@import "tailwindcss";

@theme {
  --font-sans: "Atkinson Hyperlegible Next", "Atkinson Hyperlegible", ui-sans-serif, system-ui, -apple-system, sans-serif;

  /* Brand (Cooky cyan) */
  --color-accent: #22d3ee;
  --color-accent-deep: #095566;      /* accent text: 8.2:1 on card, 7.1:1 on a pressed (tint-on) button */
  --color-accent-soft: rgb(34 211 238 / 0.12);

  /* Neutrals (Cooky light) */
  --color-ink: #13212b;
  --color-ink-strong: #08131a;
  --color-muted: #3e4f5a;            /* Cooky's secondary (8.3:1), the floor for any readable text */
  --color-card: #fbfdfe;
  --color-paper: #ffffff;
  --color-surface: #edf4f7;
  --color-rule: #cfdde3;

  /* Safety (ReadRx, unchanged meanings) */
  --color-ok: #115a37;     --color-ok-wash: #e4f1e9;
  --color-stop: #98201a;   --color-stop-wash: #fbe9e7;
  --color-amber: #7d3c06;  --color-amber-wash: #f6ebe0;

  --radius-sm: 10px;
  --radius: 14px;
  --radius-lg: 20px;
}

:root {
  --accent-rgb: 34, 211, 238;
  --hairline: rgba(19, 33, 43, 0.08);
  --shadow-sm: 0 0 0 1px var(--hairline), 0 1px 2px rgba(19,33,43,.06), 0 2px 6px -2px rgba(19,33,43,.08);
  --shadow-md: 0 0 0 1px var(--hairline), 0 2px 4px rgba(19,33,43,.05), 0 10px 28px -10px rgba(19,33,43,.22);
  --shadow-card: 0 0 0 1px var(--hairline), 0 1px 2px rgba(19,33,43,.05), 0 12px 32px -14px rgba(19,33,43,.25), 0 40px 90px -40px rgba(var(--accent-rgb), .45);
  --tint: linear-gradient(180deg, rgba(255,255,255,.8), rgba(var(--accent-rgb), .12));
  --tint-on: linear-gradient(180deg, rgba(var(--accent-rgb), .16), rgba(var(--accent-rgb), .26));
  --tint-ring: rgba(var(--accent-rgb), .45);
  --glow: rgba(var(--accent-rgb), .5);
  --spring: linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1);
}

html { font-size: 18px; }
html[data-size="large"] { font-size: 21px; }
body {
  color: var(--color-ink);
  background: linear-gradient(140deg, #f3fafc 0%, #ecf6f9 50%, #e3f0f5 100%) fixed;
}

/* Floating card */
.card { background: var(--color-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }

/* Tinted-glass button, sized for ReadRx */
.btn {
  min-height: 48px; padding: 0 20px; border: 0; border-radius: var(--radius);
  font: inherit; font-weight: 700; color: var(--color-accent-deep);
  background: var(--tint);
  box-shadow: inset 0 0 0 1px var(--tint-ring), inset 0 1px 0 rgba(255,255,255,.5);
  transition: box-shadow 160ms ease, background 160ms ease, transform 120ms ease;
}
.btn:hover { background: var(--tint-on); box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb),.6), 0 8px 22px -10px var(--glow); }
.btn:active { transform: translateY(1px); }
.btn[aria-pressed="true"] { background: var(--tint-on); box-shadow: inset 0 0 0 1.5px rgba(var(--accent-rgb),.7), 0 0 14px -2px var(--glow); }
:focus-visible { outline: 3px solid var(--color-accent-deep); outline-offset: 2px; box-shadow: 0 0 0 6px rgba(var(--accent-rgb), .25); }

/* Frame mesh + grain (put <div class="ambient" aria-hidden="true"> first in <body>) */
.ambient { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; isolation: isolate; }
.ambient::before, .ambient::after { content: ''; position: fixed; pointer-events: none; z-index: -1; }
.ambient::before {
  inset: -25%;
  background:
    radial-gradient(38% 48% at 18% 22%, rgba(var(--accent-rgb), .42), transparent 70%),
    radial-gradient(34% 44% at 82% 26%, rgba(96,165,250,.32), transparent 70%),
    radial-gradient(44% 50% at 62% 86%, rgba(168,85,247,.24), transparent 70%),
    radial-gradient(30% 40% at 12% 88%, rgba(244,114,182,.2), transparent 70%);
  animation: mesh-drift 32s ease-in-out infinite alternate;
}
.ambient::after {
  inset: -60px; opacity: .14; mix-blend-mode: soft-light; background-size: 240px 240px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
@keyframes mesh-drift {
  0% { transform: translate(0,0) rotate(0) scale(1); }
  33% { transform: translate(6%,-4%) rotate(8deg) scale(1.08); }
  66% { transform: translate(-5%,5%) rotate(-6deg) scale(1.04); }
  100% { transform: translate(3%,6%) rotate(10deg) scale(1.12); }
}
@media (prefers-reduced-motion: reduce) { .ambient::before { animation: none; } }
```

Also update `index.html`, `manifest.webmanifest` and `capacitor.config.json` so the status bar and splash match the frame: `theme-color` / `background_color` / iOS `backgroundColor` → `#F3FAFC`.

### Checklist for the redesign
- [ ] Every text/background pair is at least 7:1 for body and 4.5:1 for large text. Check the tinted states too.
- [ ] Every tap target is at least 48×48px.
- [ ] Nothing important is shown only through color or glow.
- [ ] Safety colors (ok, stop, amber) appear only with their meaning.
- [ ] Reduced motion turns off drift, lifts and the intro animation.
- [ ] The text still reads at 21px "large" size and with iOS Dynamic Type turned up.
