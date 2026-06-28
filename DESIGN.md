---
name: First Light Society
description: The management agency that turns combat athletes into earning enterprises.
colors:
  night: "#170327"
  night-surface: "#1d1028"
  night-card: "#251538"
  bone: "#f0ebe3"
  dawn: "#3d5a6c"
  dawn-mid: "#4e6f82"
  amber: "#d4925a"
  amber-mid: "#e0a876"
typography:
  display:
    fontFamily: "Cormorant SC, Georgia, serif"
    fontSize: "clamp(2.8rem, 6.5vw, 5.5rem)"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "0em"
  headline:
    fontFamily: "Cormorant SC, Georgia, serif"
    fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "0.02em"
  title:
    fontFamily: "Cormorant, Georgia, serif"
    fontSize: "clamp(1.35rem, 2.5vw, 1.8rem)"
    fontWeight: 300
    lineHeight: 1.5
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 300
    lineHeight: 1.75
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.65rem"
    fontWeight: 500
    letterSpacing: "0.22em"
rounded:
  none: "0"
spacing:
  xs: "1rem"
  sm: "1.5rem"
  md: "2.5rem"
  lg: "4rem"
  xl: "7rem"
  xxl: "8rem"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.night}"
    rounded: "{rounded.none}"
    padding: "1rem 2.5rem"
  button-primary-hover:
    backgroundColor: "{colors.amber-mid}"
    textColor: "{colors.night}"
  button-dawn:
    backgroundColor: "{colors.dawn}"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "1rem 2.5rem"
  button-dawn-hover:
    backgroundColor: "{colors.dawn-mid}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "0.85rem 2rem"
  button-ghost-hover:
    textColor: "{colors.amber}"
  input-base:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "0.4rem 0 0.8rem"
  input-focus:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
---

# Design System: First Light Society

## 1. Overview

**Creative North Star: "The Film Negative"**

Something developing in the dark. Potential made visible only when exposed correctly — through the right light, the right process, the right infrastructure. First Light Society exists in the interval between what an athlete has built and what it should be producing. The design lives in that interval too: sparse, charged, and deliberate. Nothing decorative. Everything loaded.

The palette is deep violet-black with a single warm neutral surface. Amber appears rarely — at decisive moments only — and earns its brightness precisely because the rest of the system withholds it. Dawn blue operates structurally: borders, guarantees, focus states. Bone carries everything legible. The visual temperature is cool discipline with one warm signal.

Typography is a high-contrast pairing: Cormorant SC (display, small caps) carries the authority of a management document, a contract header, a title card before the main event. DM Sans at 300 weight handles all functional text. The two typefaces share no aesthetic DNA, which is the point. One makes you feel the weight of the institution; the other gets out of the way.

This system explicitly rejects: the red/black aggression of UFC-adjacent branding; cheap gradient CTAs and testimonial carousels from Instagram coaching programs; the feature-grid hero metrics of SaaS; the drop-cap broadsheet grid of editorial-magazine aesthetics; any octagon imagery, glove photography, or "warrior" language in the visual layer.

**Key Characteristics:**
- Deep violet-black ground, not warm-neutral
- A single accent (amber) used at ≤10% of any surface
- Zero border-radius everywhere — signage precision
- Display serif in small caps only — never sentence case
- Motion is reveal, not decoration; every animation earns its place
- The athlete applies to First Light Society; the design reflects that power dynamic

## 2. Colors: The Film Negative Palette

A palette that develops in darkness. Authority comes from restraint — only one color is warm, and it appears rarely enough that it stops you when it arrives.

### Primary
- **Night** (`#170327` / oklch ≈ 8% 0.09 303): The ground. Every page background. Violet-black, not neutral black. Tinted toward the indigo end of the spectrum so it reads as considered rather than generic dark mode.
- **Bone** (`#f0ebe3` / oklch ≈ 93% 0.018 80): Primary text color and form backgrounds on light sections. Warm without being cream — a faint amber lean, not a neutral white.

### Secondary
- **Amber** (`#d4925a` / oklch ≈ 65% 0.12 55): The signal color. Reserved for primary CTAs, founding numbers, and key highlights. Its rarity is structural.
- **Amber Mid** (`#e0a876` / oklch ≈ 72% 0.09 55): Hover state for amber only. Never used as a standalone color.

### Tertiary
- **Dawn** (`#3d5a6c` / oklch ≈ 36% 0.058 222): Structural authority. The guarantee section background, dawn-accent borders, focus states. Reads as institutional — the color of a contract header.
- **Dawn Mid** (`#4e6f82` / oklch ≈ 44% 0.055 222): Secondary dawn for labels, navigation cues, and interactive micro-elements.

### Neutral
- **Night Surface** (`#1d1028` / oklch ≈ 12% 0.08 303): One step up from Night. Used for alternating section backgrounds to create depth through tonal shift, not shadow.
- **Night Card** (`#251538` / oklch ≈ 16% 0.07 303): Card backgrounds and the deepest surface layer.
- **T2** (Bone at 58% opacity): Body text, secondary paragraphs, all prose that is explanatory rather than declarative.
- **T3** (Bone at 32% opacity): Labels, metadata, timestamps, muted descriptors.
- **Border Night** (Bone at 9% opacity): Hairline dividers on dark surfaces.
- **Border Dawn** (Dawn at 30% opacity): Structural borders — section dividers, card outlines on dark.

### Named Rules
**The One Signal Rule.** Amber appears on ≤10% of any given surface. Its power is its rarity. Do not use amber as a background, a decorative element, or a text color for anything below a direct CTA. One amber element per section is the ceiling.

**The Warmth Carrier Rule.** Warmth in this system is carried by Bone text, Cormorant SC letterforms, and the amber CTA — not by the background. The background is always cool-to-neutral. Never add warmth to the ground.

## 3. Typography: The Contract and the Coach

**Display Font:** Cormorant SC (300, 400, 500 weight) with `Georgia, serif` fallback
**Body Font:** DM Sans (300, 400, 500 weight) with `system-ui, sans-serif` fallback
**Pullquote / Italic Font:** Cormorant (italic 300, 400) — the non-SC variant, for editorial quotations only

**Character:** Cormorant SC carries institutional authority through the small-caps form — the typeface of a fight contract, a management agreement, a title card before the main event. DM Sans at 300 weight is deliberately thin and functional, offering no competition. The contrast between them is total: one is carved, the other is printed.

### Hierarchy

- **Display** (Cormorant SC 300, `clamp(2.8rem, 6.5vw, 5.5rem)`, line-height 1.1, letter-spacing 0em): Hero headlines only. Fluid scale across viewports. Never used below the fold unless for major section breaks.
- **Headline** (Cormorant SC 400, `clamp(1.8rem, 3.5vw, 2.8rem)`, line-height 1.15, letter-spacing 0.02em): Section headings. Section statement. The h2 role across all pages.
- **Title** (Cormorant italic 300, `clamp(1.35rem, 2.5vw, 1.8rem)`, line-height 1.5): Pullquotes and blockquotes only. The editorial voice inside the institutional voice.
- **Body** (DM Sans 300, 1rem fixed, line-height 1.75, max-width 65ch): All prose. Light-on-dark increases optical weight, so 300 renders as regular-equivalent. Never set body below 1rem.
- **Label** (DM Sans 500, 0.65rem, letter-spacing 0.22em, uppercase): Kickers, section markers, navigation, button text, form labels. The administrative layer.

### Named Rules
**The SC Rule.** Cormorant SC is used for headings at all sizes, tier display names, step numerals, and the drawer navigation. It is never used for body copy or captions. The small-caps form is the brand's institutional register — it should feel like letterhead.

**The Italic Rule.** Cormorant italic (non-SC) is reserved for pullquotes and blockquotes only. It is the emotional counterweight to the institutional SC: where SC is authority, italic is confession.

**The Tracking Rule.** Uppercase DM Sans labels carry 0.22em letter-spacing. Cormorant SC headings at large display sizes run at 0em (natural). Medium headings run at 0.02–0.04em. Never tighten Cormorant SC below 0em — small caps collapse at tight tracking.

## 4. Elevation

This system uses tonal layering as its primary depth mechanism. The three Night tones (`--night`, `--night-surface`, `--night-card`) create the illusion of stacked surfaces without any shadow vocabulary. Sections alternate between Night and Night Surface; cards sit on Night inside a Night Surface container.

**One structural exception:** the fixed navigation bar carries a single ambient shadow to visually separate it from scrolling content below.

### Shadow Vocabulary

- **Nav ambient** (`0 1px 0 oklch(36% 0.058 222 / 0.3)` + `backdrop-filter: blur(16px)`): The navigation's bottom edge. Not a drop shadow — a border-blur composite that reads as separation without depth.

### Named Rules
**The Flat-By-Default Rule.** All surfaces below the navigation are flat. Cards, sections, form wrappers, drawers — no drop shadows. Depth is tonal, not spatial. Adding a `box-shadow` to a card is a signal that you are working against the system.

## 5. Components

### Buttons

Buttons are signage. Zero radius. Wide-tracked uppercase DM Sans. Generous horizontal padding so the label breathes inside the block.

- **Shape:** Zero radius (0). Hard edges at every corner.
- **Primary (Amber):** `background: #d4925a`, `color: #170327`, padding `1rem 2.5rem`. The rarest button — used once per page maximum.
- **Primary Hover:** `background: #e0a876`. Transition 0.2s.
- **Dawn:** `background: #3d5a6c`, `color: #f0ebe3`. Used on Reign-tier pages where amber would conflict with the page's cooler register.
- **Ghost:** `background: transparent`, `color: #f0ebe3`, `border: 1px solid dawn at 30% opacity`. Hover shifts border and text to amber.
- **Full-width variant:** `width: 100%`, `text-align: center`, padding-block `1.2rem`.

### Inputs / Fields

Inputs are deliberately invisible — underline only, no box, no background, no radius. The form disappears; only the answer remains.

- **Style:** `border: none; border-bottom: 1px solid bone at 9% opacity`. Transparent background.
- **Focus:** Border-bottom shifts to Dawn (on light) or Amber (on dark). No glow, no outline — just the color shift.
- **Label:** DM Sans 500, 0.62rem, letter-spacing 0.16em, uppercase. Muted opacity.
- **Placeholder:** Bone at 22% opacity. Never use full-opacity placeholder text.

### Navigation

Fixed, blurred, dawn-bordered. The nav is the one element that separates from the page.

- **Style:** `position: fixed`, `height: 68px`, `backdrop-filter: blur(16px)`, `background: night at 92% opacity`, `border-bottom: 1px solid dawn at 30% opacity`.
- **Logo:** SVG logotype, 80px height displayed in a 28px overflow-hidden container. The crop is intentional — the full mark is larger than the nav allows, creating vertical compression.
- **Navigation control:** Hamburger only (no inline nav links). Drawer pattern opens from left.

### Drawer

Full-height left panel with backdrop overlay.

- **Width:** 300px.
- **Background:** Night Surface.
- **Border:** Dawn at 30% opacity on the right edge.
- **Tier names inside drawer:** Cormorant SC 500, 1.3rem, letter-spacing 0.04em. The tier names are the biggest typographic element in the drawer.
- **Active state:** Amber on tier name and link color.

### Cards (Path Grid / Handle Grid)

Cards carry no border-radius, no shadow, no hover elevation. State change is background-only.

- **Corner Style:** Zero radius.
- **Background:** Night at rest; Night Surface on hover. Transition 0.25s.
- **Border:** The grid gap between cards is filled with `var(--border-d)` (Dawn at 30%) via `background` on the grid container and `gap: 1px` — a hairline grid of dawn-colored lines between cards.
- **Internal Padding:** `2.25–2.75rem`.
- **Hover:** Background lifts from Night to Night Surface. No transform, no shadow.

## 6. Do's and Don'ts

### Do:
- **Do** use Cormorant SC for all headings at every level. Never substitute another display serif, even temporarily.
- **Do** keep Amber to one primary CTA per section. Its value is scarcity.
- **Do** use the tonal Night system (night / night-surface / night-card) to create depth. Never add box-shadow to content cards.
- **Do** set letter-spacing to at least 0.02em on Cormorant SC headings at body-heading scale (≤3rem). Small caps close up at zero tracking.
- **Do** use DM Sans 300 for all body text. The thinness is load-bearing — it reads as functional restraint, not weakness.
- **Do** increase body line-height on dark backgrounds by 0.05–0.1 vs. light backgrounds. Light type on dark reads lighter; compensate.
- **Do** cap body line length at 62–68ch. No long lines regardless of viewport width.
- **Do** use `text-wrap: balance` on h1–h3, and `text-wrap: pretty` on long prose paragraphs.
- **Do** reserve Cormorant italic (non-SC) exclusively for pullquotes and blockquotes. It is the system's emotional register, not a style option.
- **Do** use reduced-motion alternatives for every animation. The brand can't be legible only to users without motion sensitivities.

### Don't:
- **Don't** use UFC/Bellator visual language: red/black combinations, grunge textures, aggression as aesthetic.
- **Don't** use Instagram-coaching program patterns: cheap gradients, bold yellow CTAs, testimonial carousels, before/after sliders.
- **Don't** use SaaS landing page templates: feature grids, metric hero sections (big number / small label / supporting stats), light mode with blue CTAs.
- **Don't** use editorial-magazine aesthetics: Klim-style drop caps, broadsheet grids, display serif at sentence-case in running text.
- **Don't** use fight-cliché imagery or language in the visual layer: octagon shapes, glove photography, "warrior" vocabulary.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on any card or callout. Use background tints or full borders instead.
- **Don't** use `background-clip: text` with gradient backgrounds. No gradient text. Ever.
- **Don't** use glassmorphism as a default treatment. `backdrop-filter: blur` exists in the system only on the navigation bar.
- **Don't** add a kicker label above every section heading. One or two sections without a kicker add rhythm. The pattern repeated without variation becomes scaffolding.
- **Don't** add border-radius to buttons, inputs, or cards. Zero radius is non-negotiable. Any rounding erodes the hard architectural character of the system.
- **Don't** set Cormorant SC at negative letter-spacing. Small caps close up and letters touch.
- **Don't** use Red Hat Display. It was the system's original heading choice and is now replaced. Any reversion to it is a regression.
