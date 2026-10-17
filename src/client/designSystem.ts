/**
 * 墨色 design system: the `--zmd-*` token layer, the embedded Latin face, and
 * the two texture primitives (wash + grain).
 *
 * WHY A SEPARATE MODULE. The three surfaces (composer seat, 模型配置 page, catalog
 * region) live in three stylesheets injected by three components. Without one
 * owned token layer they would grow their own greys and drift. This module is
 * the ONLY place allowed to spell a colour literal; every sheet reads
 * `var(--zmd-*)`.
 *
 * THE DIRECTION IS MONOCHROME INK, NOT A HUD. The earlier direction in this
 * round (an "Endfield HUD") was rejected by the user: this is a software
 * surface, not a game console. What remains is ink on paper/ink: a neutral
 * near-black and a neutral paper, one hairline weight, quiet ordinals, a single
 * host-blue accent for the state that needs to be found, and a local wash +
 * grain so a surface reads as material rather than as a flat panel. The
 * language is specified in `docs/ink-design-language.md`.
 *
 * THEME SWITCHING IS THE HOST'S. DSH's theme plugin toggles the boolean
 * `data-ds-dark-theme` attribute on `<body>` (ui-theme `boot-theme`), so the
 * dark overrides below are attribute selectors on that body, not a JS listener
 * and not `prefers-color-scheme` (a user can pick light while the OS is dark).
 *
 * THE FACE travels as a base64 woff2 data URI: a DSH client plugin ships one
 * browser module and no asset server, and the embedded payload keeps the
 * plugin network-free. Regenerate with `node scripts/build-font-asset.mjs`;
 * provenance and the OFL notice live in `fontAsset.ts` and
 * `docs/fonts/Archivo-OFL.txt`.
 *
 * @module dsh-rabbit-model-picker/client/designSystem
 */

import { FONT_FAMILY, FONT_WOFF2_BASE64 } from './fontAsset.ts'

/** Id of the owned style element (stable, so re-activation replaces it). */
const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-design'

const FONT_FACE = `@font-face {
  font-family: ${JSON.stringify(FONT_FAMILY)};
  src: url(data:font/woff2;base64,${FONT_WOFF2_BASE64}) format('woff2');
  font-weight: 100 900;
  font-stretch: 62% 125%;
  font-style: normal;
  font-display: swap;
}`

/**
 * The token layer. Light is the default; the dark block re-points the same
 * semantic names. Every value here appears in the design-language table with
 * its measured contrast. The accent and error roles point at the HOST's own
 * tokens on purpose: the surface should not import a second palette.
 */
const TOKENS = `:root {
  --zmd-font-latin: ${JSON.stringify(FONT_FAMILY)}, var(--dsh-font-family-text, var(--dsh-font-family-text-default, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif));

  /* paper / ink / line (neutral; no warm cast) */
  --zmd-panel: #f6f6f4;
  --zmd-panel-deep: #ededeb;
  --zmd-hover: #e7e7e4;
  --zmd-line: #d8d8d4;
  --zmd-line-strong: #b4b4ae;
  --zmd-line-control: #82827c;
  --zmd-ink: #141414;
  --zmd-ink-secondary: #4c4c48;
  --zmd-ink-mute: #66665f;

  /* the wash: two tonal ends of the same surface + grain tint */
  --zmd-wash-top: #fbfbfa;
  --zmd-wash-bottom: #f0f0ed;

  /* functional state colours that are NOT host aliases (graphics only) */
  --zmd-online: #2f7d4f;

  --zmd-ease: cubic-bezier(0.2, 0, 0, 1);
}

body[data-ds-dark-theme] {
  --zmd-panel: #1a1a1a;
  --zmd-panel-deep: #121212;
  --zmd-hover: #242424;
  --zmd-line: #333330;
  --zmd-line-strong: #5a5a56;
  --zmd-line-control: #85857e;
  --zmd-ink: #f1f1ee;
  --zmd-ink-secondary: #b6b6b1;
  --zmd-ink-mute: #8b8b86;

  --zmd-wash-top: #222222;
  --zmd-wash-bottom: #161616;

  --zmd-online: #6bbf8a;
}

/* HOST-TOKEN ALIASES MUST BE DECLARED ON <body>, NOT :root.
   DSH defines its --dsw-* palette on <body> (light) and
   <body[data-ds-dark-theme]> (dark). A custom property's var() is substituted on
   the element that DECLARES it, so an alias declared on :root resolves against
   :root's own (empty) host tokens and becomes guaranteed-invalid — it then
   inherits as an empty value and every accent/border/ring painted from it
   disappears. Declared here, one block serves both themes: on the dark body the
   host tokens are re-pointed by the host's own rule, so the alias computes to
   the dark blue with no duplicate declaration. */
body {
  --zmd-accent: var(--dsw-alias-state-business-primary);
  --zmd-on-accent: var(--zmd-panel);
  --zmd-focus: var(--dsw-alias-state-business-primary);
  --zmd-danger: var(--dsw-alias-state-error-primary);
}`

/**
 * The shared primitives.
 *
 * `zmd-num` — tabular figures, because counts and durations must not jitter.
 * `zmd-rule` — the one hairline used as structure (a divider, not a control).
 * `zmd-wash` — the local ink wash: a low-contrast tonal gradient across ONE
 *   surface. It never carries text contrast on its own; every painted word is
 *   measured against both ends of the wash by `check-contrast.mjs`.
 * `zmd-grain` — a 120px tiling fractal-noise tile at ~5% alpha, mid-grey so it
 *   reads as material on both paper and ink. It is an ::after overlay with
 *   `pointer-events: none`; it carries no text and no state.
 */
const PRIMITIVES = `/* Tabular figures for counts, durations and identifiers. */
.zmd-num {
  font-variant-numeric: tabular-nums;
}

/* A structural hairline. */
.zmd-rule {
  height: 1px;
  border: 0;
  background: var(--zmd-line);
}

/* Local ink wash. One surface, one direction; low contrast, never text. */
.zmd-wash {
  background-color: var(--zmd-panel);
  background-image:
    radial-gradient(120% 96% at 4% 0%, var(--zmd-wash-top) 0%, var(--zmd-panel) 58%, var(--zmd-wash-bottom) 100%);
}

/* The grain overlay. A mid-grey fractal noise baked into the SVG's own alpha,
   so it needs no opacity property (the sheet's "no opacity" rule still holds). */
.zmd-grain {
  position: relative;
}

.zmd-grain::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23g)'/%3E%3C/svg%3E");
  background-size: 120px 120px;
  background-repeat: repeat;
}

/* Grain is decoration: motion users still get it, reduced-motion has nothing to
   disable here. Text above it sits on its own layer (surfaces set z-index). */`

/** The whole design-system sheet: the face, then the token layer, then the primitives. */
const CSS = `${FONT_FACE}

${TOKENS}

${PRIMITIVES}`

/**
 * Inject the design-system sheet once per activation.
 *
 * Replaces any previous element with the same id, so hot reload leaves exactly
 * one. Idempotent by construction — the page and the catalog may call it too,
 * and the last call still leaves one element.
 * @returns the disposer that removes this activation's element.
 */
export function injectDesignSystem(): () => void {
  if (typeof document === 'undefined') return () => {}
  document.getElementById(STYLE_ELEMENT_ID)?.remove()
  const element = document.createElement('style')
  element.id = STYLE_ELEMENT_ID
  element.textContent = CSS
  document.head.append(element)
  return () => {
    if (element.isConnected) element.remove()
  }
}

/** The sheet text, exported for the static selfcheck and the static fixtures. */
export const DESIGN_SYSTEM_STYLESHEET = CSS

/** The declared family name, exported for fixtures and gates. */
export const LATIN_FACE_FAMILY = FONT_FAMILY
