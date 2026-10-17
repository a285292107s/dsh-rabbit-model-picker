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
 * WHICH SHEETS IT READS. All three of the plugin's sheets, not just the seat's:
 * `styles.ts` (`dmp-`), `modelConfigStyles.ts` (the 模型配置 page, `dmc-`) and
 * `catalogStyles.ts` (that page's inline catalog region, also `dmc-`). Before this gate was
 * widened, the two `dmc-` sheets were read by NO contrast measurement at all —
 * their copy had never been measured in either theme, which is the exact class of
 * gap this file exists to close.
 *
 * WHAT "MEASURED" MEANS FOR A `dmc-` RULE. Registering the styles by hand cannot
 * be the whole answer, because a hand list only judges what someone remembered to
 * add. So the sweep below walks every rule in every sheet, and for the `dmc-`
 * domain it is closed by name: a selector that paints a `color` or states a
 * `font-size` must appear in the measured set, or it is REPORTED. The only way
 * out is a named exemption (an inactive control), which is narrow enough that it
 * cannot cover a neighbouring text rule.
 *
 * THE GRAPHIC-ONLY TOKENS STAY OUT OF THE TEXT ROLE. `--dsw-alias-state-*` and
 * the three label tiers (`tertiary` / `caption` / `dimmed`) are marks — a rail, a
 * bar, a focus ring, a field edge — never ink, so none of them is registered as a
 * text style and one appearing in a `color:` declaration of a `dmc-` sheet is a
 * failure in its own right.
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

  // --- the 模型配置 page (`dmc-`, modelConfigStyles.ts) ----------------------
  // Registered one by one rather than left to the sweep, because the brief asks
  // for the registry and because a listed style whose ink changes is re-measured
  // instead of silently disappearing. The sweep below is what proves this list is
  // COMPLETE.
  // `.dmc-title` is deliberately NOT here: the visible `<h2>` was retired (§16/V2)
  // and its name now travels on the section's `aria-label`, which paints nothing.
  // Leaving the selector registered made this gate FAIL once the sheet dropped it —
  // which is the registry doing its job, and the reason the entry is deleted rather
  // than tolerated. A selector that comes BACK is caught by the static selfcheck's
  // retired-class list, not here.
  { selector: '.dmc-readout', note: 'ready statement, the page\'s one loud line' },
  { selector: '.dmc-empty', note: 'first-run hint' },
  { selector: '.dmc-notice', note: 'page state line' },
  { selector: '.dmc-notice-action', note: 'the action inside that line' },
  { selector: '.dmc-alert', note: 'read-only refusal sentence' },
  { selector: '.dmc-add', note: 'the page\'s one accent action (ink on the plain ground)' },
  { selector: '.dmc-picker-item', note: 'catalog entry in the add picker' },
  { selector: '.dmc-name', note: 'provider display name' },
  { selector: '.dmc-route', note: 'route id beside the name' },
  { selector: '.dmc-verdict', note: 'the row\'s one answer word' },
  { selector: '.dmc-manage', note: 'the row\'s one door (§5.35)' },
  { selector: '.dmc-field-label', note: 'a field\'s name in the well (凭据 / API 协议 / 自动重试)' },
  { selector: '.dmc-field-value', note: 'a field\'s value line in the well' },
  { selector: '.dmc-quiet', note: 'a stated value inside a field (已配置 / 使用默认值 / 由账号提供)' },
  { selector: '.dmc-diagnostic', note: 'the diagnostic sentence, first line of an open well' },
  { selector: '.dmc-danger', note: 'the lifecycle entry, last line of an open well' },
  { selector: '.dmc-key-action', note: 'credential entry as a text action' },
  { selector: '.dmc-key-clear', note: 'credential clear as a text action' },
  { selector: '.dmc-protocol', note: 'protocol select value (the row\'s one 1px-edged control)' },
  { selector: '.dmc-protocol option', note: 'native option text, painted on the field fill' },
  { selector: '.dmc-catalog', note: 'the model cell: a fact that is also the drawer\'s door' },
  // §5.33 — the inline auto-retry editor, one entry per rule that paints text. It
  // is the SAME domain as the page above (the editor's rules live in
  // `modelConfigStyles.ts`, and the editor renders inside a `.dmc-row`), so its ink
  // ladder has to clear the same floor. Registered one by one rather than left to
  // the sweep below, because a listed style whose token changes is re-measured
  // instead of disappearing — and the sweep is what proves the list is COMPLETE.
  { selector: '.dmc-retry-action', note: '自动重试 触发词：控制行里的去铬文字动作（rest 即 primary 墨）' },
  { selector: '.dmc-retry-state', note: '已单独设置 / 使用默认值：编辑器顶部那一行事实' },
  { selector: '.dmc-retry-label', note: '字段名（重试次数 / 间隔上限）：安静的一档墨' },
  { selector: '.dmc-retry-input', note: '数字字段的值：页面上第二个真实表单控件，自带填充' },
  { selector: '.dmc-retry-unit', note: '单位词（次 / 秒）：数字旁边的那一个字' },
  { selector: '.dmc-retry-summary', note: '一行排期（5 次 · 首次等待 0.5s · 最长合计 ~15s）：tabular 数字' },
  // --- the catalog region (`dmc-`, catalogStyles.ts) ------------------------
  // The region is the row's expanded body now, so its text is composited against
  // the row's positional fill — not against a floating panel's own ground.
  { selector: '.dmc-catalog-panel', note: 'the region shell (states the inherited ink and size)' },
  { selector: '.dmc-catalog-title', note: 'catalog title (模型目录)' },
  { selector: '.dmc-catalog-status', note: 'catalog state / discovery count sentence' },
  { selector: '.dmc-btn', note: 'catalog control' },
  { selector: '.dmc-btn-commit', note: 'catalog commit word (保存 / 添加所选)' },
  { selector: '.dmc-catalog-section', note: 'catalog section heading (选择要添加的模型)' },
  { selector: '.dmc-catalog-notice', note: 'catalog notice' },
  { selector: '.dmc-catalog-error', note: 'Host diagnostic, verbatim' },
  { selector: '.dmc-catalog-note', note: 'catalog footnote' },
  { selector: '.dmc-model-ref', note: 'roster line: the model id (§5.36)' },
  { selector: '.dmc-model-alias', note: 'roster line: the display name' },
  { selector: '.dmc-model-fact', note: 'roster line: the capacity facts (上下文 / 输出)' },
  { selector: '.dmc-model-edit', note: 'roster line: its one door (编辑)' },
  { selector: '.dmc-model-danger', note: 'the well\'s remove entry (删除模型)' },
  { selector: '.dmc-model-label', note: 'field label in a catalog row' },
  { selector: '.dmc-model-input', note: 'catalog field value' },
  { selector: '.dmc-model-input::placeholder', note: 'catalog field placeholder' },
  { selector: '.dmc-model-error', note: 'per-field validation sentence' },
  { selector: '.dmc-reasoning-help', note: 'reasoning-levels help' },
  { selector: '.dmc-discover-id', note: 'discovered model id' },
  { selector: '.dmc-discover-name', note: 'discovered model name' },
  { selector: '.dmc-discover-group', note: 'discovery list group heading (§13.5)' },

  // --- the Endfield revision (docs/endfield-design-language.md §8) -----------
  // Every rule that paints text in the two `dmc-` sheets and the design-system
  // primitives, registered by name. The sweep below proves this list is COMPLETE;
  // the list is what pins each style's intent so a change of its ink is
  // re-measured instead of quietly disappearing.
  { selector: '.dmc-page', note: 'the page root: the ink and size every child inherits' },
  { selector: '.dmc-add', note: 'the page\'s one accent action (ink on the plain ground)' },
  { selector: '.dmc-add:disabled', note: 'the unavailable add entry (secondary ink)' },
  { selector: '.dmc-row', note: 'the ledger row: states the inherited row ink' },
  { selector: '.dmc-index', note: 'the two-digit position mark, 10px muted ink' },
  { selector: '.dmc-name', note: 'the provider name, the row\'s big identity' },
  { selector: '.dmc-catalog:hover:not(:disabled)', note: 'the model cell under the pointer' },
  { selector: '.dmc-catalog:disabled', note: 'the unavailable model cell' },
  { selector: '.dmc-verdict[data-state=\'missing-key\']', note: 'the answer word when no key is configured' },
  { selector: '.dmc-verdict[data-state=\'unreachable\']', note: 'the answer word when the provider cannot answer' },
  { selector: '.dmc-manage:disabled', note: 'the door when the deployment cannot write' },
  { selector: '.dmc-pending', note: 'the in-flight word under the scan line' },
  { selector: '.dmc-key-action::placeholder', note: 'the credential field hint' },
  { selector: '.dmc-key-action:hover:not(:disabled)', note: 'the credential action under the pointer' },
  { selector: '.dmc-retry-tally', note: 'the backoff count as a display numeral' },
  { selector: '.dmc-retry-tally-unit', note: 'the unit beside the backoff count' },
  { selector: '.dmc-retry-detail', note: 'the schedule detail line' },
  { selector: '.dmc-protocol:disabled', note: 'the protocol select when the page is read-only' },
  { selector: '.dmc-danger:disabled', note: 'the lifecycle entry when it cannot act' },
  { selector: '.dmc-model-row', note: 'one model row in the roster (inherits the panel ink)' },
  { selector: '.dmc-model-index', note: 'the roster line\'s two-digit position mark' },
  { selector: '.dmc-model-sub', note: 'the roster line\'s quiet fact line' },
  { selector: '.dmc-model-label', note: 'the roster field label' },
  { selector: '.dmc-model-add', note: 'the "+ 添加模型" row, signal-ink bar' },
  { selector: '.dmc-reasoning-value', note: 'the reasoning-level value field' },
  { selector: '.dmc-reasoning-value::placeholder', note: 'that field\'s placeholder' },
  { selector: '.dmc-reasoning-level', note: 'the reasoning-level select' },
  { selector: '.dmc-discover-search', note: 'the discovery search field' },
  { selector: '.dmc-discover-search::placeholder', note: 'that field\'s placeholder' },
  { selector: '.dmc-discover-candidate', note: 'one discovery candidate row' },
  { selector: '.dmc-discover-candidate[data-present=\'true\']', note: 'an already-present candidate (quiet ink)' },
  { selector: '.dmc-model-danger:disabled', note: 'the remove entry when it cannot act' },
  { selector: '.dmc-btn:hover:not(:disabled)', note: 'a catalog control under the pointer' },
  { selector: '.dmc-btn:disabled', note: 'an unavailable catalog control' },
  // The design-system primitives: the two shared marks that paint text.
]
/** Painted by a host primitive rather than by this sheet, so there is no size to derive. */
const PRIMITIVE_SIZED = new Set(['.dmp-badge-value', '.dmp-settings-input input::placeholder'])
/** The sizes those primitive-painted styles render at (the Tag capsule's value, the Input's own). */
const PRIMITIVE_SIZE = { size: 11, weight: 400 }

// The plugin's own sheets must name these tokens; a style that drifts onto a
// caption/dimmed token is caught statically below as well, so a renamed class
// cannot slip past this gate by no longer being listed here.
//
// Only the CSS TEMPLATE is parsed: the module around it is TypeScript, and a
// stray `{ … }` there (or a class name in a string literal) must not be read as
// a rule. Comments are stripped too — these sheets are heavily annotated and a
// `/*…*/` between two rules would otherwise be read as part of the next
// selector, which is exactly the kind of silent miss this gate exists to avoid.
//
// THE DESIGN SYSTEM JOINS THE LIST. It is where the `--zmd-*` tokens live and its
// primitives (`.zmd-rule`, `.zmd-wash`, `.zmd-grain`) paint the material; the
// token block is parsed separately below because it is the SOURCE of the colours
// every other style resolves. The ink language keeps no painted text primitive
// (the HUD's field-code / display numerals are retired), so this sheet is here for
// completeness and for the closure's sake.
const SHEETS = [
  { file: 'src/client/styles.ts', owner: 'the composer seat (dmp-)', dmc: false, zmd: false },
  { file: 'src/client/modelConfigStyles.ts', owner: 'the 模型配置 page (dmc-)', dmc: true, zmd: false },
  { file: 'src/client/catalogStyles.ts', owner: 'the model catalog region (dmc-)', dmc: true, zmd: false },
  { file: 'src/client/designSystem.ts', owner: 'the design system (zmd-)', dmc: false, zmd: true },
]

/** Neutralise `${…}` interpolations inside a TS template literal's raw source. */
function neutraliseTemplateExpressions(source) {
  let out = ''
  let index = 0
  while (index < source.length) {
    const at = source.indexOf('${', index)
    if (at < 0) { out += source.slice(index); break }
    out += source.slice(index, at) + '__EXPR__'
    let depth = 0
    let cursor = at + 1
    while (cursor < source.length) {
      const char = source[cursor]
      if (char === '{') depth += 1
      else if (char === '}') {
        depth -= 1
        if (depth === 0) break
      }
      cursor += 1
    }
    index = cursor + 1
  }
  return out
}

/**
 * Pull one sheet's CSS template literal out of its module.
 *
 * The literal is opened by `const CSS = \`` and closed by the next backtick; both
 * `selfcheck-static.mjs` (for all four sheets) and a module-header comment in
 * `modelConfigStyles.ts` assert that no backtick ever appears inside the CSS text,
 * so the first close is the right one.
 *
 * `designSystem.ts` is the exception that needs one extra step: its literal
 * interpolates `${FONT_FACE}` (the face) and `${TOKENS}` (the token layer), and the
 * token layer itself interpolates `${JSON.stringify(FONT_FAMILY)}`. A naive scan
 * would read the interpolation braces as CSS blocks — this gate measured an EMPTY
 * light token bag before the neutralising step existed — so the expressions are
 * replaced with a placeholder before the literal is sliced.
 * @param relative - the module path, relative to the repository root.
 * @returns the CSS text, or null when the literal is not there.
 */
function cssOf(relative) {
  const source = readFileSync(resolve(root, relative), 'utf8')
  if (relative.endsWith('/designSystem.ts')) {
    // The primitives are their own literal (`const PRIMITIVES = \`…\``); the
    // module's `const CSS` is just `${FONT_FACE}\n${TOKENS}\n${PRIMITIVES}` and
    // carries no rule of its own.
    const marker = 'const PRIMITIVES = `'
    const open = source.indexOf(marker)
    if (open < 0) return null
    const body = neutraliseTemplateExpressions(source.slice(open + marker.length))
    const close = body.indexOf('`')
    // The interpolations stand alone between rules (`${FONT_FACE}` / `${TOKENS}`);
    // dropping the placeholder leaves the primitive rules themselves untouched and
    // keeps a placeholder from becoming a bogus selector for the next rule.
    return close < 0 ? null : body.slice(0, close).replace(/__EXPR__/g, '')
  }
  const open = source.indexOf('const CSS = `')
  if (open < 0) return null
  const from = open + 'const CSS = `'.length
  const close = source.indexOf('`', from)
  if (close < 0) return null
  return source.slice(from, close)
}

/** The two `--zmd-*` token bags, parsed out of designSystem.ts's TOKENS literal. */
function designSystemTokenBags() {
  const source = readFileSync(resolve(root, 'src/client/designSystem.ts'), 'utf8')
  const marker = 'const TOKENS = `'
  const open = source.indexOf(marker)
  const bags = { light: {}, dark: {} }
  if (open < 0) return bags
  const body = neutraliseTemplateExpressions(source.slice(open + marker.length))
  const close = body.indexOf('`')
  if (close < 0) return bags
  const css = body.slice(0, close).replace(/\/\*[\s\S]*?\*\//g, '')
  for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const target = block[1].includes('data-ds-dark-theme') ? bags.dark : bags.light
    for (const declaration of block[2].split(';')) {
      const colon = declaration.indexOf(':')
      if (colon < 0) continue
      const name = declaration.slice(0, colon).trim()
      if (name.startsWith('--zmd-')) target[name] = declaration.slice(colon + 1).trim()
    }
  }
  return bags
}
const zmd = designSystemTokenBags()
// The dark block OVERRIDES :root; a token declared only in :root (on-accent,
// grain-tint, the host-palette references) still applies in the dark theme, so
// resolution runs against the merged bag.
const zmdMerged = { light: { ...zmd.light }, dark: { ...zmd.light, ...zmd.dark } }

const sheetCss = new Map()
for (const sheet of SHEETS) {
  const css = cssOf(sheet.file)
  if (css === null || css.trim() === '') {
    console.log(`  FAIL contrast: the sheet could not be read out of ${sheet.file}`)
    failures += 1
    sheetCss.set(sheet.file, '')
    continue
  }
  sheetCss.set(sheet.file, css)
}
const styleRules = [...sheetCss.values()].join('\n').replace(/\/\*[\s\S]*?\*\//g, '')

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
  // A state/descendant variant of a registered style still renders at the BASE
  // style's size. `input.dmc-key-action` (the input form of a text action) and
  // colour, so the size has to be found on the compound they end with and on the
  // class-only spelling of a type-prefixed selector.
  for (const candidate of [selector, stateRule]) {
    const lastCompound = candidate.split(/\s+/).pop()
    if (lastCompound !== candidate) candidates.push(lastCompound)
    const classOnly = candidate.replace(/^[a-z]+(?=[.#[:])/i, '')
    if (classOnly !== candidate) candidates.push(classOnly)
  }
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
  return /^var\((--(?:dsw|zmd)-[a-z0-9-]+)\)$/.exec(value)?.[1] ?? null
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

  // --- the 模型配置 page (`dmc-`) -------------------------------------------
  // The page states its ink once, on `.dmc-page`, and the catalog region states its own on
  // `.dmc-catalog-panel`; every rule below that does not declare a colour of its own
  // reaches one of those through this chain. A class missing here has no
  // inheritable ink to find, which for a sized rule is a reported failure rather
  // than a pass.
  '.dmc-page': null,
  '.dmc-head': '.dmc-page',
  // `.dmc-title` is retired (§16/V2); `.dmc-head` stays because it is still the
  // container of the ready statement below.
  // The ready statement is the page's one large line and it states its own ink, so
  // it is listed for completeness rather than because it inherits one.
  '.dmc-readout': '.dmc-head',
  '.dmc-empty': '.dmc-page',
  '.dmc-notice': '.dmc-page',
  '.dmc-notice-action': '.dmc-notice',
  '.dmc-alert': '.dmc-page',
  '.dmc-actions': '.dmc-page',
  '.dmc-add': '.dmc-actions',
  '.dmc-picker': '.dmc-page',
  '.dmc-picker-list': '.dmc-picker',
  '.dmc-picker-item': '.dmc-picker-list',
  '.dmc-list': '.dmc-page',
  '.dmc-row': '.dmc-list',
  '.dmc-rail': '.dmc-row',
  '.dmc-name': '.dmc-row',
  '.dmc-route': '.dmc-name',
  '.dmc-verdict': '.dmc-row',
  // The scan line's two right-hand cells (§5.35). The model cell is a fact, so it
  // hangs off the row; the door is a control whose ink is its own.
  '.dmc-catalog': '.dmc-row',
  '.dmc-manage': '.dmc-row',
  '.dmc-pending': '.dmc-row',
  // The settings well: a form, not a segment. Its fields state their own ink and
  // size, so the chain is here for the two things it still decides: which of those
  // inks are composited against the row's hover fill, and where a size would be
  // inherited from if a field stopped stating it.
  '.dmc-well': '.dmc-row',
  '.dmc-diagnostic': '.dmc-well',
  '.dmc-field-label': '.dmc-well',
  '.dmc-field-value': '.dmc-well',
  '.dmc-quiet': '.dmc-field-value',
  '.dmc-key-action': '.dmc-field-value',
  '.dmc-key-clear': '.dmc-field-value',
  '.dmc-protocol': '.dmc-field-value',
  '.dmc-retry-action': '.dmc-field-value',
  '.dmc-danger': '.dmc-field-value',
  // §5.33 — the inline auto-retry editor. It opens INSIDE the well, under the
  // field line that owns it, so its shell hangs off `.dmc-well`. Every rule in this
  // family states its own ink and its own size.
  '.dmc-retry': '.dmc-well',
  '.dmc-retry-state': '.dmc-retry',
  '.dmc-retry-fields': '.dmc-retry',
  '.dmc-retry-field': '.dmc-retry-fields',
  '.dmc-retry-label': '.dmc-retry-field',
  '.dmc-retry-row': '.dmc-retry-field',
  '.dmc-retry-input': '.dmc-retry-row',
  '.dmc-retry-unit': '.dmc-retry-row',
  '.dmc-retry-summary': '.dmc-retry',
  '.dmc-retry-actions': '.dmc-retry',
  // --- the catalog region (`dmc-`), inside the provider row ------------------
  // The region hangs off `.dmc-row` rather than off `null`: it is IN the row, so
  // its text is composited against the row's positional fill tokens
  // (`backdropsFor` below), which is the whole point of moving it inline.
  '.dmc-catalog-panel': '.dmc-row',
  '.dmc-catalog-head': '.dmc-catalog-panel',
  '.dmc-catalog-heading': '.dmc-catalog-head',
  '.dmc-catalog-title': '.dmc-catalog-heading',
  '.dmc-catalog-close': '.dmc-catalog-head',
  '.dmc-catalog-status': '.dmc-catalog-heading',
  '.dmc-btn': '.dmc-catalog-panel',
  '.dmc-btn-commit': '.dmc-catalog-foot',
  '.dmc-catalog-body': '.dmc-catalog-panel',
  '.dmc-catalog-foot': '.dmc-catalog-panel',
  '.dmc-catalog-guard': '.dmc-catalog-body',
  '.dmc-catalog-guard-actions': '.dmc-catalog-guard',
  '.dmc-catalog-section': '.dmc-catalog-body',
  '.dmc-catalog-notice': '.dmc-catalog-body',
  '.dmc-catalog-error': '.dmc-catalog-body',
  '.dmc-catalog-note': '.dmc-catalog-foot',
  '.dmc-model-list': '.dmc-catalog-body',
  '.dmc-model-row': '.dmc-model-list',
  // §5.36 — the roster line. Its identity, its quiet fact line and its door hang off
  // the row; the fields and the reasoning editor hang off the well the door opens.
  '.dmc-model-ref': '.dmc-model-row',
  '.dmc-model-sub': '.dmc-model-row',
  '.dmc-model-alias': '.dmc-model-sub',
  '.dmc-model-fact': '.dmc-model-sub',
  '.dmc-model-edit': '.dmc-model-row',
  '.dmc-model-well': '.dmc-model-row',
  '.dmc-model-fields': '.dmc-model-well',
  '.dmc-model-id': '.dmc-model-fields',
  '.dmc-model-name': '.dmc-model-fields',
  '.dmc-model-window': '.dmc-model-fields',
  '.dmc-model-tokens': '.dmc-model-fields',
  '.dmc-model-label': '.dmc-model-well',
  '.dmc-model-input': '.dmc-model-id',
  '.dmc-model-error': '.dmc-model-well',
  '.dmc-model-danger': '.dmc-model-well',
  '.dmc-model-add': '.dmc-catalog-body',
  '.dmc-reasoning': '.dmc-model-well',
  '.dmc-reasoning-head': '.dmc-reasoning',
  '.dmc-reasoning-row': '.dmc-reasoning',
  '.dmc-reasoning-level': '.dmc-reasoning-row',
  '.dmc-reasoning-value': '.dmc-reasoning-row',
  '.dmc-reasoning-add': '.dmc-reasoning-head',
  '.dmc-reasoning-remove': '.dmc-reasoning-row',
  '.dmc-reasoning-help': '.dmc-reasoning',
  '.dmc-discover-actions': '.dmc-catalog-body',
  '.dmc-discover': '.dmc-discover-actions',
  '.dmc-discover-adopt': '.dmc-discover-actions',
  '.dmc-discover-tool': '.dmc-discover-actions',
  '.dmc-discover-panel': '.dmc-catalog-body',
  '.dmc-discover-tools': '.dmc-discover-panel',
  '.dmc-discover-list': '.dmc-discover-panel',
  '.dmc-discover-candidate': '.dmc-discover-list',
  '.dmc-discover-label': '.dmc-discover-candidate',
  '.dmc-discover-check': '.dmc-discover-candidate',
  '.dmc-discover-id': '.dmc-discover-candidate',
  '.dmc-discover-name': '.dmc-discover-candidate',
  '.dmc-discover-group': '.dmc-discover-list',
  '.dmc-discover-search': '.dmc-discover-panel',
  // --- the Endfield revision: the new classes' place in the tree -------------
  '.dmc-head-index': '.dmc-head',
  '.dmc-index': '.dmc-name',
  '.dmc-field-code': '.dmc-field-label',
  '.dmc-field-name': '.dmc-field-label',
  '.dmc-catalog-code': '.dmc-catalog-heading',
  '.dmc-roster-count': '.dmc-catalog-heading',
  '.dmc-model-index': '.dmc-model-row',
  '.dmc-model-facts': '.dmc-model-row',
  '.dmc-model-add': '.dmc-catalog-body',
  '.dmc-reasoning-value': '.dmc-reasoning-row',
  '.dmc-reasoning-level': '.dmc-reasoning-row',
  '.dmc-discover-search': '.dmc-discover-panel',
  '.dmc-well-rule': '.dmc-well',
  '.dmc-retry-head': '.dmc-retry',
  '.dmc-retry-code': '.dmc-retry-head',
  '.dmc-retry-rule': '.dmc-retry-head',
  '.dmc-retry-tally': '.dmc-retry-summary',
  '.dmc-retry-tally-unit': '.dmc-retry-summary',
  '.dmc-retry-detail': '.dmc-retry',
}

/**
 * A selector with its attribute tests and pseudo-classes removed, so the cascade
 * map can be consulted for `[data-state='missing-key']`-style variants too.
 * @param selector - a selector, possibly with a state attribute or a pseudo.
 * @returns the bare class selector.
 */
function bareSelector(selector) {
  return selector
    .replace(/\[[^\]]*\]/g, '')
    .replace(/::?[a-z-]+(\([^)]*\))?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Whether a selector's text is painted inside a ROW.
 *
 * This is what makes the backdrop honest rather than merely conservative: a row
 * carries the tone ladder (`--dsw-alias-interactive-bg-hover` while the pointer or
 * the open catalog region is here, `-hover-danger` for a row that cannot serve), so text
 * inside a row can sit on a fill the card backdrop never shows. Text that is not
 * in a row — the title, the ready statement, the add action — is judged against
 * the card backdrop alone.
 * @param selector - the selector to place in the tree.
 * @returns whether a row is one of its ancestors (or it is a row).
 */
function sitsInRow(selector) {
  let current = bareSelector(selector)
  for (let depth = 0; depth < 24; depth += 1) {
    if (current === '.dmc-row') return true
    const ancestor = CONTAINERS[current]
    if (ancestor === null || ancestor === undefined) return false
    current = ancestor
  }
  return false
}

/**
 * The `--dsw-*` fills the page itself declares on a ROW, read out of the sheet.
 *
 * Derived rather than hard-coded on purpose: §14 R1 removes the rest fill, so a
 * list of token names written here by hand would keep judging text against a fill
 * the page no longer paints (or, worse, miss a new one). Whatever the row rules
 * actually declare is what gets composited.
 * @returns the distinct token names, in sheet order.
 */
function rowFillTokens() {
  const tokens = []
  for (const rule of styleRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const paints = rule[1].split(',').some(part => /^\.dmc-row(?![a-z0-9-])/.test(part.trim()))
    if (!paints) continue
    const token = /(?:^|;)\s*background\s*:\s*var\((--dsw-[a-z0-9-]+)\)/.exec(rule[2])?.[1]
    if (token !== undefined && !tokens.includes(token)) tokens.push(token)
  }
  return tokens
}

/**
 * Every opaque background one selector's text can actually sit on.
 *
 * §8 of the design language changed what the card IS: the three surfaces now paint
 * an OPAQUE `--zmd-panel`, and the row states paint `--zmd-hover` /
 * `--zmd-panel-deep`. So for a `--zmd-*` ink the honest backdrops are the token
 * layer's own grounds, read from designSystem.ts — not the host's translucent menu
 * film. For a host (`--dsw-*`) ink the old card backdrops still apply (the seat
 * keeps host label aliases in a few places) AND the zmd grounds are added, because
 * the card under them is now opaque paper. A `dmc-` style inside a row still gets
 * every fill its row rules declare, composited over the page base.
 *
 * The verdict is taken against the WORST backdrop, as before: the gate must not
 * depend on which surface the panel happens to float over.
 * @param selector - the selector whose text is being judged.
 * @param which - `light` or `dark`.
 * @param inkToken - the token that paints the text, so the ground set can match.
 * @returns the candidate opaque backgrounds.
 */
function backdropsFor(selector, which, inkToken) {
  // `--zmd-on-accent` is defined ONLY as ink on the accent fill (§2.3): the blue
  // square may be painted by the element's own `::before` rather than by the rule
  // that states the colour, so the fill role — not the selector tree — decides
  // the ground.
  if (inkToken === '--zmd-on-accent') {
    const accent = zmdColor(which, '--zmd-accent')
    return accent === null ? [] : [accent]
  }
  const bag = bags[which]
  const candidates = []
  if (!inkToken.startsWith('--zmd-')) candidates.push(...cardBackgrounds(bag))
  candidates.push(...zmdGrounds(which))
  if (!sitsInRow(selector)) return candidates
  const page = resolveToken(bag, '--dsw-alias-bg-base')
  if (page === null) return candidates
  for (const token of rowFillTokens()) {
    const fill = resolveToken(bag, token)
    if (fill !== null) candidates.push(over(fill, page))
  }
  return candidates
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
  const direct = declared === null ? null : /var\((--(?:dsw|zmd)-[a-z0-9-]+)\)/.exec(declared)?.[1] ?? null
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

/**
 * Resolve one `--zmd-*` token. The value may be a literal, a reference to another
 * `--zmd-*` token (on-accent → panel), or a reference to the HOST palette
 * (`--zmd-accent` → `--dsw-alias-state-business-primary`): the ink language has
 * one palette, and the accent/error roles borrow the host's own tokens. A naive
 * one-hop resolver would report those three roles as "unresolved".
 * @param which - `light` or `dark`.
 * @param token - the `--zmd-*` name.
 * @param depth - recursion guard.
 * @returns the sRGB colour, or null.
 */
function zmdColor(which, token, depth = 0) {
  if (depth > 12) return null
  const value = zmdMerged[which]?.[token]
  if (value === undefined) return null
  const reference = /^var\((--[a-z0-9-]+)\)$/.exec(value.trim())
  if (reference === null) return parseColor(value)
  if (reference[1].startsWith('--dsw-')) return resolveToken(bags[which], reference[1])
  return zmdColor(which, reference[1], depth + 1)
}

/**
 * Resolve either ink layer: host `--dsw-*` through its `var()` chain, or the
 * token layer's `--zmd-*` from designSystem.ts. One function so every measured
 * style is judged by the same rule whatever layer owns its ink.
 * @param which - `light` or `dark`.
 * @param token - the CSS custom property name.
 * @returns the sRGB colour, or null.
 */
function resolveInk(which, token) {
  return token.startsWith('--zmd-') ? zmdColor(which, token) : resolveToken(bags[which], token)
}

/**
 * The token layer's own opaque grounds: the card, the sunken well, the hover fill
 * and BOTH ends of the local wash. Every painted word is judged against all of
 * them (§2.2: the wash never carries text contrast on its own — the words must
 * clear AA against the brightest AND the darkest end of the surface).
 * @param which - `light` or `dark`.
 * @returns the candidate ground colours.
 */
function zmdGrounds(which) {
  return ['--zmd-panel', '--zmd-panel-deep', '--zmd-hover', '--zmd-wash-top', '--zmd-wash-bottom']
    .map(token => zmdColor(which, token))
    .filter(colour => colour !== null)
}

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
      check(`contrast: ${style.selector} paints an ink token`, false, { selector: style.selector })
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
      const ink = resolveInk(which, token)
      if (ink === null) {
        check(`contrast: ${token} resolves in the ${which} theme`, false, { token })
        continue
      }
      // Judged against the WORST backdrop the card can sit on, so the verdict
      // does not depend on which surface the panel happens to float over.
      const ratios = backdropsFor(style.selector, which, token)
        .map(background => contrast(over(ink, background), background))
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
  // The `dmc-` sheets get the inactive-control exemption and NOTHING else. The
  // dimmed-ink and icon exemptions are argued in place for the `dmp-` seat; a
  // `dmc-` rule that reached for the dimmed token would otherwise be skipped, and
  // §2 puts every graphic-only token out of the text role entirely.
  // A rule the exemptions do not cover and that this gate cannot size is
  // REPORTED rather than passed over.
  const EXEMPT = (selector, token) => {
    // The token-layer primitives are all structural in the ink language (no painted
    // text primitive survives the HUD removal); nothing in that domain is exempt.
    if (/^\.zmd-/.test(selector)) return false
    if (/^\.dmc-/.test(selector)) return /:disabled|\[aria-disabled/.test(selector)
    return (token === '--dsw-alias-label-dimmed' || /:disabled|\[aria-disabled/.test(selector))
      || /^\.dmp-[a-z-]*(?:icon|check|dot)(?:[\s:\[]|$)/.test(selector)
      || /^\.dmp-[a-z-]*\[[^\]]*\][^,]*\.dmp-[a-z-]*(?:icon|check|dot)/.test(selector)
      || /^\.dmp-(?:settings-button|chevron)(?:[\s:\[]|$)/.test(selector)
      // The switch is a control with no copy of its own: it states `color` so its
      // thumb can take `currentColor`, but there is no word to size or measure.
      || /(?:^|\s)\.dmp-settings-switch(?:[\s:\[]|$)/.test(selector)
  }
  const sweep = []
  const unsized = []
  for (const rule of styleRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const token = /(?:^|;)\s*color\s*:\s*var\((--(?:dsw|zmd)-[a-z0-9-]+)\)/.exec(rule[2])?.[1] ?? null
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
        const color = resolveInk(which, ink)
        const onBackdrops = color === null
          ? [null]
          : backdropsFor(selector, which, ink).map(background => contrast(over(color, background), background))
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

  // --- 5. the dmc- sheets: no text rule may go unmeasured --------------------
  // This is the hole the brief names. The sweep above can still walk past a rule
  // it cannot size or whose ink it cannot resolve, and a rule that was walked
  // past reads exactly like a rule that passed — which is how the two `dmc-`
  // sheets had never been measured at all. For the `dmc-` domain the sweep is
  // therefore closed BY NAME: every selector that paints a colour or states a
  // text size must appear in the measured set, and the only way out is the
  // inactive-control exemption above.
  //
  // The FIRST assertion below is the other half of that closure, and it exists
  // because a mutation found the hole: `effectiveInk` follows the cascade to
  // `.dmc-page`, so a registered style that loses its own `color` and `font-size`
  // still measures as "primary ink at the page's 13px" and passes. Deleting the
  // `.dmc-readout` rule outright — the page's one large line, which would then
  // render at body size in the page ink — left this gate GREEN until this check
  // existed. A registered style must therefore state its own ink or its own size:
  // inheriting from a container is only legitimate for a style that is not asked
  // to be a style of its own.
  const silentRegistered = []
  for (const style of STYLES) {
    if (!style.selector.startsWith('.dmc-')) continue
    const own = declarationOf(style.selector, 'color') !== null || declarationOf(style.selector, 'font-size') !== null
    if (!own) silentRegistered.push(style.selector)
  }
  check(
    'contrast: every registered dmc- style states its own ink or its own size',
    silentRegistered.length === 0,
    { silentRegistered },
  )
  const dmcSheetFiles = SHEETS.filter(sheet => sheet.dmc || sheet.zmd).map(sheet => sheet.file)
  const measuredSelectors = new Set(sweep.map(entry => entry.selector))
  const unmeasured = []
  for (const file of dmcSheetFiles) {
    const css = (sheetCss.get(file) ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
    const domain = file.endsWith('designSystem.ts') ? '.zmd-' : '.dmc-'
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const paintsText = /(?:^|;)\s*color\s*:/.test(rule[2]) || /(?:^|;)\s*font-size\s*:/.test(rule[2])
      if (!paintsText) continue
      const token = /(?:^|;)\s*color\s*:\s*var\((--(?:dsw|zmd)-[a-z0-9-]+)\)/.exec(rule[2])?.[1] ?? null
      for (const selector of rule[1].split(',').map(part => part.trim()).filter(part => part.startsWith(domain))) {
        if (measuredSelectors.has(selector)) continue
        if (EXEMPT(selector, token)) continue
        unmeasured.push(`${file}: ${selector}`)
      }
    }
  }
  check(
    'contrast: every dmc-/zmd- rule that paints text is measured (no silent skip)',
    unmeasured.length === 0,
    { unmeasured: [...new Set(unmeasured)] },
  )

  // --- 6. the graphic-only tokens stay out of the text role ------------------
  // §2 of the ink language: neutrals are panel/line/fill roles, the accent is the
  // host's information blue and is GRAPHIC ONLY (3.91:1 light), the error red is a
  // 4px bar / diagnostic edge, and the online green is the one state colour that
  // may also be a word. A `color:` that names a graphic token is reported here as
  // well as by the static selfcheck, so neither gate is the single point of
  // failure. Two narrow exemptions survive: a DISABLED control (WCAG-exempt, the
  // host's dimmed token) and an ERROR ICON (a glyph carried by currentColor, not a
  // word). The wash tops are grounds, never inks.
  const ZMD_GRAPHIC_TOKENS = new Set([
    '--zmd-panel', '--zmd-panel-deep', '--zmd-hover', '--zmd-line', '--zmd-line-strong',
    '--zmd-line-control', '--zmd-wash-top', '--zmd-wash-bottom', '--zmd-grain-tint',
    '--zmd-accent', '--zmd-focus', '--zmd-danger',
  ])
  const ZMD_TEXT_TOKENS = new Set([
    '--zmd-ink', '--zmd-ink-secondary', '--zmd-ink-mute', '--zmd-online', '--zmd-on-accent',
  ])
  const graphicOnlyText = []
  for (const [file, css] of sheetCss) {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const rule of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const selector of rule[1].split(',').map(part => part.trim()).filter(Boolean)) {
        const disabled = /:disabled|\[aria-disabled/.test(selector)
        const glyph = /(?:-icon)(?:[\s:.[]|$)|(?:^|\s)svg(?:[\s:.[]|$)/.test(selector)
        for (const match of rule[2].matchAll(/(?:^|;)\s*color\s*:\s*([^;}]+)/g)) {
          const token = /var\((--(?:dsw|zmd)-[a-z0-9-]+)\)/.exec(match[1].trim())?.[1] ?? null
          if (token === null) continue
          if (token === '--zmd-danger' && glyph) continue
          if (token === '--dsw-alias-label-dimmed' && disabled) continue
          if (ZMD_GRAPHIC_TOKENS.has(token)) { graphicOnlyText.push(`${file}: ${selector}: ${token}`); continue }
          if (/^--dsw-alias-(?:state-|label-(?:tertiary|caption|dimmed))/.test(token) && !disabled) {
            graphicOnlyText.push(`${file}: ${selector}: ${token}`)
          }
        }
      }
    }
  }
  check(
    'contrast: the sheets paint text with a readable role token only',
    graphicOnlyText.length === 0,
    { graphicOnlyText: [...new Set(graphicOnlyText)] },
  )

  // --- 7. THE TOKEN LAYER'S OWN CONTRACT: the bands, the wash ends, the accent -
  // These are assertions on the TOKENS THEMSELVES (both themes), so they cannot be
  // satisfied by a nice-looking selector: they are the numbers the design language
  // quotes, re-measured from the source. The accent / focus / error roles are
  // references into the HOST palette, so `zmdColor` resolves them through the host
  // bag — the ink language deliberately owns no second palette.
  /** One token-to-token ratio in both themes. */
  const tokenRatio = (which, fg, bg) => {
    const foreground = zmdColor(which, fg)
    const background = zmdColor(which, bg)
    return foreground === null || background === null ? null : contrast(foreground, background)
  }
  check('contrast: the ink token layer parsed in both themes',
    Object.keys(zmd.light).length >= 15 && Object.keys(zmd.dark).length >= 5,
    { light: Object.keys(zmd.light).length, dark: Object.keys(zmd.dark).length })

  // (a) THE LINES: visible but not competing with text (§2.1 / the design record's
  // measured 1.26–2.51). Structural lines may step a little higher but never reach
  // the text floor. Judged against every ground a line can be drawn on, including
  // both ends of the wash.
  const LINE_BANDS = [
    { token: '--zmd-line', min: 1.05, max: 2.7, label: 'decorative line' },
    { token: '--zmd-line-strong', min: 1.7, max: 3.0, label: 'structural line' },
  ]
  const lineBandIssues = []
  for (const band of LINE_BANDS) {
    for (const which of ['light', 'dark']) {
      for (const ground of ['--zmd-panel', '--zmd-panel-deep', '--zmd-wash-top', '--zmd-wash-bottom']) {
        const ratio = tokenRatio(which, band.token, ground)
        if (ratio === null) lineBandIssues.push(`${band.token} does not resolve in ${which}`)
        else if (ratio < band.min || ratio > band.max) {
          lineBandIssues.push(`${band.label} ${band.token} on ${ground} (${which}) = ${ratio.toFixed(2)}:1, outside ${band.min}–${band.max}`)
        }
      }
    }
  }
  check('contrast: the decorative/structural lines sit in their measured visibility bands',
    lineBandIssues.length === 0, { lineBandIssues })

  // (b) THE FORM-CONTROL EDGE is a real 3:1 boundary on every ground a field sits
  // on (the page, the sunken well, the wash end).
  const controlEdgeIssues = []
  for (const which of ['light', 'dark']) {
    for (const ground of ['--zmd-panel', '--zmd-panel-deep', '--zmd-wash-top']) {
      const ratio = tokenRatio(which, '--zmd-line-control', ground)
      if (ratio === null || ratio < AA_LARGE) {
        controlEdgeIssues.push(`--zmd-line-control on ${ground} (${which}) = ${ratio === null ? 'unresolved' : `${ratio.toFixed(2)}:1`}`)
      }
    }
  }
  check('contrast: the form-control edge clears the 3:1 graphical floor on every ground',
    controlEdgeIssues.length === 0, { controlEdgeIssues })

  // (c) THE ACCENT AND THE FOCUS RING are graphical marks: the host blue must clear
  // 3:1 against the paper/ink grounds it is drawn on (2px bar, filled square, ring).
  // It is NEVER text — the point of the pair checks below is that the only thing
  // that sits ON the blue is `--zmd-on-accent`.
  const accentGraphicIssues = []
  for (const which of ['light', 'dark']) {
    for (const ground of ['--zmd-panel', '--zmd-panel-deep', '--zmd-hover', '--zmd-wash-top', '--zmd-wash-bottom']) {
      const ratio = tokenRatio(which, '--zmd-accent', ground)
      if (ratio === null || ratio < AA_LARGE) {
        accentGraphicIssues.push(`--zmd-accent on ${ground} (${which}) = ${ratio === null ? 'unresolved' : ratio.toFixed(2)}`)
      }
      const focusRatio = tokenRatio(which, '--zmd-focus', ground)
      if (focusRatio === null || focusRatio < AA_LARGE) {
        accentGraphicIssues.push(`--zmd-focus on ${ground} (${which}) = ${focusRatio === null ? 'unresolved' : focusRatio.toFixed(2)}`)
      }
      const dangerRatio = tokenRatio(which, '--zmd-danger', ground)
      if (dangerRatio === null || dangerRatio < AA_LARGE) {
        accentGraphicIssues.push(`--zmd-danger on ${ground} (${which}) = ${dangerRatio === null ? 'unresolved' : dangerRatio.toFixed(2)}`)
      }
    }
  }
  check('contrast: the accent, the focus ring and the error mark clear 3:1 as graphics',
    accentGraphicIssues.length === 0, { accentGraphicIssues })
  const onAccentIssues = []
  for (const which of ['light', 'dark']) {
    const ratio = tokenRatio(which, '--zmd-on-accent', '--zmd-accent')
    if (ratio === null || ratio < AA_LARGE) {
      onAccentIssues.push(`--zmd-on-accent on --zmd-accent (${which}) = ${ratio === null ? 'unresolved' : ratio.toFixed(2)}`)
    }
  }
  check('contrast: --zmd-on-accent clears the graphical floor on the blue fill (it inks a glyph, not a word)',
    onAccentIssues.length === 0, { onAccentIssues })

  // (d) THE PAIRING IS ASSERTED IN THE SHEETS TOO, both ways: a blue fill states
  // its on-accent ink; a rule that states the on-accent ink is a blue carrier (fill
  // or 2px bar in the same rule). Ink of another role on the blue is the 3.91:1
  // failure this pair exists to prevent.
  const accentPairRules = []
  // The framed checkbox states the blue fill on the control and its tick on the
  // control's `::after`; the fill role and the ink role may live in two rules of
  // ONE object, so a sibling pseudo/state rule counts as the pair. The lookup key
  // is the selector with state pseudo-classes and pseudo-elements stripped.
  const baseOf = value => value
    .replace(/::?(?:before|after)/g, '')
    .replace(/:(?:checked|hover|focus-visible|focus-within|active|disabled|not\([^)]*\))/g, '')
    .replace(/\[[^\]]*\]/g, '')
  const accentCarrierSelectors = new Set()
  for (const [file, css] of sheetCss) {
    for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = rule[1].trim()
      if (!/var\(--zmd-on-accent\)/.test(rule[2])) continue
      accentCarrierSelectors.add(`${file}::${baseOf(selector)}`)
    }
  }
  for (const [file, css] of sheetCss) {
    for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = rule[1].trim()
      const fill = /(?:^|;)\s*background(?:-color)?\s*:\s*var\(--zmd-accent\)/.test(rule[2])
      const ownInk = /(?:^|;)\s*color\s*:\s*([^;}]+)/.exec(rule[2])?.[1]?.trim() ?? null
      if (fill && ownInk !== null && !/var\(--zmd-on-accent\)/.test(ownInk)) {
        accentPairRules.push(`${file}: ${selector} paints ${ownInk} on the blue fill`)
      }
      if (fill && ownInk === null && !accentCarrierSelectors.has(`${file}::${baseOf(selector)}`)) {
        accentPairRules.push(`${file}: ${selector} fills blue but states no on-accent ink`)
      }
      if (ownInk !== null && /var\(--zmd-on-accent\)/.test(ownInk)
        && !/(?:background|border-left)[^;}]*var\(--zmd-accent\)/.test(rule[2])) {
        accentPairRules.push(`${file}: ${selector} states on-accent ink without a blue carrier`)
      }
    }
  }
  check('contrast: the blue fill and --zmd-on-accent are always stated as a pair',
    accentPairRules.length === 0, { accentPairRules })

  // (e) NO HUD COLOUR SURVIVES. The signal tokens are gone from the token layer; a
  // sheet that still names one would resolve to nothing (and paint nothing), which
  // the undeclared-token check in the static gate catches. Here the CONTRAST
  // contract is stated: every measured style must be an ink role or a carrier.
  const undecodableInk = measured
    .filter(entry => entry.token.startsWith('--zmd-')
      && !ZMD_TEXT_TOKENS.has(entry.token) && entry.token !== '--zmd-on-accent')
    .map(entry => `${entry.style.selector}: ${entry.token}`)
  check('contrast: every zmd ink that is measured is a text role',
    undecodableInk.length === 0, { undecodableInk: [...new Set(undecodableInk)] })
}

console.log(failures === 0 ? 'contrast check: all good' : `contrast check: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
