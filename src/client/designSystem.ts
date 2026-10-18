
import { FONT_FAMILY, FONT_WOFF2_BASE64 } from './fontAsset.ts'

const STYLE_ELEMENT_ID = 'dsh-rabbit-model-picker-design'

const FONT_FACE = `@font-face {
  font-family: ${JSON.stringify(FONT_FAMILY)};
  src: url(data:font/woff2;base64,${FONT_WOFF2_BASE64}) format('woff2');
  font-weight: 100 900;
  font-stretch: 62% 125%;
  font-style: normal;
  font-display: swap;
}`

// Two noise tiles, because one alpha cannot be right for both grounds. The light ground needs
// a more opaque speck to read at all (dark ink on near-white), the dark ground a softer one:
// a single 8% tile measured 9.2/255 amplitude in dark and 3.1/255 in light, i.e. two materials.
const GRAIN_LIGHT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.42 0 0 0 0 0.42 0 0 0 0 0.44 0 0 0 0.11 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23g)'/%3E%3C/svg%3E")`
const GRAIN_DARK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.62 0 0 0 0 0.62 0 0 0 0 0.66 0 0 0 0.075 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23g)'/%3E%3C/svg%3E")`

// Neutral-cool at equal lightness, so the plate sits inside DSH without pulling against it:
// the ramp keeps the host's slight blue cast but at the object's own values, and the only
// chroma on a surface is the host's information blue (selection, focus, "you are here").
const TOKENS = `:root {
  --zmd-font-latin: ${JSON.stringify(FONT_FAMILY)}, var(--dsh-font-family-text, var(--dsh-font-family-text-default, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif));

  --zmd-panel: #f8f8f7;
  --zmd-raised: #ffffff;
  --zmd-panel-deep: #efefee;
  --zmd-hover: #ececea;
  --zmd-line: #8d8d8a;
  --zmd-line-strong: #7e7e7b;
  --zmd-line-control: #787874;
  --zmd-ink: #0f0f10;
  --zmd-ink-secondary: #4c4c50;
  --zmd-ink-mute: #65656a;

  --zmd-wash-top: #fdfdfc;
  --zmd-wash-bottom: #f1f1ef;
  --zmd-grain-tile: ${GRAIN_LIGHT};

  --zmd-online: #2f7d4f;

  --zmd-ease: cubic-bezier(0.2, 0, 0, 1);
}

body[data-ds-dark-theme] {
  --zmd-panel: #161618;
  --zmd-raised: #1d1d20;
  --zmd-panel-deep: #101011;
  --zmd-hover: #202024;
  --zmd-line: #666670;
  --zmd-line-strong: #7b7b86;
  --zmd-line-control: #83838f;
  --zmd-ink: #f3f3f5;
  --zmd-ink-secondary: #b5b5bc;
  --zmd-ink-mute: #8e8e96;

  --zmd-wash-top: #1e1e21;
  --zmd-wash-bottom: #111113;
  --zmd-grain-tile: ${GRAIN_DARK};

  --zmd-online: #6bbf8a;
}

body {
  --zmd-accent: var(--dsw-alias-state-business-primary);
  --zmd-on-accent: var(--zmd-panel);
  --zmd-focus: var(--dsw-alias-state-business-primary);
  --zmd-danger: var(--dsw-alias-state-error-primary);
  --zmd-on-ink: var(--zmd-panel);
}`

// The shared vocabulary. Every surface composes these and adds nothing structural of its own;
// that is what keeps one plate, one rule and four action tiers the same everywhere.
const PRIMITIVES = `
.zmd-num {
  font-variant-numeric: tabular-nums;
}

.zmd-plate {
  position: relative;
  isolation: isolate;
  background-color: var(--zmd-panel);
  background-image:
    radial-gradient(135% 105% at 2% -18%, var(--zmd-wash-top) 0%, var(--zmd-panel) 52%, var(--zmd-wash-bottom) 100%);
}

.zmd-grain::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 1;
  background-image: var(--zmd-grain-tile);
  background-size: 120px 120px;
  background-repeat: repeat;
}

.zmd-runhead {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
}

.zmd-runhead > .zmd-rule {
  flex: 1 1 auto;
  min-width: 8px;
}

.zmd-rule {
  height: 1px;
  border: 0;
  background: var(--zmd-line);
}

.zmd-masthead {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.zmd-masthead-name {
  margin: 0;
  overflow: hidden;
  color: var(--zmd-ink);
  font-size: 24px;
  line-height: 32px;
  font-weight: 500;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zmd-masthead-meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  min-width: 0;
  color: var(--zmd-ink-secondary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.zmd-footing {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding-top: 8px;
  border-top: 1px solid var(--zmd-line);
  color: var(--zmd-ink-mute);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.zmd-footing-note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zmd-footing-keys {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.zmd-ordinal {
  flex: 0 0 auto;
  width: 26px;
  color: var(--zmd-ink-mute);
  font-size: 10px;
  line-height: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.zmd-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 0;
  background: var(--zmd-ink);
  color: var(--zmd-on-ink);
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  transition: background-color 120ms var(--zmd-ease), transform 80ms var(--zmd-ease);
}

.zmd-btn-primary:hover:not(:disabled) {
  background: var(--zmd-ink-secondary);
}

.zmd-btn-primary:active:not(:disabled) {
  transform: translateY(1px);
}

.zmd-btn-primary:disabled {
  background: var(--zmd-hover);
  color: var(--zmd-ink-mute);
  cursor: default;
}

.zmd-btn-door {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--zmd-line-control);
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 120ms var(--zmd-ease), border-color 120ms var(--zmd-ease), transform 80ms var(--zmd-ease);
}

.zmd-btn-door.zmd-btn-commit {
  height: 32px;
  padding: 0 16px;
  border-color: var(--zmd-ink);
  font-size: 14px;
  line-height: 20px;
}

.zmd-btn-door:hover:not(:disabled) {
  border-color: var(--zmd-ink-mute);
  background: var(--zmd-hover);
}

.zmd-btn-door:active:not(:disabled) {
  transform: translateY(1px);
}

/* An open door is stated by its edge, not its fill: a fill reads as a second commit on the
   row and hides the plate underneath it. */
.zmd-btn-door[aria-expanded='true'] {
  border-color: var(--zmd-ink);
  background: transparent;
}

.zmd-btn-door:disabled {
  border-color: var(--zmd-line);
  color: var(--zmd-ink-mute);
  cursor: default;
}

.zmd-btn-quiet {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 6px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 120ms var(--zmd-ease), color 120ms var(--zmd-ease), transform 80ms var(--zmd-ease);
}

.zmd-btn-quiet:hover:not(:disabled) {
  background: var(--zmd-hover);
}

.zmd-btn-quiet:active:not(:disabled) {
  transform: translateY(1px);
}

.zmd-btn-quiet:disabled {
  color: var(--zmd-ink-mute);
  cursor: default;
}

.zmd-btn-danger {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 6px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--zmd-danger);
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 120ms var(--zmd-ease), color 120ms var(--zmd-ease);
}

.zmd-btn-danger:hover:not(:disabled) {
  background: var(--zmd-hover);
  color: var(--zmd-danger);
}

.zmd-btn-danger:disabled {
  color: var(--zmd-ink-mute);
  cursor: default;
}

.zmd-field {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 2px;
  border: 0;
  border-bottom: 1px solid var(--zmd-line-control);
  border-radius: 0;
  background: transparent;
  color: var(--zmd-ink);
  font-family: var(--zmd-font-latin);
  font-size: 14px;
  line-height: 22px;
  font-variant-numeric: tabular-nums;
  transition: border-color 120ms var(--zmd-ease);
}

.zmd-field:focus,
.zmd-field:focus-visible {
  border-bottom-color: var(--zmd-accent);
  outline: 0;
}

.zmd-field::placeholder {
  color: var(--zmd-ink-mute);
}

.zmd-btn-primary:focus-visible,
.zmd-btn-door:focus-visible,
.zmd-btn-quiet:focus-visible,
.zmd-btn-danger:focus-visible {
  outline: 2px solid var(--zmd-focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .zmd-btn-primary,
  .zmd-btn-door,
  .zmd-btn-quiet,
  .zmd-btn-danger,
  .zmd-field {
    transition: none;
  }

  .zmd-btn-primary:active:not(:disabled),
  .zmd-btn-door:active:not(:disabled),
  .zmd-btn-quiet:active:not(:disabled) {
    transform: none;
  }
}
`

const CSS = `${FONT_FACE}

${TOKENS}

${PRIMITIVES}`

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

export const DESIGN_SYSTEM_STYLESHEET = CSS

export const LATIN_FACE_FAMILY = FONT_FAMILY
