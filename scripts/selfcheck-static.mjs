/**
 * Static gates for the parts of "would a reviewer call this wrong?" that a
 * machine can decide without taste. No build, no server, no browser.
 *
 *   1. colors: the sheet may not hardcode any color — only host `--dsw-*`
 *      semantic tokens (the whole surface has to follow the host skin);
 *   2. no dashed/dotted borders, and `border-radius` only `0` / `50%` / `var()`;
 *   3. the two composer narrow-row display variables are consumed, and the
 *      `:focus-visible`, `prefers-reduced-motion` and narrow-width branches exist;
 *   4. dead classes both ways: every `dmp-*` rule is used by the TSX, and every
 *      `dmp-*` class in the TSX has a rule;
 *   5. literal/template ARIA id references resolve to a declared id (a dangling
 *      `aria-controls` is a silent accessibility failure);
 *   6. the shadowing contract still holds: seat name, `priority: -10`, the
 *      service inject list, and the client manifest that makes the bundle loadable;
 *   7. the row badge contract: the model row states facts and offers no control,
 *      and the facts come from one place;
 *   8. the parameter panel's Host contract (provider directory join, `settings/
 *      mutate`, optional settings faces);
 *   9. copy: every `t(...)` key is defined, every dictionary entry is used, and
 *      zh/en define the same key set;
 *  10. the badge capsule stays COMPACT (the width budget was fought over twice:
 *      first for icons drawn too narrow, then for capsules that left the model
 *      name ~two characters) and the icon family draws one on-screen weight
 *      across its two viewBox grids;
 *  11. the provider scope is NOT persisted: the seat neither reads nor writes a
 *      stored filter, every open starts from the conversation's own provider, the
 *      scope follows the session boundary, and the keys an older build wrote are
 *      swept once under their pre-rename spelling;
 *  12. the component acts on every verdict the pure layer hands it;
 *  12b. the parameter panel's focus: where opening it lands, and the order `Tab`
 *      walks the controls in (which must be the order they are rendered in);
 *  13. transport failures SURFACE: a write or selection that rejects instead of
 *      answering, an ask that never reached an answer is retried, and every open
 *      re-reads the settings snapshot (an external edit must stay visible);
 *  14. the §5.18 anchor-loss rule: popovers dismiss when the seat root stops
 *      occupying the page;
 *  15. one package identity in the three places that must agree (bundle entry
 *      id, Loader row, locale namespace) while the swept `localStorage` prefix
 *      deliberately keeps its pre-rename spelling.
 *
 * The TRIGGER, not a chip, carries the provider: §5.26 folded the read-only
 * provider chip into the trigger's own `provider/model` label, so there is no
 * second surface to keep in sync with it.
 *
 * Run: node scripts/selfcheck-static.mjs
 *
 * @module dsh-rabbit-model-picker/selfcheck-static
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0

/**
 * Record one check.
 * @param label - what is being asserted.
 * @param ok - whether it held.
 * @param detail - evidence printed on failure.
 */
function check(label, ok, detail) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — ${JSON.stringify(detail)}`}`)
  if (!ok) failures += 1
}

/** Read one project file. */
function read(relative) {
  return readFileSync(resolve(root, relative), 'utf8')
}

/** Whether one project file is on disk at all. */
function exists(relative) {
  return existsSync(resolve(root, relative))
}

/** Remove block and line comments so prose never satisfies a check. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const CLASS_NAME = /dmp-[a-z0-9]+(?:-[a-z0-9]+)*/g

// A stylesheet is a TS template literal, so a backtick anywhere inside the CSS
// text — including in a comment that mentions a token by name — closes the
// literal early and turns the rest of the sheet into a syntax error. That
// failure is confusing (esbuild reports it as "Expected ';' but found …" in the
// middle of a comment), and it happened three times while this sheet was
// written, so it is gated rather than remembered.
//
// THE ASSERTION IS NOW STRONGER THAN "THE LITERAL IS NOT EMPTY", and the reason is
// an incident rather than a theory: a backtick pair added to a comment in
// `drawerStyles.ts` (line 97, quoting a class name) closed that sheet's literal
// after 1.2KB of its 14KB, and the OLD form of this check — `close >= 0 &&
// body.slice(0, close).includes('{')` — stayed GREEN, because a truncated literal
// still opens with a rule. What actually broke was downstream: `tsc` failed inside
// the stylesheet, and `check-contrast.mjs` silently lost 30+ assertions (the whole
// drawer half of its registry) while still printing its own name. A gate whose
// miss is invisible in another gate is the worst kind, so the shape is pinned
// instead of the emptiness: the closing backtick must sit at the END of its line.
// Every real sheet closes that way (`\`` alone on a line, or `\`;` with nothing
// after it before the newline), and a backtick used mid-line inside the CSS — in a
// rule or in a comment — cannot satisfy it.
for (const file of [
  'src/client/styles.ts',
  // docs/endfield-design-language.md §8: the design system owns the token layer
  // and the shared primitives, and its CSS is a template literal too. It
  // interpolates `${FONT_FACE}` / `${TOKENS}` (never a backtick), so the same
  // end-of-line shape applies — a prose backtick in one of its comments is the
  // same build-breaking accident this check exists for.
  'src/client/designSystem.ts',
  // `src/client/retryStyles.ts` was the retry card's own sheet on the shipped
  // Models page. The card moved INTO the 模型配置 page and its rules now live in
  // `modelConfigStyles.ts` with the page's other `dmc-` rules, so the sheet (and
  // its `drc-` domain) is deleted rather than left as a second design system —
  // the "gone from disk, not merely unreferenced" assertion further down owns
  // that, so this list simply stops naming it.
  'src/client/modelConfigStyles.ts',
  'src/client/catalogStyles.ts',
]) {
  const source = read(file)
  const open = source.indexOf('const CSS = `')
  check(`${file}: the CSS template literal is present`, open >= 0, { file })
  if (open < 0) continue
  const body = source.slice(open + 'const CSS = `'.length)
  const close = body.indexOf('`')
  const afterClose = body.slice(close + 1, close + 2)
  const closesItsOwnLine = close >= 0 && (afterClose === '\n' || afterClose === '\r')
  check(`${file}: no stray backtick inside the CSS text`,
    closesItsOwnLine && body.slice(0, close).includes('{'),
    {
      firstBacktickAt: close,
      closesItsOwnLine,
      afterClose,
      cssBytes: close,
      // The offending line, so the report names the comment that broke the literal.
      line: close < 0
        ? null
        : source.slice(0, open + 'const CSS = `'.length + close).split(/\r?\n/).length,
    })
}

const stylesSource = read('src/client/styles.ts')
const stylesCode = stripComments(stylesSource)
// `src/client/RetryCard.tsx` used to sit here: it rendered in the shipped Models
// section under its own `drc-` domain. It is DELETED this round (the retry policy
// is edited inline on the 模型配置 page instead), so it is no longer a surface
// whose `dmp-` classes and copy keys this seat-level half has anything to say
// about. Its replacement, `RetryEditor.tsx`, belongs to the `dmc-` domain and is
// listed in `MODEL_CONFIG_TSX` below — not here, because every `config.*` key it
// asks for comes from `modelConfigCopy.ts`, which the seat's `dictionary.ts`
// checks (used keys / dead keys, further down) do not own.
const tsxFiles = [
  'src/client/Picker.tsx',
  'src/client/BadgeIcons.tsx',
  'src/client/ProviderRail.tsx',
  'src/client/SettingsMenu.tsx',
]
// The non-TSX modules are scanned too, for the copy keys they ask for and the
// row contract they implement; only the TSX half can carry a `dmp-*` class.
const contractFiles = [
  ...tsxFiles,
  'src/client/badges.ts',
  'src/client/effort.ts',
  'src/client/panelCopy.ts',
  // The retry editor's arithmetic (`retryWaitCurve` / `waitRange` / the two
  // parsers). It carries no class of its own and no copy key — the `dmp-` class
  // checks below cannot reach it, and `test-retry-policy.mjs` owns its numbers;
  // it stays listed because it is still one of the modules this plugin ships
  // into a user-visible surface, not because these checks read anything from it.
  'src/client/retryPolicy.ts',
]
const tsxCode = stripComments(tsxFiles.map(read).join('\n'))
const contractCode = stripComments(contractFiles.map(read).join('\n'))
// The TSX is also read RAW (comments intact) for the inline-style and
// component-consumption assertions below: `stripComments` would happily delete
// the very line a mutation lives on if it sat next to a trailing comment, and
// those two checks exist precisely to see what the TSX writes.
const tsxSource = tsxFiles.map(read).join('\n')

// --- 1. colors -------------------------------------------------------------
const hardcoded = [...stylesCode.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g)].map(m => m[0])
check('colors: no hardcoded color values in the sheet', hardcoded.length === 0, { hardcoded })
check(
  'colors: the sheet uses host --dsw-* semantic tokens',
  (stylesCode.match(/--dsw-/g) ?? []).length >= 10,
)

// --- 2. borders and radii --------------------------------------------------
check('borders: no dashed/dotted', !/dashed|dotted/.test(stylesCode))
// §3 of docs/endfield-design-language.md: ALL right angles, and the only circle
// is a state dot. The old rule accepted `var(--dsw-radius-*)`; that allowance is
// DELETED rather than widened, because the host radius tokens are non-zero and
// accepting them is exactly how a rounded corner comes back under a token name.
// 50% stays, but only on a `-dot` selector.
const radiusEntries = [...stylesCode.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .flatMap(rule => rule[1].split(',').map(part => part.trim()).filter(part => part !== '')
    .flatMap(selector => [...rule[2].matchAll(/border-radius:\s*([^;]+);/g)]
      .map(match => ({ selector, value: match[1].trim() }))))
const badRadius = radiusEntries
  .filter(entry => !(entry.value === '0' || entry.value === '0px' || entry.value === '50%'))
  .map(entry => `${entry.selector}: ${entry.value}`)
const badDotRadius = radiusEntries
  .filter(entry => entry.value === '50%' && !/-dot(?:[\s:.[]|$)/.test(entry.selector))
  .map(entry => entry.selector)
check('border-radius: only 0 / 50% (no host radius token)', badRadius.length === 0, { badRadius })
check('border-radius: a 50% circle is only a state dot', badDotRadius.length === 0, { badDotRadius })

// --- 2a. the sheet is a TEMPLATE LITERAL, so it may not contain one ---------
// A backtick anywhere inside the sheet ends the literal early and the CSS that
// follows is parsed as JavaScript: the build then fails with a ReferenceError
// about a fragment of prose (`card is not defined`, from a comment naming
// `.dmp-card`), which reads like a component bug and not like a typo in a
// comment. Hit twice while writing §5.25, once in each direction. A comment is
// documentation, not a place to quote a class with the delimiter that happens to
// build the file, so this is a hard rule rather than a style preference: the
// names are written plain, and this gate is why they can be.
const cssBody = stylesCode.slice(stylesCode.indexOf('const CSS = ') + 12)
const cssOpen = cssBody.indexOf('`')
const cssClose = cssBody.lastIndexOf('`')
check(
  'sheet: the CSS template literal contains no backtick of its own',
  cssOpen >= 0 && cssClose > cssOpen && !cssBody.slice(cssOpen + 1, cssClose).includes('`'),
  { backticks: [...cssBody.matchAll(/`/g)].length, cssOpen, cssClose },
)

// --- 2b. nothing may dim text behind the colour's back ----------------------
// `scripts/check-contrast.mjs` proves each style's own ink clears AA, but it
// measures the TOKEN: `opacity: 0.55` on the same rule renders the same token at
// 2.28:1 and leaves that gate green. Any property that fades or recolours the
// painted result has to be caught here instead, where every value is literal.
// (An ancestor's opacity has the same effect; the sheet sets none anywhere.)
const dimming = [...stylesCode.matchAll(/(?:^|[{;])\s*(opacity|filter|text-shadow|mix-blend-mode)\s*:\s*([^;}]+)/g)]
  .map(m => `${m[1]}: ${m[2].trim()}`)
check('contrast: no rule fades or blends its own text', dimming.length === 0, { dimming })

// The same prohibition has to cover INLINE styles, because the sheet is not the
// only place a paint can be changed: `style={{ opacity: 0.5 }}` on a text node
// renders 2.28:1 while every gate stays green (the sheet scan never sees it, and
// the contrast gate measures tokens, not pixels). Found by adversarial review.
const inlineStyles = [...tsxCode.matchAll(/style=\{\{([^}]*)\}\}/g)].map(m => m[1].trim())
const dimmingInline = inlineStyles.filter(body =>
  /(opacity|filter|textShadow|mixBlendMode|color|background)\s*:/.test(body))
check('contrast: no inline style on a TSX element dims or recolors text',
  dimmingInline.length === 0, { dimmingInline })

// And the inline styles that DO exist have to be the measured-placement object:
// anything else is a paint change nobody is auditing. Listing them by name keeps
// a new one from arriving unexamined.
const ALLOWED_INLINE = new Set(['visibility: \'hidden\', left: 0, top: 0'])
const unexplainedInline = inlineStyles.filter(body => !ALLOWED_INLINE.has(body))
check('contrast: every inline style is the placement object, and nothing else',
  unexplainedInline.length === 0, { unexplainedInline })

// Copy cannot be taken away from sighted users either. `role="img"` (or
// `aria-hidden`) on a node that renders a `t(...)` string removes the words from
// view while every other gate stays green: the dead-class check only asks whether
// a class appears SOMEWHERE in the TSX, and no gate otherwise owns the
// visual-vs-AT contract. Two things are hidden on purpose and named here rather
// than exempted by pattern: the badge FACE (`dmp-badges`), whose facts are
// restated in the row's `aria-label`, and the failure dot, which carries no text.
// The seat's own sheet is `dmp-`; the retry card renders in the Models section
// under `drc-` and draws a chart whose bars are decoration beside its own
// accessible name. Only the seat's classes are in scope here, matching the
// assertion's name.
const HIDDEN_COPY_ALLOWED = new Set(['dmp-badges', 'dmp-provider-failed-dot', 'dmp-rail-index'])
const hiddenCopy = []
for (const element of tsxSource.matchAll(/<(?:span|div|p|li|button)\b[^>]*>/g)) {
  const tag = element[0]
  if (!/role="img"|aria-hidden="true"/.test(tag)) continue
  const names = (/className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(tag)?.slice(1).find(Boolean) ?? '')
    .split(/\s+/).filter(Boolean)
  if (names.length === 0 || names.every(name => HIDDEN_COPY_ALLOWED.has(name))) continue
  if (names.every(name => !name.startsWith('dmp-'))) continue
  hiddenCopy.push({ tag: tag.replace(/\s+/g, ' ').slice(0, 130), classes: names })
}
check('a11y: no dmp-* element hides its own copy from sighted users',
  hiddenCopy.length === 0, { hiddenCopy })

// --- 3. required branches and the composer contract ------------------------
check(
  'composer: consumes --dsh-composer-model-text-display',
  stylesCode.includes('--dsh-composer-model-text-display'),
)
check(
  'composer: consumes --dsh-composer-model-icon-display',
  stylesCode.includes('--dsh-composer-model-icon-display'),
)
check('a11y: :focus-visible branch exists', stylesCode.includes(':focus-visible'))
check('motion: prefers-reduced-motion branch exists', stylesCode.includes('prefers-reduced-motion'))
check('narrow: @media (max-width) branch exists', /@media[^{]*max-width\s*:/.test(stylesCode))

// --- 4. dead classes, both directions --------------------------------------
const cssClasses = new Set([...stylesCode.matchAll(new RegExp(`\\.(${CLASS_NAME.source})`, 'g'))].map(m => m[1]))
const tsxClasses = new Set([...tsxCode.matchAll(new RegExp(`\\b(${CLASS_NAME.source})`, 'g'))].map(m => m[1]))
const deadInCss = [...cssClasses].filter(name => !tsxClasses.has(name)).sort()
const unstyledInTsx = [...tsxClasses].filter(name => !cssClasses.has(name)).sort()
check('classes: no dmp-* rule is unused', deadInCss.length === 0, { deadInCss })
check('classes: every dmp-* class in the TSX has a rule', unstyledInTsx.length === 0, { unstyledInTsx })

// --- 5. ARIA id references -------------------------------------------------
const declaredIds = [...tsxCode.matchAll(/\bid=\{`([^`]*)`\}/g)].map(m => m[1])
const referencedIds = [...tsxCode.matchAll(/aria-(?:controls|activedescendant|labelledby|describedby)=[^>]*?`([^`]*)`/g)]
  .map(m => m[1])
const shape = value => value.replace(/\$\{[^}]*\}/g, '*')
const declaredShapes = new Set(declaredIds.map(shape))
const dangling = [...new Set(referencedIds.map(shape))].filter(shapeOf => !declaredShapes.has(shapeOf)).sort()
check('a11y: every templated aria id reference has a declared id', dangling.length === 0, { dangling, declaredIds })

// --- 6. shadowing contract -------------------------------------------------
const entry = stripComments(read('src/client/index.ts'))
check(
  'seat: registers conversation.input.model',
  entry.includes("name: 'conversation.input.model'"),
)
check('seat: registers at priority -10 (shadows the shipped seat at 0)', /priority:\s*-10\b/.test(entry))
check(
  'seat: claims the target through slots.inject',
  entry.includes("slots.inject('conversation.input.model'"),
)
// `remote` / `remote.session` are required because the shared resolver reads
// them against the CALLER's fiber (caller-context tracking); omitting them makes
// the seat's inject face throw and the entry abdicate to the shipped seat.
for (const service of ['slots', 'sessions', 'modelDirectories', 'remote', 'remote.session']) {
  check(`inject: requires the "${service}" service`, entry.includes(`'${service}'`))
}

// --- 7. the parameter panel's Host contract ---------------------------------
const params = stripComments(read('src/client/params.ts'))
check(
  'params: reads the provider directory (settingsNs/settingsPath come from it)',
  params.includes('listConfigurableProviders'),
)
check('params: writes through settings/mutate', params.includes('settings.mutate('))
check('params: understands settings/conflict', params.includes('settings/conflict'))
check(
  'params: addresses the user layer by the same path as the effective value',
  params.includes('getPath(view.user, entryPath)'),
)
// The settings faces are read with `ctx.get(...)`, never listed in the required
// inject array: a deployment that mounts no settings controller must still get
// the picker (its panel reports the Host settings as unavailable), whereas a
// missing injectable would make the seat abdicate to the shipped one.
check(
  'params: the settings faces are optional, read via ctx.get',
  entry.includes("scope.get('remote.settings')") && entry.includes("scope.get('remote.llm')"),
)
// …and read AT READ TIME rather than captured at activation. Remote namespaces
// are mounted by their owners when those owners activate (DESIGN §2.2), so the
// two `ctx.get` calls can honestly answer "not yet" here. Captured once, that
// unlucky ordering became permanent and was then shown to the user as a claim
// about the DEPLOYMENT ("this deployment mounts no settings service"), with every
// write refused — the exact defect `CapabilityStore`'s own resolver exists to
// avoid. So the face must be a RESOLVER: `settingsFaceOf` returns a function,
// `ParamsStore` stores a function, and both read sites call it.
{
  // `settingsFaceOf` must return a closure, not the faces.
  const faceOf = /function settingsFaceOf\([\s\S]*?\n\}/.exec(entry)?.[0] ?? ''
  check(
    'params: the settings faces are resolved per read, not captured at activation',
    /return \(\) => \{/.test(faceOf) && !/^ {2}return \{ settings, llm \}/m.test(faceOf),
    { faceOf: faceOf.slice(0, 220) },
  )
  check(
    'params: ParamsStore stores a face RESOLVER, and its two read sites call it',
    /constructor\(private readonly face: \(\) => RemoteFace \| null\)/.test(params)
    && /const face = this\.face\(\)/.test(params)
    && (params.match(/const face = this\.face\(\)/g) ?? []).length === 2
    && !/this\.face\b(?!\()/.test(params),
    { calls: (params.match(/const face = this\.face\(\)/g) ?? []).length },
  )
}
check(
  'params: the seat inject list stays unchanged (the settings faces stay optional)',
  entry.includes("export const inject = ['slots', 'sessions', 'modelDirectories', 'remote', 'remote.session'] as const")
    && entry.includes("ctx.inject(['slots', 'sessions', 'modelDirectories', 'remote', 'remote.session']"),
)
check(
  'panel: renders the declaration it writes (namespace + path)',
  read('src/client/SettingsMenu.tsx').includes('settings.target'),
)
// A write that REJECTS (a dead transport, not a Host refusal) used to propagate
// out of `ParamsStore.write` into a `then` with no `catch`: `writing` stayed set
// forever, every control of the panel stayed disabled, and no message appeared.
// The store must convert the rejection into the same outcome a refused write
// takes, so the panel's existing refusal display is the only path needed.
const writeBody = /async write\([\s\S]*?private read\(\)/.exec(params)?.[0] ?? ''
check(
  'params: a write that rejects fails the write instead of hanging the panel',
  writeBody.includes('try {') && writeBody.includes('catch') && writeBody.includes('ok: false'),
  { writeBody: writeBody.slice(0, 160) },
)

// --- 7b. the facts the ADAPTER published ------------------------------------
// A route the settings document cannot address used to show no modality badge
// and no window while the panel drew both modality switches as OFF — a claim
// about the model that nothing had verified. The facts now come from the
// adapter's own catalog, and these assertions pin the decisions that keep that
// read honest: it never reaches an endpoint, it is resolved late enough to
// survive activation order, and it never becomes an edit.
const capabilities = stripComments(read('src/client/capabilities.ts'))
// The adapter-catalog reader: extracted from `index.ts` so the unit gate can
// drive it, and read here for the decisions that only source text can show.
const adapterCatalog = stripComments(read('src/client/adapterCatalog.ts'))
// The "did anything a subscriber can see change?" answer both stores publish
// through, and the two publish guards that consume it.
const snapshotEq = stripComments(read('src/client/snapshotEq.ts'))
// `contractCode` above deliberately covers only the files that can carry a
// `dmp-*` class or a copy key, so the contract itself is read on its own here.
const contractSource = stripComments(read('src/client/contract.ts'))

// A snapshot a store BUILDS cannot be compared by reference, so a publish that
// carries no change used to wake every subscriber anyway: `useSyncExternalStore`
// re-renders whenever the snapshot it reads stops being `Object.is`-equal to the
// last one. Both stores therefore have to compare CONTENT before publishing.
{
  check(
    'publish: both stores guard their publish with the shared content comparison',
    /if \(sameSnapshot\(this\.snapshot, next\)\) return/.test(capabilities)
    && /if \(sameSnapshot\(this\.snapshot, snapshot\)\) return/.test(params),
  )
  check(
    'publish: the comparison is a real structural one, not a reference check',
    /export function sameSnapshot/.test(snapshotEq)
    && /Array\.isArray\(left\)/.test(snapshotEq)
    && /Object\.keys\(left\)/.test(snapshotEq),
  )
  // The capability snapshot's lifecycle field was WRITE-ONLY: no surface read it
  // (`src/` checked), so it only ever made the snapshot differ from itself. Its
  // return would reinstate a re-render per read that reports nothing.
  check(
    'publish: the capability snapshot carries no write-only status field',
    !/CapabilityStatus/.test(contractSource) && !/readonly status: CapabilityStatus/.test(contractSource),
  )
  // The card's own "a read is still running" signal comes from the directory
  // store, which is the one that must keep its status.
  check(
    'publish: the directory status the card renders is untouched',
    /DirectoryStatus/.test(contractSource) && /readonly status: DirectoryStatus/.test(contractSource),
  )
}
check(
  'capabilities: a route the adapter only knows from configuration is never interrogated',
  capabilities.includes('entry.declared === true'),
)
check(
  'capabilities: the LLM face is resolved when a route is asked for, not at activation',
  entry.includes('new CapabilityStore(') && entry.includes("ctx.get('remote.llm')"),
)
check(
  'capabilities: an adapter-owned catalog is named by the route it serves',
  adapterCatalog.includes("'dsh-opencode-go'") && adapterCatalog.includes('opencodeGoModels'),
)
// "Not mounted yet" and "published none" are two different answers, and the
// store consumes them differently: `[]` is an ANSWER it never re-asks, a throw
// releases the ask for a later open. Collapsing them (returning `[]` for an
// absent namespace) consumed the one ask of an adapter whose Remote was still
// mounting, which is the async-mount race the store exists to absorb.
{
  const readFn = /export async function readCatalog[\s\S]*?\n\}/.exec(adapterCatalog)?.[0] ?? ''
  check(
    'capabilities: an unmounted adapter namespace throws instead of answering "published none"',
    /typeof face\?\.read !== 'function'\)\s*\{\s*throw/.test(readFn),
    { readFn: readFn.slice(0, 400) },
  )
  check(
    'capabilities: the adapter-catalog reader is wired through the store, not inlined',
    entry.includes('registerAdapterCatalogs(ctx, capabilities)')
    && !/ctx\.get\(`remote\.\$\{namespace\}`\)/.test(entry),
  )
}
check(
  'capabilities: the panel states a published fact beside the notice',
  read('src/client/panelCopy.ts').includes("'settings.input.capability'")
    && read('src/client/panelCopy.ts').includes("'settings.context.capability'"),
)
check(
  'capabilities: a route with nothing published gets no modality switch to misread',
  read('src/client/SettingsMenu.tsx').includes('showsInputSection(address, capability)'),
)
check(
  'capabilities: the row badges read the same published facts',
  stripComments(read('src/client/Picker.tsx')).includes('capability: catalog.routes['),
)
// A read that never reached an answer (the LLM face not mounted YET, a transport
// failure) used to consume the ask permanently: one bad race, and the provider's
// facts stayed absent for the whole page. These pin the three halves of the fix:
// the failed ask is released, an unanswered read is not cached as an empty
// answer, and a reader registered mid-flight re-runs the racing ask instead of
// being swallowed by the inflight guard.
check(
  'capabilities: an ask that never reaches an answer is released for a later try',
  /catch\s*\{[\s\S]*?unanswered\.add\(provider\)/.test(capabilities),
)
check(
  'capabilities: a failed directory read is not cached as an empty answer',
  /if \(!result\.ok\) throw/.test(capabilities),
)
check(
  'capabilities: a reader registered mid-flight re-runs the racing ask once it settles',
  capabilities.includes('this.requeue')
    && /requeue\.delete\(provider\)[\s\S]*?ensure\(\[provider\]\)/.test(capabilities),
)
// …and it re-runs it on BOTH settle paths. The re-run used to hang off the
// success branch alone, so a reader that arrived during an ask that FAILED — the
// async-mount race this store exists to absorb — was never re-run: mount order
// decided whether its facts ever arrived, and the parked entry stayed in the
// requeue set forever, later forcing a second read of an already-answered
// provider. The catch arm must therefore fall THROUGH to the settle, which is
// exactly what an early `return` there would prevent.
{
  const readBody = /private async read\([\s\S]*?\n  \}/.exec(capabilities)?.[0] ?? ''
  const catchBody = /catch\s*\{([\s\S]*?)\n {4}\}/.exec(readBody)?.[1] ?? null
  check(
    'capabilities: the failing arm does not return early (it settles like the answering one)',
    catchBody !== null && !/\breturn\b/.test(catchBody),
    { catchBody },
  )
  // The settle sits after the try/catch, not inside the success branch: the text
  // following the try/catch is where the re-run has to appear.
  const afterTryCatch = readBody.slice(readBody.indexOf(catchBody === null ? '\u0000' : catchBody))
  check(
    'capabilities: the re-run is a single settle after the try/catch, not a success-path tail',
    (readBody.match(/requeueRacingReader\(provider\)/g) ?? []).length === 1
    && afterTryCatch.includes('requeueRacingReader(provider)'),
    { calls: (readBody.match(/requeueRacingReader\(provider\)/g) ?? []).length },
  )
}

// --- 8. copy: every key used exists, every key defined is used --------------
// A stale `t('settings.openEdited')` after a rename renders the raw key, and a
// leftover dictionary entry is dead copy; neither is visible in a screenshot.
const dictionary = read('src/client/dictionary.ts')
const dictionaryKeys = new Set([...dictionary.matchAll(/^ {2}'([^']+)':/gm)].map(m => m[1]))
const zhKeys = new Set([...dictionary.slice(0, dictionary.indexOf('/** English dictionary')).matchAll(/^ {2}'([^']+)':/gm)].map(m => m[1]))
const enKeys = new Set([...dictionary.slice(dictionary.indexOf('/** English dictionary')).matchAll(/^ {2}'([^']+)':/gm)].map(m => m[1]))

/**
 * Every string literal passed to a `t(...)` call, following nested ternaries.
 * Literals inside a NESTED call are skipped: `join('.')` in a parameter is not a
 * copy key, and a separator would otherwise look like a missing dictionary entry.
 *
 * A `key:` property is collected too. `panelCopy.ts` returns copy as data
 * (`{ key: 'settings.busy' }`) so the per-state DECISION can be unit-tested, and
 * a table like that names its dictionary entries without calling `t` itself; the
 * `settings.` prefix is what keeps the two spellings apart from an unrelated
 * object field.
 * @param code - comment-stripped source.
 * @returns the keys the surfaces ask for.
 */
function usedTranslateKeys(code) {
  const keys = new Set()
  for (const match of code.matchAll(/\bkey:\s*'((?:settings|badge|provider|trigger|menu|search|group|effort|status|error|action|warning|empty|panel)\.[A-Za-z0-9.]+)'/g)) {
    keys.add(match[1])
  }
  for (const match of code.matchAll(/(?<![\w.])t\(/g)) {
    let depth = 0
    let index = match.index + match[0].length - 1
    const start = index
    for (; index < code.length; index += 1) {
      const character = code[index]
      if (character === '(') depth += 1
      else if (character === ')') {
        depth -= 1
        if (depth === 0) break
      }
    }
    let level = 0
    let direct = ''
    for (const character of code.slice(start + 1, index)) {
      if (character === '(') level += 1
      else if (character === ')') level -= 1
      if (level === 0) direct += character
    }
    for (const literal of direct.matchAll(/'([^']+)'/g)) keys.add(literal[1])
  }
  return keys
}

const usedKeys = usedTranslateKeys(contractCode)
const missingCopy = [...usedKeys].filter(key => !dictionaryKeys.has(key)).sort()
const deadCopy = [...dictionaryKeys].filter(key => !usedKeys.has(key)).sort()
check('copy: every t(...) key is defined', missingCopy.length === 0, { missingCopy })
check('copy: no dictionary entry is unused', deadCopy.length === 0, { deadCopy })
check(
  'copy: zh and en define the same keys',
  zhKeys.size === enKeys.size && [...zhKeys].every(key => enKeys.has(key)),
  { zhOnly: [...zhKeys].filter(key => !enKeys.has(key)), enOnly: [...enKeys].filter(key => !zhKeys.has(key)) },
)
check('copy: a literal join separator exists for modality lists', dictionaryKeys.has('settings.listJoin'))

// --- 8b. the 模型配置 tab: its own sheet, on its own terms -------------------
// A THIRD additive surface, so it gets its own domain rather than being folded
// into the `dmp-` checks above. Those assert the COMPOSER SEAT's contract
// (shadowing rank, badge grid, focus chain) and are meaningless here, while the
// rules that DO matter — dead classes both ways, no baked colours, the three
// responsive branches — are the same ones. Keeping the domains separate is what
// lets each surface's dead-rule check stay independent.
// `src/client/RetryEditor.tsx` joins this list this round: the inline retry
// editor is the new third surface of the `dmc-` domain, and it is a SEPARATE file
// from the page, so leaving it out would exempt the whole editor from the dead
// class sweep (a `dmc-retry-*` name that only the sheet spells would then read as
// live). It is deliberately NOT added to `tsxFiles`: every key it asks for is a
// `config.*` key owned by `modelConfigCopy.ts`, and the seat-level
// `dictionary.ts` checks above would report them all as missing copy.
const MODEL_CONFIG_TSX = ['src/client/ModelConfigPage.tsx', 'src/client/RetryEditor.tsx', 'src/client/ModelCatalog.tsx']
const MODEL_CONFIG_SHEETS = ['src/client/modelConfigStyles.ts', 'src/client/catalogStyles.ts']
const modelConfigCode = stripComments(MODEL_CONFIG_TSX.map(read).join('\n'))
const modelConfigSheet = stripComments(MODEL_CONFIG_SHEETS.map(read).join('\n'))
// The two sheets answer different questions about width. The PAGE lives inside the
// host settings panel, which hands it a fixed content column at ANY viewport, so
// its narrow branch must ask a CONTAINER query (see the check below). The old DRAWER is
// a fixed-position panel sized off the viewport (`width: min(460px, 100vw)`), so a
// viewport media query is the correct instrument there and is left alone. Keeping
// the two apart is what stops a `@media`-only regression in the page sheet from
// being masked by another surface's legitimate one.
const modelConfigPageSheet = stripComments(read('src/client/modelConfigStyles.ts'))
// The catalog region's own sheet, checked separately for the ONE row-shape reason the two
// cannot share: the drawer WAS a `position: fixed` panel whose width came from the
// viewport (`width: min(460px, 100vw)`), so a viewport media query is the correct
// instrument there — and its `.dmc-model-row` is a four-field form, which the house
// rules exempt from the one-1px-edge budget that governs the page's rows.
const modelConfigCatalogSheet = stripComments(read('src/client/catalogStyles.ts'))
// The state vocabulary may live in the page's own module rather than in a JSX
// attribute (`data-state={reading.answer}`, with `RowAnswer` spelling the three
// values), so the search for "which states does the TSX produce" reads the
// component AND the pure module it imports them from.
const MODEL_CONFIG_STATE_SOURCES = [...MODEL_CONFIG_TSX, 'src/client/modelConfigModel.ts']
const modelConfigStateCode = stripComments(MODEL_CONFIG_STATE_SOURCES.map(read).join('\n'))
const DMC_CLASS = /dmc-[a-z0-9]+(?:-[a-z0-9]+)*/g

// WHICH `dmc-` TOKENS IN THE TSX ARE CLASSES, AND WHY THIS IS NO LONGER A RAW
// TOKEN SCAN. §5.33 puts ARIA ids in the same domain on purpose: the frozen
// contract requires `id={`dmc-retry-${provider}`}` on the editor and
// `aria-controls={`dmc-retry-${provider}`}` on the page's trigger, and the two
// numeric fields go one step further (`dmc-retry-count-${provider}` /
// `dmc-retry-cap-${provider}`, each the target of its own `<label htmlFor>`).
// A raw scan reads those id strings as class names and demands a CSS rule for
// `dmc-retry-count` — a rule that CANNOT exist, because that token is an id. The
// class half therefore reads what the JSX declares as a class.
//
// THE NARROWING IS CLOSED, not trusted: the assertion right below walks EVERY
// `dmc-` token in the TSX and requires each one to be either a class here or an id
// in an `id=`/`aria-controls=` template. A token that is neither is reported, so a
// class reaching the DOM some other way (a variable, a spread, a data attribute)
// cannot slip out of the sweep by not looking like a class attribute.
const dmcClassTokens = [...modelConfigCode.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{([^}]*)\})/g)]
  .flatMap(match => [...(match[1] ?? match[2] ?? match[3] ?? '').matchAll(new RegExp(DMC_CLASS.source, 'g'))])
  .map(match => match[0])
const dmcIdTokens = [...modelConfigCode.matchAll(/(?:^|\s)(?:id|aria-controls)=\{`([^`]*)`\}/g)]
  .flatMap(match => [...match[1].matchAll(new RegExp(DMC_CLASS.source, 'g'))])
  .map(match => match[0])
const dmcInSheet = new Set(
  [...modelConfigSheet.matchAll(new RegExp(`\\.(${DMC_CLASS.source})`, 'g'))].map(m => m[1]))
const dmcInTsx = new Set(dmcClassTokens)
const dmcTokensInTsx = new Set(
  [...modelConfigCode.matchAll(new RegExp(DMC_CLASS.source, 'g'))].map(m => m[0]))
const dmcIdSet = new Set(dmcIdTokens)
const unaccountedDmc = [...dmcTokensInTsx]
  .filter(name => !dmcInTsx.has(name) && !dmcIdSet.has(name)).sort()
const deadDmc = [...dmcInSheet].filter(name => !dmcInTsx.has(name)).sort()
const unstyledDmc = [...dmcInTsx].filter(name => !dmcInSheet.has(name)).sort()
check('model config: no dmc- rule is unused', deadDmc.length === 0, { deadInCss: deadDmc })
check('model config: every dmc- class in the TSX has a rule', unstyledDmc.length === 0, { unstyledInTsx: unstyledDmc })
check('model config: every dmc- token in the TSX is a class or an ARIA id (nothing hidden by the class reading)',
  unaccountedDmc.length === 0,
  { unaccounted: unaccountedDmc, tokens: [...dmcTokensInTsx].length })

// The frozen class contract, asserted by name so a rename cannot pass as a
// refactor. §13.5 froze exactly three NEW names and §13.4 retired four; the two
// dead-class sweeps above are generic and would not notice, say, `.dmc-readout`
// being spelled `.dmc-summary` in the sheet and in the TSX at once.
//
// §5.33 (the retry move) adds the two names that carry the NEW SHAPE: the inline
// editor's shell (`.dmc-retry`) and its one bordered control (`.dmc-retry-input`).
// They are the two the review has to be able to find by name — one proves the
// editor is a block of its own under the row rather than a cell inside the
// control line, the other proves the numeric field kept the edge the retired card
// recorded as necessary. The other nine `dmc-retry-*` names are covered by the
// generic sweeps above plus the contrast registry; freezing all eleven here
// would restate the sheet rather than pin the two contracts.
// §5.37 (the drawer becomes the row's region) freezes the names that carry the
// NEW SHAPE: the region itself (`.dmc-catalog-panel`, a grid child of the row), its
// one folding action (`.dmc-catalog-close`), and the head/body/foot that make it a
// region rather than a floating panel. They are pinned by name because the whole
// review is "is this still an overlay?", and a rename could otherwise move the
// surface back out of the row with every generic sweep staying green.
const DMC_NEW_CLASSES = ['dmc-readout', 'dmc-manage', 'dmc-well', 'dmc-field-label', 'dmc-field-value', 'dmc-catalog', 'dmc-discover-group', 'dmc-model-ref', 'dmc-model-edit', 'dmc-model-well', 'dmc-model-danger', 'dmc-retry', 'dmc-retry-input', 'dmc-catalog-panel', 'dmc-catalog-head', 'dmc-catalog-title', 'dmc-catalog-status', 'dmc-catalog-close', 'dmc-catalog-body', 'dmc-catalog-foot', 'dmc-catalog-guard']
// §5.35 retires the control line's own anatomy: the row no longer HAS a second
// segment of fixed tracks (`dmc-edit`), a credential cell (`dmc-key`), a
// diagnostic glyph (`dmc-error-toggle`) or a table cell for the lifecycle verb
// (`dmc-enable`). Their rules, their TSX and their copy-adjacent comments went with
// the shape change, and the rows now state their facts on one line with the
// controls in a settings well. `.dmc-catalog-count` is retired too: the model cell
// states its count inside its own label instead of hanging a bare number beside it.
// §5.37 retires the whole DRAWER family: the scrim, the fixed shell and every
// head/body/foot name that belonged to it. Listing them here is what makes the
// rename a contract rather than a sweep — a stray `dmc-drawer-*` rule or string in
// any of the three surfaces fails by name.
const DMC_RETIRED_CLASSES = [
  'dmc-list-head', 'dmc-list-head-cell', 'dmc-key-state', 'dmc-intro', 'dmc-title',
  'dmc-edit', 'dmc-enable', 'dmc-error-toggle', 'dmc-error-text', 'dmc-catalog-count',
  'dmc-model-actions', 'dmc-model-options', 'dmc-model-options-panel', 'dmc-model-remove',
  'dmc-drawer', 'dmc-drawer-scrim', 'dmc-drawer-head', 'dmc-drawer-heading',
  'dmc-drawer-title', 'dmc-drawer-sub', 'dmc-drawer-close', 'dmc-drawer-body',
  'dmc-drawer-foot', 'dmc-drawer-section', 'dmc-drawer-status', 'dmc-drawer-notice',
  'dmc-drawer-error', 'dmc-drawer-note',
]
const newClassState = DMC_NEW_CLASSES.map(name => ({ name, inSheet: dmcInSheet.has(name), inTsx: dmcInTsx.has(name) }))
check('model config: the frozen new classes exist in BOTH the sheet and the TSX',
  newClassState.every(entry => entry.inSheet && entry.inTsx), { newClassState })
// ...and each one must have a TOP-LEVEL rule of its own. A name that survives only
// inside a `@container` / `prefers-reduced-motion` override still satisfies the
// presence check above while the element renders with none of its intended type:
// deleting the base `.dmc-readout` rule (20px, the page's one large line) leaves
// the name in two narrow-branch selectors, and the dead-class sweeps stay green.
const newClassesWithoutBaseRule = DMC_NEW_CLASSES
  .filter(name => !new RegExp(`^\\.${name}\\s*\\{`, 'm').test(modelConfigSheet))
check('model config: each new class has a top-level rule, not only a narrow-branch override',
  newClassesWithoutBaseRule.length === 0, { newClassesWithoutBaseRule })
const retiredSeen = []
for (const file of [...MODEL_CONFIG_TSX, ...MODEL_CONFIG_SHEETS]) {
  const text = stripComments(read(file))
  for (const name of DMC_RETIRED_CLASSES) if (text.includes(name)) retiredSeen.push(`${file}: ${name}`)
}
check('model config: the retired classes are gone from every surface',
  retiredSeen.length === 0, { retiredSeen, retired: DMC_RETIRED_CLASSES })

const modelConfigHardcoded = [
  ...modelConfigSheet.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g),
].map(m => m[0])
check('model config: no hardcoded colour values', modelConfigHardcoded.length === 0, { modelConfigHardcoded })
const modelConfigBadRadius = [...modelConfigSheet.matchAll(/border-radius:\s*([^;]+);/g)]
  .map(m => m[1].trim())
  .filter(value => !(value === '0' || value === '0px' || value === '50%'))
check('model config: border-radius is only 0 / 50% (no host radius token)', modelConfigBadRadius.length === 0, { modelConfigBadRadius })
check('model config: no dashed/dotted borders', !/dashed|dotted/.test(modelConfigSheet))
const modelConfigDimming = [
  ...modelConfigSheet.matchAll(/(?:^|[{;])\s*(opacity|filter|text-shadow|mix-blend-mode)\s*:\s*([^;}]+)/g),
].map(m => `${m[1]}: ${m[2].trim()}`)
check('model config: no rule fades or blends its own text', modelConfigDimming.length === 0, { modelConfigDimming })
// §8 of the design language: the sheets read `var(--zmd-*)` from the token layer
// and host `var(--dsw-*)` where a semantic role exists. The old assertion demanded
// ten `--dsw-*` uses; that number is no longer the design (the token layer now
// owns paper/ink/signal), but the INTENT — the sheet must be fed by the theme, not
// by itself — is kept as "it names the token layer at all, and still names ≥10
// semantic tokens in total". A sheet that spells its own `--zmd-*` values is
// caught separately (the token-definition assertion in the design-system block).
check('model config: the sheets read the token layer (--zmd-*/--dsw-*)',
  (modelConfigSheet.match(/--zmd-/g) ?? []).length > 0
  && (modelConfigSheet.match(/--(?:zmd|dsw)-/g) ?? []).length >= 10,
  {
    zmd: (modelConfigSheet.match(/--zmd-/g) ?? []).length,
    dsw: (modelConfigSheet.match(/--dsw-/g) ?? []).length,
  })
check('model config: :focus-visible branch exists', modelConfigSheet.includes(':focus-visible'))
check('model config: prefers-reduced-motion branch exists', modelConfigSheet.includes('prefers-reduced-motion'))

// The narrow branch, re-stated. The old assertion was `/@media[^{]*max-width:/`,
// which is TRUE for any viewport media query — and on the PAGE a viewport one can
// never fire: the host hands this section a content column of a fixed width
// (measured 564px at a 1920px viewport, 106px at a 390px viewport), so a
// `max-width: 900px` media query is dead code on every desktop and the row kept
// demanding its 566px of fixed tracks inside a 106px column (measured overflow:
// 460px). The semantics are unchanged — "a narrow branch exists", hence the OR —
// but on this sheet the branch now has to exist in a form that can match, and the
// container it queries has to be established; the NEXT check is the one that
// demands that form. The OR is deliberately NOT a relaxation of the page's
// requirement: the catalog region is a different sheet (see the catalog assertion
// below), and it is held to the same container rule.
check(
  'model config: a narrow-container branch exists',
  /@container[^{]*max-width\s*:/.test(modelConfigPageSheet) || /@media[^{]*max-width\s*:/.test(modelConfigPageSheet),
  { containerBranches: (modelConfigPageSheet.match(/@container[^{]*\{/g) ?? []).length, mediaBranches: (modelConfigPageSheet.match(/@media[^{]*\{/g) ?? []).length },
)
check(
  'model config: the page sheet queries the CONTAINER (@container + container-type: inline-size)',
  /@container[^{]*max-width\s*:/.test(modelConfigPageSheet) && /container-type\s*:\s*inline-size/.test(modelConfigPageSheet),
  { hasContainerQuery: /@container[^{]*max-width\s*:/.test(modelConfigPageSheet), hasContainerType: /container-type\s*:\s*inline-size/.test(modelConfigPageSheet) },
)
// Stated as a ban, because a single survivor is enough to hide a regression: the
// page may carry NO viewport-width branch at all. Converting only the 520px branch
// to `@media` used to leave the 360px `@container` branch behind, which satisfied
// "a container query exists" while reintroducing the dead branch the audit found —
// and the only remaining `@media` on this sheet is the reduced-motion one.
check(
  'model config: the page sheet has no viewport-width branch at all (@media is for motion only)',
  !/@media[^{]*max-width\s*:/.test(modelConfigPageSheet),
  { mediaWidthBranches: (modelConfigPageSheet.match(/@media[^{]*max-width[^{]*/g) ?? []) },
)
// And the catalog region is inline now: it is a child of the page's own query
// container, so its narrow branch must be a @container query too. The old drawer
// was `position: fixed` and sized off the viewport, which is why it carried a
// viewport media query — that whole surface is gone, and the ban below is
// symmetric with the page's: no `@media (max-width: …)` may survive here.
check(
  'model catalog: the region asks the page CONTAINER, not the viewport',
  /@container[^{]*max-width\s*:/.test(modelConfigCatalogSheet)
  && !/@media[^{]*max-width\s*:/.test(modelConfigCatalogSheet),
  {
    containerBranches: (modelConfigCatalogSheet.match(/@container[^{]*\{/g) ?? []).length,
    mediaWidthBranches: (modelConfigCatalogSheet.match(/@media[^{]*max-width[^{]*/g) ?? []),
  },
)
// And it is placed by the ROW's grid, not by the window: the region starts at the
// name's spine and shares the scan line's track. A `position: fixed` or a floating
// box here is the regression this refactor exists to remove, so both are banned by
// name rather than left to the visual review.
check(
  'model catalog: the region is a grid child of the row (column 2, never fixed)',
  /\.dmc-catalog-panel\s*\{[^}]*grid-column\s*:\s*2\s*\/\s*-1/.test(modelConfigCatalogSheet)
  && !/\.dmc-catalog-panel\s*\{[^}]*position\s*:\s*fixed/.test(modelConfigCatalogSheet)
  && !/\.dmc-catalog-scrim/.test(modelConfigCatalogSheet),
  {
    hasGridColumn: /grid-column\s*:\s*2\s*\/\s*-1/.test(modelConfigCatalogSheet),
    fixedDecl: /position\s*:\s*fixed/.test(modelConfigCatalogSheet),
  },
)
// And the container property must sit on `.dmc-page` itself: `container-type` on
// some inner element would make every `@container` query below it resolve against
// a box that is not the one the host sizes.
const dmcPageRule = /\.dmc-page\s*\{([^}]*)\}/.exec(modelConfigPageSheet)
check('model config: .dmc-page is the query container',
  /container-type\s*:\s*inline-size/.test(dmcPageRule?.[1] ?? ''),
  { body: (dmcPageRule?.[1] ?? '').slice(0, 120).replace(/\s+/g, ' ') })

// The two state tokens are GRAPHIC-only. They measure 4.4976:1 and 4.2349:1 on
// the light ground — both UNDER the 4.5:1 AA floor for text — while clearing the
// 3:1 bar for graphical objects, which is why the row's scan rail and the focus
// ring may use them and a label may not. Asserted as "never reaches `color:`"
// rather than "never appears", because a blanket ban would forbid the exact uses
// the design depends on. See docs/design-model-config-tab.md §3.3.
const modelConfigTextColours = [
  ...modelConfigSheet.matchAll(/(?:^|[{;])\s*color\s*:\s*([^;}]+)/g),
].map(m => m[1].trim())
const stateTokenAsText = modelConfigTextColours.filter(value => /--dsw-alias-state-/.test(value))
check('model config: the state colour tokens never paint text',
  stateTokenAsText.length === 0, { stateTokenAsText })

// Text on the accent FILL is forbidden, and the reason is a MEASUREMENT rather
// than taste: the theme has no "ink on accent" role, and the white the retry
// sheet pairs with that fill measures 4.235:1 on the light ground and 2.3278:1 on
// the dark one — under the 4.5:1 floor every label in this sheet owes. The accent
// may carry an EDGE (the graphical 3:1 bar, which it clears) or a focus ring,
// never a background behind text. Found by review; the pairing was unmeasured
// until this gate existed, and the same pairing still sits in `drc-btn-primary`.
const accentFilledText = [...modelConfigSheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(rule => /background(?:-color)?\s*:\s*var\(--dsw-alias-state-business-primary\)/.test(rule[2])
    && /(?:^|;)\s*color\s*:/.test(rule[2]))
  .map(rule => rule[1].trim())
check('model config: no text sits on the accent fill (measured 4.235:1, an AA fail)',
  accentFilledText.length === 0, { accentFilledText })

// --- the state model (§2 as ruled by §13.6) ----------------------------------
// `data-state` is MUTUALLY EXCLUSIVE and names the row's ANSWER: `ready` /
// `missing-key` / `unreachable` in the list, `dormant` in the picker. A diagnostic
// is a separate boolean hook (`data-error="true"`) that may ride beside any answer,
// so a failed write marks the row without rewriting what the row says about itself.
// These four assertions are the whole contract in static form: the sheet may not
// invent a state, may not style a state the component cannot produce, and the
// component must produce the three answers plus the two hooks.
const DMC_STATES = ['ready', 'missing-key', 'unreachable', 'dormant']
const dmcStatesInSheet = new Set(
  [...modelConfigSheet.matchAll(/data-state\s*=\s*['"]([^'"]+)['"]/g)].map(m => m[1]))
const dmcWordsInCode = new Set(
  DMC_STATES.filter(state => new RegExp(`['"\`]${state}['"\`]`).test(modelConfigStateCode)))
check('model config: data-state is bound in the component',
  /data-state\s*=/.test(modelConfigCode), { bound: /data-state\s*=/.test(modelConfigCode) })
check('model config: the sheet styles no state outside the frozen four',
  [...dmcStatesInSheet].every(state => DMC_STATES.includes(state)),
  { inSheet: [...dmcStatesInSheet], allowed: DMC_STATES })
check('model config: every data-state the sheet styles is a state the component produces',
  [...dmcStatesInSheet].every(state => dmcWordsInCode.has(state)),
  { inSheet: [...dmcStatesInSheet], produced: [...dmcWordsInCode] })
check('model config: the component produces all three list answers',
  ['ready', 'missing-key', 'unreachable'].every(state => dmcWordsInCode.has(state)),
  { produced: [...dmcWordsInCode] })
// The diagnostic hook, and its one job: it is the `!` ENTRY beside the answer.
// §14 R2 settled the channel budget: the rail states "can this serve me" and
// nothing else, so `data-error` may not touch it, and it may not paint anything.
check('model config: the diagnostic is a separate data-error hook',
  /data-error\s*=/.test(modelConfigCode)
  && (/data-error=\{[\s\S]{0,120}?'true'/.test(modelConfigCode) || /data-error\s*=\s*['"]true['"]/.test(modelConfigCode)),
  { inCode: /data-error\s*=/.test(modelConfigCode), inSheet: /data-error/.test(modelConfigSheet) })
const errorRulePaints = [...modelConfigPageSheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(rule => /data-error/.test(rule[1]) && /(?:^|;)\s*(?:background|border)\s*:/.test(rule[2]))
  .map(rule => rule[1].trim())
check('model config: data-error paints nothing (the entry and the sentence carry it)',
  errorRulePaints.length === 0, { errorRulePaints })

// §14 R1 — THE ROW HAS NO REST FILL, not even for `unreachable`.
// The refactor's first ruling: a filled row became the loudest element on the page
// and fought the quiet-instrument direction, while §10.1 had already settled that
// ten rows are carried by the WORD (primary channel) with the rail as the redundant
// second. A third channel does not add information; it adds volume. So a row-level
// rule may paint a fill only while the pointer, the focus ring or an open catalog is
// present, and no `data-state` (or its `data-usable` alias) may paint at all.
const dmcRowBackgrounds = [...modelConfigPageSheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .flatMap(rule => {
    const value = /(?:^|;)\s*background\s*:\s*([^;}]+)/.exec(rule[2])?.[1]?.trim()
    if (value === undefined) return []
    return rule[1].split(',').map(part => part.trim())
      .filter(selector => /^\.dmc-row(?![a-z0-9-])/.test(selector))
      .map(selector => ({ selector, value }))
  })
const transientFill = selector => /:(?:hover|focus-within|active)|\[data-catalog|\[data-well/.test(selector)
const paintedRestFills = dmcRowBackgrounds.filter(entry => !transientFill(entry.selector) && !/^(?:transparent|none)$/i.test(entry.value))
const stateFills = dmcRowBackgrounds.filter(entry => /data-state|data-usable/.test(entry.selector))
const liveFills = dmcRowBackgrounds.filter(entry => transientFill(entry.selector))
check('model config: a row has no rest-state fill (the state travels on rail + word)',
  paintedRestFills.length === 0, { paintedRestFills })
check('model config: no data-state paints a row, unreachable included',
  stateFills.length === 0, { stateFills })
check('model config: the live fill survives for :hover / :focus-within / [data-catalog]',
  liveFills.length > 0 && liveFills.every(entry => /^var\(--(?:dsw|zmd)-/.test(entry.value)), { liveFills })
// …and since §4.23 of the design language the live fill is the token layer's
// `--zmd-hover` (the tone that keeps every ink legible in both themes), not a
// local tone rung. A row that hovers in `--zmd-line` measured 3.54–3.70:1 for the
// muted inks; the hover token is the fix, so it is pinned by name here.
check('model config: the live row fill is --zmd-hover',
  liveFills.length > 0 && liveFills.every(entry => entry.value === 'var(--zmd-hover)'),
  { liveFills })

// §14 R2 — the rail is the "can this serve me" channel and ONLY that: it branches
// on `data-state`, never on the diagnostic, and it is empty at rest.
const dmcRailRules = [...modelConfigPageSheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .flatMap(rule => rule[1].split(',').map(part => part.trim())
    .filter(selector => /^\.dmc-rail(?![a-z0-9-])/.test(selector))
    .map(selector => ({ selector, declarations: rule[2] })))
const railStateValues = new Set(
  dmcRailRules.map(entry => /data-state\s*=\s*['"]([^'"]+)['"]/.exec(entry.selector)?.[1]).filter(Boolean))
const railRestRule = dmcRailRules.find(entry => entry.selector === '.dmc-rail')
check('model config: the rail never branches on the diagnostic',
  dmcRailRules.every(entry => !/data-error/.test(entry.selector)),
  { railSelectors: dmcRailRules.map(entry => entry.selector) })
check('model config: the rail marks exactly missing-key and unreachable',
  railStateValues.size === 2 && [...railStateValues].every(state => state === 'missing-key' || state === 'unreachable'),
  { railStateValues: [...railStateValues] })
check('model config: the rail is empty at rest',
  railRestRule !== undefined && /(?:^|;)\s*background\s*:\s*transparent/.test(railRestRule.declarations),
  { rest: railRestRule?.declarations?.slice(0, 120).replace(/\s+/g, ' ') ?? null })

// §15.3 — THE DISABLED INK. A de-chromed control has no box, no fill and no edge;
// its ink IS its affordance, so the one state that must never look available is the
// unavailable one. Before this ruling the rest colour and the `:disabled` colour of
// the page's text actions were the SAME token, which made a control that cannot be
// pressed look exactly like one that can. The pair is now pinned: rest states the
// word in the PRIMARY ink, `:disabled` in the SECONDARY one.
//
// Only the classes the component actually disables are required to carry the pair
// (`disabled={…}` in the TSX). `.dmc-error-toggle` is never disabled, so demanding
// an ink step for a state that cannot occur would be a false assertion — if it ever
// gains one, the pair applies to it too (its entry is checked but not required).
const disabledInkRequired = [
  { sheet: 'page', name: '.dmc-key-action' },
  { sheet: 'page', name: '.dmc-key-clear' },
  { sheet: 'page', name: '.dmc-protocol' },
  { sheet: 'page', name: '.dmc-danger' },
  { sheet: 'catalog', name: '.dmc-btn' },
]
// The model cell is no longer a disabled-able control: reading the catalog is legal
// in a read-only deployment, so it keeps the quiet ink at rest and states no
// `:disabled` colour at all (the sweep above requires a registered style to state
// its own ink or size, which it does).
const disabledInkOptional = []
/**
 * The LAST `color` declaration a selector's own rule states, or null.
 * @param css - one comments-stripped sheet.
 * @param selector - the exact selector to look up.
 * @returns the declaration value, or null.
 */
function colourOfSelector(css, selector) {
  let found = null
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = rule[1].split(',').map(part => part.trim())
    if (!selectors.includes(selector)) continue
    const value = /(?:^|;)\s*color\s*:\s*([^;}]+)/.exec(rule[2])
    if (value !== null) found = value[1].trim()
  }
  return found
}
const disabledInkIssues = []
const disabledInkPairs = []
// §8 of the design language: the ink ladder is the token layer's now. The INTENT
// of §15.3 is unchanged (a resting action speaks in the primary ink, an
// unavailable one drops a step) and the assertion still pins the PAIR; only the
// token names moved from the host's label aliases to the `--zmd-*` roles. Both
// spellings are accepted so the sentence keeps its meaning whichever layer owns
// the role on a given surface.
const PRIMARY_INKS = ['--zmd-ink', '--dsw-alias-label-primary']
const SECONDARY_INKS = ['--zmd-ink-secondary', '--dsw-alias-label-secondary']
const inkTokenOf = value => /var\((--[a-z0-9-]+)\)/.exec(value)?.[1] ?? null
for (const entry of [...disabledInkRequired, ...disabledInkOptional]) {
  const css = entry.sheet === 'page' ? modelConfigPageSheet : modelConfigCatalogSheet
  const rest = colourOfSelector(css, entry.name)
  const disabled = colourOfSelector(css, `${entry.name}:disabled`)
  const required = disabledInkRequired.some(item => item.name === entry.name && item.sheet === entry.sheet)
  if (rest === null) { disabledInkIssues.push(`${entry.name}: no rest colour`); continue }
  if (disabled === null) {
    if (required) disabledInkIssues.push(`${entry.name}: the component disables it but the sheet states no :disabled colour`)
    continue
  }
  disabledInkPairs.push({ name: entry.name, rest, disabled })
  if (!PRIMARY_INKS.includes(inkTokenOf(rest))) disabledInkIssues.push(`${entry.name}: rest is not the primary ink (${rest})`)
  if (!SECONDARY_INKS.includes(inkTokenOf(disabled))) disabledInkIssues.push(`${entry.name}: disabled is not the secondary ink (${disabled})`)
  if (rest === disabled) disabledInkIssues.push(`${entry.name}: rest and disabled are the same ink`)
}
check('model config: an unavailable text action is dimmer than a resting one (primary rest -> secondary disabled)',
  disabledInkIssues.length === 0 && disabledInkPairs.length >= disabledInkRequired.length,
  { disabledInkIssues, disabledInkPairs })
// §5.35 — THE DIAGNOSTIC IS A SENTENCE IN THE WELL, not a glyph on the row. The
// `!` entry is retired with the control line: a failed write happens inside the
// well, so its sentence belongs at the top of that same well, read next to the
// controls that can change it. It carries no fill and no edge — it is a sentence —
// and the sheet paints it in the primary ink, because the state colour is under the
// 4.5:1 body bar and may never paint text.
// §5.35 — THE DIAGNOSTIC IS A SENTENCE IN THE WELL. It carries no fill: the state
// is carried by a 4px danger bar at its leading edge (a graphic, where the state
// colour clears 3:1) and by the words themselves, which are painted in the primary
// ink — the state colour is under the 4.5:1 body bar and may never paint text.
// The old assertion demanded "no fill and no edge"; §4.4 of the design language
// explicitly ADDS the red left bar, so the assertion is revised rather than
// dropped: the fill stays forbidden, the sentence's bar becomes required, and a
// full frame around the sentence is still a failure (it would read as a card).
const dmcDiagnosticRules = [...modelConfigPageSheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .flatMap(rule => rule[1].split(',').map(part => part.trim())
    .filter(selector => /^\.dmc-diagnostic(?![a-z0-9-])/.test(selector))
    .map(selector => ({ selector, declarations: rule[2] })))
const diagnosticChrome = dmcDiagnosticRules.filter(entry => {
  const border = /(?:^|;)\s*border\s*:\s*([^;}]+)/.exec(entry.declarations)?.[1]?.trim()
  const background = /(?:^|;)\s*background\s*:\s*([^;}]+)/.exec(entry.declarations)?.[1]?.trim()
  const sideBorders = [...entry.declarations.matchAll(/(?:^|;)\s*border-(top|right|bottom|left)\s*:\s*([^;}]+)/g)]
    .filter(([, side, value]) => !/^(?:none|0|0px)/.test(value.trim())
      && !(side === 'left' && /^4px solid var\(--zmd-danger\)$/.test(value.trim())))
  return (border !== undefined && !/^(?:none|0|0px)(?:\s|$)/.test(border))
    || (background !== undefined && !/^(?:transparent|none)$/i.test(background))
    || sideBorders.length > 0
})
const diagnosticHasBar = dmcDiagnosticRules.some(entry =>
  /(?:^|;)\s*border-left\s*:\s*4px solid var\(--zmd-danger\)/.test(entry.declarations))
check('model config: the diagnostic is a sentence — the danger bar, no fill, no frame',
  dmcDiagnosticRules.length > 0 && diagnosticChrome.length === 0 && diagnosticHasBar,
  { diagnosticChrome, diagnosticHasBar, selectors: dmcDiagnosticRules.map(entry => entry.selector) })

// THE 1px BUDGET, SPLIT INTO ITS THREE ROLES (§10 of docs/ink-design-language.md).
//
// The HUD revision split the same budget into structure / control / SIGNAL bar.
// The ink language keeps the split but changes the third role: the only bar is
// the HOST-BLUE 2px accent (`--zmd-accent`, graphic, ≥3:1) and the ERROR 4px bar
// (`--zmd-danger`, graphic). There is no signal colour any more — the yellow
// tokens, the yellow carrier pair and the 2–4px signal whitelist are RETIRED, not
// relaxed. The scarcity is still the same: a 1px edge is structure or a real form
// control; a bar is exactly the accent's 2px or the error's 4px, on the left, and
// nothing else may masquerade as either.
//
//   structure — `--zmd-line` / `--zmd-line-strong`, exactly 1px, any count;
//   control   — `--zmd-line-control` ONLY, exactly 1px, on the frozen form controls;
//   accent    — `--zmd-accent`, exactly 2px, LEFT edge only (current / selected);
//   danger    — `--zmd-danger`, exactly 4px, LEFT edge only (status rail / diagnostic).
const PAGE_CONTROL_EDGES = new Set(['input.dmc-key-action', '.dmc-protocol', '.dmc-retry-input'])
// The `+` instrument square from the HUD revision is gone (the add entry is a
// plain word action again, §6.4), so no mark edge exists. The set stays as the
// named extension point for a future real form field.
const PAGE_MARK_EDGES = new Set()
const STRUCTURE_LINE_TOKENS = new Set(['--zmd-line', '--zmd-line-strong'])
const CONTROL_LINE_TOKEN = '--zmd-line-control'
/** The only two bars in the language: token -> exact width in px. */
const BAR_WIDTHS = new Map([['--zmd-accent', 2], ['--zmd-danger', 4]])
const borderWidthOf = value => {
  const width = /(?:^|\s)(\d*\.?\d+)px/.exec(value)
  return width === null ? null : Number.parseFloat(width[1])
}
const borderTokenOf = value => /var\((--[a-z0-9-]+)\)/.exec(value)?.[1] ?? null
/** Every `border` / `border-<side>` declaration with a width, per selector. */
function edgeDeclarations(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(rule => {
    const selectors = rule[1].split(',').map(part => part.trim()).filter(part => part !== '')
    const declarations = [...rule[2].matchAll(/(?:^|;)\s*(border(?:-(?:top|right|bottom|left))?)\s*:\s*([^;}]+)/g)]
      .map(match => ({ property: match[1], value: match[2].trim() }))
      .filter(declaration => !/^(?:none|0|0px)$/.test(declaration.value))
    return selectors.flatMap(selector => declarations.map(declaration => ({ selector, ...declaration })))
  })
}
const pageEdges = edgeDeclarations(modelConfigPageSheet)
  .map(entry => ({ ...entry, width: borderWidthOf(entry.value), token: borderTokenOf(entry.value) }))
  .filter(entry => entry.width !== null)
const pageBars = pageEdges.filter(entry => BAR_WIDTHS.has(entry.token ?? ''))
const pageStructure = pageEdges.filter(entry => STRUCTURE_LINE_TOKENS.has(entry.token ?? ''))
const pageControls = pageEdges.filter(entry => entry.token === CONTROL_LINE_TOKEN)
const pageControlSelectors = [...new Set(pageControls.map(entry => entry.selector))].sort()
const pageEdgeRoleIssues = [
  // Every non-bar edge must name one of the three line roles; a host border alias
  // or a literal colour on an edge is not part of this language.
  ...pageEdges.filter(entry => !BAR_WIDTHS.has(entry.token ?? '')
    && !STRUCTURE_LINE_TOKENS.has(entry.token ?? '') && entry.token !== CONTROL_LINE_TOKEN)
    .map(entry => `${entry.selector}: ${entry.property}: ${entry.value}`),
  // A bar is the accent's 2px or the danger's 4px, on the LEFT edge only.
  ...pageBars.filter(entry => entry.property !== 'border-left'
    || entry.width !== BAR_WIDTHS.get(entry.token))
    .map(entry => `bar width/side: ${entry.selector}: ${entry.property}: ${entry.value}`),
  // A control edge is 1px and the control token; the registry check below says
  // which selectors may carry it.
  ...pageControls.filter(entry => entry.width !== 1)
    .map(entry => `control width: ${entry.selector}: ${entry.value}`),
  ...pageControlSelectors.filter(selector => !PAGE_CONTROL_EDGES.has(selector) && !PAGE_MARK_EDGES.has(selector))
    .map(selector => `unregistered control edge: ${selector}`),
  // A structure line is exactly 1px; 0.5px / 2px structural lines are a different
  // object (a hairline or a bar) wearing the structure token.
  ...pageStructure.filter(entry => entry.width !== 1)
    .map(entry => `structure width: ${entry.selector}: ${entry.value}`),
]
check('model config: the 1px budget is split — structure lines, registered control edges, accent/error bars',
  pageEdgeRoleIssues.length === 0
  && pageControlSelectors.length === PAGE_CONTROL_EDGES.size + PAGE_MARK_EDGES.size
  && pageStructure.length > 0,
  {
    pageEdgeRoleIssues,
    controlSelectors: pageControlSelectors,
    expectedControls: [...PAGE_CONTROL_EDGES],
    marks: [...PAGE_MARK_EDGES],
    structureLines: pageStructure.map(entry => `${entry.selector}: ${entry.value}`),
    bars: pageBars.map(entry => `${entry.selector}: ${entry.value}`),
  })
check('model config: every registered form control keeps exactly one 1px control edge',
  [...PAGE_CONTROL_EDGES].every(selector =>
    pageControls.filter(entry => entry.selector === selector).length === 1
    && pageControls.some(entry => entry.selector === selector && entry.width === 1 && entry.token === CONTROL_LINE_TOKEN)),
  { pageControls: pageControls.map(entry => `${entry.selector}: ${entry.value}`), expected: [...PAGE_CONTROL_EDGES] })
check('model config: a bar is exactly the 2px accent or the 4px error, on the left',
  pageBars.length > 0 && pageBars.every(entry =>
    entry.property === 'border-left' && entry.width === BAR_WIDTHS.get(entry.token)),
  { bars: pageBars.map(entry => `${entry.selector}: ${entry.value}`) })

// THE ACCENT GRAMMAR (§5 of the ink language). The HUD revision's signal-ink bar
// is gone; the accent is the host's own information blue, used as a GRAPHIC only:
// a 2px left bar (current / selected), a filled square behind an on-accent glyph,
// or the focus ring. It is never ink (3.91:1 in the light theme), and a blue fill
// carries `--zmd-on-accent` and nothing else. The error red has the same shape of
// restriction at 4px: graphics only, never a word.
const ACCENT_TOKEN = '--zmd-accent'
const ON_ACCENT_TOKEN = '--zmd-on-accent'
const DANGER_TOKEN = '--zmd-danger'
const barDeclarations = [...modelConfigPageSheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .flatMap(rule => rule[1].split(',').map(part => part.trim()).filter(part => part !== '')
    .flatMap(selector => [...rule[2].matchAll(/(?:^|;)\s*(border[a-z-]*|background[a-z-]*|color|text-decoration-color|outline[a-z-]*)\s*:\s*([^;}]+)/g)]
      .map(match => ({ selector, property: match[1], value: match[2].trim() }))))
const accentAsInk = barDeclarations
  // Only `color:` is forbidden: §5.1 explicitly allows the host blue as the HOVER
  // UNDERLINE (a text-decoration line is a graphic, not the glyphs) and §5 gives it
  // the focus ring. The word itself is what must stay ink.
  .filter(entry => entry.property === 'color'
    && entry.value.includes(`var(${ACCENT_TOKEN})`))
  .map(entry => `${entry.selector}: ${entry.property}: ${entry.value}`)
check('model config: the accent blue never paints text (3.91:1, graphic only)',
  accentAsInk.length === 0, { accentAsInk })
const dangerAsInk = barDeclarations
  .filter(entry => /^(?:color|text-decoration-color)$/.test(entry.property)
    && entry.value.includes(`var(${DANGER_TOKEN})`))
  .map(entry => `${entry.selector}: ${entry.property}: ${entry.value}`)
check('model config: the error red is a 4px bar, never a word',
  dangerAsInk.length === 0, { dangerAsInk })
// A blue fill states the ink it carries. The check is the PAIR: a rule that fills
// with the accent and states a `color` must state `--zmd-on-accent`; a rule that
// colours with on-accent must be the accent's carrier (fill or 2px bar in the same
// rule). This is what keeps a blue box from growing arbitrary text.
const accentFillRules = barDeclarations
  .filter(entry => /^background(?:-color)?$/.test(entry.property) && entry.value.includes(`var(${ACCENT_TOKEN})`))
  .map(entry => entry.selector)
/**
 * Whether a rule's blue FILL carries its on-accent ink on a child pseudo-element
 * (the framed checkbox draws its tick as `::after` borders), which is a legitimate
 * carrier: the fill role and the ink role are stated by two rules of one object.
 * @param selector - the rule declaring the fill.
 * @returns whether a paired pseudo rule states the on-accent ink.
 */
function pageHasAccentGlyph(selector) {
  return [...modelConfigPageSheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(other =>
    other[1].trim().startsWith(`${selector}::`) && /var\(--zmd-on-accent\)/.test(other[2]))
}
const accentPairIssues = []
for (const rule of [...modelConfigPageSheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]) {
  const body = rule[2]
  const fills = /(?:^|;)\s*background(?:-color)?\s*:\s*[^;}]*var\(--zmd-accent\)/.test(body)
  if (!fills) continue
  const selector = rule[1].trim()
  const ownInk = /(?:^|;)\s*color\s*:\s*([^;}]+)/.exec(body)?.[1]?.trim() ?? null
  if (ownInk !== null && !ownInk.includes(`var(${ON_ACCENT_TOKEN})`)) {
    accentPairIssues.push(`${selector}: ${ownInk} on the accent fill`)
  }
  if (ownInk === null && !pageHasAccentGlyph(selector)) {
    accentPairIssues.push(`${selector}: blue fill states no on-accent ink`)
  }
}
check('model config: a blue fill carries --zmd-on-accent ink only',
  accentPairIssues.length === 0,
  { accentPairIssues, accentFillRules })
// The page's structural/status bars must exist (the rail and the diagnostic carry
// the 4px error bar) and the add entry is a word action again (no left bar).
check('model config: the error bar survives on the rail and the diagnostic, and no yellow bar remains',
  pageBars.some(entry => entry.token === DANGER_TOKEN && entry.width === 4)
  && !/--zmd-signal/.test(modelConfigPageSheet),
  { bars: pageBars.map(entry => `${entry.selector}: ${entry.value}`) })
// §16/V2 — ONE ROW, TWO ENTRIES, TWO NAMES. The credential-clear entry and the
// lifecycle entry used to both read 删除, so the juror read a single row as
// offering the same destructive action twice. The credential entry now carries its
// own key (`config.key.clear`); this asserts the two keys resolve to DIFFERENT
// copy in both languages AND that the component actually asks for the new one — a
// key added to the dictionary but never rendered would satisfy neither half.
const copyFile = read('src/client/modelConfigCopy.ts')
const copyValue = (part, key) => {
  const found = new RegExp(`'config\\.${key.replace(/\./g, '\\.')}':\\s*'([^']*)'`).exec(part)
  return found === null ? null : found[1]
}
const zhCopyPart = copyFile.slice(copyFile.indexOf('export const zh'), copyFile.indexOf('/** English dictionary'))
const enCopyPart = copyFile.slice(copyFile.indexOf('/** English dictionary'))
const clearCopy = { zh: copyValue(zhCopyPart, 'key.clear'), en: copyValue(enCopyPart, 'key.clear') }
const removeCopy = { zh: copyValue(zhCopyPart, 'remove'), en: copyValue(enCopyPart, 'remove') }
check('model config: the credential-clear entry and the lifecycle entry have different words in both languages',
  clearCopy.zh !== null && clearCopy.en !== null && removeCopy.zh !== null && removeCopy.en !== null
  && clearCopy.zh !== removeCopy.zh && clearCopy.en !== removeCopy.en
  && /config\.key\.clear/.test(modelConfigCode),
  { clearCopy, removeCopy, usedInTsx: /config\.key\.clear/.test(modelConfigCode) })

// §5.35 — THE SCAN LINE IS A LEDGER, AND THE WELL IS A FORM. Two static halves of
// the alignment claim the live check measures:
//   1. the row lays out on SHARED TRACKS (a wrapping flex line would let each row's
//      cells march after each other's widths), and the answer word and the door are
//      RIGHT-ALIGNED, so their right edges coincide down the whole list;
//   2. the well is a two-column grid whose first column is the FIXED label track,
//      so a value and its name can never drift apart.
const dmcRowRule = /\.dmc-row\s*\{([^}]*)\}/.exec(modelConfigPageSheet)
check('model config: the scan line lays out on shared tracks, not a ragged flex wrap',
  /display\s*:\s*grid/.test(dmcRowRule?.[1] ?? '') && /grid-template-columns/.test(dmcRowRule?.[1] ?? ''),
  { body: (dmcRowRule?.[1] ?? '').slice(0, 200).replace(/\s+/g, ' ') })
const dmcVerdictEnd = /\.dmc-verdict\s*\{[^}]*justify-self\s*:\s*end/.test(modelConfigPageSheet)
const dmcManageEnd = /\.dmc-manage\s*\{[^}]*justify-self\s*:\s*end/.test(modelConfigPageSheet)
check('model config: the ledger\'s two right-hand cells are right-aligned',
  dmcVerdictEnd && dmcManageEnd, { verdict: dmcVerdictEnd, manage: dmcManageEnd })
const dmcWellRule = /\.dmc-well\s*\{([^}]*)\}/.exec(modelConfigPageSheet)
const dmcWellGrid = /display\s*:\s*grid/.test(dmcWellRule?.[1] ?? '')
const dmcWellLabelTrack = /grid-template-columns\s*:\s*\d+px\s+minmax\(0,\s*1fr\)/.test(dmcWellRule?.[1] ?? '')
check('model config: the settings well is a two-column form with a fixed label track',
  dmcWellGrid && dmcWellLabelTrack,
  { body: (dmcWellRule?.[1] ?? '').slice(0, 200).replace(/\s+/g, ' '), dmcWellGrid, dmcWellLabelTrack })

// The graphic-only label tiers, the sibling of the state-colour assertion above:
// tertiary / caption / dimmed are 3.605:1 / 2.077:1 / 1.228:1 on the light ground
// — under the 4.5:1 bar a body label owes — so a `color:` that reaches for one is
// the same defect as painting text in the error colour. The contrast gate measures
// every painted style as well; this keeps the rule visible in the static domain.
const dmcGraphicOnlyText = modelConfigTextColours
  .filter(value => /--dsw-alias-label-(?:tertiary|caption|dimmed)/.test(value))
check('model config: the tertiary/caption/dimmed label tiers never paint text',
  dmcGraphicOnlyText.length === 0, { dmcGraphicOnlyText })

// The registration itself, asserted where a regression would actually land. The
// section id must not become the shipped `models` cell (that is shadowing, which
// ADR 0003 rejected) and the registration must carry no `priority` (the
// shadowing rank). Both are ONE-LINE edits away, and neither fails loudly at
// runtime: the shipped Models page would simply stop appearing.
const indexSource = read('src/client/index.ts')
check('model config: registered under a NON-shipped section id',
  /id:\s*MODEL_CONFIG_SECTION_ID/.test(indexSource)
  && /MODEL_CONFIG_SECTION_ID = 'rabbit-model-config'/.test(indexSource),
  { id: /MODEL_CONFIG_SECTION_ID = '([^']*)'/.exec(indexSource)?.[1] ?? null })
const sectionRegistration = indexSource.slice(
  Math.max(0, indexSource.indexOf("scope.slots.inject('settings.section'")),
)
check('model config: the section registration carries no shadowing priority',
  sectionRegistration.length > 0 && !/priority/.test(sectionRegistration.slice(0, 600)),
  { head: sectionRegistration.slice(0, 200).replace(/\s+/g, ' ') })

// §5.33 — THE MOVE, ASSERTED WHERE IT COULD SILENTLY COME BACK. The retry card used
// to be registered into the SHIPPED Models section's keyed
// `settings.models.provider-card` seat, which is why the official page showed it.
// "Not registered any more" is the whole搬运: re-adding one `slots.inject(...)`
// line would put the card back on someone else's page while every other gate
// stayed green (the component and its copy would simply be used again).
//
// Asserted as an ABSENCE OF THE REGISTRATION, not as an absence of the words: the
// entry point still explains WHY nothing claims that seat, and deleting that
// explanation to satisfy a text search would trade a real hazard for a comment.
// The registration has two spellings — the seat claim and the registered name —
// so both are named.
const retrySeatClaim = /slots\.inject\(\s*'settings\.models\.provider-card'/
const retrySeatName = /name:\s*'settings\.models\.provider-card'/
check('model config: the shipped Models page\'s provider-card seat is no longer claimed',
  !retrySeatClaim.test(indexSource) && !retrySeatName.test(indexSource)
  && !/registerRetryCard|injectRetryStyles/.test(indexSource),
  {
    claimed: retrySeatClaim.test(indexSource),
    named: retrySeatName.test(indexSource),
    imports: /registerRetryCard|injectRetryStyles/.test(indexSource),
  })
// …and the retry editor's ARIA pair is the other half of the wiring. The trigger
// lives in `ModelConfigPage.tsx` and the element it controls lives in
// `RetryEditor.tsx`, so the generic `a11y: every templated aria id reference has a
// declared id` check above — which reads only the seat's TSX — cannot see it. The
// id is derived from the provider in both places; a mismatch (one file using the
// route, the other the display name) leaves `aria-controls` pointing at nothing,
// which no runtime error and no screenshot reports.
const retryControlIds = [...modelConfigCode.matchAll(/aria-controls=\{`([^`]*)`\}/g)].map(m => m[1])
const retryEditorIds = [...modelConfigCode.matchAll(/\bid=\{`(dmc-retry[^`]*)`\}/g)].map(m => m[1])
const ariaShape = value => value.replace(/\$\{[^}]*\}/g, '*')
const retryAriaPairs = retryControlIds
  .map(control => ({ control, shape: ariaShape(control) }))
  .filter(entry => entry.shape.startsWith('dmc-retry'))
check('model config: the retry trigger\'s aria-controls names an id the editor declares',
  retryAriaPairs.length > 0
  && retryAriaPairs.every(entry => retryEditorIds.map(ariaShape).includes(entry.shape))
  && retryEditorIds.length > 0,
  { controlIds: retryControlIds, editorIds: retryEditorIds })

// --- 9. the row badge contract ----------------------------------------------
// The row used to carry an interactive effort pill; effort is edited in the
// parameter panel now, and a row only STATES facts. These three assertions are
// what keeps that decision from silently coming back:
//   1. no effort control (or its class) is left in the row;
//   2. the strip is the read-only Tag primitive — a span, never a button;
//   3. every fact comes from `badgeSpecsOf`, so the badge copy has one owner.
const picker = stripComments(read('src/client/Picker.tsx'))
check(
  'badges: the model row renders no effort control',
  !/\bEffortMenu\b/.test(contractCode) && !/dmp-pill/.test(contractCode + stylesCode),
  { effortMenu: /\bEffortMenu\b/.test(contractCode), pillClass: /dmp-pill/.test(contractCode + stylesCode) },
)
check(
  'badges: the fact strip is built from the read-only Tag primitive',
  picker.includes('<Tag') && /import[\s\S]*?\bTag\b[\s\S]*?from '@deepseek-ai\/dsh-client-ui-primitives'/.test(picker),
)
check(
  'badges: every row fact resolves through badgeSpecsOf',
  picker.includes('badgeSpecsOf(') && read('src/client/badges.ts').includes('export function badgeSpecsOf'),
)

// --- 10. the badge capsule stays compact, and the family draws one weight ----
// Width is the scarce resource in a 320px card: the row must show a model name
// AND four fact capsules. These two assertions encode the budget that two
// rounds of feedback settled, so a later edit cannot quietly re-inflate the
// strip (or shrink the icon back into the sliver that started this).
const capsule = (selector, property) => {
  const block = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(stylesCode)
  return block === null ? null : new RegExp(`${property}\\s*:\\s*([^;]+);`).exec(block[1])?.[1].trim() ?? null
}
const cellWidth = capsule('.dmp-badge-fact', 'width')
const badgePadding = capsule('.dmp-badges .dmp-badge', 'padding')
const iconSize = /size = (\d+)/.exec(stripComments(read('src/client/BadgeIcons.tsx')))?.[1]
const cellPx = cellWidth === null ? NaN : Number.parseFloat(cellWidth)
const padPx = badgePadding === null ? NaN : Number.parseFloat(badgePadding.replace(/^0\s+/, ''))
check(
  'badges: the icon cell is no wider than the glyph it holds',
  Number.isFinite(cellPx) && Number.isFinite(Number(iconSize)) && cellPx <= Number(iconSize),
  { cellWidth, iconSize },
)
check(
  'badges: the capsule padding stays inside the compact budget',
  Number.isFinite(padPx) && padPx <= 5,
  { badgePadding },
)

// --- 10b. the fact grid: four fixed tracks, one source of widths ------------
// The 2026-10-15 pass turned the right-packed strip into a table: every row draws
// all four tracks in BADGE_FACTS order so the columns agree across rows and an
// absent fact shows as an empty track instead of shifting its neighbours. The
// budget therefore moved from "the capsules must be small" to "the four tracks,
// always reserved, must fit the same 320px card": 3 icons + 3 gaps + the window
// track. These assertions keep a later edit from either dropping the reserved
// tracks (which would silently restore the ragged strip) or re-inflating them.
const gridBlock = /\.dmp-badges\s*\{([^}]*)\}/.exec(stylesCode)?.[1] ?? ''
const gridTracks = /grid-template-columns:\s*([^;]+);/.exec(gridBlock)?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
/** One `--dmp-col-*` token's px value, read from the sheet. */
const columnPx = token => {
  const value = new RegExp(`${token}\\s*:\\s*([\\d.]+)px`).exec(stylesCode)?.[1]
  return value === undefined ? NaN : Number.parseFloat(value)
}
const iconCol = columnPx('--dmp-col-icon')
const windowCol = columnPx('--dmp-col-window')
const colGap = columnPx('--dmp-col-gap')
const stripPx = 3 * iconCol + 3 * colGap + windowCol
check(
  'badges: the strip is four tracks — three icons then the window — in one rule',
  /var\(--dmp-col-icon\)\s+var\(--dmp-col-icon\)\s+var\(--dmp-col-icon\)\s+var\(--dmp-col-window\)/
    .test(gridTracks),
  { gridTracks },
)
check(
  'badges: every row draws all four tracks through BADGE_FACTS',
  picker.includes('BADGE_FACTS.map'),
)
check(
  'badges: the always-reserved strip still fits the compact budget',
  Number.isFinite(stripPx) && stripPx <= 120,
  { stripPx, iconCol, windowCol, colGap },
)
// --- 10c. the horizontal budget: does the NAME still get room? --------------
// 10b proves the strip fits. That is only half the property, and it is the half
// that cannot fail alone: the name is the row's ELASTIC half (`flex: 1 1 auto`)
// and the strip is its fixed half, so squeezing the columns never changes the
// strip's width — it only takes room from the name. Mutation testing confirmed
// the gap: widening the rail to 260px, narrowing the card to 380px, raising the
// name's own floor to 96px and fattening the row padding to 30px ALL passed every
// gate in this repo, while each one quietly shrinks the name column.
//
// So this walks the real box model from the card down to the name and asserts the
// result. Every band is read out of the sheet, so the gate follows an edit rather
// than going stale beside it. Calibrated below against the two numbers the sheet's
// own comments record from the live GUI (a 331px model pane, a 175px name column)
// — if the arithmetic stops reproducing those, the gate says so instead of passing
// on a model that no longer describes the card.
// The model column's own floor, from the stylesheet's own derivation: "the rail's
// 176px plus the 320px the model column needs, plus the card's own 4px of padding
// either side" (styles.ts, above `@media (max-width: 536px)`). It is a design
// intent rather than a rule in the sheet, so it is named here.
const MODEL_COLUMN_FLOOR = 320
/** The card is `100vw - 24px` under the 480px branch, where the narrow layout applies. */
const VIEWPORT_SLACK_NARROW = 24
/** The narrowest viewport the surfaces are actually measured at (DESIGN §5.24). */
const NARROWEST_MEASURED_VIEWPORT = 320

{
  /** One selector's property, as a number of px (NaN when absent). */
  const px = (selector, property) => {
    const raw = capsule(selector, property)
    if (raw === null) return NaN
    const value = /(-?[\d.]+)px/.exec(raw)
    return value === null ? NaN : Number.parseFloat(value[1])
  }
  /** The Nth space-separated component of a shorthand property, as px. */
  const partPx = (selector, property, index) => {
    const raw = capsule(selector, property)
    if (raw === null) return NaN
    const value = /(-?[\d.]+)px/.exec(raw.split(/\s+/)[index] ?? '')
    return value === null ? NaN : Number.parseFloat(value[1])
  }

  const menuPaddingX = 2 * px('.dmp-menu', 'padding')
  const railBasis = partPx('.dmp-rail', 'flex', 2)
  const railPadRight = partPx('.dmp-rail', 'padding', 1)
  const railBorderRight = px('.dmp-rail', 'border-right')
  const modelsPadLeft = px('.dmp-models', 'padding-left')
  const rowPadX = 2 * columnPx('--dmp-row-pad-x')
  const rowGap = px('.dmp-row', 'gap')
  const checkWidth = partPx('.dmp-check', 'flex', 2)
  const copyGap = px('.dmp-row-copy', 'gap')
  const nameFloor = px('.dmp-row-name', 'min-width')
  // The card's own width, and the viewport slack it is drawn against.
  const cardMax = Number.parseFloat(/min\(\s*([\d.]+)px/.exec(capsule('.dmp-card', 'width'))?.[1] ?? '')
  const viewportSlack = Number.parseFloat(/- ([\d.]+)px/.exec(capsule('.dmp-card', 'width'))?.[1] ?? '')
  const collapseAt = Number.parseFloat(/@media \(max-width:\s*([\d.]+)px\)/.exec(stylesCode)?.[1] ?? '')

  /** Every band, for one card width. */
  const atCardWidth = (card, { narrow = false } = {}) => {
    // In the narrow layout the rail is a strip ABOVE the list, so it costs no
    // width and `.dmp-models` drops its own left padding.
    const railOuter = narrow ? 0 : railBasis + railPadRight + railBorderRight
    const pane = card - menuPaddingX - railOuter
    const modelsLeft = narrow ? 0 : modelsPadLeft
    const rowInner = pane - modelsLeft - rowPadX
    return { pane, rowInner, name: rowInner - rowGap - checkWidth - copyGap - stripPx }
  }

  const design = atCardWidth(cardMax)
  // CALIBRATION. These two are the sheet's own recorded live-GUI measurements
  // (styles.ts: "the model pane is 331px and the name column is 175px on every
  // row"). Reproducing them is what makes the arithmetic below trustworthy: an
  // edit that moves either number is an edit that changed the measured layout, and
  // re-measuring is the only honest response to this gate going red.
  check(
    'layout: the budget model reproduces the measured pane and name column',
    Math.round(design.pane) === 331 && Math.round(design.name) === 175,
    { pane: design.pane, name: design.name },
  )
  // The name must not become the smaller half of the row. It is what ellipsizes,
  // so once the strip outweighs it every row stops identifying its own model —
  // which is the failure this whole budget exists to prevent.
  check(
    'layout: the name column keeps more room than the fact strip it sits beside',
    Number.isFinite(design.name) && design.name >= stripPx,
    { name: design.name, strip: stripPx },
  )
  // The two-pane card needs the rail plus a usable model column plus its own
  // padding, and it cannot be narrower than that: a card whose max width is under
  // it can never lay out as two panes at ANY viewport.
  const wideNeeds = railBasis + MODEL_COLUMN_FLOOR + menuPaddingX
  check(
    'layout: the card is wide enough to lay out as two panes at all',
    Number.isFinite(cardMax) && cardMax >= wideNeeds,
    { cardMax, wideNeeds },
  )
  // The name's floor is the point below which it stops identifying a model, and it
  // has to stay a MINORITY of the room its column gets. That distinction is the
  // whole reason this is a separate assertion: raising the floor does not change
  // the computed width at all (the name is elastic), so the budget arithmetic above
  // cannot see it — only comparing the two can. A floor at or above the room
  // available means the column is permanently below its own minimum, which is a
  // contradiction the browser resolves by overflowing the row.
  check(
    'layout: the name floor stays under the room the name column actually gets',
    Number.isFinite(nameFloor) && Number.isFinite(design.name) && nameFloor < design.name,
    { nameFloor, roomAvailable: design.name },
  )
  // …and the floor has to leave room for the name to be a name, which is a claim
  // about how many characters it shows rather than about a preferred number: at
  // 13px the name holds roughly one character per 7px, and a floor under three
  // characters is a column that cannot distinguish one model from another. This is
  // deliberately WEAK — the floor's real constraint is the viewport check below,
  // since a floor and a viewport are two ends of one budget. It is here so that a
  // floor collapsed to nothing is caught even if the viewport check would pass.
  const nameCharPx = 7
  check(
    'layout: the name floor still shows a few characters at the name\'s own type size',
    Number.isFinite(nameFloor) && nameFloor >= 3 * nameCharPx,
    { nameFloor, minimum: 3 * nameCharPx },
  )
  // …and the collapse breakpoint has to be exactly where that stops fitting.
  // These two numbers are one decision written twice, so an edit to either the rail
  // or the breakpoint alone is a contradiction: below the breakpoint the two-pane
  // layout would be squeezed past its floor, and above it the one-column layout
  // stays on screen with room to spare.
  check(
    'layout: the collapse breakpoint is exactly where the two panes stop fitting',
    Number.isFinite(collapseAt) && Number.isFinite(viewportSlack)
      && collapseAt - viewportSlack === wideNeeds,
    { collapseAt, slack: viewportSlack, expected: wideNeeds },
  )
  // The narrow layout is what a phone gets, so it has to keep the name readable at
  // a phone's width. Below this the name is under its own floor and the row
  // overflows. 320px is the narrowest width this project actually measures its
  // surfaces at (DESIGN §5.24 records 320/360/420/560/1280 as the five viewports
  // every row was checked at), so it is the widest honest bar to hold here.
  const narrowNeeds = VIEWPORT_SLACK_NARROW + menuPaddingX + rowPadX + rowGap + checkWidth
    + copyGap + stripPx + nameFloor
  check(
    'layout: the name stays readable at the narrowest measured viewport',
    Number.isFinite(narrowNeeds) && narrowNeeds <= NARROWEST_MEASURED_VIEWPORT,
    { narrowestViewport: narrowNeeds, measuredAt: NARROWEST_MEASURED_VIEWPORT },
  )
}

// The key under the search field is the other half of the same decision: the
// strip is only readable if the card names its columns, so the key has to exist
// in the sheet AND be rendered (the dead-class gate covers the reverse).
check(
  'badges: the card states which column is which, in the columns order',
  /\.dmp-legend\s*\{/.test(stylesCode) && picker.includes('dmp-legend-item')
    && /const legend[\s\S]*?'text'[\s\S]*?'image'[\s\S]*?'effort'[\s\S]*?'context'/.test(picker),
  { legendRule: /\.dmp-legend\s*\{/.test(stylesCode), legendOrder: /badge\.key\.text/.test(picker) },
)

// THE ICON FAMILY IS NOW ONE DRAWING HAND ON ONE GRID (§4.5 of the design
// language). The old assertion compared a 16-unit grid against the host's
// 24-unit brain glyph — it existed because the family mixed the two. §4.5 redraws
// all four facts as square technical glyphs on ONE 16-unit grid, so the honest
// assertion changed with the artwork: one stroke constant, one viewBox, one render
// size, and the on-screen weight still 1.4px (1.6 × 14/16). The intent — a later
// edit must not make one glyph thinner than its neighbours — is unchanged; the
// second grid it compared against no longer exists, so the comparison became a
// single-grid identity. The no-brain branch is asserted separately so a host glyph
// cannot quietly rejoin the family.
const icons = stripComments(read('src/client/BadgeIcons.tsx'))
const gridStroke = /BADGE_STROKE\s*=\s*([\d.]+)/.exec(icons)
const gridViewBox = /viewBox="0 0 16 16"/.test(icons)
const brainRejoined = /BRAIN_STROKE|viewBox=\{brain\s*\?|const BRAIN/.test(icons)
check(
  'badges: one 16-unit grid, one stroke constant, one render size',
  gridStroke !== null && gridViewBox && iconSize !== undefined && !brainRejoined,
  { gridStroke: gridStroke?.[1], gridViewBox, renderSize: iconSize, brainRejoined },
)
if (gridStroke !== null && iconSize !== undefined) {
  const size = Number(iconSize)
  const onScreen = Number(gridStroke[1]) * (size / 16)
  check(
    'badges: the glyphs draw 1.4px on screen (the language\'s line weight)',
    Math.abs(onScreen - 1.4) < 0.06,
    { stroke: gridStroke[1], size, onScreen: onScreen.toFixed(3) },
  )
}
// The icon family has exactly ONE state per fact: "the model has it". The
// slashed "not available" variant was removed because nothing could ever render
// it — the row keeps only `!off` facts (see `badges.ts`), so an `off` glyph was
// unreachable artwork that the design record still described as shipped. If a
// slash ever comes back it must come back with a render site, which is what this
// asserts: no `off` prop, no slash path, and the row still filtering on `off`.
const iconOffBranch = /readonly off\?|artworkOf\([^)]*,\s*off\)|\boff\s*=\s*false/.test(icons)
check(
  'badges: the icon family draws only the "has this fact" state',
  !iconOffBranch && !/SLASH/.test(icons),
  { offBranch: iconOffBranch, slash: /const SLASH[^=]*=/.exec(icons)?.[0] ?? null },
)
check(
  'badges: the row still drops `off` facts before drawing them',
  /specs\.filter\(spec => !spec\.off\)/.test(picker),
  { filter: /specs\.filter\([^)]*\)/.exec(picker)?.[0] ?? null },
)

// --- 11. the three 2026-10-02 follow-ups, each as an anti-regression gate ----
// a. The panel's scroll role. `MenuSurface` paints the card's fill as an
//    absolutely positioned `.material` child anchored to the surface's padding
//    box, so a SURFACE that scrolls drags that layer up with the content: the
//    lower part of the card loses its fill (the page shows through the panel's
//    own footer) and the layer's rounded corners appear mid-card. Measured on
//    the real GUI. Scrolling belongs to an inner body.
check(
  'panel: the settings surface itself never scrolls',
  /\.dmp-settings\s*\{[^}]*overflow:\s*hidden/.test(stylesCode)
    && !/\.dmp-settings\s*\{[^}]*overflow(-y)?\s*:\s*(auto|scroll)/.test(stylesCode),
  { settings: /\.dmp-settings\s*\{[^}]*\}/.exec(stylesCode)?.[0]?.replace(/\s+/g, ' ').trim() ?? null },
)
check(
  'panel: the scroll viewport is the inner body',
  /\.dmp-settings-body\s*\{[^}]*overflow-y:\s*auto/.test(stylesCode)
    && read('src/client/SettingsMenu.tsx').includes('className="dmp-settings-body"'),
)
// b. The trigger labels the model AND the effort in force beside it (the stock
//    picker's "name · level"). Two invariants the reversal must keep:
//      - the effort renders as TEXT, so it carries the readable ink, not the
//        chevron's caption grey — a future "make it subtler" edit would drop it
//        under AA, and the contrast gate only catches that if the rule exists;
//      - the middot is a CSS ::before, never a DOM node or accessible-name text,
//        so a screen reader hears trigger.ariaEffort's sentence, not a stray dot.
//    (This check once asserted the opposite — that the chip must NOT repeat the
//    effort. That decision was reversed on request; the classes are back on
//    purpose, so the gate now guards how they render rather than their absence.)
check(
  'trigger: the chip states the model and the effort in readable ink',
  /dmp-trigger-effort/.test(picker)
    && /\.dmp-trigger-effort\s*\{[^}]*color:\s*var\(--dsw-alias-label-(?:primary|secondary)\)/.test(stylesCode)
    && !/dmp-trigger-sep/.test(picker + stylesCode),
  {
    rendered: /dmp-trigger-effort/.test(picker),
    ink: /\.dmp-trigger-effort\s*\{[^}]*color:\s*var\((--dsw-alias-label-[a-z]+)\)/.exec(stylesCode)?.[1] ?? null,
  },
)
// c. The provider scope is NOT remembered any more (§5.26). It used to be a
//    per-session preference (§5.13): read on mount, written on every change.
//    §5.26 removed it, because the trigger beside the list now names
//    `provider/model` itself — a remembered scope would disagree with it the
//    moment a session resumed on another provider, and every open is supposed to
//    answer "what can I switch to from here" first. So the seat must neither read
//    nor write a stored scope, and the module that used to hold it must be gone.
const retiredScope = stripComments(read('src/client/retiredScope.ts'))
check(
  'filter: the provider scope is not read from or written to storage',
  !/readProviderFilter|rememberProviderFilter/.test(picker + retiredScope)
    && !/localStorage/.test(picker)
    && /setProviderFilter\(currentProviderId\)/.test(picker),
  {
    writes: /localStorage[^\n]*/.exec(picker)?.[0] ?? null,
    openScope: /setProviderFilter\(currentProviderId\)/.exec(picker)?.[0] ?? null,
  },
)
// c2. …and it still follows the SESSION boundary. The seat is not remounted when
//     the conversation changes, so a scope left over from the previous one would
//     point at a provider the new conversation has nothing to do with; the new
//     session's own provider is the answer (there is nothing remembered to read).
check(
  'filter: the scope follows the session boundary',
  /if \(scopeSession !== sessionId\)/.test(picker)
    && /setProviderFilter\(state\.current\?\.provider \?\? null\)/.test(picker),
  { boundary: /if \(scopeSession !== sessionId\)[\s\S]{0,200}/.exec(picker)?.[0]?.replace(/\s+/g, ' ').trim() ?? null },
)
// c2. …and the modules that held the removed mechanisms are GONE FROM DISK, not
//     merely unreferenced. This is a separate assertion because "nothing imports
//     it" and "nothing calls it" are different failures, and only the second was
//     covered: a file that comes back — a bad merge, a `checkout` of the wrong
//     tree, an editor restoring a deletion — is invisible to every check above,
//     since a dead module by definition calls nothing the other gates can see.
//     These three were all deleted deliberately: `ProviderMenu.tsx` (the provider
//     popover §5.25 folded into the rail), `prefs.ts` (the remembered scope §5.26
//     removed, replaced by `retiredScope.ts`'s one-way sweep) and `recent.ts`
//     ("recently used" §5.21/§5.16 removed). Their absence is the contract.
//     §5.33 adds the retry move's two: `RetryCard.tsx` (the card that lived in the
//     shipped Models page's keyed seat) and `retryStyles.ts` (its `drc-` sheet).
//     The retry policy now renders INSIDE this plugin's own 模型配置 page, so both
//     are deleted rather than kept as a second surface — and a `git checkout` of
//     the wrong tree, or an editor restoring a deletion, is exactly the accident
//     this list is here to catch.
//     §5.37 adds the drawer's pair: `ModelDrawer.tsx` (the floating model catalog)
//     and `drawerStyles.ts` (its fixed/scrim sheet). The catalog is now the row's
//     inline region (`ModelCatalog.tsx` / `catalogStyles.ts`), so the old paths
//     must stay gone rather than linger as a second, still-floating surface.
const REMOVED_MODULES = [
  'src/client/ProviderMenu.tsx',
  'src/client/prefs.ts',
  'src/client/recent.ts',
  'src/client/RetryCard.tsx',
  'src/client/retryStyles.ts',
  'src/client/ModelDrawer.tsx',
  'src/client/drawerStyles.ts',
]
const resurrected = REMOVED_MODULES.filter(exists)
check(
  'removed: the deleted modules stay deleted',
  resurrected.length === 0,
  { cameBack: resurrected },
)
// c3. …and nothing re-introduces them by import either. `existsSync` cannot see a
//     rename, and an import of a missing file would only fail at bundle time — so
//     this walks every source file rather than the handful already read above,
//     which keeps it independent of where in this script it runs.
const sourceFiles = readdirSync(resolve(root, 'src'), { recursive: true, encoding: 'utf8' })
  .filter(name => /\.tsx?$/.test(name))
const reimported = REMOVED_MODULES.filter((module) => {
  const specifier = `'./${module.split('/').pop().replace(/\.tsx?$/, '')}`
  return sourceFiles.some(name => read(`src/${name.split(sep).join('/')}`).includes(specifier))
})
check(
  'removed: nothing imports the deleted modules',
  reimported.length === 0,
  { imported: reimported, scanned: sourceFiles.length },
)
// c4. …and the retired IDENTITY is gone from every source file, not just from the
//     two module paths above. `existsSync` proves the file is absent and the import
//     walk proves nothing points at it; neither notices a `drc-` class left behind
//     in another sheet, or a comment in a file that survived claiming an exemption
//     from a module that no longer exists (which is worse than a dead rule: it
//     argues for the rule using evidence that is no longer in the tree).
//
//     SCOPED TO `src/`, deliberately: DESIGN/README legitimately narrate the
//     history — a name may appear there as the thing that was retired — while the
//     shipped source may not. `scripts/` is out of scope for the same reason: these
//     very checks quote the names in their own failure text.
const retiredNames = ['drc-', 'RetryCard', 'retryStyles', 'ModelDrawer', 'drawerStyles', 'dmc-drawer']
const resurrectedNames = []
for (const name of sourceFiles) {
  const relative = `src/${name.split(sep).join('/')}`
  const text = read(relative)
  for (const retiredName of retiredNames) {
    if (text.includes(retiredName)) resurrectedNames.push(`${relative}: ${retiredName}`)
  }
}
check(
  'removed: no source file still names the retry card, its sheet or its drc- domain',
  resurrectedNames.length === 0,
  { found: resurrectedNames, retired: retiredNames, scanned: sourceFiles.length },
)

// d. …and what is left of that record is a DATA contract: the keys an older build
//    wrote still exist in users' browsers, so the plugin sweeps them ONCE at
//    activation. Activation rather than a seat's mount, because the sweep is a data
//    migration: it is idempotent, it has nothing to do with a conversation, and a
//    session that never opens the card should not carry the dead entries either.
//    The prefix must be a PREFIX sweep under the OLD spelling, because the record
//    has two shapes (the per-session keys and the single unscoped key before them)
//    and a sweep looking for the new package name would miss every key it exists to
//    remove. (That second half is asserted in §15, where `pkg` is in scope.)
check(
  'filter: the retired scope record is swept once, under its old key spelling',
  /RETIRED_SCOPE_PREFIX = '([^']+)'/.test(retiredScope)
    && /key\.startsWith\(RETIRED_SCOPE_PREFIX\)/.test(retiredScope)
    && /ctx\.effect\(\(\) => retireStoredScope\(\), /.test(entry)
    && !/retireStoredScope/.test(picker),
  {
    prefix: /RETIRED_SCOPE_PREFIX = '([^']+)'/.exec(retiredScope)?.[1] ?? null,
    wiring: /ctx\.effect\(\(\) => retireStoredScope[^\n]*/.exec(entry)?.[0] ?? null,
  },
)
// e. The TRIGGER states the identity of the model in use: `provider/model` (§5.26).
//    The provider is a prefix rather than a chip beside it, and it is not a second
//    control: it exists because two providers really do offer the same model names,
//    so the seat has to say which one this conversation is on. With no model
//    selected there is no provider to prefix, and the label falls back to the
//    "select a model" / "loading" copy alone.
check(
  'trigger: the label is `provider/model`, and only when there is a provider',
  /const triggerLabel = currentProviderLabel === null \? modelName : `\$\{currentProviderLabel\}\/\$\{modelName\}`/.test(picker)
    && /const currentProviderLabel = currentProviderId === null \? null : providerNameOf\(currentProviderId\)/.test(picker)
    && /<span className="dmp-trigger-label">\{triggerLabel\}<\/span>/.test(picker),
  { label: /const triggerLabel[\s\S]{0,160}/.exec(picker)?.[0]?.replace(/\s+/g, ' ').trim() ?? null },
)
// e2. …and the card says the same thing about the same provider, WITHOUT the
//     words 「当前会话」: at rail width those words beside a name, a count and the
//     check squeeze the provider name into an ellipsis, which would gut the one job
//     this pane has. The marker is `aria-current` plus one step of font weight, and
//     §5.26 leaves the words nowhere else to live — the trigger's own label is the
//     subject of the seat now, and the rail's selected row (usually the same
//     provider, since every open starts there) is what agrees with it.
const providerRail = stripComments(read('src/client/ProviderRail.tsx'))
check(
  'filter: the session\'s provider is marked on its own rail row',
  /session: group\.id === state\.current\?\.provider/.test(picker)
    && /aria-current=\{option\.session \? 'true' : undefined\}/.test(providerRail)
    && /\.dmp-rail-row\[aria-current='true'\] \.dmp-rail-name\s*\{[^}]*font-weight/.test(stylesCode)
    && !dictionaryKeys.has('provider.sessionHere'),
  { mark: /aria-current=\{option\.session[\s\S]{0,90}/.exec(providerRail)?.[0]?.replace(/\s+/g, ' ').trim() ?? null },
)
// f. …while narrowing the LIST is still only ever the user's own choice — an
//    explicit one, held in `providerFilter`. §5.26 seeds that state from the
//    session's provider when the card opens, but the LIST must not read
//    `state.current` itself: a scope recomputed from the session on every render
//    would snap back the moment the user scoped to another provider, and the other
//    providers would be unreachable for the length of a conversation.
const groupsMemo = /const groups = useMemo<DisplayGroup\[\]>\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\)/.exec(picker)?.[0] ?? ''
check(
  'filter: only an explicit narrowing scopes the model list',
  groupsMemo.includes('providerFilter === null')
    && !/state\.current\?\.provider/.test(groupsMemo),
  { groups: groupsMemo.replace(/\s+/g, ' ').trim() },
)
// g. The rail holds every SCOPE, and its members come from exactly three places:
//    the unfiltered row, the loaded catalog, and the failures list. §5.21 removed
//    the unfiltered row from the popover because a menu row that is not a provider
//    is indistinguishable from one that is; §5.25 puts it back deliberately on a
//    surface where that objection does not hold — the rail IS a scope list, so
//    "everything" is a scope like any other, and it is the way back out of a
//    narrowing that the in-card strip used to provide. The retired "recently used"
//    pseudo-provider stays gone: it named pulsed history, not the catalog, and its
//    module was deleted outright rather than hidden.
//
//    What the gate protects is therefore the SHAPE of the list, not the absence of
//    a row: exactly three top-level elements, in this order — the literal
//    unfiltered row (id null, the total count), then the catalog spread, then the
//    failures spread — and no fourth row smuggled in behind either spread.
//
//    The memo's ELEMENT LIST is what is asserted, not a pattern over its text.
//    The body is split on its depth-0 commas, so every top-level element is one
//    row, and the claim becomes the plain one: element 0 is a literal carrying
//    `id: null`, elements 1 and 2 are whole spreads over the catalog and the
//    failure list, and there is nothing else.
//    Pattern-matching object literals instead was tried twice and was wrong both
//    times: `!/\{\s*id:\s*null/` without `m` anchored to the slice start, so a
//    re-added row on the next line stayed GREEN (caught by sabotage, 2026-10-04);
//    widening it to "no literal row at all" also matched the object bodies of the
//    two legitimate spreads and made the gate fail on correct code (same day).
//    Splitting on depth-0 commas cannot be fooled by either, and it catches a
//    handwritten row whatever id it carries.
//
//    The splitter walks the body character by character and skips over string and
//    template literals, so a comma inside a `'a},b'` cannot split an element in
//    half. Without that, such a comma makes the gate go RED on correct code —
//    fail-safe, never a false pass, but a gate that cries wolf gets deleted by
//    the next person. Comments need no handling here: `picker` was already run
//    through `stripComments` above, so a `// a, b` note has become empty text by
//    the time this runs (verified 2026-10-04 — handling them inside the splitter
//    would be unreachable code). Audited against string literals, `${x},${y}`,
//    nested generics and trailing commas (2026-10-04).
const optionsBody = /const providerOptions = useMemo<ProviderOption\[\]>\(\(\) => \[([\s\S]*?)\n  \], \[[^\]]*\]\)/.exec(picker)?.[1] ?? ''
/**
 * Split an expression body on its depth-0 commas: one element per top-level row.
 * String and template literals are traversed but never split on.
 */
function topLevelElements(body) {
  const elements = []
  let depth = 0
  let start = 0
  let index = 0
  while (index < body.length) {
    const char = body[index]
    // A string/template literal is stepped over wholesale: only its LENGTH matters.
    if (char === "'" || char === '"' || char === '`') {
      let cursor = index + 1
      while (cursor < body.length) {
        if (body[cursor] === '\\') cursor += 2
        else if (body[cursor] === char) break
        else cursor += 1
      }
      index = cursor + 1
      continue
    }
    if ('([{'.includes(char)) depth += 1
    else if (')]}'.includes(char)) depth -= 1
    else if (char === ',' && depth === 0) {
      elements.push(body.slice(start, index).trim())
      start = index + 1
    }
    index += 1
  }
  const tail = body.slice(start).trim()
  if (tail !== '') elements.push(tail)
  return elements.filter(element => element !== '')
}
const optionRows = topLevelElements(optionsBody)
/**
 * The spread each element is (`orderedGroups`/`state.failures`), or null when the
 * element is not exactly one whole spread.
 *
 * "Exactly" is load-bearing, and it is the third thing this gate got wrong. An
 * element that merely STARTS with `...orderedGroups.map(` can still smuggle rows
 * in behind it: `...orderedGroups.map(g => ({…})).concat([{ id: null, … }])` was
 * one top-level element whose first characters matched, so a re-added "all" row
 * passed under a green gate (adversarial probe, 2026-10-04).
 *
 * A regex cannot decide this: `^\.\.\.(\w+)\.map\(([\s\S]*)\)\s*$` matches the
 * smuggled element too, because the greedy group backtracks to the LAST `)` and
 * swallows `.concat([…])` whole. The `map(` call's closing paren has to be found
 * by DEPTH, and whatever follows it must be whitespace alone. So the call is
 * scanned parenthesis by parenthesis instead.
 */
function spreadCallOf(element) {
  const head = /^\.\.\.([\w.]+)\.map\(/.exec(element)
  if (head === null) return null
  let depth = 0
  for (let index = head[0].length - 1; index < element.length; index += 1) {
    // The literal arguments are stepped over, so a `)` inside them is not counted.
    if (element[index] === "'" || element[index] === '"' || element[index] === '`') {
      const quote = element[index]
      let cursor = index + 1
      while (cursor < element.length) {
        if (element[cursor] === '\\') cursor += 2
        else if (element[cursor] === quote) break
        else cursor += 1
      }
      index = cursor
      continue
    }
    if (element[index] === '(') depth += 1
    else if (element[index] === ')') {
      depth -= 1
      // Back at depth 0: the `map(` call just closed. Only whitespace may follow.
      if (depth === 0) return /^\s*$/.test(element.slice(index + 1)) ? head[1] : null
    }
  }
  return null
}
const spreadRows = optionRows.map(spreadCallOf)
const literalRows = optionRows.filter((element, index) => spreadRows[index] === null)
check(
  'provider rail: the unfiltered scope, then the catalog, then the failures — and nothing else',
  optionsBody !== ''
    && optionRows.length === 3
    // The unfiltered row is a literal, and it is the one addressed by `id: null`;
    // the other two are whole spreads, catalog first, failures last. Nothing is
    // prepended to the first and nothing is appended after the last.
    && literalRows.length === 1
    && literalRows[0] === optionRows[0]
    && /\bid:\s*null\b/.test(literalRows[0])
    && spreadRows[1] === 'orderedGroups'
    && spreadRows[2] === 'state.failures'
    && !/\bRECENT_ID\b/.test(optionsBody),
  {
    spreadRows,
    literalRows: literalRows.map(element => element.replace(/\s+/g, ' ').slice(0, 120)),
    memo: optionsBody.replace(/\s+/g, ' ').trim().slice(0, 220) || null,
  },
)
// h. …and no CHIP comes back beside the trigger. §5.25 stated the model's provider
//    as a separate read-only fact chip; §5.26 folded it into the trigger's own
//    label, so a second element naming the same provider would be the seat saying
//    the same thing twice — and it would cost the model name the width it does not
//    have. The class, its two inner parts and its copy key must all stay gone.
check(
  'trigger: no separate provider chip beside the trigger',
  !/dmp-provider(?![-a-z])/.test(picker + stylesCode)
    && !dictionaryKeys.has('provider.chipTip')
    && !/provider\.chipTip/.test(picker),
  {
    inPicker: /dmp-provider(?![-a-z])[\s\S]{0,60}/.exec(picker)?.[0]?.replace(/\s+/g, ' ').trim() ?? null,
    inSheet: /\.dmp-provider(?![-a-z])[\s\S]{0,60}/.exec(stylesCode)?.[0]?.replace(/\s+/g, ' ').trim() ?? null,
  },
)
// h2. The way OUT of a scope is the rail's own unfiltered row — the one row of
//     the rail that is a scope rather than a provider. §5.26 made the scope
//     transient (every open starts from the session's provider), so 「全部」 is no
//     longer the state a fresh open lands in; that makes this row MORE load-bearing,
//     not less: it is the only way to see every provider at once, and the target of
//     the hidden-hits strip below.
check(
  'filter: the rail carries the way back to every provider',
  /t\('provider\.all'\)/.test(optionsBody)
    && /\bid:\s*null\b/.test(optionRows[0] ?? '')
    && /onPick\(option\.id\)/.test(providerRail)
    && !/RECENT_ID|'recent'/.test(picker + providerRail),
  { all: /id: null[\s\S]{0,160}/.exec(optionsBody)?.[0]?.replace(/\s+/g, ' ').trim() ?? null },
)
// h3. …and the in-card strip is no longer a scope label: the rail states the
//     scope, so the strip exists for the one case the rail cannot cover — a query
//     whose hits the scope is hiding. That is not decoration: without it, typing a
//     model name while scoped reads as "no such model", and the way back is a pane
//     the user has no reason to look at. Pinned by the count it states, the copy
//     key, and the unfiltered write its button performs.
check(
  'filter: hidden hits under another provider are counted, with a way back',
  /className="dmp-filter-hint"/.test(picker)
    && /elsewhereCount > 0 &&/.test(picker)
    && /t\('provider\.elsewhere', \{ count: String\(elsewhereCount\) \}\)/.test(picker)
    && /className="dmp-filter-clear"[\s\S]{0,160}pickProvider\(null\)/.test(picker)
    && dictionaryKeys.has('provider.elsewhere')
    && dictionaryKeys.has('provider.showAll'),
  { hint: /elsewhereCount > 0[\s\S]{0,260}/.exec(picker)?.[0]?.replace(/\s+/g, ' ').trim() ?? null },
)
// h4. …and scoping keeps the card OPEN and hands the keyboard to the list it just
//     scoped. The old popover closed itself and re-opened the model card through
//     `show()`, which cost a round trip; the rail lives inside that card, so the
//     pick must land focus on the search box where the next keystroke belongs —
//     and must go through the one `pickProvider` path rather than setting the
//     scope in place (a second write path is how the scope and the list drift).
check(
  'filter: a rail pick scopes the list and hands focus to the search box',
  /const pickProvider = \(providerId: string \| null\): void => \{[\s\S]*?setProviderFilter\(providerId\)[\s\S]*?searchRef\.current\?\.focus\(\)/.test(picker)
    && /onPick=\{pickProvider\}/.test(picker)
    && !/closeProviderMenu|providerAt/.test(picker),
  { pick: /const pickProvider = [\s\S]{0,320}/.exec(picker)?.[0]?.replace(/\s+/g, ' ').trim() ?? null },
)

// h5. The `Tab` chain is READ FROM THE CARD, not assembled from refs. A hand-kept
//     list has to be kept in step with the JSX by hand, and three controls that
//     exist only in one state had drifted out of it — the search field's clear
//     button, the "show all providers" button, and the retry button on a failed
//     read. Since the card cancels `Tab` and walks its own chain, the browser
//     cannot reach them either: all three were pointer-only, and "reload the group
//     that failed to load" had no other way in at all (WCAG 2.1.1). `SettingsMenu`
//     lost its two switches to the same mistake (§5.10, caveat 2). The behavioural
//     rules live in `focusChain.ts` and are driven by the unit gate; what is
//     asserted here is that the component actually goes through them.
{
  const focusChain = stripComments(read('src/client/focusChain.ts'))
  check(
    'focus: the seat walks the chain it reads off the rendered card',
    /stepChain\(cardChainOf\(/.test(picker),
    { call: /stepChain\([^)]*\)/.exec(picker)?.[0] ?? null },
  )
  check(
    'focus: the chain is no longer assembled from refs by hand',
    !/const chain: \(HTMLElement \| null\)\[\] = \[railRefs/.test(picker),
  )
  // A model row is a `div` at tabIndex=-1, so a query for the platform's tabbable
  // elements alone would miss every row of the list.
  check(
    'focus: the chain selector includes [tabindex] so the rows are reachable',
    /\[tabindex\]/.test(focusChain) && /button/.test(focusChain) && /input/.test(focusChain),
    { selector: /CHAIN_SELECTOR = '([^']*)'/.exec(focusChain)?.[1] ?? null },
  )
  // A listbox is ONE tab stop: the rail's rows sit at 0 and -1, and a model row
  // uses that same -1 to mean "in the chain", so the role has to decide.
  check(
    'focus: the rail stays one tab stop rather than one per row',
    /getAttribute\('role'\) === 'option'/.test(focusChain) && /tabIndex === 0/.test(focusChain),
  )
  // `disabled` excludes; `aria-disabled` must NOT, because the rows carry it
  // during a write precisely so the keyboard is not dropped.
  check(
    'focus: a disabled control is excluded but an aria-disabled one is not',
    /disabled === true/.test(focusChain) && !/aria-disabled/.test(focusChain),
  )
  // Backward off the first member closes the seat — the keyboard's only way out.
  check(
    'focus: stepping back off the first member closes the seat',
    /next < 0\) return \{ kind: 'close' \}/.test(focusChain),
  )
}

// --- 12. the component has to CONSUME the decisions the pure layer makes -----
// `panelCopy.ts` is meticulously gated, and `test-params.mjs` drives it directly —
// which means a mutation in the COMPONENT's switch is invisible to every test:
// flipping `case 'reject': setCapacityError(true)` to `setCapacityError(false)`
// deletes the sticky-flag behaviour the unit gate was written for, and the whole
// suite still passes (adversarial review, round 2). These assertions close that
// gap from the other side: the pure layer decides, and the component is required
// to act on the verdict.
const settings = stripComments(read('src/client/SettingsMenu.tsx'))
/** The body of one `case 'x':` arm in a switch. */
function switchArm(source, label) {
  const start = source.indexOf(`case '${label}':`)
  if (start < 0) return null
  const rest = source.slice(start)
  const next = rest.slice(1).search(/\n\s*case '/)
  return next < 0 ? rest : rest.slice(0, next + 1)
}
const rejectArm = switchArm(settings, 'reject')
check(
  'panel: the component flags a rejected capacity (consumes capacityAction)',
  rejectArm !== null && /setCapacityError\(true\)/.test(rejectArm) && !/setCapacityError\(false\)/.test(rejectArm),
  { arm: rejectArm?.replace(/\s+/g, ' ').trim() ?? null },
)
const skipArm = switchArm(settings, 'skip')
check(
  'panel: the component writes nothing for a skipped capacity',
  skipArm !== null && !/write\(/.test(skipArm),
  { arm: skipArm?.replace(/\s+/g, ' ').trim() ?? null },
)
const unsetArm = switchArm(settings, 'unset')
check(
  'panel: an empty capacity un-declares through mutate',
  unsetArm !== null && /op: 'unset'/.test(unsetArm),
  { arm: unsetArm?.replace(/\s+/g, ' ').trim() ?? null },
)
const setArm = switchArm(settings, 'set')
check(
  'panel: a new capacity is declared through mutate',
  setArm !== null && /op: 'set'/.test(setArm) && /contextWindow/.test(setArm),
  { arm: setArm?.replace(/\s+/g, ' ').trim() ?? null },
)
// The field's own draft state must not be re-derived from the snapshot: the
// component reads `capacityDraft ?? contextField.value`, and the reset effect is
// keyed on the address and the committed value.
check(
  'panel: the capacity field derives its value and stores only a draft',
  /capacityDraft \?\? contextField\.value/.test(settings),
  { fallback: /capacityDraft \?\? [A-Za-z.]+/.exec(settings)?.[0] ?? null },
)
// The failure signal for text must not come from an ink the contrast gate has
// rejected: `.dmp-settings-alert` and the two error cards paint neutral text and
// carry the state in their fill and icons.
const alertBlock = /\.dmp-settings-alert\s*\{([^}]*)\}/.exec(stylesCode)
check(
  'panel: the refusal line uses readable ink, not the sub-AA error color',
  alertBlock !== null
    && /color:\s*var\(--dsw-alias-label-secondary\)/.test(alertBlock[1]),
  { block: alertBlock?.[1]?.replace(/\s+/g, ' ').trim() ?? null },
)

// --- 12b. §5.10 focus: where the panel puts focus, and in what order --------
// This defect survives every other gate here and survives a screenshot: opening
// the parameter panel put the caret in the context field, AND the `Tab` chain
// started there, while the card renders the two modality switches ABOVE it. So
// `Tab` walked backwards up the card (WCAG 2.4.3), and on touch that field's
// `inputMode="numeric"` summoned the keypad over a card anchored to the
// composer. Both halves are decidable from one file by comparing two orders:
// the selectors inside `chain()` and the order the JSX renders them in.
const chainBlock = /const chain = \(\): HTMLElement\[\] => \{([\s\S]*?)\.filter\(/.exec(settings)?.[1] ?? null
const CHAIN_SELECTOR = /'(\[[^\]]+\]|\.[a-z0-9-]+(?: input)?)'/g
const chainOrder = chainBlock === null ? [] : [...chainBlock.matchAll(CHAIN_SELECTOR)].map(match => match[1])
const rendered = settings.slice(settings.indexOf('return createPortal('))
/** Each chain selector, with where its control first appears in the returned JSX. */
const RENDERED_AT = [
  ['[role="switch"]', rendered.indexOf('<Switch')],
  ['.dmp-settings-input input', rendered.indexOf('dmp-settings-input')],
  ['.dmp-effort-item', rendered.indexOf('dmp-effort-item')],
  ['.dmp-settings-reset', rendered.indexOf('dmp-settings-reset')],
]
const renderOrder = RENDERED_AT
  .filter(([, at]) => at >= 0)
  .sort((left, right) => left[1] - right[1])
  .map(([selector]) => selector)
// The one documented exception to "chain == render order": 「恢复默认」 is painted
// in the card header, top right, and is walked LAST anyway. A destructive action
// must not be what the first `Tab` lands on, and the panel's initial focus is the
// card itself — so the first `Tab` off the card reaches a switch, not the reset.
const expectedChain = [...renderOrder.filter(selector => selector !== '.dmp-settings-reset'), '.dmp-settings-reset']
check(
  '§5.10: the focus chain is in the order the panel renders its controls',
  renderOrder.length === RENDERED_AT.length
    && chainOrder.length === expectedChain.length
    && chainOrder.every((selector, index) => selector === expectedChain[index]),
  { chain: chainOrder, rendered: renderOrder },
)
// The panel takes initial focus, not a control: a text field here summons the
// keypad, arms a blur-commit, and is announced in place of the card's own name.
// Read-only needs no special case for it either — the card can always focus,
// where every control is disabled.
check(
  '§5.10: opening the panel focuses the panel itself, not its first control',
  /tabIndex=\{-1\}/.test(settings)
    && /panelRef\.current\?\.focus\(\)/.test(settings)
    && !/chain\(\)\[0\]/.test(settings),
  { tabIndex: /tabIndex=\{-1\}/.test(settings), focusesCard: /panelRef\.current\?\.focus\(\)/.test(settings) },
)
// `position` is re-measured on scroll and resize; re-running the focus effect
// there would drag focus out of whatever the seat was using — mid-edit in the
// capacity field, mid-arrow in the effort list.
check(
  '§5.10: re-measuring the card does not take focus back',
  /tookFocus\.current/.test(settings) && /if \(position === null \|\| tookFocus\.current\) return/.test(settings),
  { guard: /tookFocus\.current/.test(settings) },
)
// Focus on the card is only acceptable if it is visible (WCAG 2.4.7): the UA's
// default outline reads as a selection border on a floating card, so the ring is
// drawn in the same token the capacity field paints on `:focus-within`.
check(
  '§5.10: the focused panel paints a ring of its own',
  /\.dmp-settings:focus-visible\s*\{[^}]*outline:/.test(stylesCode),
  { rule: /\.dmp-settings:focus-visible\s*\{[^}]*\}/.exec(stylesCode)?.[0].replace(/\s+/g, ' ') ?? null },
)

// --- 13. transport failures surface, and every open re-reads the snapshot ---
// Two rejection paths used to vanish: `ParamsStore.write` could REJECT (a dead
// transport, not a Host refusal) into a `then` with no `catch` — the panel
// stayed disabled forever with no message — and the seat's selection had the
// same hole. And a snapshot that only moved when this plugin wrote kept an
// external edit (Settings → Models) invisible until the next write or a page
// reload. These gates pin the surfacing points, the re-read on every open, and
// the two host identifiers this plugin reads that no inspection face declares.
check(
  'transport: a rejected selection surfaces through the toast',
  /select\(selection\)\.then\(settleSelection\)\.catch\(/.test(picker),
)
check(
  'transport: opening the model menu re-reads the settings snapshot',
  /\{\s*if \(!open\) return\s*void params\.refresh\(\)\s*\}, \[open, params\]\)/.test(picker),
)
check(
  'transport: opening the parameter panel re-reads the settings snapshot',
  /useEffect\(\(\) => \{\s*void params\.refresh\(\)\s*\}, \[params\]\)/.test(settings),
)
check(
  'transport: the pinned provider ids and the toast anchor are present',
  picker.includes("'deepseek-account'") && picker.includes("'deepseek-official'")
    && picker.includes("'[data-composer-card]'"),
)

// --- 14. §5.18 anchor loss: the popovers must CLOSE, not drift --------------
// The bug this gates is invisible to every other check. The parameter panel is
// placed from a `position: fixed` anchor rect and portaled to the body, so when
// the Host elects a question card into `conversation.composer` and switches the
// composer bar to `display: none`, the panel does not fail — it SUCCEEDS at
// being placed, from a rect that is all zeros, and lands in the viewport corner
// (measured 265,787 → 12,12). Only a live GUI can see that, so these gates hold
// the parts that are decidable statically: the rule exists, it is wired to the
// seat root rather than to one anchor, and the wait it uses is one that still
// fires when the seat is off the page.
//
// The last of those is the one worth having a gate for. The obvious
// implementation waits with `requestAnimationFrame`, and it does not work: a
// `display: none` subtree stops the browser servicing the frame callback, so
// the confirmation is scheduled and never runs and the popover stays open
// forever — the original bug, unchanged. That was measured on the GUI, not
// reasoned about, and it would be trivially easy to reintroduce.
const anchorLoss = stripComments(read('src/client/anchorLoss.ts'))
check(
  '§5.18: a popover is dismissed when the seat root stops occupying the page',
  /export function seatLeftThePage/.test(anchorLoss)
    && /isConnected/.test(anchorLoss)
    && /getClientRects\(\)\.length/.test(anchorLoss),
  { hasRootProbe: /getClientRects\(\)\.length/.test(anchorLoss) },
)
// The wait must be a task-queue timer. A `requestAnimationFrame` confirmation is
// the exact defect described above, so its presence is itself the regression.
const lossConfirm = /const confirm = \(\): void => \{[\s\S]*?\n  \}/.exec(anchorLoss)?.[0] ?? ''
check(
  '§5.18: the second look waits on a timer, not on a frame callback',
  /setTimeout\(confirm/.test(lossConfirm) && !/requestAnimationFrame/.test(lossConfirm),
  { confirm: lossConfirm.replace(/\s+/g, ' ').trim().slice(0, 160) || null },
)
// The root is the subject, not an anchor: `closest('[data-composer-seat]')` or a
// per-anchor ref would be measuring one symptom, and a narrow composer squeezes
// the trigger to 12px without taking the seat off the page.
check(
  '§5.18: the seat root is the observed node',
  /=> rootRef\.current/.test(picker) && !/observeSeatLoss\(\s*\(\)\s*=>\s*triggerRef/.test(picker),
  { probe: /observeSeatLoss\(\s*\(\)\s*=>\s*(\w+)/.exec(picker)?.[1] ?? null },
)
// Both surfaces are one unit: they already share the one-at-a-time contract, and
// a model card left floating over a vanished composer is the same defect as a
// parameter panel over one.
// The `useEffect(` is pinned with a backreference so the capture cannot start at
// an earlier effect and run to the first matching dependency list — which, with
// the outside-click effect sharing this exact guard and dependency list, is
// exactly what a greedy capture does. The span is then CUT at `observeSeatLoss`,
// so what is checked is the anchor-loss effect's own body and not the two
// effects concatenated; otherwise `closeOutside`'s `setSettingsAt(false)` masks
// a deletion from the other one. Each closing call is checked on its own, so
// dropping exactly one of the two is caught.
const lossSpan = /useEffect\(\(\) => \{\s*if \(!open && !settingsAt\) return[\s\S]*?observeSeatLoss\([\s\S]*?\}, \[open, settingsAt\]\)/.exec(picker)?.[0] ?? ''
const lossCall = lossSpan.slice(lossSpan.indexOf('return observeSeatLoss(') === -1
  ? 0
  : lossSpan.lastIndexOf('useEffect('))
// The list of things to close is DERIVED, not written here. It used to be the
// hand-written pair `['setOpen(false)', 'setSettingsAt(false)']`, while the design
// record described the same rule as "三个一起关" — and the third one
// (`setSelectionFocus(false)`, which releases the latched flag suppressing the
// trigger's focus ring) was asserted by nothing at all: deleting it left both
// gates green. A hand-written list beside a prose rule is a list that drifts, so
// the rule is now read out of the code: every boolean this seat LATCHES ON must be
// released when the seat leaves the page, or it is still latched when the composer
// comes back. That is the same failure §5.29 fixed — state that a keyboard user
// can see the absence of, left in a place no gate was looking.
const latched = [...new Set([...picker.matchAll(/set([A-Z]\w*)\(true\)/g)].map(m => m[1]))].sort()
check(
  '§5.18: every flag the seat latches on is released when it is dismissed',
  latched.length > 0
    && latched.every(name => lossCall.includes(`set${name}(false)`))
    && !/triggerRef\.current\?\.focus\(\)|lastActionRef/.test(lossCall),
  { latched, missing: latched.filter(name => !lossCall.includes(`set${name}(false)`)) },
)
// The observer has to be armed while a popover is open — a guard that watches
// the seat all the time would make every one of these surfaces hostage to
// layout noise, which is the failure mode the negative half of the GUI check
// exists to catch.
check(
  '§5.18: the observer is armed only while a popover is open',
  /useEffect\(\(\) => \{\s*if \(!open && !settingsAt\) return\s*return observeSeatLoss/.test(picker),
  null,
)
check(
  '§5.18: the observer is disconnected on teardown',
  /observer\.disconnect\(\)/.test(anchorLoss) && /clearTimeout/.test(anchorLoss),
  null,
)

// ==========================================================================
// --- 17. THE INK DESIGN SYSTEM (docs/ink-design-language.md §10) -----------
// The final direction of this round is monochrome ink + the host's own blue, with
// a local wash and a fine grain. The HUD revision that came before it was REJECTED
// by the user, and its gates are retired with it rather than relaxed: the signal
// colour, the English field codes, the display numerals, the notch/wipe and the
// dot matrix are now asserted to be ABSENT. What survives is the part of the HUD
// work the design kept: the token layer ownership, the 1px role budget (with the
// accent bar where the signal bar was), the width budget, the embedded face, the
// build-fresh contract and the mutation discipline.
//
// `designSystem.ts` is still the single owner of colour literals. Its values are
// neutral greys plus two kinds of reference: the accent / focus / error roles point
// at the HOST's own `--dsw-*` tokens (no second palette), so a reference check must
// allow a `var()` value and the contrast gate resolves it through the host bag.
// ==========================================================================

/** Neutralise `${…}` interpolations in a TS template literal's raw source text. */
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
 * The raw CSS of one `const NAME = \`…\`` template literal, interpolations
 * neutralised. The neutralising step is REQUIRED: the token block interpolates
 * `${JSON.stringify(FONT_FAMILY)}`, and a naive brace scan splits :root there
 * (measured: the light bag parsed as empty before this step existed).
 * @param source - the module's source text.
 * @param name - the const name (`TOKENS`, `FONT_FACE`, `PRIMITIVES`, `CSS`).
 * @returns the CSS text, or null when the literal is absent.
 */
function templateLiteralOf(source, name) {
  const marker = `const ${name} = \``
  const open = source.indexOf(marker)
  if (open < 0) return null
  const body = neutraliseTemplateExpressions(source.slice(open + marker.length))
  const close = body.indexOf('`')
  return close < 0 ? null : body.slice(0, close)
}

/** The comments-stripped CSS of a template literal (comments carry colons and braces). */
const cssOfLiteral = (source, name) => {
  const literal = templateLiteralOf(source, name)
  // A stand-alone `${…}` between rules must not become a bogus selector for the
  // rule that follows it.
  return literal === null ? null : literal.replace(/__EXPR__/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

const designSystemSource = read('src/client/designSystem.ts')
const fontAssetSource = read('src/client/fontAsset.ts')
const tokensCss = cssOfLiteral(designSystemSource, 'TOKENS')
const fontFaceCss = cssOfLiteral(designSystemSource, 'FONT_FACE')
const primitivesCss = cssOfLiteral(designSystemSource, 'PRIMITIVES')
check('design system: the token block, the face and the primitives exist',
  tokensCss !== null && fontFaceCss !== null && primitivesCss !== null,
  { tokens: tokensCss !== null, face: fontFaceCss !== null, primitives: primitivesCss !== null })

/** The raw light/dark `--zmd-*` bags, parsed out of the token block. */
function zmdBagsOf(css) {
  const bags = { light: {}, dark: {} }
  if (css === null) return bags
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
const zmd = zmdBagsOf(tokensCss)
// The dark block is an OVERRIDE of :root, not a full copy: a token defined only in
// :root still applies in the dark theme (that is how on-accent / grain-tint /
// accent / focus / danger inherit).
const zmdMerged = { light: { ...zmd.light }, dark: { ...zmd.light, ...zmd.dark } }
const HEX_ONLY = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/
const zmdRefs = /^var\((--(?:zmd|dsw)-[a-z0-9-]+)\)$/

// 17.1 THE LITERAL IS ALLOWED IN EXACTLY ONE PLACE — the `--zmd-*` tokens.
const tokenBlockLiteralIssues = []
if (tokensCss !== null) {
  for (const declaration of tokensCss.matchAll(/([^{};]+):\s*([^;}]+)/g)) {
    const name = declaration[1].trim()
    if (!COLOR_LITERAL.test(declaration[2])) continue
    if (!name.startsWith('--zmd-')) tokenBlockLiteralIssues.push(`${name}: ${declaration[2].trim()}`)
  }
  for (const value of tokensCss.matchAll(/:\s*([^;}]+)/g)) {
    const text = value[1].trim()
    if (COLOR_LITERAL.test(text)) continue
    if (HEX_ONLY.test(text) || zmdRefs.test(text)) continue
    // font/ease values are the two non-colour tokens and are not judged here.
  }
}
for (const [label, css] of [['@font-face', fontFaceCss], ['shared primitives', primitivesCss]]) {
  if (css !== null && COLOR_LITERAL.test(css)) tokenBlockLiteralIssues.push(`${label} spells a colour literal`)
}
check('design system: colour literals live only in the --zmd-* token blocks',
  tokenBlockLiteralIssues.length === 0, { tokenBlockLiteralIssues })

// 17.2 THE TOKEN SET AND ITS REFERENCES. The accent / focus / error roles are
// REFERENCES to the host's palette (one palette, not two); every other colour is
// a literal. A token whose value is neither is a typo that paints nothing.
const NON_COLOR_TOKENS = new Set(['--zmd-font-latin', '--zmd-ease'])
const REQUIRED_TOKENS = [
  '--zmd-panel', '--zmd-panel-deep', '--zmd-hover', '--zmd-line', '--zmd-line-strong',
  '--zmd-line-control', '--zmd-ink', '--zmd-ink-secondary', '--zmd-ink-mute',
  '--zmd-wash-top', '--zmd-wash-bottom', '--zmd-grain-tint',
  '--zmd-accent', '--zmd-on-accent', '--zmd-focus', '--zmd-danger', '--zmd-online',
]
const lightNames = new Set(Object.keys(zmd.light).filter(name => !NON_COLOR_TOKENS.has(name)))
const darkNames = new Set(Object.keys(zmd.dark).filter(name => !NON_COLOR_TOKENS.has(name)))
const tokenSetIssues = REQUIRED_TOKENS.filter(name => !lightNames.has(name))
  .map(name => `missing in :root: ${name}`)
  .concat([...darkNames].filter(name => !lightNames.has(name)).map(name => `dark declares a token light does not: ${name}`))
check('design system: the ink token set is complete and the dark block only overrides it',
  tokenSetIssues.length === 0, { tokenSetIssues, light: lightNames.size, dark: darkNames.size })

const tokenRefIssues = []
const REFERENCED_HOST_TOKENS = new Map([
  ['--zmd-accent', '--dsw-alias-state-business-primary'],
  ['--zmd-focus', '--dsw-alias-state-business-primary'],
  ['--zmd-danger', '--dsw-alias-state-error-primary'],
])
for (const name of lightNames) {
  const value = zmd.light[name]
  if (HEX_ONLY.test(value)) {
    if (REFERENCED_HOST_TOKENS.has(name)) tokenRefIssues.push(`${name} must reference the host palette, not spell a literal`)
    continue
  }
  const reference = zmdRefs.exec(value)?.[1] ?? null
  if (reference === null) { tokenRefIssues.push(`${name}: ${value} is neither a hex value nor a token reference`); continue }
  if (REFERENCED_HOST_TOKENS.has(name) && REFERENCED_HOST_TOKENS.get(name) !== reference) {
    tokenRefIssues.push(`${name} points at ${reference}, expected ${REFERENCED_HOST_TOKENS.get(name)}`)
  }
  if (reference.startsWith('--zmd-') && !(reference in zmd.light)) {
    tokenRefIssues.push(`${name} references undeclared ${reference}`)
  }
}
check('design system: the accent/focus/error roles reference the host palette, everything else resolves',
  tokenRefIssues.length === 0, { tokenRefIssues })

// 17.2b THE HOST ALIASES LIVE ON `body`, NOT `:root` — a CSS custom property's
// `var()` is substituted on the element that DECLARES it, and the host defines its
// `--dsw-*` palette on <body>. An alias declared on :root would resolve against
// :root's own empty host tokens, become guaranteed-invalid and silently inherit as
// an empty value: every accent bar, focus ring and error edge would disappear with
// a green build. These four aliases are the whole accent grammar, so their block is
// pinned: :root is literal-only, a plain `body {}` block declares the aliases (one
// block serves both themes), and the dark block only overrides the neutrals.
const tokenBlocks = [...(tokensCss ?? '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(match => ({ selector: match[1].trim(), body: match[2] }))
const rootBlock = tokenBlocks.find(block => block.selector === ':root') ?? null
const bodyAliasBlock = tokenBlocks.find(block => block.selector === 'body') ?? null
const darkBlock = tokenBlocks.find(block => block.selector.includes('data-ds-dark-theme')) ?? null
const ALIASES = ['--zmd-accent', '--zmd-on-accent', '--zmd-focus', '--zmd-danger']
const aliasIssues = []
if (rootBlock === null) aliasIssues.push('no :root token block')
else if (/var\(--dsw-/.test(rootBlock.body)) aliasIssues.push(':root declares a host alias (var() would resolve against :root, not <body>)')
if (bodyAliasBlock === null) aliasIssues.push('no body{} alias block (host aliases must be declared on <body>)')
else {
  for (const alias of ALIASES) {
    if (!new RegExp(`${alias}\\s*:`).test(bodyAliasBlock.body)) aliasIssues.push(`body{} does not declare ${alias}`)
  }
  if (!/--zmd-accent\s*:\s*var\(--dsw-/.test(bodyAliasBlock.body)) aliasIssues.push('accent does not reference the host palette')
  if (!/--zmd-focus\s*:\s*var\(--dsw-/.test(bodyAliasBlock.body)) aliasIssues.push('focus does not reference the host palette')
  if (!/--zmd-danger\s*:\s*var\(--dsw-/.test(bodyAliasBlock.body)) aliasIssues.push('danger does not reference the host palette')
  if (!/--zmd-on-accent\s*:\s*var\(--zmd-panel\)/.test(bodyAliasBlock.body)) aliasIssues.push('on-accent is not the panel ink')
}
if (darkBlock === null) aliasIssues.push('no dark override block')
else {
  for (const alias of ALIASES) {
    if (new RegExp(`${alias}\\s*:`).test(darkBlock.body)) aliasIssues.push(`the dark block re-declares ${alias} (it must inherit the body alias)`)
  }
}
check('design system: the host-token aliases are declared on <body> and inherited by both themes',
  aliasIssues.length === 0, { aliasIssues })
// Sheets consume the token layer, never the host's action colours directly: the
// alias is what keeps "one palette" true and lets a future host-theme change reach
// every accent at once.
const directHostColours = []
for (const [name, css] of [
  ['styles.ts', stylesCode],
  ['modelConfigStyles.ts', modelConfigPageSheet],
  ['catalogStyles.ts', modelConfigCatalogSheet],
]) {
  for (const match of css.matchAll(/var\((--dsw-alias-state-(?:business|error)-primary)\)/g)) {
    directHostColours.push(`${name}: ${match[1]}`)
  }
}
check('design system: sheets reach the accent/error roles through the token layer',
  directHostColours.length === 0, { directHostColours })

// A sheet may only CONSUME tokens; a `--zmd-*` definition inside a sheet is how a
// second token layer starts. A referenced token that does not exist is invisible
// at runtime (the property simply does not paint), so the reference scan is the
// only thing that can catch a typo.
const sheetCssByName = new Map([
  ['styles.ts', stylesCode],
  ['modelConfigStyles.ts', modelConfigPageSheet],
  ['catalogStyles.ts', modelConfigCatalogSheet],
  ['designSystem.ts', primitivesCss ?? ''],
])
const zmdTokenNames = new Set([...Object.keys(zmd.light), ...Object.keys(zmd.dark)])
const undeclaredTokens = []
const locallyDefinedTokens = []
for (const [name, css] of sheetCssByName) {
  for (const match of css.matchAll(/var\((--zmd-[a-z0-9-]+)/g)) {
    if (!zmdTokenNames.has(match[1])) undeclaredTokens.push(`${name}: ${match[1]}`)
  }
  const definitions = [...css.matchAll(/(?:^|[;{]\s*)(--zmd-[a-z0-9-]+)\s*:/g)].map(match => match[1])
  if (definitions.length > 0) locallyDefinedTokens.push(`${name}: ${[...new Set(definitions)].join(', ')}`)
}
check('design system: every referenced --zmd-* token is declared',
  undeclaredTokens.length === 0, { undeclaredTokens: [...new Set(undeclaredTokens)], tokens: zmdTokenNames.size })
check('design system: no sheet declares its own --zmd-* token',
  locallyDefinedTokens.length === 0, { locallyDefinedTokens })

// 17.3 THE HUD IS RETIRED — BY ABSENCE, NOT BY MEMORY. These are the constructs
// the rejected direction introduced. A rule that "no longer renders" is not
// enough: the code itself must be gone, or the next `git checkout` / a stray
// comment brings the vocabulary back. Comments are stripped first, because a
// comment explaining WHY there is no notch is documentation, not a construct.
const RETIRED_HUD = [
  ['the signal colour', /--zmd-signal/],
  ['the English field-code table', /FIELD_CODES/],
  ['the field-code mark', /\bzmd-code\b/],
  ['the display numeral', /\bzmd-display\b/],
  ['the corner notch', /zmd-notch/],
  ['the entrance wipe', /zmd-wipe/],
  ['the clip-path reveal', /clip-path/],
  ['uppercase field-code type', /text-transform:\s*uppercase/],
  ['width-variable display type', /font-variation-settings[^;}]*[\"']?wdth/],
]
const inkSourceFiles = readdirSync(resolve(root, 'src'), { recursive: true, encoding: 'utf8' })
  .filter(name => /\.tsx?$/.test(name))
const retiredHudHits = []
for (const file of inkSourceFiles) {
  const text = stripComments(read(`src/${file.split(sep).join('/')}`))
  for (const [label, pattern] of RETIRED_HUD) {
    if (pattern.test(text)) retiredHudHits.push(`${file}: ${label}`)
  }
}
check('ink: the rejected HUD vocabulary is gone from every source file',
  retiredHudHits.length === 0, { retiredHudHits, retired: RETIRED_HUD.map(([label]) => label) })

// 17.4 THE SHARED UTILITY CLASSES ARE CROSS-CHECKED IN BOTH DIRECTIONS. The
// surviving primitives are `zmd-num`, `zmd-rule`, `zmd-wash`, `zmd-grain`; the
// `dmp-`/`dmc-` dead-class sweeps cannot see them (they live in another module).
// The negative lookbehind keeps `--zmd-*` TOKEN references in inline styles out
// of the class set.
const ZMD_CLASS = /(?<![\w-])zmd-[a-z0-9]+(?:-[a-z0-9]+)*/g
const zmdClassesInSheet = new Set(
  [...(primitivesCss ?? '').matchAll(/\.(zmd-[a-z0-9]+(?:-[a-z0-9]+)*)/g)].map(match => match[1]))
const decorationSourceFiles = [...tsxFiles, ...MODEL_CONFIG_TSX]
const classNameTexts = decorationSourceFiles.flatMap(file =>
  [...read(file).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{([^{}]*)\})/g)]
    .map(match => match[1] ?? match[2] ?? match[3] ?? ''))
const zmdClassesInTsx = new Set(classNameTexts.flatMap(text => [...text.matchAll(ZMD_CLASS)].map(match => match[0])))
const deadZmdClass = [...zmdClassesInSheet].filter(name => !zmdClassesInTsx.has(name)).sort()
const unstyledZmdClass = [...zmdClassesInTsx].filter(name => !zmdClassesInSheet.has(name)).sort()
check('design system: every .zmd-* primitive is used by a component', deadZmdClass.length === 0, { deadZmdClass })
check('design system: every zmd-* class used by a component is a declared primitive',
  unstyledZmdClass.length === 0, { unstyledZmdClass })

// 17.5 THE TWO TEXTURES, AND ONLY THE TWO. §4/§6 of the ink language allows exactly
// two material effects: the local wash (`radial-gradient` on `.zmd-wash`, stops
// from the three wash/panel tokens) and the fine grain (ONE SVG fractal-noise data
// URI on `.zmd-grain::after`). Every other gradient, background-image or url() is
// forbidden, because that is how a HUD's dot matrix / scan line comes back.
const textureIssues = []
// Every background-image in the primitives is one of the two textures: the wash's
// radial gradient or the grain's data URI. A third one (a dot matrix, a scan line,
// a second gradient) is the HUD coming back.
const backgroundImageRules = [...(primitivesCss ?? '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .flatMap(rule => [...rule[1].split(',').map(part => part.trim()).filter(part => part !== '')]
    .flatMap(selector => [...rule[2].matchAll(/(?:^|;)\s*background-image\s*:\s*([^;}]+)/g)]
      .map(match => ({ selector, value: match[1].trim() }))))
for (const entry of backgroundImageRules) {
  if (/gradient\(/.test(entry.value)) {
    if (entry.selector !== '.zmd-wash') {
      textureIssues.push(`the wash is the only gradient surface, not ${entry.selector}`)
      continue
    }
    if (!/^radial-gradient\(/.test(entry.value)) textureIssues.push(`.zmd-wash is not a radial-gradient: ${entry.value}`)
    const colours = [...entry.value.matchAll(/var\((--[a-z0-9-]+)\)/g)].map(match => match[1])
    const allowedWashColours = new Set(['--zmd-wash-top', '--zmd-panel', '--zmd-wash-bottom'])
    for (const colour of colours) if (!allowedWashColours.has(colour)) textureIssues.push(`.zmd-wash stop ${colour}`)
    if (colours.length === 0) textureIssues.push('.zmd-wash has no token stops')
    continue
  }
  if (!/^url\("data:/.test(entry.value)) {
    textureIssues.push(`${entry.selector}: background-image is not a texture token/URL: ${entry.value}`)
    continue
  }
  if (entry.selector !== '.zmd-grain::after') {
    textureIssues.push(`the grain is the only data-URI surface, not ${entry.selector}`)
  }
}
// The grain: exactly one data-URI in the primitives, on `.zmd-grain::after`, an
// SVG fractal-noise tile, never on the sheets and never a network URL.
const dataUriMatches = [...(primitivesCss ?? '').matchAll(/url\("(data:[^"]+)"\)/g)]
if (dataUriMatches.length !== 1) textureIssues.push(`expected exactly one data URI in the primitives, found ${dataUriMatches.length}`)
const grainRule = /\.zmd-grain::after\s*\{([^}]*)\}/.exec(primitivesCss ?? '')?.[1] ?? ''
const grainUri = dataUriMatches[0]?.[1] ?? ''
if (grainUri !== '' && !/^data:image\/svg\+xml,/.test(grainUri)) textureIssues.push('the grain tile is not an inline SVG')
if (grainUri !== '' && !/feTurbulence/.test(grainUri)) textureIssues.push('the grain tile is not fractal noise')
if (!/background-size:\s*120px 120px/.test(grainRule)) textureIssues.push('the grain tile does not repeat at 120px')
if (!/pointer-events:\s*none/.test(grainRule)) textureIssues.push('the grain overlay can eat pointer events')
if (!/\.zmd-grain\s*\{[^}]*position:\s*relative/.test(primitivesCss ?? '')) textureIssues.push('the grain has no positioned host')
for (const [name, css] of sheetCssByName) {
  if (name === 'designSystem.ts') continue
  if (/background-image/.test(css)) textureIssues.push(`${name} sets background-image (texture is owned by the design system)`)
  if (/url\(/.test(css)) textureIssues.push(`${name} embeds a url()`)
  if (/(?:linear|conic|radial)-gradient/.test(css)) textureIssues.push(`${name} spells a gradient`)
}
if ((fontFaceCss ?? '').match(/url\(/g)?.length !== 1) textureIssues.push('the face must be the one other allowed url()')
check('ink: the only textures are the .zmd-wash gradient and the one .zmd-grain noise tile',
  textureIssues.length === 0, { textureIssues })

// The textures sit on bounded surfaces, never on a scrolling list or the whole
// page: a wash behind scrolling content slides; grain over copy is a HUD tile.
const TEXTURE_HOSTS = new Set(['dmp-menu', 'dmc-head', 'dmc-catalog-panel', 'dmp-settings', 'dmc-page'])
const TEXTURE_FORBIDDEN = /^(?:dmp-groups|dmp-models|dmp-rail|dmc-list|dmp-settings-body)$/
const textureUsers = []
for (const file of decorationSourceFiles) {
  for (const match of read(file).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{([^{}]*)\})/g)) {
    const value = match[1] ?? match[2] ?? match[3] ?? ''
    if (!/\bzmd-(?:wash|grain)\b/.test(value)) continue
    textureUsers.push({ file, classes: value.split(/\s+/).filter(Boolean) })
  }
}
const textureUserIssues = textureUsers
  .filter(user => user.classes.some(name => TEXTURE_FORBIDDEN.test(name))
    || !user.classes.some(name => TEXTURE_HOSTS.has(name)))
  .map(user => `${user.file}: ${user.classes.join(' ')}`)
check('ink: the wash and grain ride only on a bounded surface',
  textureUserIssues.length === 0 && textureUsers.length > 0,
  { textureUserIssues, users: textureUsers.length })
// §6.2/§6.4: a surface wears the material as a PAIR — the tonal wash and the paper
// grain together. A lone wash reads as a gradient; a lone grain reads as noise.
const texturePairIssues = textureUsers
  .filter(user => !(user.classes.includes('zmd-wash') && user.classes.includes('zmd-grain')))
  .map(user => `${user.file}: ${user.classes.join(' ')}`)
check('ink: the wash and the grain are worn together',
  texturePairIssues.length === 0, { texturePairIssues })

// 17.6 GEOMETRY: all right angles; no fades, no shadow, no blur, no corner morphing.
const inkRadiusEntries = [...sheetCssByName].flatMap(([name, css]) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(rule =>
    rule[1].split(',').map(part => part.trim()).filter(part => part !== '')
      .flatMap(selector => [...rule[2].matchAll(/border-radius:\s*([^;]+);/g)]
        .map(match => ({ name, selector, value: match[1].trim() })))))
const inkBadRadius = inkRadiusEntries
  .filter(entry => !(entry.value === '0' || entry.value === '0px' || entry.value === '50%'))
  .map(entry => `${entry.name} ${entry.selector}: ${entry.value}`)
const inkBadDotRadius = inkRadiusEntries
  .filter(entry => entry.value === '50%' && !/-dot(?:[\s:.[]|$)/.test(entry.selector))
  .map(entry => `${entry.name} ${entry.selector}`)
check('geometry: only 0 / 50% (a circle is a state dot)',
  inkBadRadius.length === 0 && inkBadDotRadius.length === 0,
  { badRadius: inkBadRadius, badDotRadius: inkBadDotRadius })
const shadowIssues = []
const dimmingIssues = []
const cornerIssues = []
for (const [name, css] of sheetCssByName) {
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = rule[1].split(',').map(part => part.trim()).filter(part => part !== '')
    const declarations = property => [...rule[2].matchAll(
      new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;}]+)`, 'g'))].map(match => match[1].trim())
    for (const value of declarations('box-shadow')) {
      const ring = /^(?:inset )?0 0 0 [\d.]+px var\(--(?:zmd-focus|zmd-accent|zmd-line-strong|dsw-focus-ring-color)/.test(value)
      for (const selector of selectors) if (value !== 'none' && !ring) shadowIssues.push(`${name} ${selector}: box-shadow: ${value}`)
    }
    for (const property of ['opacity', 'filter', 'text-shadow', 'mix-blend-mode', 'backdrop-filter']) {
      for (const value of declarations(property)) {
        const allowed = (property === 'filter' || property === 'backdrop-filter') && value === 'none'
        if (!allowed) for (const selector of selectors) dimmingIssues.push(`${name} ${selector}: ${property}: ${value}`)
      }
    }
    for (const value of declarations('corner-shape')) {
      for (const selector of selectors) {
        if (!(value === 'round' && /-dot(?:[\s:.[]|$)/.test(selector))) cornerIssues.push(`${name} ${selector}: corner-shape: ${value}`)
      }
    }
  }
}
check('geometry: no elevation shadow and no blur anywhere',
  shadowIssues.length === 0, { shadowIssues })
check('geometry: no rule fades, blends or dims its own text',
  dimmingIssues.length === 0, { dimmingIssues })
check('geometry: corner-shape is only the 50% status dot',
  cornerIssues.length === 0, { cornerIssues })

// 17.7 THE LINE, THE FILL AND THE ACCENT: the three colour-grammar rules that are
// decidable statically. §2/§4: a line is structure, a fill is hover/sunken/panel,
// and the only colour is the host blue used as a graphic.
const allSheetRules = [...sheetCssByName].flatMap(([name, css]) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(rule =>
    rule[1].split(',').map(part => part.trim()).filter(part => part !== '')
      .map(selector => ({ sheet: name, selector, body: rule[2] }))))
const declarationValues = (body, property) => [...body.matchAll(
  new RegExp(`(?:^|;)\\s*${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;}]+)`, 'g'))]
  .map(match => match[1].trim())
const ROW_CLASS = /\.(?:dmp-(?:row|rail-row|effort-item|picker-item)|dmc-(?:row|picker-item|model-row|discover-candidate))(?![\w-])/
const ROW_STATE = /:(?:hover|focus-visible|focus-within|active)\b|\[(?:aria-checked|aria-selected)='?true'?\]|\[data-(?:active|catalog|well)\]/
const rowFillIssues = allSheetRules
  .filter(rule => !/::/.test(rule.selector) && !/\s/.test(rule.selector)
    && new RegExp(`^${ROW_CLASS.source}`).test(rule.selector) && ROW_STATE.test(rule.selector))
  .flatMap(rule => declarationValues(rule.body, 'background')
    .filter(value => !/^var\(--zmd-(?:hover|panel-deep)\)$/.test(value) && !/^(?:transparent|none)$/i.test(value))
    .map(value => `${rule.sheet} ${rule.selector}: ${value}`))
check('grammar: a row hover/selected fill is --zmd-hover or --zmd-panel-deep',
  rowFillIssues.length === 0, { rowFillIssues })
const LINE_FILL_EXEMPT = /\.dmc-backoff-cell\[data-level='0'\]/
const lineFillIssues = allSheetRules.flatMap(rule => declarationValues(rule.body, 'background')
  .filter(value => /^var\(--zmd-line\)$/.test(value))
  .filter(() => !/(?:^|;)\s*(?:height|width)\s*:\s*1px/.test(rule.body))
  .filter(() => !LINE_FILL_EXEMPT.test(rule.selector))
  .map(value => `${rule.sheet} ${rule.selector}: ${value}`))
check('grammar: --zmd-line is never used as a fill',
  lineFillIssues.length === 0, { lineFillIssues })
const accentAsTextRules = allSheetRules.flatMap(rule =>
  // Only `color:` — the host blue is allowed as a text-decoration underline (the
  // hover of an expanded word action, §5.1) and as the focus ring.
  declarationValues(rule.body, 'color')
    .filter(value => /var\(--zmd-accent\)/.test(value))
    .map(value => `${rule.sheet} ${rule.selector}: color: ${value}`))
check('grammar: the host blue never paints text',
  accentAsTextRules.length === 0, { accentAsTextRules })
const dangerAsTextRules = allSheetRules.flatMap(rule =>
  [...['color', 'text-decoration-color', 'caret-color']]
    .flatMap(property => declarationValues(rule.body, property)
      .filter(value => /var\(--zmd-danger\)/.test(value))
      // The error colour may still INK A GLYPH: a warning/error icon is a graphic
      // carried by `currentColor`, not a word. §6.5 keeps the red state mark and
      // §5.4 keeps the fact itself in ink, so the exemption is narrow: the
      // selector must be an icon slot (or an svg) and nothing else.
      .filter(() => !/(?:-icon)(?:[\s:.[]|$)|(?:^|\s)svg(?:[\s:.[]|$)/.test(rule.selector))
      .map(value => `${rule.sheet} ${rule.selector}: ${property}: ${value}`)))
check('grammar: the error red is a 4px bar, never a word',
  dangerAsTextRules.length === 0, { dangerAsTextRules })
const accentFillPairIssues = allSheetRules.flatMap(rule => {
  const fills = declarationValues(rule.body, 'background')
    .filter(value => /^var\(--zmd-accent\)$/.test(value))
  if (fills.length === 0) return []
  const ownInk = [...declarationValues(rule.body, 'color'), ...declarationValues(rule.body, 'border-color')]
  const carriesInk = ownInk.some(value => /var\(--zmd-on-accent\)/.test(value))
  // The framed checkbox states the fill on the control and the tick on its own
  // `::after`; that pair is one object, so a sibling pseudo/state rule counts. The
  // base is the selector with its state pseudo-classes/attributes stripped.
  const baseOf = value => value
    .replace(/::?(?:before|after)/g, '')
    .replace(/:(?:checked|hover|focus-visible|focus-within|active|disabled|not\([^)]*\))/g, '')
    .replace(/\[[^\]]*\]/g, '')
  const glyphRule = allSheetRules.some(other => {
    if (other.sheet !== rule.sheet || other.selector === rule.selector) return false
    return baseOf(other.selector) === baseOf(rule.selector) && /var\(--zmd-on-accent\)/.test(other.body)
  })
  return carriesInk || glyphRule ? [] : [`${rule.sheet} ${rule.selector}: blue fill without --zmd-on-accent ink`]
})
check('grammar: a blue fill carries --zmd-on-accent ink',
  accentFillPairIssues.length === 0, { accentFillPairIssues })

// 17.8 THE 1px BUDGET ACROSS ALL THREE SURFACES, in the same four roles as the
// page block above. The seat and the catalog get their own frozen control lists:
// a real form field is the only thing allowed to carry the control ink; the only
// bars are the 2px accent and the 4px error, on the left.
const CONTROL_EDGES_BY_SHEET = new Map([
  ['styles.ts', new Set(['.dmp-search-row .dmp-search', '.dmp-settings .dmp-settings-switch', '.dmp-settings-input'])],
  ['modelConfigStyles.ts', new Set([...PAGE_CONTROL_EDGES, ...PAGE_MARK_EDGES])],
  ['catalogStyles.ts', new Set([
    '.dmc-model-input', '.dmc-discover-check', '.dmc-discover-search',
    '.dmc-reasoning-value', '.dmc-reasoning-level',
  ])],
])
const unifiedEdgeIssues = []
for (const rule of allSheetRules) {
  for (const property of ['border', 'border-top', 'border-right', 'border-bottom', 'border-left']) {
    for (const value of declarationValues(rule.body, property)) {
      if (/^(?:none|0|0px)$/.test(value)) continue
      const width = borderWidthOf(value)
      if (width === null) continue
      const token = borderTokenOf(value)
      const left = property === 'border-left'
      const glyph = /::(?:before|after)/.test(rule.selector) && width <= 3
        && ['--zmd-panel', '--zmd-on-accent', '--zmd-ink'].includes(token ?? '')
      const bar = left && BAR_WIDTHS.get(token ?? '') === width
      const structure = (token === '--zmd-line' || token === '--zmd-line-strong')
      const control = token === CONTROL_LINE_TOKEN && CONTROL_EDGES_BY_SHEET.get(rule.sheet)?.has(rule.selector)
      if (glyph || bar) continue
      if (structure) {
        if (width !== 1) unifiedEdgeIssues.push(`${rule.sheet} ${rule.selector}: structure line at ${width}px`)
        continue
      }
      if (control) {
        if (width !== 1) unifiedEdgeIssues.push(`${rule.sheet} ${rule.selector}: control edge at ${width}px`)
        continue
      }
      unifiedEdgeIssues.push(`${rule.sheet} ${rule.selector}: ${property}: ${value}`)
    }
  }
}
const unregisteredControlSheets = [...CONTROL_EDGES_BY_SHEET].flatMap(([sheet, selectors]) =>
  [...selectors].filter(selector => !allSheetRules.some(rule => rule.sheet === sheet && rule.selector === selector
    && ['border', 'border-top', 'border-right', 'border-bottom', 'border-left']
      .some(property => declarationValues(rule.body, property)
        .some(value => borderTokenOf(value) === CONTROL_LINE_TOKEN)))))
check('grammar: every sheet edge is a structure line, a registered control edge, a 2px accent or a 4px error bar',
  unifiedEdgeIssues.length === 0, { unifiedEdgeIssues })
check('grammar: each frozen form-control edge is present and carries the control ink',
  unregisteredControlSheets.length === 0, { unregisteredControlSheets })
// §5: the accent's whole vocabulary is the GRAPHIC mark — and the two marks the
// language promises must actually exist: the seat's 2px accent left bar (the
// current row / the session's provider) and the 4px error bar (the status rail and
// the diagnostic). A stylesheet that never paints them has lost the accent grammar
// while every "never as text" assertion above stays green.
const accentBarRules = allSheetRules.filter(rule =>
  ['border-left', 'border-inline-start'].some(property => declarationValues(rule.body, property)
    .some(value => /^2px solid var\(--zmd-accent\)$/.test(value))))
const errorBarRules = allSheetRules.filter(rule =>
  ['border-left', 'border-inline-start'].some(property => declarationValues(rule.body, property)
    .some(value => /^4px solid var\(--zmd-danger\)$/.test(value))))
check('grammar: the accent 2px bar and the 4px error bar actually exist',
  accentBarRules.length > 0 && errorBarRules.length > 0,
  {
    accentBars: accentBarRules.map(rule => `${rule.sheet} ${rule.selector}`),
    errorBars: errorBarRules.map(rule => `${rule.sheet} ${rule.selector}`),
  })

// 17.9 THE TYPE SCALE HAS NO DISPLAY TIER ANY MORE. The HUD's 44px numeral, 800
// weight and uppercase Latin codes are gone (§3/§4); the largest type in the ink
// language is the 20px ready statement. This also catches a surviving
// `font-weight: 800` display rule whose size was reduced by hand.
const typeScaleIssues = []
for (const [name, css] of sheetCssByName) {
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const value of declarationValues(rule[2], 'font-size')) {
      const size = Number.parseFloat(value)
      if (Number.isFinite(size) && size > 20) typeScaleIssues.push(`${name} ${rule[1].trim()}: font-size: ${value}`)
    }
    for (const value of declarationValues(rule[2], 'font-weight')) {
      const weight = Number.parseFloat(value)
      if (Number.isFinite(weight) && weight >= 700) typeScaleIssues.push(`${name} ${rule[1].trim()}: font-weight: ${value}`)
    }
  }
}
check('type: no display-tier size and no display weight survives the HUD removal',
  typeScaleIssues.length === 0, { typeScaleIssues })

// 17.10 THE EMBEDDED FACE: three independent byte counts, the OFL file, and the
// family name in every place that must agree (unchanged from the HUD revision —
// the user kept the face).
const fontFamily = /export const FONT_FAMILY = "([^"]+)"/.exec(fontAssetSource)?.[1] ?? null
const fontBase64 = /export const FONT_WOFF2_BASE64 = "([A-Za-z0-9+/=]+)"/.exec(fontAssetSource)?.[1] ?? null
const fontHeaderBytes = Number.parseInt(/Raw woff2: (\d+) bytes/.exec(fontAssetSource)?.[1] ?? 'NaN', 10)
const fontProvenanceBytes = Number.parseInt(/"bytes": (\d+)/.exec(fontAssetSource)?.[1] ?? 'NaN', 10)
const fontLicenseText = exists('docs/fonts/Archivo-OFL.txt') ? read('docs/fonts/Archivo-OFL.txt') : ''
const fontProvenanceLicense = /"license": "([^"]+)"/.exec(fontAssetSource)?.[1] ?? null
const fontSourceUrl = /"source": "([^"]+)"/.exec(fontAssetSource)?.[1] ?? null
const decodedFont = fontBase64 === null ? null : Buffer.from(fontBase64, 'base64')
const fontBytes = decodedFont === null ? NaN : decodedFont.length
const woff2Magic = decodedFont === null ? false : decodedFont.slice(0, 4).toString('latin1') === 'wOF2'
const fontBase64Shape = fontBase64 !== null && fontBase64.length % 4 === 0
  && /^[A-Za-z0-9+/]+={0,2}$/.test(fontBase64)
const fontFaceUsesImportedFamily = /font-family:\s*\$\{JSON\.stringify\(FONT_FAMILY\)\};/.test(designSystemSource)
const tokenUsesImportedFamily = /--zmd-font-latin:\s*\$\{JSON\.stringify\(FONT_FAMILY\)\},/.test(designSystemSource)
const fontIssues = []
if (fontFamily === null) fontIssues.push('FONT_FAMILY is missing')
if (fontBase64 === null) fontIssues.push('FONT_WOFF2_BASE64 is missing')
if (!Number.isFinite(fontBytes) || fontBytes > 64 * 1024) fontIssues.push(`decoded woff2 is ${fontBytes} bytes (budget 64KB)`)
if (!woff2Magic) fontIssues.push('decoded payload is not woff2 (no wOF2 magic)')
if (!fontBase64Shape) fontIssues.push('FONT_WOFF2_BASE64 is not valid base64')
if (fontHeaderBytes !== fontBytes) fontIssues.push(`header says ${fontHeaderBytes} bytes, decoded ${fontBytes}`)
if (fontProvenanceBytes !== fontBytes) fontIssues.push(`provenance says ${fontProvenanceBytes} bytes, decoded ${fontBytes}`)
if (fontProvenanceLicense !== 'SIL Open Font License 1.1') fontIssues.push(`license is ${fontProvenanceLicense}`)
if (fontSourceUrl === null || !/^https:\/\/raw\.githubusercontent\.com\/google\/fonts\//.test(fontSourceUrl)) {
  fontIssues.push(`source is ${fontSourceUrl}`)
}
if (!fontLicenseText.includes('SIL OPEN FONT LICENSE')) fontIssues.push('docs/fonts/Archivo-OFL.txt is missing the OFL header')
if (!/Copyright/.test(fontLicenseText)) fontIssues.push('docs/fonts/Archivo-OFL.txt is missing the copyright line')
if (!fontFaceUsesImportedFamily || !tokenUsesImportedFamily || fontFamily === null) {
  fontIssues.push('the family is not interpolated from the single FONT_FAMILY constant')
}
if (fontFaceCss !== null) {
  if (!/url\(data:font\/woff2;base64,/.test(fontFaceCss)) fontIssues.push('the face is not a woff2 data URI')
  if (/https?:/.test(fontFaceCss)) fontIssues.push('the face references a network URL')
  if (!/font-display:\s*swap/.test(fontFaceCss)) fontIssues.push('the face does not declare font-display: swap')
  if (!/font-weight:\s*100 900/.test(fontFaceCss)) fontIssues.push('the face does not declare the 100–900 weight axis')
  if (!/font-stretch:\s*62% 125%/.test(fontFaceCss)) fontIssues.push('the face does not declare the 62–125% width axis')
}
check('font: the embedded face is a valid, bounded woff2 with matching byte counts',
  fontIssues.length === 0, { fontIssues, fontBytes, fontHeaderBytes, fontProvenanceBytes })
check('font: the family is declared identically in the face, the token layer and fontAsset.ts',
  fontFamily !== null && fontFaceUsesImportedFamily && tokenUsesImportedFamily,
  { fontFamily })
const manifest = JSON.parse(read('package.json'))
const gitignore = read('.gitignore')
check('font: the OFL licence ships in the repository and in the package',
  exists('docs/fonts/Archivo-OFL.txt')
  && JSON.stringify(manifest.files ?? []).includes('docs/fonts/Archivo-OFL.txt'),
  { files: manifest.files, ofl: exists('docs/fonts/Archivo-OFL.txt') })
check('font: the asset is committed while the regeneration cache stays ignored',
  /^\.cache\/\s*$/m.test(gitignore)
  && !gitignore.split(/\r?\n/).some(line => !line.trim().startsWith('#')
    && /^(?:\/)?src\/client\/(?:fontAsset\.ts)?$|fontAsset\.ts/.test(line.trim()))
  && manifest.scripts?.['font:build'] === 'node scripts/build-font-asset.mjs',
  { cacheIgnored: /^\.cache\/\s*$/m.test(gitignore), fontBuildScript: manifest.scripts?.['font:build'] ?? null })
const sheetFontLiterals = [...sheetCssByName]
  .filter(([name]) => name !== 'designSystem.ts')
  .filter(([, css]) => /font-family:\s*["']ZMD Archivo/.test(css) || /@font-face/.test(css))
  .map(([name]) => name)
check('font: only the design system declares the face or spells its family',
  sheetFontLiterals.length === 0, { sheetFontLiterals })

// 17.11 WIDTH BUDGET: the ten numbers the 331/175/113 model is made of stay
// PINNED, not merely re-derived (§9: the ink language does not move the budget).
function ruleBodyOf(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  return match === null ? null : match[1]
}
const pinnedRule = (selector, property) => {
  const body = ruleBodyOf(stylesCode, selector)
  return body === null ? null : declarationValues(body, property)[0] ?? null
}
const budgetPins = [
  ['.dmp-menu', 'padding', '4px'],
  ['.dmp-rail', 'flex', '0 0 176px'],
  ['.dmp-rail', 'padding', '2px 4px 2px 0'],
  ['.dmp-models', 'padding-left', '4px'],
  ['.dmp-row', 'gap', '6px'],
  ['.dmp-check', 'flex', '0 0 14px'],
  ['.dmp-row-copy', 'gap', '5px'],
  ['.dmp-row-name', 'min-width', '48px'],
]
const budgetPinIssues = budgetPins
  .filter(([selector, property, expected]) => pinnedRule(selector, property) !== expected)
  .map(([selector, property, expected]) => `${selector} ${property}: ${pinnedRule(selector, property)} (pinned ${expected})`)
const rowPadToken = /--dmp-row-pad-x:\s*(\d+)px/.exec(stylesCode)?.[1] ?? null
const cardWidth = ruleBodyOf(stylesCode, '.dmp-card') ?? ''
const cardWidthPinned = /width:\s*min\(520px, calc\(100vw - 32px\)\)/.test(cardWidth)
const collapsePinned = /@media \(max-width: 536px\)/.test(stylesCode)
check('layout: the ten budget inputs of the two-pane card are pinned',
  budgetPinIssues.length === 0 && rowPadToken === '7' && cardWidthPinned && collapsePinned,
  { budgetPinIssues, rowPadToken, cardWidthPinned, collapsePinned })
/** One `@container (max-width: Npx)` block's body, by balanced braces. */
function containerBodyOf(css, width) {
  const marker = `@container (max-width: ${width}px)`
  const open = css.indexOf(marker)
  if (open < 0) return null
  const bodyStart = css.indexOf('{', open)
  if (bodyStart < 0) return null
  let depth = 0
  for (let index = bodyStart; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1
    else if (css[index] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(bodyStart + 1, index)
    }
  }
  return null
}
const dmcTier560 = containerBodyOf(modelConfigPageSheet, 560)
const dmcTier484 = containerBodyOf(modelConfigPageSheet, 484)
const dmcTier360 = containerBodyOf(modelConfigPageSheet, 360)
check('layout: the page asks the container in three tiers (560 / 484 / 360)',
  dmcTier560 !== null && dmcTier484 !== null && dmcTier360 !== null
  && !/@media[^{]*max-width/.test(modelConfigPageSheet),
  { tiers: [dmcTier560, dmcTier484, dmcTier360].map(body => body !== null) })

// 17.12 THE COLUMN KEY STAYS READABLE (§6.2). The four Chinese column names are
// the only place a sighted user learns what the four badges mean; the HUD's
// English codes are gone, so the readable words are not optional.
const keyLabels = [...picker.matchAll(/t\('(badge\.key\.[a-z]+)'\)/g)].map(match => match[1])
const legendOrdered = /const legend[\s\S]*?'text'[\s\S]*?'image'[\s\S]*?'effort'[\s\S]*?'context'/.test(picker)
const legendRendered = /className="dmp-legend"/.test(picker)
  && /className="dmp-legend-word"/.test(picker)
  && !/className="dmp-legend"[^>]*aria-hidden/.test(picker)
check('badges: the four readable column keys survive, in the columns order',
  legendOrdered && legendRendered && keyLabels.length === 4 && new Set(keyLabels).size === 4,
  { keyLabels, legendOrdered, legendRendered })

const pkg = JSON.parse(read('package.json'))
check('manifest: exports["./client"] is declared', typeof pkg.exports?.['./client'] === 'object')
check('manifest: dsh.client.platform is "web"', pkg.dsh?.client?.platform === 'web')

// --- 15. one package identity, three places that must agree -----------------
// A rename is not a one-file edit: the Loader row is resolved by name, the
// client bundle registers itself under an id that MUST equal the package name
// (`client-modules` requests the entry by package name through
// `exports["./client"]`), and the locale namespace is the plugin's own identity.
// Disagreement is silent — the row resolves to nothing and the seat simply never
// appears — so pin all three to `package.json` here rather than trusting a
// build-time assertion the reader may not have rebuilt from.
const patch = read('cordis.patch.yml')
const patchRow = /- insert:\s*\n\s*- id:\s*(\S+)\s*\n\s*name:\s*(\S+)/.exec(patch)
check(
  'identity: the bundle entry id, the Loader row and package.json agree',
  patchRow !== null && patchRow[1] === pkg.name && patchRow[2] === pkg.name,
  { pkg: pkg.name, rowId: patchRow?.[1] ?? null, rowName: patchRow?.[2] ?? null },
)
check('identity: the locale namespace is the package name', new RegExp(`export const NS = '${pkg.name}'`).test(read('src/client/dictionary.ts')))
// The swept key is a DATA contract, not an identity: `localStorage` is shared
// across plugins, and the keys this prefix matches were written by an older build
// under the OLD package name. The sweep therefore has to look for the old spelling
// — a "tidy up the rename" edit that pointed it at `pkg.name` would leave every
// existing user's dead entry in place forever, which is the exact opposite of what
// the sweep is for. (Two records preceded this one: the "recently used" keys, gone
// with the module that read them, and the per-session scope keys §5.26 retired.)
const retiredScopeCode = read('src/client/retiredScope.ts')
check(
  'identity: the swept localStorage prefix does NOT follow the package name',
  !new RegExp(`'${pkg.name}\\.provider`).test(retiredScopeCode)
    && /'dsh-model-picker\.provider\.'/.test(retiredScopeCode),
  { sweptPrefix: /const RETIRED_SCOPE_PREFIX = '([^']+)'/.exec(retiredScopeCode)?.[1] ?? null },
)

// --- 16. the design skill's own linter, on this round's four surfaces -------
// The skill ships the linter whose rules the design record quotes (`shadow`,
// `outlined-box`, `em-dash`), and a gate that only re-states those rules in prose
// drifts from the tool the reviewer actually runs. So the tool is RUN, on exactly
// the four source files this round touches, and its FAIL block has to be empty.
// WARN lines are printed with their count rather than failed: a 1px edge on a real
// form field is the exemption the house rules themselves name, and the count is
// the metric of this refactor (five outlined boxes per row became one).
//
// The linter lives in the user's skill install, so a machine without it prints a
// note instead of a red: the missing tool is not a defect in this repository.
// `lib/` is deliberately NOT passed — it is the build artifact of these files and
// would report every finding a second time.
const TASTE_LINT_CANDIDATES = [
  process.env.TASTE_SKILL_LINT,
  join(homedir(), '.dsh', 'skills', 'design-taste-frontend', 'scripts', 'lint.mjs'),
  join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'skills', 'design-taste-frontend', 'scripts', 'lint.mjs'),
].filter(candidate => typeof candidate === 'string' && candidate !== '')
const tasteLint = TASTE_LINT_CANDIDATES.find(candidate => existsSync(candidate))
if (tasteLint === undefined) {
  console.log('  note taste-skill lint: not installed on this machine — the four surfaces were not linted')
} else {
  const LINTED = [
    'src/client/ModelConfigPage.tsx',
    'src/client/modelConfigStyles.ts',
    'src/client/ModelCatalog.tsx',
    'src/client/catalogStyles.ts',
  ]
  const run = spawnSync(process.execPath, [tasteLint, ...LINTED], { cwd: root, encoding: 'utf8' })
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
  const sections = { FAIL: [], WARN: [] }
  let section = null
  for (const line of output.split(/\r?\n/)) {
    if (/^FAIL\s*$/.test(line)) { section = 'FAIL'; continue }
    if (/^WARN\s*$/.test(line)) { section = 'WARN'; continue }
    if (section !== null && /^\s{2}\[/.test(line)) { sections[section].push(line.trim()); continue }
    if (/^(?:RESULT|TASTESKILL)/.test(line)) section = null
  }
  console.log(`  info taste-skill lint: fails=${sections.FAIL.length} warnings=${sections.WARN.length} (${LINTED.length} files)`)
  for (const warning of sections.WARN) console.log(`  info taste-skill lint warn: ${warning}`)
  check(
    'taste-skill lint: no FAIL on the four round surfaces',
    sections.FAIL.length === 0,
    { fail: sections.FAIL, exitCode: run.status },
  )
}

console.log(failures === 0 ? 'static selfcheck: all good' : `static selfcheck: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
