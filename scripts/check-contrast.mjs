/**
 * Text-contrast gate for this plugin's own copy, measured against the host's
 * real palette in BOTH themes.
 *
 * The plugin may not hard-code a color (the static selfcheck enforces that), so
 * its readability is entirely a question of WHICH semantic token it picks. That
 * made one mistake both easy and invisible: `.dmp-settings-hint` and friends
 * used `--dsw-alias-label-caption`, which is fine on the host's own surfaces but
 * measures 2.08:1 over this card's composited fill in the light theme — the
 * explanatory lines of the parameter panel ("尚未声明，当前跟随适配器默认：文字、图片")
 * failed WCAG AA for their size, in both themes, and no screenshot review caught
 * it because 2.08:1 still LOOKS like a deliberate quiet grey.
 *
 * So this gate reads the installed theme's token sheet, resolves `var()` chains,
 * alpha-composites the menu surface over the page base, and asserts a minimum
 * ratio per painted style. The token values live in the host, so the numbers
 * move when DSH moves; the FLOOR is ours.
 *
 * Run: node scripts/check-contrast.mjs
 *
 * @module dsh-rabbit-model-picker/check-contrast
 */

import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Where the host's token sheet lives, most specific first. */
const THEME_CANDIDATES = [
  process.env.DSH_INSTALL_DIR === undefined
    ? null
    : join(process.env.DSH_INSTALL_DIR, 'node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js'),
  join(
    process.env.APPDATA ?? '',
    'npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js',
  ),
]

/** WCAG AA for body-size text. */
const AA_NORMAL = 4.5
/** WCAG AA for large text: >=24px, or >=18.66px at 700+. */
const AA_LARGE = 3

let failures = 0

/**
 * Record one assertion.
 * @param label - what is being asserted.
 * @param ok - whether it held.
 * @param detail - evidence printed on failure.
 */
function check(label, ok, detail) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — ${JSON.stringify(detail)}`}`)
  if (!ok) failures += 1
}

/** Locate the installed theme bundle, or null when DSH is not where we expect. */
function themeFile() {
  for (const candidate of THEME_CANDIDATES) {
    if (candidate !== null && existsSync(candidate)) return candidate
  }
  return null
}

/**
 * The committed token fixture, used when no host is installed (CI).
 *
 * The gate's job is measuring this plugin's ink against the host palette, and
 * that palette normally only exists inside an installed DSH — so on CI the gate
 * used to print `skip` and exit 0, a green tick that had measured nothing while
 * the README advertised it as the proof that every painted word clears AA.
 * Falling back to a committed snapshot of the exact tokens the gate resolves
 * makes the measurement real everywhere; a local run with DSH installed still
 * reads the LIVE sheet, so a host upgrade that moves the palette is still caught
 * by whoever has the host. Regenerate with `node scripts/_dump-theme-fixture.mjs`.
 * @returns the two palettes, or null when the fixture is missing too.
 */
function fixturePalettes() {
  const path = resolve(root, 'scripts/theme-tokens.json')
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * Parse one theme's `--dsw-*` values out of the bundled token sheet.
 *
 * The sheet is a single CSS string: the light palette under `body{…}`, the dark
 * one under `body[data-ds-dark-theme]{…}`, both possibly repeated in later
 * blocks (menu-mate overrides and the like), so later blocks win.
 * @param source - the theme bundle's text.
 * @returns both palettes.
 */
function palettes(source) {
  const anchor = source.indexOf('--dsw-static-amber-100')
  if (anchor < 0) throw new Error('theme bundle: token sheet not found')
  const start = source.lastIndexOf('"', anchor - 1) + 1
  const end = source.indexOf('"', source.indexOf('--shiki', anchor))
  const sheet = source.slice(start, end).replace(/\\n/g, '\n').replace(/\\"/g, '"')

  const bags = { light: {}, dark: {} }
  for (const match of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const target = match[1].includes('data-ds-dark-theme') ? bags.dark : bags.light
    for (const declaration of match[2].split(';')) {
      const colon = declaration.indexOf(':')
      if (colon < 0) continue
      const name = declaration.slice(0, colon).trim()
      if (name.startsWith('--')) target[name] = declaration.slice(colon + 1).trim()
    }
  }
  return bags
}

/**
 * Parse `#rgb` / `#rrggbb` / `#rrggbbaa` into `[r, g, b, a]`.
 * @param text - the color text.
 * @returns the channels, or null when the text is not a hex color.
 */
function parseColor(text) {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(text.trim())
  if (hex === null) return null
  let digits = hex[1]
  if (digits.length === 3) digits = digits.split('').map(c => c + c).join('')
  if (digits.length === 6) digits += 'ff'
  if (digits.length !== 8) return null
  return [
    parseInt(digits.slice(0, 2), 16),
    parseInt(digits.slice(2, 4), 16),
    parseInt(digits.slice(4, 6), 16),
    parseInt(digits.slice(6, 8), 16) / 255,
  ]
}

/**
 * Resolve a token to an sRGB color through `var()` chains.
 * @param bag - one theme's token values.
 * @param name - the token name.
 * @param depth - recursion guard.
 * @returns the color, or null when the token is absent or not a hex color.
 */
function resolveToken(bag, name, depth = 0) {
  if (depth > 12) return null
  const value = bag[name]
  if (value === undefined) return null
  const reference = /^var\((--[^,)]+)(?:,\s*(.+))?\)$/.exec(value.trim())
  if (reference === null) return parseColor(value)
  return resolveToken(bag, reference[1], depth + 1)
}

/**
 * Composite a possibly translucent color over an opaque one.
 * @param fg - the top color.
 * @param bg - the opaque background.
 * @returns the opaque result.
 */
function over(fg, bg) {
  return [0, 1, 2].map(channel => Math.round(fg[channel] * fg[3] + bg[channel] * (1 - fg[3])))
}

/**
 * WCAG relative luminance.
 * @param rgb - an opaque color.
 * @returns the luminance.
 */
function luminance(rgb) {
  const [r, g, b] = rgb.map(value => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * WCAG contrast ratio.
 * @param a - an opaque color.
 * @param b - an opaque color.
 * @returns the ratio.
 */
function contrast(a, b) {
  const first = luminance(a)
  const second = luminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

/**
 * The backgrounds a card can actually sit on.
 *
 * The panel and the two menus are `MenuSurface` cards, so their fill is
 * `--dsw-menu-surface-fill`; but that fill is translucent, so what matters is
 * what is UNDER it. The panel opens off the gear, which lives in the composer
 * card (`--dsw-specific-input-major`), and the menus open inside the same
 * column — so the base page is NOT the only backdrop, and in the dark theme it
 * is not the darkest one either. Both are measured:
 *
 *   dark   fill over --dsw-static-neutral-bluish-850 (composer) -> the darker card
 *   dark   fill over --dsw-alias-bg-base                          -> a lighter card
 *
 * Judging against the page base alone is how a "4.30:1" becomes 3.60:1 in the
 * theme nobody re-checked.
 * @param bag - one theme's token values.
 * @returns the candidate opaque backgrounds.
 */
function cardBackgrounds(bag) {
  const fill = resolveToken(bag, '--dsw-menu-surface-fill')
  return ['--dsw-alias-bg-base', '--dsw-specific-input-major']
    .map(token => resolveToken(bag, token))
    .filter(page => page !== null)
    .map(page => over(fill, page))
}

// Every text style the plugin paints. Neither the token NOR the floor is listed
// here: both are read from the sheet itself (`inkOf` reads the `color`
// declaration, `floorFor` reads the size and weight). That is what gives this
// gate teeth — pointing `.dmp-settings-hint` at another token changes what is
// measured instead of slipping past a hard-coded expectation.
const STYLES = [
  { selector: '.dmp-trigger', note: 'trigger label: provider/model and the effort' },
  { selector: '.dmp-rail-name', note: 'provider name on the rail' },
  { selector: '.dmp-settings-title', note: 'panel model name' },
  { selector: '.dmp-settings-name', note: 'switch row label' },
  { selector: '.dmp-settings-reset', note: 'restore-defaults button' },
  { selector: '.dmp-settings-label', note: 'section label' },
  { selector: '.dmp-settings-hint', note: 'section hint' },
  { selector: '.dmp-settings-notice', note: 'panel state line' },
  { selector: '.dmp-settings-note', note: 'panel footer note' },
  { selector: '.dmp-settings-target', note: 'write-location footer' },
  { selector: '.dmp-settings-input input', note: 'context field value' },
  { selector: '.dmp-settings-input input::placeholder', note: 'context placeholder' },
  { selector: '.dmp-effort-item', note: 'effort choice' },
  { selector: '.dmp-filter-hint', note: 'provider filter strip' },
  { selector: '.dmp-row-name', note: 'model row name' },
  { selector: '.dmp-badge-value', note: 'badge value, 11px from the Tag primitive' },
  { selector: '.dmp-legend', note: 'key to the fact columns' },
  { selector: '.dmp-legend-word', note: 'one word of that key' },
  { selector: '.dmp-search-row .dmp-search input::placeholder', note: 'search hint' },
  { selector: '[data-menu-group-heading]', note: 'provider landmark, host-painted element' },
  { selector: '.dmp-settings-alert', note: 'Host refusal' },
]
/** Painted by a host primitive rather than by this sheet, so there is no size to derive. */
const PRIMITIVE_SIZED = new Set(['.dmp-badge-value', '.dmp-settings-input input::placeholder'])
/** The sizes those primitive-painted styles render at (the Tag capsule's value, the Input's own). */
const PRIMITIVE_SIZE = { size: 11, weight: 400 }

// The plugin's own sheet must name these tokens; a style that drifts onto a
// caption/dimmed token is caught statically below as well, so a renamed class
// cannot slip past this gate by no longer being listed here.
//
// Only the CSS TEMPLATE is parsed: the module around it is TypeScript, and a
// stray `{ … }` there (or a class name in a string literal) must not be read as
// a rule. Comments are stripped too — this sheet is heavily annotated and a
// `/*…*/` between two rules would otherwise be read as part of the next
// selector, which is exactly the kind of silent miss this gate exists to avoid.
const stylesSheet = readFileSync(resolve(root, 'src/client/styles.ts'), 'utf8')
const template = /const CSS = `([\s\S]*?)`\s*$|const CSS = `([\s\S]*?)`\n/m.exec(stylesSheet)
const styleRules = (template?.[1] ?? template?.[2] ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
if (styleRules.trim() === '') {
  console.log('  FAIL contrast: the sheet could not be read out of styles.ts')
  failures += 1
}

/**
 * Read one declaration out of the rule that paints a selector in the plugin's
 * own sheet.
 *
 * Selectors here are often grouped (`.dmp-status,\n.dmp-empty { … }`) or
 * descendant (`.dmp-settings-input input::placeholder { … }`), and a style can
 * be painted by a later rule than the first one naming it, so every rule whose
 * selector list contains the given selector is considered and the LAST one with
 * the property wins — the same way the cascade would.
 * @param selector - the selector to look up, e.g. `.dmp-settings-alert`.
 * @param property - the CSS property, e.g. `font-size`.
 * @returns the declaration's value, or null.
 */
function declarationOf(selector, property) {
  let found = null
  const name = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const declaration = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`)
  for (const rule of styleRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = rule[1].split(',').map(part => part.trim())
    // A declaration applies when the rule's selector IS this one, or when it
    // names it as a compound member or a descendant — `.dmp-badges .dmp-badge`
    // sets the badge's own size, and `.dmp-status, .dmp-empty` sets the
    // chip's. Splitting on whitespace only: a pseudo-class selector
    // (`.dmp-trigger:disabled`) must NOT count as `.dmp-trigger`'s own
    // declaration, or every disabled state would overwrite the base ink.
    const applies = selectors.some(part =>
      part === selector || part.split(/\s+/).includes(selector))
    if (!applies) continue
    const value = declaration.exec(rule[2])
    if (value !== null) found = value[1].trim()
  }
  return found
}

/**
 * The WCAG AA floor that actually applies to one style, derived from the size
 * and weight it renders at — not from a flag in this file. WCAG counts text as
 * "large" at >=24px, or >=18.66px when bold (>=700); anything smaller owes
 * 4.5:1.
 *
 * A state rule that only changes `color` (`.dmp-settings-button[data-edited]`) or a
 * pseudo-element inherits its size from the base rule, so when the selector
 * itself states none, the base selector and then the ancestor selectors are
 * consulted — the way the cascade would resolve it.
 * @param selector - the selector to judge.
 * @returns the floor, and the size/weight it was derived from.
 */
function floorFor(selector) {
  const candidates = [selector]
  const stateRule = selector.replace(/\[[^\]]*\]|::?[a-z-]+(\([^)]*\))?/g, '')
  if (stateRule !== selector) candidates.push(stateRule)
  const bare = stateRule.replace(/\s+/g, ' ').trim()
  for (let current = bare; current.includes(' ');) {
    current = current.slice(0, current.lastIndexOf(' ')).trim()
    if (current !== '') candidates.push(current)
  }
  // Then outwards through the card's own tree: a class can state its size on a
  // rule that names its container (`.dmp-badges .dmp-badge`) or on an ancestor
  // rule (`.dmp-menu`), and neither is a descendant selector of this one.
  for (let ancestor = CONTAINERS[bare] ?? null; ancestor !== null && ancestor !== undefined;) {
    candidates.push(ancestor)
    ancestor = CONTAINERS[ancestor] ?? null
  }
  let sizeText = null
  let weightText = null
  for (const candidate of candidates) {
    sizeText ??= declarationOf(candidate, 'font-size')
    weightText ??= declarationOf(candidate, 'font-weight')
  }
  const size = sizeText === null ? NaN : Number.parseFloat(sizeText)
  const weight = weightText === null ? 400 : Number.parseFloat(weightText)
  const large = Number.isFinite(size) && (size >= 24 || (size >= 18.66 && weight >= 700))
  return { floor: large ? AA_LARGE : AA_NORMAL, size, weight, inherited: candidates[0] !== selector }
}

/**
 * The token a style paints its text with, read from the sheet's own `color`
 * declaration — so the thing measured is the thing shipped.
 * @param selector - the selector to look up.
 * @returns the `--dsw-*` token name, or null when the rule paints no color.
 */
function inkOf(selector) {
  const value = declarationOf(selector, 'color')
  if (value === null) return null
  return /^var\((--dsw-[a-z0-9-]+)\)$/.exec(value)?.[1] ?? null
}

/**
 * Where each class sits inside the card, so an ink that is inherited can be
 * resolved.
 *
 * Rules like `.dmp-row-name { color: inherit }` and `.dmp-row { color: inherit }`
 * take the ink of the card, which is stated once on `.dmp-menu`. The sheet
 * cannot express containment (there is no nesting), so the shape of the tree is
 * declared here — chain by chain, from the outside in. A class missing from this
 * map simply has no inheritable ink to find, which is what the check reports.
 */
const CONTAINERS = {
  '.dmp-menu': null,
  // The two panes of the model card (§5.25). The rail's own chain has to be
  // declared like any other: a class missing from this map has no ink to find,
  // and the sweep would skip its rule instead of judging it.
  '.dmp-rail': '.dmp-menu',
  '.dmp-rail-row': '.dmp-rail',
  '.dmp-rail-copy': '.dmp-rail-row',
  '.dmp-rail-name': '.dmp-rail-copy',
  '.dmp-models': '.dmp-menu',
  '.dmp-groups': '.dmp-menu',
  '.dmp-row': '.dmp-groups',
  '.dmp-row-copy': '.dmp-row',
  '.dmp-row-name': '.dmp-row-copy',
  '.dmp-badges': '.dmp-row',
  '.dmp-badge': '.dmp-badges',
  '.dmp-badge-fact': '.dmp-badge',
  '.dmp-badge-icon': '.dmp-badge',
  '.dmp-badge-value': '.dmp-badge',
  '.dmp-check': '.dmp-row',
  '.dmp-effort-list': '.dmp-settings-body',
  '.dmp-effort-item': '.dmp-effort-list',
  '.dmp-effort-name': '.dmp-effort-item',
  '.dmp-effort-check': '.dmp-effort-item',
  '.dmp-settings-body': '.dmp-menu',
  '.dmp-settings-head': '.dmp-menu',
  '.dmp-settings-title': '.dmp-settings-head',
  '.dmp-settings-reset': '.dmp-settings-head',
  '.dmp-settings-open': '.dmp-settings-head',
  // The gear and the two chips live in the seat, outside the card.
  '.dmp-settings-button': null,
  '.dmp-trigger': null,
  // The effort tail is a span inside the trigger button; it states its own ink
  // (so the sweep must size it) and inherits the chip's 13px/400 from here.
  '.dmp-trigger-effort': '.dmp-trigger',
  '.dmp-settings-section': '.dmp-settings-body',
  '.dmp-settings-row': '.dmp-settings-section',
  '.dmp-settings-label': '.dmp-settings-section',
  '.dmp-settings-name': '.dmp-settings-row',
  '.dmp-settings-hint': '.dmp-settings-section',
  '.dmp-settings-target': '.dmp-settings-body',
  '.dmp-settings-note': '.dmp-settings-body',
  '.dmp-settings-alert': '.dmp-menu',
  '.dmp-settings-alert-icon': '.dmp-settings-alert',
  '.dmp-settings-notice': '.dmp-menu',
  '.dmp-status': '.dmp-menu',
  '.dmp-empty': '.dmp-menu',
  '.dmp-error': '.dmp-menu',
  '.dmp-error-icon': '.dmp-error',
  '.dmp-warning': '.dmp-menu',
  '.dmp-filter-hint': '.dmp-menu',
  '.dmp-filter-clear': '.dmp-filter-hint',
  '.dmp-provider-count': '.dmp-menu',
  '.dmp-provider-failed': '.dmp-menu',
  '.dmp-provider-failed-dot': '.dmp-provider-failed',
  '.dmp-search-row': '.dmp-menu',
  '.dmp-search-clear': '.dmp-search-row',
  '.dmp-legend': '.dmp-menu',
  '.dmp-legend-item': '.dmp-legend',
  '.dmp-legend-icon': '.dmp-legend-item',
  '.dmp-legend-word': '.dmp-legend-item',
}

/**
 * The token a selector actually paints its text with, following the cascade.
 *
 * A rule may state `color: var(--…)`, or `color: inherit` (or state no color at
 * all) and render in an ancestor's ink, so the chain in {@link CONTAINERS} is
 * walked outwards.
 * @param selector - the selector to look up.
 * @returns the effective `--dsw-*` token name, or null when none is found.
 */
function effectiveInk(selector) {
  const declared = declarationOf(selector, 'color')
  const direct = declared === null ? null : /var\((--dsw-[a-z0-9-]+)\)/.exec(declared)?.[1] ?? null
  if (direct !== null) return direct
  // A literal (non-token) color that is not `inherit` is a real paint we cannot
  // judge against the host palette; report it as unresolved rather than guessing.
  if (declared !== null && !/^inherit$/.test(declared)) return null

  const bare = selector
    .replace(/\[[^\]]*\]/g, '')
    .replace(/::?[a-z-]+(\([^)]*\))?/g, '')
    .replace(/:(?:hover|focus-visible|disabled|not\([^)]*\))/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  for (let ancestor = CONTAINERS[bare] ?? null; ancestor !== null && ancestor !== undefined;) {
    const inherited = inkOf(ancestor)
    if (inherited !== null) return inherited
    ancestor = CONTAINERS[ancestor] ?? null
  }
  return null
}

// The host sheet is preferred so a host upgrade that moves the palette is caught
// by whoever has the host installed; the committed fixture is what makes CI (and
// any machine without DSH) measure the same thing instead of printing a skip.
const theme = themeFile()
const bags = theme === null
  ? fixturePalettes()
  : palettes(readFileSync(theme, 'utf8'))

if (bags === null) {
  // Neither source exists: nothing was measured, so this must not read as a pass.
  // It is counted as a FAILURE rather than by setting `process.exitCode` here,
  // because the footer assigns that variable unconditionally — an early
  // assignment would be silently overwritten by `failures === 0`, which is
  // exactly the "prints a warning, still exits 0" defect this branch exists to
  // prevent.
  console.error('contrast: no DSH install and no scripts/theme-tokens.json — nothing measured')
  failures += 1
} else {
  if (theme === null) {
    console.log('  note contrast: no DSH install; measuring against scripts/theme-tokens.json')
  }

  // --- 1. the sheet must actually paint what this gate measures ------------
  for (const style of STYLES) {
    if (style.selector.startsWith('.dmp-settings-input input::')) continue
    const base = style.selector.replace(/::?placeholder$/, '')
    if (!styleRules.includes(base)) {
      check(`contrast: ${style.selector} exists in the sheet`, false, { selector: style.selector })
    }
  }

  // --- 2. measured contrast per theme --------------------------------------
  const measured = []
  for (const style of STYLES) {
    const token = effectiveInk(style.selector)
    if (token === null) {
      check(`contrast: ${style.selector} paints a --dsw-* color`, false, { selector: style.selector })
      continue
    }
    const { floor, size, weight } = floorFor(style.selector)
    // Text a host primitive paints for us (the Tag capsule's 11px value, the
    // Input's own placeholder) has no size in this sheet; those are body-size,
    // so the AA body floor is the honest one.
    const judged = PRIMITIVE_SIZED.has(style.selector)
      ? { floor: AA_NORMAL, size: 11, weight: 400 }
      : { floor, size, weight }
    if (!Number.isFinite(judged.size)) {
      check(`contrast: ${style.selector} states a font-size to judge`, false, { selector: style.selector })
      continue
    }
    for (const which of ['light', 'dark']) {
      const bag = bags[which]
      const ink = resolveToken(bag, token)
      if (ink === null) {
        check(`contrast: ${token} resolves in the ${which} theme`, false, { token })
        continue
      }
      // Judged against the WORST backdrop the card can sit on, so the verdict
      // does not depend on which surface the panel happens to float over.
      const ratios = cardBackgrounds(bag).map(background => contrast(over(ink, background), background))
      measured.push({ style, which, ratio: Math.min(...ratios), token, ...judged })
    }
  }
  const failing = measured.filter(entry => entry.ratio < entry.floor)
  check(
    'contrast: every painted text style clears its WCAG AA floor in both themes',
    failing.length === 0,
    failing.map(entry => ({
      selector: entry.style.selector,
      theme: entry.which,
      token: entry.token,
      painted: `${entry.size}px/${entry.weight}`,
      ratio: `${entry.ratio.toFixed(2)}:1`,
      floor: `${entry.floor}:1`,
    })),
  )

  // --- 3. report the tightest lines, so the headroom is visible -------------
  const worst = [...measured].sort((a, b) => a.ratio - b.ratio).slice(0, 4)
  for (const entry of worst) {
    console.log(`  info tightest: ${entry.style.selector} (${entry.which}) ${entry.ratio.toFixed(2)}:1`)
  }

  // --- 4. sweep every rule the sheet paints text in ------------------------
  // The list above can only judge what someone remembered to list. This sweep is
  // the net underneath it, and it is deliberately shaped like the sheet rather
  // than like the list: it walks EVERY text rule, splits grouped selectors,
  // resolves the ink through the cascade and the size through inheritance, and
  // refuses to let "I could not tell how big this is" read as "this is fine".
  //
  // Two earlier versions of this sweep were defeated by an adversarial review:
  // one skipped a rule whose `font-size` lived in a sibling rule of a grouped
  // selector (`.dmp-status, .dmp-empty`), the other looked a whole selector
  // list up as a single string and matched nothing at all. Both shapes are
  // normal in this sheet, so both are handled here.
  //
  // Deliberate exemptions, each one named, each one argued where it is painted,
  // and each one narrow enough that it cannot cover a neighbouring text rule:
  //   - an inactive control (WCAG exempts those; the host's own dimmed token is
  //     what every disabled surface in this shell uses);
  //   - an ICON slot — the gear, the chevrons, the badge glyph, the two warning
  //     glyphs, the check marks, the failure dot — which states no copy of its
  //     own (the adjacent badge value carries the fact in text, and a failure's
  //     words are painted separately).
  // A rule the exemptions do not cover and that this gate cannot size is
  // REPORTED rather than passed over.
  const EXEMPT = (selector, token) =>
    (token === '--dsw-alias-label-dimmed' || /:disabled|\[aria-disabled/.test(selector))
    || /^\.dmp-[a-z-]*(?:icon|check|dot)(?:[\s:\[]|$)/.test(selector)
    || /^\.dmp-[a-z-]*\[[^\]]*\][^,]*\.dmp-[a-z-]*(?:icon|check|dot)/.test(selector)
    || /^\.dmp-(?:settings-button|chevron)(?:[\s:\[]|$)/.test(selector)
  const sweep = []
  const unsized = []
  for (const rule of styleRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const token = /(?:^|;)\s*color\s*:\s*var\((--dsw-[a-z0-9-]+)\)/.exec(rule[2])?.[1] ?? null
    for (const selector of rule[1].split(',').map(part => part.trim()).filter(part => part !== '')) {
      if (EXEMPT(selector, token)) continue
      const { floor, size, weight } = floorFor(selector)
      if (!Number.isFinite(size)) {
        // The badge's value and the field's placeholder are painted by the host
        // primitives, which own their size; those are judged at body size.
        if (PRIMITIVE_SIZED.has(selector)) continue
        // A selector that only sets `color` on a CONTROL (the gear's states, the
        // two clear buttons) or on the card itself paints no text of its own, so
        // there is no size to find and nothing to report. Everything else that
        // paints a colour and cannot be sized is reported.
        const paintsNoText = /^\.dmp-(?:menu|settings-button|settings-open|search-clear|filter-clear)\b/.test(selector)
        const declared = declarationOf(selector, 'color')
        if (!paintsNoText && token !== null && declared !== null) unsized.push(selector)
        continue
      }
      const ink = token ?? effectiveInk(selector)
      if (ink === null) continue
      const judged = PRIMITIVE_SIZED.has(selector)
        ? { floor: AA_NORMAL, ...PRIMITIVE_SIZE }
        : { floor, size, weight }
      const ratios = {}
      for (const which of ['light', 'dark']) {
        const color = resolveToken(bags[which], ink)
        const onBackdrops = color === null
          ? [null]
          : cardBackgrounds(bags[which]).map(background => contrast(over(color, background), background))
        ratios[which] = onBackdrops.some(ratio => ratio === null) ? null : Math.min(...onBackdrops)
      }
      sweep.push({ selector, token: ink, ...judged, ratios })
    }
  }
  check(
    'contrast: every rule that paints text can be sized (nothing silently skipped)',
    unsized.length === 0,
    { unsized: [...new Set(unsized)] },
  )
  const unswept = sweep.filter(entry =>
    Object.values(entry.ratios).some(ratio => ratio === null || ratio < entry.floor - 1e-9))
  check(
    'contrast: every rule that paints text clears AA (no style left on the caption ink)',
    unswept.length === 0,
    unswept.map(entry => ({
      selector: entry.selector,
      token: entry.token,
      painted: `${entry.size}px/${entry.weight}`,
      light: entry.ratios.light?.toFixed(2),
      dark: entry.ratios.dark?.toFixed(2),
      floor: entry.floor,
    })),
  )
}

console.log(failures === 0 ? 'contrast check: all good' : `contrast check: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
