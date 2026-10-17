#!/usr/bin/env node
/**
 * End-to-end verification of the `rabbit-model-config` settings tab against a
 * LIVE DSH web GUI.
 *
 * It drives the running GUI read-only: it never clicks 保存 / 添加所选 / 删除 and
 * never stores a credential, so it cannot mutate the deployment's settings.
 *
 * ⚠ READ docs/agent-safety.md BEFORE RUNNING THIS. It drives a REAL GUI:
 *   - NEVER point it at a second `dsh web` sharing the same DSH_HOME/profile as the
 *     owner's instance. That is what destabilised the primary server on 2026-10-17
 *     (no exit code survived; the incident is recorded in docs/agent-safety.md).
 *   - R5 (theme switch through 通用设置 → 外观) and A9/A20 (dirty-draft gating) touch
 *     WRITE paths. Get explicit permission, or skip them, before running this
 *     against the owner's own server. Everything else here is read-only.
 *   - Never stop a `dsh web` process you did not start.
 *
 * ⚠ THIS SCRIPT STILL ASSERTS THE §5.32 DOM (`.dmc-key` / `.dmc-edit` /
 * `.dmc-enable` / the six-track control line / the R3 left-edge table). The
 * 2026-10-17 ledger rewrite (DESIGN §5.35, docs/ui-language.md) replaced that shape
 * with a scan line + a settings well, so most checks here now fail against the
 * current page. It was NOT rewritten in that round: the owner took over visual
 * verification and live runs were closed for the session, so the honest state is
 * "this gate targets the previous DOM and needs its R/A checks remapped to
 * line/well/door/diagnostic" — a half-updated gate nobody executed would be worse.
 * Rewrite it against the new contract before the next live acceptance.
 *
 * The page's CURRENT static contract is enforced by `npm run selfcheck`,
 * `npm run contrast`, `npm run test:model-config` and `npm run test:model-config-copy`.
 *
 * Usage:
 *   node scripts/verify-model-config-tab.cjs
 *   DSH_WEB_URL=http://127.0.0.1:3080 DSH_WEB_TOKEN=... node scripts/verify-model-config-tab.cjs
 *   DMC_VERIFY_MUTATE=1 node scripts/verify-model-config-tab.cjs
 *
 * The token is read from the newest ~/.dsh/logs/web-*.stdout.log when the env
 * var is absent (that is where `dsh web` prints its one-time URL).
 *
 * A1–A13 are the tab's EXISTING contract (tab seat, layout, credential entry,
 * inline catalog region, save gate, Tab walk, three-step discovery, Escape,
 * console). R1–R8 are
 * the 2026-10-16 refactor's own checks, and they are the reason this file was
 * touched: the redesign's whole claim is that ten rows read as ONE aligned table
 * under ONE counting sentence, so every one of those words is measured rather
 * than reviewed.
 *
 * `DMC_VERIFY_MUTATE=1` adds a "break it and watch it go red" pass: each R check's
 * measurement runs again against a deliberately corrupted DOM, and a check whose
 * detector does NOT flip to failure is reported as BAD. A gate nobody has broken
 * on purpose is a gate nobody knows the shape of.
 *
 * Exit code 0 = every check passed; 1 = at least one check failed or the harness
 * could not run.
 *
 * Known-failing checks are marked `known defect` in their label; they are real
 * product defects observed on 2026-10-16, not harness problems.
 */

'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const SHOTS_DIR = path.join(__dirname, '..', 'shots')
const DEFAULTS = { url: 'http://127.0.0.1:3080', viewports: [[1920, 1080], [1440, 900], [1024, 800], [768, 900], [390, 844]] }
/** The three container widths the brief names (§11): the phone column, a mid panel, the cap. */
const CONTAINER_WIDTHS = [106, 484, 560]

/** Resolve playwright from the global @playwright/cli install, then the local tree. */
function loadPlaywright () {
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@playwright', 'cli'),
    path.join(os.homedir(), '.npm-global', 'lib', 'node_modules', '@playwright', 'cli'),
    '/usr/lib/node_modules/@playwright/cli',
    path.join(__dirname, '..'),
  ]
  for (const base of candidates) {
    try {
      return require(require.resolve('playwright', { paths: [base] }))
    } catch { /* try the next root */ }
  }
  try { return require('playwright') } catch { /* fall through */ }
  return undefined
}

/** Read the one-time GUI token from the newest `dsh web` stdout log. */
function readToken () {
  const dir = path.join(os.homedir(), '.dsh', 'logs')
  let newest
  let newestTime = 0
  for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!/^web-.*\.stdout\.log$/.test(name)) continue
    const full = path.join(dir, name)
    const when = fs.statSync(full).mtimeMs
    if (when > newestTime) { newestTime = when; newest = full }
  }
  if (newest === undefined) return undefined
  const found = /[?&]token=([A-Za-z0-9_-]+)/.exec(fs.readFileSync(newest, 'utf8'))
  return found === null ? undefined : found[1]
}

const results = []
function record (id, label, ok, detail) {
  results.push({ id, label, ok, detail })
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`${mark}  ${id}  ${label}`)
  if (detail !== undefined) console.log(`      ${detail}`)
}

/** One informational line (never affects the exit code). */
function note (text) {
  console.log(`note  ${text}`)
}

/**
 * The copy the running page renders, read out of `modelConfigCopy.ts`.
 *
 * Read rather than duplicated: the words are the designer's to tune, and a check
 * that hard-codes 可用 would pass while the screen said something else — or fail
 * because a word was improved. Both languages are collected because the GUI
 * language is the host's, not this script's.
 * @returns the verdict words and the three readout sentences, per language.
 */
function readCopy () {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'client', 'modelConfigCopy.ts'), 'utf8')
  const zhPart = source.slice(source.indexOf('export const zh'), source.indexOf('/** English dictionary'))
  const enPart = source.slice(source.indexOf('/** English dictionary'))
  const value = (part, key) => {
    const found = new RegExp(`'config\\.${key.replace(/\./g, '\\.')}':\\s*'([^']*)'`).exec(part)
    return found === null ? null : found[1]
  }
  const collect = (part) => ({
    ready: value(part, 'verdict.ready'),
    missingKey: value(part, 'verdict.missingKey'),
    unavailable: value(part, 'verdict.unavailable'),
    dormant: value(part, 'verdict.dormant'),
    signedIn: value(part, 'account.signedIn'),
    summaryReady: value(part, 'summary.ready'),
    summaryAttention: value(part, 'summary.attention'),
    summaryNone: value(part, 'summary.none'),
    // §5.33 — the inline auto-retry editor's words. Read, never spelled here: the
    // trigger's wording is what proves the card is GONE from the shipped Models
    // page (A5), and the two state words are what A16 accepts.
    retryTrigger: value(part, 'retryPolicy.trigger'),
    retryDeclared: value(part, 'retryPolicy.declared'),
    retryInherits: value(part, 'retryPolicy.inherits'),
    retrySaved: value(part, 'retryPolicy.saved'),
    retryReset: value(part, 'retryPolicy.reset'),
    retryUnavailable: value(part, 'retryPolicy.unavailable'),
  })
  return { zh: collect(zhPart), en: collect(enPart) }
}

/** Fill `{name}` placeholders the way `modelConfigCopy.interpolate` does. */
function interpolate (template, params) {
  if (template === null) return null
  return template.replace(/\{(\w+)\}/g, (whole, name) => (name in params ? String(params[name]) : whole))
}

/** Collapse whitespace so a wrapped sentence still compares equal. */
function normalize (text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim()
}

/** The click path that opens Settings → 模型配置, tolerant of a closed dialog. */
async function ensureModelConfig (page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await page.locator('[role=dialog]').count() === 0) {
      await page.getByRole('button', { name: '账号菜单' }).click({ timeout: 6000 }).catch(() => {})
      await page.waitForTimeout(700)
      const item = page.getByRole('menuitem', { name: '设置' })
      if (await item.count() > 0) { await item.click().catch(() => {}); await page.waitForTimeout(1000) }
    }
    if (await page.locator('[role=dialog]').count() > 0) break
    await page.waitForTimeout(700)
  }
  const tab = page.getByRole('button', { name: '模型配置' })
  if (await tab.count() > 0 && await page.locator('.dmc-row').count() === 0) {
    await tab.click().catch(() => {})
    await page.waitForTimeout(1200)
  }
}

/** Park focus and the pointer so a row's hover/focus fill cannot be mistaken for a state fill. */
async function parkPointer (page) {
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur() })
  await page.mouse.move(2, 2)
  await page.waitForTimeout(350)
}

/**
 * Everything the refactor checks measure, in one read of the live page.
 *
 * `getComputedStyle` rather than attributes wherever a verdict is about PAINT: a
 * rule that exists but loses the cascade would satisfy an attribute check and
 * still show the wrong thing.
 */
const SNAPSHOT = () => {
  const stateOf = (el) => {
    const explicit = el.getAttribute('data-state')
    if (explicit !== null && explicit !== '') return explicit
    return el.getAttribute('data-usable') === 'false' ? 'unreachable' : null
  }
  const box = (el) => {
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return {
      left: +rect.left.toFixed(2),
      right: +rect.right.toFixed(2),
      top: +rect.top.toFixed(2),
      width: +rect.width.toFixed(2),
      height: +rect.height.toFixed(2),
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
      background: style.backgroundColor,
      color: style.color,
    }
  }
  const paints = (background) => !/^(?:transparent|rgba\(0, 0, 0, 0\))$/.test(String(background).trim())
  /** What a screen reader announces for a control: `aria-label` first, then its text. */
  const accessibleName = (el) => {
    if (el === null) return null
    const label = el.getAttribute('aria-label')
    if (label !== null && label.trim() !== '') return label.trim()
    return (el.textContent || '').replace(/\s+/g, ' ').trim()
  }

  const page = document.querySelector('.dmc-page')
  const readout = document.querySelector('.dmc-readout')
  const rows = [...document.querySelectorAll('.dmc-row')]
  const CONTROL_CLASSES = ['.dmc-key', '.dmc-protocol', '.dmc-catalog', '.dmc-error-toggle', '.dmc-enable']

  return {
    dpr: window.devicePixelRatio,
    page: page === null
      ? null
      : {
          ...box(page),
          clientWidth: page.clientWidth,
          scrollWidth: page.scrollWidth,
          fontSize: Number.parseFloat(getComputedStyle(page).fontSize),
          containerType: getComputedStyle(page).containerType,
        },
    docOverflow: document.scrollingElement === null ? 0 : document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
    readout: readout === null
      ? null
      : {
          text: readout.textContent,
          fontSize: Number.parseFloat(getComputedStyle(readout).fontSize),
          lineHeight: Number.parseFloat(getComputedStyle(readout).lineHeight),
          height: +readout.getBoundingClientRect().height.toFixed(2),
        },
    verdictCount: document.querySelectorAll('.dmc-verdict').length,
    rows: rows.map((row) => {
      const verdict = row.querySelector('.dmc-verdict')
      const rail = row.querySelector('.dmc-rail')
      const controls = {}
      for (const cls of CONTROL_CLASSES) controls[cls] = box(row.querySelector(cls))
      const bordered = [...row.querySelectorAll('*')].filter((el) => {
        if (el.getClientRects().length === 0) return false
        const style = getComputedStyle(el)
        return ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']
          .some((side) => style[side] !== '0px' && style[side] !== '')
      }).length
      return {
        state: stateOf(row),
        dataError: row.getAttribute('data-error'),
        route: row.querySelector('.dmc-route') === null ? null : row.querySelector('.dmc-route').textContent,
        background: getComputedStyle(row).backgroundColor,
        rail: rail === null ? null : { ...box(rail), paints: paints(getComputedStyle(rail).backgroundColor) },
        verdict: verdict === null
          ? null
          : { text: verdict.textContent, color: getComputedStyle(verdict).color, right: +verdict.getBoundingClientRect().right.toFixed(2) },
        controls,
        /** What a screen reader announces: `aria-label` first, then the visible word. */
        accessNames: {
          clear: accessibleName(row.querySelector('.dmc-key-clear')),
          lifecycle: accessibleName(row.querySelector('.dmc-enable')),
        },
        bordered,
      }
    }),
  }
}

/** R1 — the readout counts the rows, and the check counts them itself. */
function judgeR1 (snapshot, copy) {
  const states = snapshot.rows.map((row) => row.state)
  const total = states.length
  const ready = states.filter((state) => state === 'ready').length
  const issues = states.filter((state) => state === 'missing-key' || state === 'unreachable').length
  const unknown = states.filter((state) => !['ready', 'missing-key', 'unreachable'].includes(state))
  const accounted = unknown.length === 0 && ready + issues === total
  const expected = total === 0
    ? [copy.zh.summaryNone, copy.en.summaryNone]
    : issues === 0
      ? [interpolate(copy.zh.summaryReady, { count: total }), interpolate(copy.en.summaryReady, { count: total })]
      : [
          interpolate(copy.zh.summaryAttention, { count: ready, issues }),
          interpolate(copy.en.summaryAttention, { count: ready, issues }),
        ]
  const readout = snapshot.readout
  const matched = readout !== null && expected.some((text) => normalize(text) === normalize(readout.text))
  const lines = readout === null ? null : readout.lineHeight > 0 ? +(readout.height / readout.lineHeight).toFixed(2) : null
  const ok = accounted && matched && lines !== null && lines <= 2.01
    && snapshot.page !== null && readout !== null && readout.fontSize > snapshot.page.fontSize
  return {
    ok,
    detail: `rows=${total} ready=${ready} issues=${issues} unknown=${JSON.stringify(unknown)} accounted=${accounted} `
      + `readout=${JSON.stringify(normalize(readout && readout.text))} expected=${JSON.stringify(expected.map(normalize))} `
      + `size=${readout && readout.fontSize}px/${lines} lines body=${snapshot.page && snapshot.page.fontSize}px`,
  }
}

/** R2 — every row states the word its own state owns, and the rail carries one meaning. */
function judgeR2 (snapshot, copy) {
  // §15.2 — the ONE place a word is more specific than the state. The session row
  // (`deepseek-account`) is `ready` because it can serve requests without a stored
  // key, but its word is 已登录 / Signed in: "Ready" would hide the fact the row
  // exists to state. Every other `ready` row states 可用.
  const words = {
    ready: [copy.zh.ready, copy.en.ready, copy.zh.signedIn, copy.en.signedIn],
    'missing-key': [copy.zh.missingKey, copy.en.missingKey],
    unreachable: [copy.zh.unavailable, copy.en.unavailable],
  }
  const wrongWord = snapshot.rows
    .map((row) => ({ state: row.state, text: row.verdict === null ? null : normalize(row.verdict.text), allowed: words[row.state] }))
    .filter((entry) => entry.allowed === undefined || entry.text === null || !entry.allowed.includes(entry.text))
  const railWrong = snapshot.rows
    .map((row) => ({ state: row.state, wants: row.state === 'missing-key' || row.state === 'unreachable', paints: row.rail !== null && row.rail.paints }))
    .filter((entry) => entry.wants !== entry.paints)
  // The session row must say 已登录 and NOT the generic answer word.
  const session = snapshot.rows.find((row) => row.route !== null && row.route.trim() === 'deepseek-account')
  const sessionOk = session === undefined
    ? true
    : session.verdict !== null && [copy.zh.signedIn, copy.en.signedIn].includes(normalize(session.verdict.text))
  const marked = snapshot.rows.filter((row) => row.state === 'missing-key' || row.state === 'unreachable')
  const ready = snapshot.rows.filter((row) => row.state === 'ready')
  const inkSplit = ready.length === 0 || marked.length === 0
    ? true
    : new Set(ready.map((row) => row.verdict && row.verdict.color)).size === 1
      && new Set(marked.map((row) => row.verdict && row.verdict.color)).size === 1
      && (ready[0].verdict && ready[0].verdict.color) !== (marked[0].verdict && marked[0].verdict.color)
  return {
    ok: snapshot.verdictCount === snapshot.rows.length && snapshot.rows.length > 0
      && wrongWord.length === 0 && railWrong.length === 0 && inkSplit && sessionOk,
    detail: `verdicts=${snapshot.verdictCount}/${snapshot.rows.length} wrongWord=${JSON.stringify(wrongWord)} `
      + `railWrong=${JSON.stringify(railWrong)} inkSplit=${inkSplit} sessionOnSessionRow=${session === undefined ? 'row-not-found' : JSON.stringify(normalize(session.verdict && session.verdict.text))}`,
  }
}

/** R3 — the control columns are columns: every row parks the same control at the same left edge. */
function judgeR3 (snapshot) {
  const classes = ['.dmc-key', '.dmc-protocol', '.dmc-catalog', '.dmc-error-toggle', '.dmc-enable']
  const spreads = classes.map((cls) => {
    const lefts = snapshot.rows.map((row) => row.controls[cls]).filter((box) => box !== null && box.visible).map((box) => box.left)
    return { cls, samples: lefts.length, spread: lefts.length > 1 ? +(Math.max(...lefts) - Math.min(...lefts)).toFixed(2) : 0, lefts }
  })
  return {
    ok: spreads.every((entry) => entry.samples < 2 || entry.spread <= 1),
    detail: JSON.stringify(spreads),
  }
}

/**
 * R4 — one 1px edge per row, and the answers stand in one right-aligned column.
 *
 * "Per row" is the PAGE's `.dmc-row` line only (§15.4). The catalog's
 * `.dmc-model-row` is a record line whose well is a real form, and the house rules
 * exempt real form fields from the no-outlined-box rule for exactly the reason the
 * page keeps its one select: a field that has no edge stops reading as a field.
 * This check therefore never looks inside `.dmc-catalog-panel`, which is also why
 * it runs while the catalog region is collapsed.
 */
function judgeR4 (snapshot) {
  const edges = snapshot.rows.map((row) => row.bordered)
  const rights = snapshot.rows.map((row) => (row.verdict === null ? null : row.verdict.right)).filter((right) => right !== null)
  const spread = rights.length > 1 ? +(Math.max(...rights) - Math.min(...rights)).toFixed(2) : 0
  return {
    ok: edges.every((count) => count <= 1) && rights.length === snapshot.rows.length && spread <= 1,
    detail: `borderedPerRow=${JSON.stringify(edges)} verdictRights=${JSON.stringify(rights)} spread=${spread}`,
  }
}

/** R8 — no row carries a rest-state fill, in any of the three states. */
function judgeR8 (snapshot) {
  const filled = snapshot.rows
    .map((row, index) => ({ index, state: row.state, background: row.background }))
    .filter((row) => !/^(?:transparent|rgba\(0, 0, 0, 0\))$/.test(String(row.background).trim()))
  const byState = {}
  for (const row of snapshot.rows) byState[row.state] = (byState[row.state] || 0) + 1
  return { ok: snapshot.rows.length > 0 && filled.length === 0, detail: `states=${JSON.stringify(byState)} filled=${JSON.stringify(filled)}` }
}

/**
 * R9 (§15.3) — the disabled ink, measured on the live page.
 *
 * A de-chromed control's ink IS its whole affordance (no box, no fill, no edge), so
 * the unavailable state has to be visibly different from the resting one: rest in
 * the primary ink, `:disabled` in the secondary one. The two reference colours are
 * read off elements whose ink is not under test — `.dmc-name` is primary and
 * `.dmc-route` is secondary — so this compares the SHIPPED tokens instead of an rgb
 * literal that would go stale with the host palette. Each sample is a real element
 * whose `disabled` property is toggled and put back.
 */
async function judgeR9 (page) {
  const measured = await page.evaluate(async () => {
    const inkOf = (selector) => {
      const el = document.querySelector(selector)
      return el === null ? null : getComputedStyle(el).color
    }
    const reference = { primary: inkOf('.dmc-name'), secondary: inkOf('.dmc-route') }
    // These controls `transition: color 120ms`, so a colour read in the SAME task as
    // a state change is still the previous one — the first version of this check did
    // exactly that and reported a false pass on three classes. Every read below is
    // therefore taken after the transition has settled.
    const settled = async (element) => {
      getComputedStyle(element).color
      await new Promise((resolve) => setTimeout(resolve, 260))
      return getComputedStyle(element).color
    }
    const samples = []
    for (const cls of ['.dmc-key-action', '.dmc-key-clear', '.dmc-catalog', '.dmc-protocol', '.dmc-enable']) {
      // The RESTING ink comes off a live ENABLED control, and the disabled ink off a
      // hidden CLONE of it. Disabling the live element instead is not merely indirect
      // — on `.dmc-key-action` it can be the open credential field, whose blur
      // commits the draft — so the deployment is never touched to take this
      // measurement.
      const live = [...document.querySelectorAll(cls)]
        .find((el) => ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && el.disabled !== true)
      if (live === undefined) continue
      const rest = await settled(live)
      const clone = live.cloneNode(true)
      clone.setAttribute('data-verify-clone', 'true')
      clone.disabled = true
      clone.style.visibility = 'hidden'
      live.parentElement.append(clone)
      const disabled = await settled(clone)
      clone.remove()
      samples.push({ cls, tag: live.tagName.toLowerCase(), rest, disabled })
    }
    return { reference, samples }
  })
  const wrong = measured.samples.filter((sample) => sample.rest !== measured.reference.primary
    || sample.disabled !== measured.reference.secondary || sample.rest === sample.disabled)
  return {
    ok: measured.reference.primary !== null && measured.reference.secondary !== null
      && measured.samples.length >= 3 && wrong.length === 0,
    detail: `reference=${JSON.stringify(measured.reference)} samples=${JSON.stringify(measured.samples)} wrong=${JSON.stringify(wrong)}`,
  }
}

/**
 * R10 (§16/V2, criterion settled by the Lead in §17) — one row, two entries, two
 * names.
 *
 * The criterion is that the two ACCESSIBLE NAMES are not equal, NOT that the two
 * verbs differ. The visible words are already distinct (清除密钥 vs 删除), and the
 * two `aria-label`s are parallel on purpose: a screen reader hears 「删除 API 密钥」
 * for the credential entry and 「删除 opencode-go」 for the lifecycle entry, which
 * are two different objects. Requiring different verbs as well would be a style
 * rule, not an accessibility one, and the Lead ruled it out.
 */
function judgeR10 (snapshot) {
  const pairs = snapshot.rows
    .map((row, index) => ({
      index,
      clear: row.controls['.dmc-key-clear'] === null ? null : row.accessNames.clear,
      lifecycle: row.controls['.dmc-enable'] === null ? null : row.accessNames.lifecycle,
    }))
    .filter((pair) => pair.clear !== null && pair.lifecycle !== null)
  const identical = pairs.filter((pair) => normalize(pair.clear) === normalize(pair.lifecycle))
  const empty = pairs.filter((pair) => pair.clear === '' || pair.lifecycle === '')
  return {
    ok: snapshot.rows.length > 0 && pairs.length >= 5 && identical.length === 0 && empty.length === 0,
    detail: `compared=${pairs.length} identicalNames=${JSON.stringify(identical)} emptyNames=${JSON.stringify(empty)} pairs=${JSON.stringify(pairs)}`,
  }
}

/**
 * R11 (§17/V5) — the protocol select's text, measured at THREE container widths.
 *
 * The first version measured the natural width only, and 11/11 passed while the
 * 484px container was still clipping `Anthropic Messages` — the same defect one
 * breakpoint away. The rule the Lead settled:
 *   - the wide widths (484 and 560) must show the selected label in full;
 *   - the 106px phone column may truncate (a ~110px label cannot fit an ~94px
 *     track — that is the host's own external constraint), but it must NOT
 *     overflow: the select keeps its own box and the page keeps its scroll width.
 */
function judgeR11 (probes) {
  const wide = probes.filter((probe) => probe.requestedWidth >= 484)
  const narrow = probes.find((probe) => probe.requestedWidth <= 106)
  const wideSamples = wide.reduce((sum, probe) => sum + (probe.protocol || []).length, 0)
  const wideTruncated = wide.flatMap((probe) => (probe.protocol || [])
    .filter((sample) => sample.truncated === true)
    .map((sample) => ({ width: probe.requestedWidth, text: sample.text, headroom: sample.headroom })))
  const narrowSamples = narrow === undefined ? [] : (narrow.protocol || [])
  const narrowOverflow = narrowSamples
    .filter((sample) => sample.scrollWidth - sample.clientWidth > 1)
    .map((sample) => ({ text: sample.text, clientWidth: sample.clientWidth, scrollWidth: sample.scrollWidth }))
  return {
    ok: wideSamples >= 10 && wideTruncated.length === 0
      && (narrow === undefined || (narrowOverflow.length === 0 && narrow.overflowers.length === 0 && narrow.pageOverflow <= 1)),
    detail: `wideSamples=${wideSamples} wideTruncated=${JSON.stringify(wideTruncated)} `
      + `narrow=${JSON.stringify(narrow === undefined ? null : {
        width: narrow.width,
        samples: narrowSamples.length,
        truncated: narrowSamples.filter((sample) => sample.truncated === true).length,
        overflow: narrowOverflow,
        overflowers: narrow.overflowers,
        pageOverflow: narrow.pageOverflow,
        headroom: narrowSamples.map((sample) => sample.headroom),
      })} `
      + `wide=${JSON.stringify(wide.map((probe) => ({ width: probe.width, minHeadroom: Math.min(...(probe.protocol || []).map((sample) => sample.headroom)) })))}`,
  }
}

/**
 * R13 (§16/V1) — nothing on the page is covered by a FOREIGN element.
 *
 * `elementFromPoint` at the visible centre of every key text and control must land
 * on that element, a descendant, or an ancestor. A hit that belongs to another
 * subtree means the element is painted over — the "ghost string"/overlap class of
 * finding, caught by measurement instead of by eye.
 *
 * Only elements with a real visible centre are tested: rows that the host's own
 * scroller clips (the last row at rest) have no hit point of their own, and they are
 * counted as `offPane` rather than silently passing as covered or uncovered.
 */
const COLLISION = () => {
  const visibleBox = (el) => {
    const rect = el.getBoundingClientRect()
    let box = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    for (let node = el.parentElement; node !== null; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (!/(?:hidden|auto|scroll|clip)/.test(`${style.overflowX}${style.overflowY}`)) continue
      const clip = node.getBoundingClientRect()
      box = {
        left: Math.max(box.left, clip.left),
        top: Math.max(box.top, clip.top),
        right: Math.min(box.right, clip.right),
        bottom: Math.min(box.bottom, clip.bottom),
      }
    }
    return {
      left: Math.max(box.left, 0),
      top: Math.max(box.top, 0),
      right: Math.min(box.right, innerWidth),
      bottom: Math.min(box.bottom, innerHeight),
    }
  }
  const targets = []
  const add = (label, el) => { if (el !== null) targets.push({ label, el }) }
  add('readout', document.querySelector('.dmc-readout'))
  add('add', document.querySelector('.dmc-add'))
  add('empty', document.querySelector('.dmc-empty'))
  add('notice', document.querySelector('.dmc-notice'))
  for (const [index, row] of [...document.querySelectorAll('.dmc-row')].entries()) {
    add(`row${index}.name`, row.querySelector('.dmc-name'))
    add(`row${index}.verdict`, row.querySelector('.dmc-verdict'))
    for (const cls of ['.dmc-key-action', '.dmc-key-clear', '.dmc-protocol', '.dmc-catalog', '.dmc-error-toggle', '.dmc-enable']) {
      add(`row${index}${cls}`, row.querySelector(cls))
    }
  }
  const results = []
  for (const target of targets) {
    const box = visibleBox(target.el)
    if (box.right - box.left < 4 || box.bottom - box.top < 4) {
      results.push({ label: target.label, status: 'offPane' })
      continue
    }
    const x = (box.left + box.right) / 2
    const y = (box.top + box.bottom) / 2
    const hit = document.elementFromPoint(x, y)
    const self = hit === target.el || target.el.contains(hit)
    const ancestor = hit !== null && hit.contains(target.el)
    results.push({
      label: target.label,
      status: self ? 'ok' : ancestor ? 'ancestor' : 'covered',
      by: self ? null : hit === null ? 'none' : `${hit.tagName.toLowerCase()}${hit.classList.length > 0 ? '.' + [...hit.classList].join('.') : ''}`,
      at: [Math.round(x), Math.round(y)],
    })
  }
  const counts = { total: results.length, ok: 0, ancestor: 0, offPane: 0, covered: 0 }
  for (const result of results) counts[result.status] = (counts[result.status] || 0) + 1
  return { counts, covered: results.filter((result) => result.status === 'covered') }
}

/** The R13 verdict, in the same shape as the other judges. */
async function judgeR13 (page) {
  const collision = await page.evaluate(COLLISION)
  return {
    ok: collision.counts.total > 0 && collision.counts.covered === 0 && collision.counts.ok >= 8,
    detail: JSON.stringify(collision),
  }
}

/** The rects R6 watches for movement. */
const MOTION_RECTS = () => {
  const pick = (selector) => {
    const el = document.querySelector(selector)
    if (el === null) return null
    const rect = el.getBoundingClientRect()
    return [+rect.x.toFixed(2), +rect.y.toFixed(2), +rect.width.toFixed(2), +rect.height.toFixed(2)]
  }
  const transitionOf = (selector) => {
    const el = document.querySelector(selector)
    if (el === null) return `${selector}:absent`
    const style = getComputedStyle(el)
    return `${selector}:${style.transitionDuration}:${style.animationName}`
  }
  return {
    rects: {
      page: pick('.dmc-page'),
      readout: pick('.dmc-readout'),
      row: pick('.dmc-row'),
      verdict: pick('.dmc-verdict'),
    },
    content: {
      rows: document.querySelectorAll('.dmc-row').length,
      verdicts: document.querySelectorAll('.dmc-verdict').length,
      readout: document.querySelector('.dmc-readout') !== null,
    },
    motion: ['.dmc-add', '.dmc-verdict', '.dmc-readout', '.dmc-key-action'].map(transitionOf),
  }
}

/** Whether two motion reads are the same still frame with all of its content. */
function sameFrame (before, after) {
  return JSON.stringify(before.rects) === JSON.stringify(after.rects)
}

/** Whether a `transition-duration` / `animation-name` report means "nothing moves". */
function motionOff (report) {
  return report.every((entry) => {
    const [, duration, animation] = entry.split(':')
    if (duration === 'absent' || duration === undefined) return true
    const seconds = String(duration).split(',').map((part) => Number.parseFloat(part) || 0)
    return seconds.every((value) => value === 0) && animation === 'none'
  })
}

/** R7 — one container width: force it, then measure what the page did with it. */
async function containerProbe (page, width) {
  await page.evaluate((w) => {
    let style = document.getElementById('verify-dmc-container')
    if (style === null) {
      style = document.createElement('style')
      style.id = 'verify-dmc-container'
      document.head.append(style)
    }
    style.textContent = `.dmc-page { width: ${w}px !important; max-width: ${w}px !important; min-width: 0 !important; }`
  }, width)
  await page.waitForTimeout(280)
  const measured = await page.evaluate(() => {
    const page = document.querySelector('.dmc-page')
    if (page === null) return { missing: true }
    const rect = page.getBoundingClientRect()
    const overflowers = []
    for (const el of page.querySelectorAll('*')) {
      if (el.getClientRects().length === 0) continue
      const own = el.getBoundingClientRect()
      if (own.right > rect.right + 1 || own.left < rect.left - 1) {
        overflowers.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`)
      }
    }
    const row = page.querySelector('.dmc-row')
    const verdict = page.querySelector('.dmc-verdict')
    const answer = verdict === null ? null : verdict.getBoundingClientRect()
    /**
     * The protocol labels at THIS container width.
     *
     * A `<select>` clips its own text (the platform draws it), so `scrollWidth` is
     * not a truncation signal; the selected option's text is measured with the
     * element's own computed font instead. Both numbers are reported because the
     * 106px column is allowed to truncate but never to overflow.
     */
    const protocol = (() => {
      const measure = document.createElement('canvas').getContext('2d')
      return [...page.querySelectorAll('.dmc-protocol')].map((el) => {
        const style = getComputedStyle(el)
        const selected = el.selectedOptions !== undefined && el.selectedOptions.length > 0
          ? el.selectedOptions[0].textContent
          : el.value
        measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        const textWidth = +measure.measureText(selected || '').width.toFixed(2)
        const contentWidth = +(el.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)).toFixed(2)
        return {
          text: (selected || '').slice(0, 30),
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          contentWidth,
          textWidth,
          headroom: +(contentWidth - textWidth).toFixed(2),
          truncated: textWidth > contentWidth,
        }
      })
    })()
    /**
     * The last rendered line of an element's own text, character by character.
     *
     * The narrow container is where a label can end up leaving ONE character alone
     * on its final line (the "orphan" the 106px round reported on the page's footer
     * action), and no box measurement can see that: it needs the characters' own
     * line positions.
     */
    const lastLineOf = (el) => {
      if (el === null) return null
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      const characters = []
      while (walker.nextNode()) {
        const node = walker.currentNode
        for (let index = 0; index < node.textContent.length; index += 1) {
          const range = document.createRange()
          range.setStart(node, index)
          range.setEnd(node, index + 1)
          const own = range.getBoundingClientRect()
          if (own.width === 0 && own.height === 0) continue
          characters.push({ top: Math.round(own.top), char: node.textContent[index] })
        }
      }
      if (characters.length === 0) return null
      const tops = [...new Set(characters.map((entry) => entry.top))]
      const lastTop = Math.max(...tops)
      return {
        lines: tops.length,
        lastLine: characters.filter((entry) => entry.top === lastTop).map((entry) => entry.char).join('').trim(),
      }
    }
    return {
      requested: Number.parseFloat(getComputedStyle(page).width),
      width: +rect.width.toFixed(2),
      containerType: getComputedStyle(page).containerType,
      docOverflow: document.scrollingElement === null ? 0 : document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
      pageOverflow: page.scrollWidth - page.clientWidth,
      overflowers: overflowers.slice(0, 6),
      tracks: row === null ? null : getComputedStyle(row).gridTemplateColumns,
      columns: row === null ? null : getComputedStyle(row).gridTemplateColumns,
      verdictInside: answer === null ? null : answer.left >= rect.left - 1 && answer.right <= rect.right + 1,
      protocol,
      lastLines: {
        add: lastLineOf(document.querySelector('.dmc-add')),
        readout: lastLineOf(document.querySelector('.dmc-readout')),
        catalog: lastLineOf(document.querySelector('.dmc-catalog')),
        verdict: lastLineOf(verdict),
      },
    }
  })
  return measured
}

/** The three container widths, measured in one pass (R7b and R11 share it). */
async function containerSuite (page) {
  const probes = []
  for (const requested of CONTAINER_WIDTHS) {
    probes.push({ requestedWidth: requested, ...(await containerProbe(page, requested)) })
  }
  await clearContainerOverride(page)
  return probes
}

/** R11 re-measured from scratch, for the mutation pass that changes the layout. */
async function judgeR11FromPage (page) {
  return judgeR11(await containerSuite(page))
}

/** Remove the container override. */
async function clearContainerOverride (page) {
  await page.evaluate(() => { document.getElementById('verify-dmc-container')?.remove() })
  await page.waitForTimeout(200)
}

/** The theme the page is actually in. */
const THEME_PROBE = () => ({
  stored: localStorage.getItem('dsh-theme'),
  dark: document.body.hasAttribute('data-ds-dark-theme') || document.documentElement.hasAttribute('data-ds-dark-theme'),
  background: getComputedStyle(document.body).backgroundColor,
})

/**
 * The refactor's before/after metrics, printed as notes.
 *
 * These are the numbers the baseline critique (`.taste-skill/critique-baseline.md`)
 * asked to be falsified — catalog wrapping, the credential cell, mid-word route
 * breaks, the header/row column alignment, whether the last rows are clipped, and
 * the CSS-px width of the column (the visual juror read it as ~1090px, which is one
 * DPR-2 screenshot of a ~545px column). None of them is an assertion on its own;
 * they are the evidence beside R1–R9.
 */
const DETAILS = () => {
  const rect = (el) => {
    if (el === null || el === undefined) return null
    const r = el.getBoundingClientRect()
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), left: +r.left.toFixed(1), right: +r.right.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) }
  }
  /** The text of the first rendered line, via a character-range walk. */
  const firstLine = (el) => {
    if (el === null) return null
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const node = walker.nextNode()
    if (node === null) return null
    const text = node.textContent
    const topAt = (index) => { const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1); return range.getBoundingClientRect().top }
    const first = topAt(0)
    for (let i = 1; i < text.length; i += 1) if (topAt(i) > first + 1) return { full: text, firstLine: text.slice(0, i) }
    return { full: text, firstLine: text }
  }
  const linesOf = (el) => {
    if (el === null) return null
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight)
    return Number.isFinite(lineHeight) && lineHeight > 0 ? +(el.getBoundingClientRect().height / lineHeight).toFixed(2) : null
  }
  const leftsOf = (selector) => [...document.querySelectorAll(selector)].map((el) => +el.getBoundingClientRect().left.toFixed(1))
  const dialog = document.querySelector('[role=dialog]')
  const page = document.querySelector('.dmc-page')
  let scroller = page === null ? null : page.parentElement
  while (scroller !== null && scroller !== document.documentElement) {
    const style = getComputedStyle(scroller)
    if (/(auto|scroll)/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight + 1) break
    scroller = scroller.parentElement
  }
  const rows = [...document.querySelectorAll('.dmc-row')]
  const last = rows.length === 0 ? null : rows[rows.length - 1]
  const lastRect = last === null ? null : last.getBoundingClientRect()
  const dialogRect = dialog === null ? null : dialog.getBoundingClientRect()
  const verdicts = [...document.querySelectorAll('.dmc-verdict')]
  const names = [...document.querySelectorAll('.dmc-name')]
  const catalog = document.querySelector('.dmc-catalog')
  const catalogText = catalog === null ? null : [...catalog.childNodes].find((node) => node.nodeType === 3 && node.textContent.trim() !== '')
  const keyCell = document.querySelector('.dmc-key')
  const keyAction = document.querySelector('.dmc-key-action')
  const clear = document.querySelector('.dmc-key-clear')
  return {
    dpr: window.devicePixelRatio,
    pageClientWidth: page === null ? null : page.clientWidth,
    nameMinWidth: names.length === 0 ? null : Math.min(...names.map((el) => +el.getBoundingClientRect().width.toFixed(1))),
    nameMaxHeight: names.length === 0 ? null : Math.max(...names.map((el) => +el.getBoundingClientRect().height.toFixed(1))),
    verdictCount: verdicts.length,
    verdictWidths: [...new Set(verdicts.map((el) => +el.getBoundingClientRect().width.toFixed(1)))],
    verdictRights: verdicts.map((el) => +el.getBoundingClientRect().right.toFixed(1)),
    verdictInsideViewport: verdicts.every((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth }),
    catalog: catalog === null
      ? null
      : {
          box: rect(catalog),
          text: catalog.textContent.trim(),
          label: (() => {
            if (catalogText === null) return null
            const range = document.createRange()
            range.selectNodeContents(catalogText)
            const box = range.getBoundingClientRect()
            return { w: +box.width.toFixed(1), h: +box.height.toFixed(1), bottom: +box.bottom.toFixed(1), lines: firstLine(catalogText.parentElement) }
          })(),
        },
    key: keyCell === null || keyAction === null
      ? null
      : {
          cell: rect(keyCell),
          actionText: keyAction.textContent.trim(),
          actionLines: linesOf(keyAction),
          clearRight: clear === null ? null : +clear.getBoundingClientRect().right.toFixed(1),
          cellRight: +keyCell.getBoundingClientRect().right.toFixed(1),
        },
    routes: [...document.querySelectorAll('.dmc-route')].map((el) => ({
      text: el.textContent.trim(), lines: linesOf(el), first: firstLine(el),
    })),
    headLefts: [...document.querySelectorAll('.dmc-list-head > *')].map((el) => +el.getBoundingClientRect().left.toFixed(1)),
    controlLefts: { key: leftsOf('.dmc-key'), protocol: leftsOf('.dmc-protocol'), catalog: leftsOf('.dmc-catalog'), enable: leftsOf('.dmc-enable') },
    clipping: {
      dialog: rect(dialog),
      scroller: scroller === null ? null : { cls: [...scroller.classList].join('.').slice(0, 40), scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight },
      lastRow: rect(last),
      lastRowHitTest: lastRect === null
        ? null
        : (() => {
            const el = document.elementFromPoint(lastRect.left + 8, Math.min(lastRect.top + lastRect.height / 2, innerHeight - 4))
            if (el === null) return 'none'
            return el.closest('.dmc-row') === null ? `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}` : 'row'
          })(),
      rowsBelowDialogBottom: dialogRect === null ? null : rows.filter((row) => row.getBoundingClientRect().bottom > dialogRect.bottom + 0.5).length,
    },
    restFilledRows: rows.filter((row) => !/^(?:transparent|rgba\(0, 0, 0, 0\))$/.test(getComputedStyle(row).backgroundColor.trim())).length,
  }
}

/** Whether two probes are one light and one dark theme. */
function bothThemes (first, second) {
  return first !== null && second !== null && first.dark !== second.dark
}

/**
 * The appearance control, as the GUI itself exposes it.
 *
 * Measured, not assumed: this build keeps the theme in the host's settings and
 * renders 外观 as three buttons (浅色 / 深色 / 跟随系统) inside 通用设置 — there is
 * no `dsh-theme` localStorage key to flip (the older `_audit-shots.cjs` recipe
 * silently did nothing here, which is why R5 read two dark screenshots before it
 * was rewritten). The selected button is read back so the original choice can be
 * restored, whatever it was.
 */
const APPEARANCE_PROBE = () => {
  const cubes = [...document.querySelectorAll('button[class*=themeCube]')]
  return {
    dark: document.body.hasAttribute('data-ds-dark-theme'),
    buttons: cubes.map((cube) => ({ text: cube.textContent.trim(), selected: /selected/.test(cube.className) })),
  }
}

/** Open Settings → 通用设置, where 外观 lives. */
async function openAppearance (page) {
  const general = page.getByRole('button', { name: '通用设置' })
  if (await general.count() > 0) {
    await general.click().catch(() => {})
    await page.waitForTimeout(900)
  }
}

/** Open the 模型配置 tab again after a theme switch. */
async function openModelConfig (page) {
  const tab = page.getByRole('button', { name: '模型配置' })
  if (await tab.count() > 0) {
    await tab.click().catch(() => {})
    await page.waitForTimeout(1000)
  }
}

async function main () {
  const playwright = loadPlaywright()
  if (playwright === undefined) {
    console.log('FAIL  harness  playwright is not resolvable; cannot drive the GUI')
    process.exit(1)
  }
  const base = process.env.DSH_WEB_URL || DEFAULTS.url
  const token = process.env.DSH_WEB_TOKEN || readToken()
  if (token === undefined) {
    console.log('FAIL  harness  no GUI token (set DSH_WEB_TOKEN or run `dsh web` first)')
    process.exit(1)
  }
  fs.mkdirSync(SHOTS_DIR, { recursive: true })

  const copy = readCopy()
  const browser = await playwright.chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  const consoleNoise = []
  const pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleNoise.push(`${m.type()}: ${m.text().slice(0, 300)}`) })
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message).slice(0, 300)))

  const mutations = []
  try {
    await page.goto(`${base}/?token=${token}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await ensureModelConfig(page)

    // A1 — the tab exists and sits directly after the official 模型 tab.
    const tabs = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] nav button')].map((b) => b.textContent.trim()))
    const iModels = tabs.indexOf('模型')
    const iConfig = tabs.indexOf('模型配置')
    record('A1', '设置侧栏出现「模型配置」且紧随官方「模型」之后', iConfig >= 0 && iConfig === iModels + 1, `tabs=${JSON.stringify(tabs)}`)

    await page.screenshot({ path: path.join(SHOTS_DIR, 'model-config-01-settings-rail-dark.png') })

    // A2 — the page renders the provider directory.
    const rowCount = await page.locator('.dmc-row').count()
    record('A2', '「模型配置」页渲染提供商行列表', rowCount > 0, `rows=${rowCount}`)

    // A3 — layout: the name column must keep a readable floor, and the row must
    // lay out horizontally (a collapsed track wraps the name one character per line).
    const wide = await page.evaluate(() => {
      const row = document.querySelector('.dmc-row')
      const page = document.querySelector('[class*=dmc-page]')
      const names = [...document.querySelectorAll('.dmc-name')]
      return {
        tracks: row ? getComputedStyle(row).gridTemplateColumns : null,
        nameWidth: names.length ? Math.min(...names.map((n) => n.getBoundingClientRect().width)) : null,
        maxNameHeight: names.length ? Math.max(...names.map((n) => n.getBoundingClientRect().height)) : null,
        rowsOverflowingPane: page === null ? null : names.filter((n) => n.getBoundingClientRect().right > page.getBoundingClientRect().right + 1).length,
        pageHeight: page ? +page.getBoundingClientRect().height.toFixed(1) : null,
      }
    })
    record('A3', 'wide layout: 提供商名列有下界与≥140px）、横排可读、且不溢出内容列',
      wide.nameWidth !== null && wide.nameWidth >= 140 && wide.maxNameHeight !== null && wide.maxNameHeight <= 80 && wide.rowsOverflowingPane === 0,
      `tracks="${wide.tracks}" minNameWidth=${wide.nameWidth} maxNameHeight=${wide.maxNameHeight} rowsOverflowingPane=${wide.rowsOverflowingPane} pageHeight=${wide.pageHeight}`)
    await page.screenshot({ path: path.join(SHOTS_DIR, 'model-config-02-page-dark.png') })

    // A4 — no document-level horizontal scrolling at any width, and the verdict stays inside.
    const matrix = []
    for (const [w, h] of DEFAULTS.viewports) {
      await page.setViewportSize({ width: w, height: h })
      await page.waitForTimeout(500)
      matrix.push(await page.evaluate(() => {
        const v = document.querySelector('.dmc-verdict')
        const vr = v ? v.getBoundingClientRect() : null
        return {
          vw: innerWidth,
          overflow: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
          verdictInside: vr === null ? null : vr.left >= 0 && vr.right <= innerWidth,
        }
      }))
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(400)
    record('A4', '各宽度无横向滚动，且 dmc-verdict 未被推出视口', matrix.every((m) => m.overflow <= 1 && m.verdictInside !== false),
      JSON.stringify(matrix))

    // A5 — ADR 0003 + §5.33: the official 模型 page still opens, and the retry card
    // is GONE from it. The card used to be registered into that page's keyed
    // `settings.models.provider-card` seat, so its PRESENCE there was the proof the
    // seat was claimed; the move inverts exactly that, and the retry editor's own
    // existence is asserted on the 模型配置 page further down (A14–A18). Both halves
    // are needed: ".drc-root is absent" alone would also pass if the card had merely
    // been deleted, and "the editor exists" alone would pass with the card still
    // shadowing the official page.
    await page.getByRole('button', { name: '模型', exact: true }).click()
    await page.waitForTimeout(1400)
    const official = await page.evaluate((retryWords) => {
      const text = document.body.textContent || ''
      const cards = [...document.querySelectorAll('[class*=rowCard]')]
      return {
        dialogOpen: !!document.querySelector('[role=dialog]'),
        drcRoots: document.querySelectorAll('[class*=drc-]').length,
        officialRowCards: cards.length,
        cardsWithRetry: cards.filter((card) => card.querySelector('[class*=drc-]') !== null).length,
        retryWordsOnPage: retryWords.filter((word) => word !== null && text.includes(word)),
      }
    }, [copy.zh.retryTrigger, copy.en.retryTrigger])
    record('A5', '官方「模型」页仍可打开，但不再渲染任何重试卡与重试编辑器只属于「模型配置」页）',
      official.dialogOpen === true && official.drcRoots === 0 && official.cardsWithRetry === 0
      && official.retryWordsOnPage.length === 0,
      `drcRoots=${official.drcRoots} officialRowCards=${official.officialRowCards} `
      + `cardsWithRetry=${official.cardsWithRetry} retryWordsOnPage=${JSON.stringify(official.retryWordsOnPage)}`)
    await page.screenshot({ path: path.join(SHOTS_DIR, 'model-config-06-official-models-tab-dark.png') })

    // A6 — the composer seat is still this plugin's picker.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(900)
    const composer = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label*="选择模型"]')
      return {
        classes: btn ? [...btn.classList] : null,
        label: btn ? btn.getAttribute('aria-label') : null,
        dmpPresent: document.querySelectorAll('[class*=dmp-]').length > 0,
      }
    })
    const composerIsOurs = composer.classes !== null && composer.classes.includes('dmp-trigger')
    record('A6', 'composer 座位仍是本插件的 dmp- 选择器', composerIsOurs, `classes=${JSON.stringify(composer.classes)} label=${composer.label}`)

    // A7 — credential controls: every ADDED route but the session one keeps one.
    // The well is collapsed at rest (§5.35), so the entry is checked by opening
    // one row's well, reading its first field, and closing it again.
    await ensureModelConfig(page)
    const credentialRow = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.dmc-row')].find((x) => {
        const r = x.querySelector('.dmc-route')
        return r && r.textContent === 'openrouter'
      })
      if (!row) return false
      row.querySelector('.dmc-manage').click()
      return true
    })
    await page.waitForTimeout(500)
    const credential = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.dmc-row')].find((x) => {
        const r = x.querySelector('.dmc-route')
        return r && r.textContent === 'openrouter'
      })
      if (!row) return { labels: [], actions: 0 }
      const labels = [...row.querySelectorAll('.dmc-field-label')].map((x) => (x.textContent || '').trim())
      return { labels, actions: row.querySelectorAll('.dmc-key-action').length }
    })
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('.dmc-row')].find((x) => {
        const r = x.querySelector('.dmc-route')
        return r && r.textContent === 'openrouter'
      })
      if (row) row.querySelector('.dmc-manage').click()
    })
    await page.waitForTimeout(300)
    const verdicts = await page.locator('.dmc-verdict').count()
    record('A7', '每个已添加的行都保留可编辑的凭据入口与会话路由除外）',
      credentialRow === true && credential.labels.includes('凭据') && credential.actions > 0,
      `.dmc-key-action=${credential.actions} labels=${JSON.stringify(credential.labels)} .dmc-verdict=${verdicts} rows=${rowCount}`)

    // A8 — the catalog is the row's own inline region, not a second modal.
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('.dmc-row')].find((x) => {
        const r = x.querySelector('.dmc-route')
        return r && r.textContent === 'openrouter'
      })
      if (row) row.querySelector('.dmc-catalog').click()
    })
    await page.waitForTimeout(1000)
    const region = await page.evaluate(() => {
      const d = document.querySelector('.dmc-catalog-panel')
      if (!d) return { open: false }
      const row = d.closest('.dmc-row')
      const r = d.getBoundingClientRect()
      const rr = row ? row.getBoundingClientRect() : null
      const opener = row ? row.querySelector('.dmc-catalog') : null
      return {
        open: true,
        role: d.getAttribute('role'),
        ariaModal: d.getAttribute('aria-modal'),
        position: getComputedStyle(d).position,
        fixed: getComputedStyle(d).position === 'fixed',
        scrim: !!document.querySelector('.dmc-catalog-scrim'),
        insideRow: row !== null,
        startsAtNameSpine: rr !== null && r.left > rr.left,
        endsAtRowEdge: rr !== null && r.right <= rr.right + 1,
        width: Math.round(r.width),
        rowWidth: rr === null ? null : Math.round(rr.width),
        openerExpanded: opener ? opener.getAttribute('aria-expanded') : null,
        modelRows: d.querySelectorAll('.dmc-model-row').length,
        pageStillRendered: !!document.querySelector('.dmc-row'),
      }
    })
    record('A8', '模型目录是行内展开区与在 .dmc-row 内、无 fixed/scrim/aria-modal），页面上下文仍在',
      region.open === true && region.insideRow === true && region.fixed === false
      && region.scrim === false && region.position !== 'fixed'
      && region.role === null && region.ariaModal === null
      && region.startsAtNameSpine === true && region.endsAtRowEdge === true
      && region.openerExpanded === 'true' && region.pageStillRendered === true,
      JSON.stringify(region))
    await page.screenshot({ path: path.join(SHOTS_DIR, 'model-config-39-catalog-inline-dark.png') })

    // A9 — 保存 is gated on a dirty draft and is a no-op while clean.
    // (Checked while the draft is still clean, i.e. before the discovery panel
    // takes over the catalog's commit word.)
    const save = await page.evaluate(() => {
      const d = document.querySelector('.dmc-catalog-panel')
      const btn = d && d.querySelector('.dmc-btn-commit')
      return { present: !!btn, disabled: btn ? btn.disabled : null }
    })
    const saveDirty = await page.evaluate(() => {
      const d = document.querySelector('.dmc-catalog-panel')
      const input = d.querySelector('.dmc-model-row .dmc-model-id input')
      const original = input.value
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, `${original}x`)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return original
    })
    await page.waitForTimeout(400)
    const dirtyDisabled = await page.evaluate(() => {
      const btn = document.querySelector('.dmc-catalog-panel .dmc-btn-commit')
      return btn ? btn.disabled : null
    })
    // put the draft back so nothing is left dirty (保存 is never clicked)
    await page.evaluate((original) => {
      const d = document.querySelector('.dmc-catalog-panel')
      const input = d.querySelector('.dmc-model-row .dmc-model-id input')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, original)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }, saveDirty)
    await page.waitForTimeout(300)
    record('A9', '「保存」在草稿未改动时禁用、改动后启用与未点击保存）',
      save.present === true && save.disabled === true && dirtyDisabled === false,
      `clean=${save.disabled} dirty=${dirtyDisabled}`)

    // A10 — Tab walks into the region and back OUT of it: there is no trap any
    // more (the host settings dialog owns the only one).
    const walk = []
    for (let i = 0; i < 50; i += 1) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(70)
      walk.push(await page.evaluate(() => {
        const el = document.activeElement
        return el ? { text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20), inRegion: !!el.closest('.dmc-catalog-panel') } : null
      }))
    }
    const reached = new Set(walk.map((s) => s && s.text))
    const leftRegion = walk.some((s) => s && s.inRegion === false)
    record('A10', 'Tab 走通 收起/编辑/添加模型/获取可用模型/恢复默认模型，并能离开行内区域与无焦点陷阱）',
      leftRegion === true && reached.has('添加模型') && reached.has('获取可用模型') && reached.has('恢复默认模型'),
      `leftRegion=${leftRegion} reached=${JSON.stringify([...reached])}`)

    // A11 — discovery is a three-step read → tick → commit, and nothing is written before commit.
    const beforeDiscovery = await page.evaluate(() => document.querySelectorAll('.dmc-catalog-panel .dmc-model-row').length)
    await page.evaluate(() => {
      const d = document.querySelector('.dmc-catalog-panel')
      const b = d && [...d.querySelectorAll('button')].find((x) => /获取可用模型/.test(x.textContent))
      if (b) b.click()
    })
    let discover = null
    for (let i = 0; i < 60; i += 1) {
      await page.waitForTimeout(500)
      discover = await page.evaluate(() => {
        const d = document.querySelector('.dmc-catalog-panel')
        if (!d) return null
        return {
          checkboxes: d.querySelectorAll('input[type=checkbox]').length,
          hasCommit: [...d.querySelectorAll('button')].some((x) => x.textContent.trim() === '添加所选'),
          modelRows: d.querySelectorAll('.dmc-model-row').length,
          status: d.querySelector('.dmc-catalog-status') ? d.querySelector('.dmc-catalog-status').textContent.trim() : null,
        }
      })
      if (discover === null) break
      if (discover.checkboxes > 0 || /没有列出任何模型|失败|not registered/.test(discover.status || '')) break
    }
    const discoveryOk = discover !== null && discover.checkboxes > 0 && discover.hasCommit && discover.modelRows === beforeDiscovery
    record('A11', '模型发现三步可见与获取 → 勾选清单 → 添加所选），且未提交前目录未变', discoveryOk,
      `before=${beforeDiscovery} after=${JSON.stringify(discover)}`)
    await page.screenshot({ path: path.join(SHOTS_DIR, 'model-config-13-discovery-result-dark.png') })

    // A12 — Escape closes ONE layer at a time: the open discovery checklist first,
    // then the region; the host settings dialog survives both.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    const afterFirstEsc = await page.evaluate(() => ({
      region: !!document.querySelector('.dmc-catalog-panel'),
      checkboxes: document.querySelectorAll('.dmc-catalog-panel input[type=checkbox]').length,
      settingsDialog: !!document.querySelector('[role=dialog]'),
    }))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(800)
    const afterEsc = await page.evaluate(() => ({
      region: !!document.querySelector('.dmc-catalog-panel'),
      settingsDialog: !!document.querySelector('[role=dialog]'),
    }))
    record('A12', 'Esc 一次一层：先关发现清单（目录区保留），再收起目录区，设置面板保留',
      afterFirstEsc.region === true && afterFirstEsc.checkboxes === 0
      && afterFirstEsc.settingsDialog === true
      && afterEsc.region === false && afterEsc.settingsDialog === true,
      `first=${JSON.stringify(afterFirstEsc)} final=${JSON.stringify(afterEsc)}`)

    // ---------------------------------------------------------------------
    // R1–R13: the refactor's own claims, measured on the live page.
    // ---------------------------------------------------------------------
    await ensureModelConfig(page)
    await parkPointer(page)
    const snapshot = await page.evaluate(SNAPSHOT)
    note(`live: dpr=${snapshot.dpr} .dmc-page clientWidth=${snapshot.page && snapshot.page.clientWidth}px `
      + `containerType=${snapshot.page && snapshot.page.containerType} verdicts=${snapshot.verdictCount} rows=${snapshot.rows.length}`)
    const details = await page.evaluate(DETAILS)
    const midWordBreaks = details.routes.filter((route) => route.first !== null && route.first.firstLine !== route.first.full
      && !/[-_/]$/.test(route.first.firstLine.trim()))
    note(`metrics: dpr=${details.dpr} pageClientWidth=${details.pageClientWidth}px nameMinWidth=${details.nameMinWidth} nameMaxHeight=${details.nameMaxHeight} `
      + `verdicts=${details.verdictCount} verdictWidths=${JSON.stringify(details.verdictWidths)} verdictRights=${JSON.stringify(details.verdictRights)} `
      + `verdictInsideViewport=${details.verdictInsideViewport} restFilledRows=${details.restFilledRows}`)
    note(`before/after: catalog=${JSON.stringify(details.catalog)} key=${JSON.stringify(details.key)}`)
    note(`before/after: routeMidWordBreaks=${JSON.stringify(midWordBreaks.map((route) => route.first.firstLine + '|' + route.first.full))} `
      + `routeLines=${JSON.stringify(details.routes.map((route) => `${route.text}:${route.lines}`))}`)
    note(`alignment: headLefts=${JSON.stringify(details.headLefts)} controlLefts=${JSON.stringify(details.controlLefts)}`)
    note(`clipping: ${JSON.stringify(details.clipping)}`)

    const judges = {
      R1: () => judgeR1(snapshot, copy),
      R2: () => judgeR2(snapshot, copy),
      R3: () => judgeR3(snapshot),
      R4: () => judgeR4(snapshot),
      R8: () => judgeR8(snapshot),
      R10: () => judgeR10(snapshot),
    }
    const labels = {
      R1: 'R1 就绪陈述与每一行的 data-state 逐行对账一致与ready + issues == 总行数，数字严格相等）、≤2 行、字号大于正文',
      R2: 'R2 每行答案词与自己的 data-state 一致；竖条只画 missing-key / unreachable与诊断不画）',
      R3: 'R3 编辑段是固定轨道：同类控件逐行左沿对齐与最大最小差 ≤1px）',
      R4: 'R4 每行带 1px 边的控件 ≤1，且 dmc-verdict 右沿逐行对齐与差 ≤1px）',
      R8: 'R8 行在 rest 态没有任何底色与ready / missing-key / unreachable 三种都过）',
      R10: 'R10 同一行上凭据清除与生命周期按钮的可访问名不相等与口径=两名不等，不要求动词不同）',
    }
    for (const id of ['R1', 'R2', 'R3', 'R4', 'R8', 'R10']) {
      const verdict = judges[id]()
      record(id, labels[id], verdict.ok, verdict.detail)
    }
    const disabledInk = await judgeR9(page)
    record('R9', 'R9 不可用的文字动作比 rest 更暗与rest = primary ink，:disabled = secondary ink，实测同一主题的两把墨）',
      disabledInk.ok, disabledInk.detail)
    const collision = await judgeR13(page)
    record('R13', 'R13 页面上的关键文本与可点控件中心没有被别的元素盖住与elementFromPoint 归属自查）',
      collision.ok, collision.detail)

    // The container cap, in CSS px and with the DPR beside it: the visual juror
    // read this page as ~1090px wide, which is one DPR-2 screenshot of a 545px
    // column. The number below is the one that decides.
    const pageCap = snapshot.page === null ? null : snapshot.page.clientWidth
    record('R7a', 'R7 .dmc-page 的客户区宽度按 CSS px 不超过 560与DPR 一并印出）',
      pageCap !== null && pageCap <= 560 && snapshot.page.containerType === 'inline-size',
      `clientWidth=${pageCap}px dpr=${snapshot.dpr} containerType=${snapshot.page && snapshot.page.containerType}`)

    // R6 — reduced motion: the content stays and nothing moves.
    await page.waitForTimeout(600)
    const before = await page.evaluate(MOTION_RECTS)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const emulateApplied = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
    await page.waitForTimeout(700)
    const motion = await page.evaluate(MOTION_RECTS)
    record('R6', 'R6 prefers-reduced-motion 下内容齐全、无位移、且过渡与动画都关掉',
      emulateApplied === true && motion.content.rows === before.content.rows && motion.content.verdicts === before.content.verdicts
      && motion.content.readout === true && sameFrame(before, motion) && motionOff(motion.motion),
      `applied=${emulateApplied} content=${JSON.stringify(motion.content)} stable=${sameFrame(before, motion)} motion=${JSON.stringify(motion.motion)}`)
    await page.emulateMedia({ reducedMotion: null })
    await page.waitForTimeout(200)

    // R7 — the container branch, at the three widths the brief names. The same
    // probes carry R11's protocol measurements (§17/V5), so the two checks always
    // describe one and the same layout pass.
    const container = await containerSuite(page)
    const narrowFired = container.length > 0 && container[0].tracks !== container[container.length - 1].tracks
    const containerOk = container.every((probe) => probe.missing !== true
      && probe.containerType === 'inline-size'
      && Math.abs(probe.width - probe.requestedWidth) <= 2
      && probe.docOverflow <= 1 && probe.pageOverflow <= 1 && probe.overflowers.length === 0
      && probe.verdictInside !== false)
    record('R7b', 'R7 容器 106 / 484 / 560 三档：@container 生效、无横向溢出、verdict 在容器内与106 档布局确实换挡）',
      containerOk && narrowFired, `narrowFired=${narrowFired} ${JSON.stringify(container)}`)
    // R11 at the same three widths: wide (484/560) must show the label in full, the
    // 106 column may truncate but must not overflow.
    const protocolFit = judgeR11(container)
    record('R11', 'R11 协议选择器文字：484/560 档不截断；106 档允许截断但不得溢出与clientWidth == scrollWidth、无横向滚动）',
      protocolFit.ok, protocolFit.detail)
    // The orphan lines at the narrowest container, reported rather than asserted: a
    // 106px column is where the footer action can leave one character alone on its
    // last line, and the fix for that is a typographic decision (wording or a
    // non-breaking join) rather than a gate.
    const orphanLines = container
      .filter((probe) => probe.lastLines !== undefined)
      .flatMap((probe) => Object.entries(probe.lastLines)
        .filter(([, value]) => value !== null && value.lines > 1)
        .map(([where, value]) => `${probe.requestedWidth}px/${where}:${value.lines}lines,last="${value.lastLine}"(${value.lastLine.length})`))
    note(`narrow last lines: ${JSON.stringify(orphanLines)}`)

    // R5 — one screenshot per theme. The theme is switched the way the GUI itself
    // offers it (通用设置 → 外观): this build keeps the choice in the host's settings,
    // so flipping `localStorage['dsh-theme']` — the older `_audit-shots.cjs` recipe —
    // changes nothing (measured: two dark screenshots, 59 KB each). The original
    // choice is read back off the selected button and restored, so the deployment is
    // left as it was found.
    //
    // §17/V4 — THE EVIDENCE IMAGE MUST CONTAIN THE PAGE'S ONLY ACCENT. The host pane
    // shows ~746px of a ~930px page, so the first two shots stopped just above the
    // footer action, and the 4px accent bar never appeared in the README's proof: one
    // juror round called the accent invisible while another (reading the narrow
    // container, where the footer is on screen) called it obvious. The capture
    // therefore lifts the clipping for its duration, and R5 asserts that the footer
    // action was actually PAINTED (hit-testable at its own centre) when the shutter
    // opened, so a footer-less evidence image cannot ship again.
    await openAppearance(page)
    const appearance = await page.evaluate(APPEARANCE_PROBE)
    const originalLabel = (appearance.buttons.find((button) => button.selected) || {}).text ?? null
    const firstName = appearance.dark ? 'dark' : 'light'
    const otherLabel = firstName === 'dark' ? '浅色' : '深色'
    const otherName = firstName === 'dark' ? 'light' : 'dark'
    const TALL_VIEWPORT = { width: 1920, height: 1500 }
    const PANE_PROBE = () => {
      const pageEl = document.querySelector('.dmc-page')
      let scroller = pageEl === null ? null : pageEl.parentElement
      while (scroller !== null && scroller !== document.documentElement) {
        const style = getComputedStyle(scroller)
        if (/(auto|scroll)/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight + 1) break
        scroller = scroller.parentElement
      }
      const add = document.querySelector('.dmc-add')
      const addRect = add === null ? null : add.getBoundingClientRect()
      const hit = addRect === null ? null : document.elementFromPoint(
        Math.min(Math.max(addRect.left + addRect.width / 2, 1), innerWidth - 1),
        Math.min(Math.max(addRect.top + addRect.height / 2, 1), innerHeight - 1))
      return {
        pane: scroller === null ? null : {
          cls: [...scroller.classList].join('.').slice(0, 40),
          clientHeight: scroller.clientHeight,
          scrollHeight: scroller.scrollHeight,
        },
        add: addRect === null ? null : { top: +addRect.top.toFixed(1), bottom: +addRect.bottom.toFixed(1) },
        pageHeight: pageEl === null ? null : +pageEl.getBoundingClientRect().height.toFixed(1),
        addPainted: hit !== null && add !== null && (hit === add || add.contains(hit) || hit.contains(add)),
        addHit: hit === null ? null : `${hit.tagName.toLowerCase()}.${[...hit.classList].join('.')}`,
      }
    }
    /** Give the page the room it needs for the capture, and report how it was won. */
    const liftPane = async () => {
      await page.evaluate(() => {
        document.getElementById('verify-dmc-tallpane')?.remove()
        const pageEl = document.querySelector('.dmc-page')
        for (let node = pageEl === null ? null : pageEl.parentElement; node !== null && node !== document.documentElement; node = node.parentElement) {
          const style = getComputedStyle(node)
          if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX}${style.overflowY}`) || style.maxHeight !== 'none') {
            node.classList.add('verify-dmc-tallpane')
          }
        }
        const sheet = document.createElement('style')
        sheet.id = 'verify-dmc-tallpane'
        sheet.textContent = '.verify-dmc-tallpane{max-height:none!important;height:auto!important;overflow:visible!important}'
        document.head.append(sheet)
      })
      await page.waitForTimeout(500)
    }
    const dropPane = async () => {
      await page.evaluate(() => {
        document.getElementById('verify-dmc-tallpane')?.remove()
        document.querySelectorAll('.verify-dmc-tallpane').forEach((el) => el.classList.remove('verify-dmc-tallpane'))
      })
      await page.waitForTimeout(300)
    }
    const shots = {}
    const shotPanes = {}
    /** Screenshot the page in whatever theme is live, and report that theme. */
    const shoot = async (name) => {
      await openModelConfig(page)
      // The two redesign shots are README/DESIGN evidence, so they keep the numbered
      // `model-config-NN-…` convention of the existing series rather than a `_`
      // scratch prefix.
      shots[name] = path.join(SHOTS_DIR, name === 'dark' ? 'model-config-31-redesign-dark.png' : 'model-config-32-redesign-light.png')
      await page.setViewportSize(TALL_VIEWPORT)
      await page.waitForTimeout(600)
      let pane = await page.evaluate(PANE_PROBE)
      if (pane.addPainted !== true) {
        await liftPane()
        pane = await page.evaluate(PANE_PROBE)
      }
      await page.locator('.dmc-page').screenshot({ path: shots[name] })
        .catch(async () => { await page.screenshot({ path: shots[name] }) })
      shotPanes[name] = pane
      const probe = await page.evaluate(THEME_PROBE)
      await dropPane()
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.waitForTimeout(400)
      await openAppearance(page)
      return probe
    }
    const firstProbe = await shoot(firstName)
    const themeSwitch = page.getByRole('button', { name: otherLabel, exact: true })
    if (await themeSwitch.count() > 0) {
      await themeSwitch.first().click().catch(() => {})
      await page.waitForTimeout(1000)
    }
    const secondProbe = await shoot(otherName)
    if (originalLabel !== null) {
      const restore = page.getByRole('button', { name: originalLabel, exact: true })
      if (await restore.count() > 0) {
        await restore.first().click().catch(() => {})
        await page.waitForTimeout(1000)
      }
    }
    const restored = await page.evaluate(THEME_PROBE)
    await openModelConfig(page)
    const shotBytes = Object.fromEntries(Object.entries(shots).map(([name, file]) => [name, fs.existsSync(file) ? fs.statSync(file).size : 0]))
    record('R5', 'R5 深/浅两主题各一张截图与走「设置 → 通用设置 → 外观」），两张主题不同、恢复原选择，且页尾动作与页面唯一 accent）确实进了画面',
      bothThemes(firstProbe, secondProbe) && shotBytes[firstName] > 5000 && shotBytes[otherName] > 5000
      && restored.dark === appearance.dark
      && shotPanes[firstName]?.addPainted === true && shotPanes[otherName]?.addPainted === true,
      `original=${originalLabel} first=${JSON.stringify(firstProbe)} second=${JSON.stringify(secondProbe)} `
      + `restored=${restored.dark} bytes=${JSON.stringify(shotBytes)} panes=${JSON.stringify(shotPanes)}`)

    // ---------------------------------------------------------------------
    // A14–A18 / §5.33: the inline auto-retry editor, measured on the live page.
    // ---------------------------------------------------------------------
    // This is the other half of A5. The card was moved OUT of the shipped Models
    // page and INTO the row it belongs to, so the evidence has to be taken on the
    // page that now owns it — and every claim the redesign makes (two numbers, one
    // schedule line, NO chart, no overflow, nothing written before the button) is a
    // measurement here rather than a reading of the sheet.
    await ensureModelConfig(page)
    await parkPointer(page)
    /** Open the inline editor on the first row that offers one. */
    const openRetry = async () => {
      await page.evaluate(() => {
        const trigger = document.querySelector('.dmc-retry-action')
        if (trigger !== null && trigger.getAttribute('aria-expanded') !== 'true') trigger.click()
      })
      await page.waitForTimeout(500)
    }
    /** Close it again, so the page is left as the other checks expect to find it. */
    const closeRetry = async () => {
      await page.evaluate(() => {
        const trigger = document.querySelector('.dmc-retry-action')
        if (trigger !== null && trigger.getAttribute('aria-expanded') === 'true') trigger.click()
      })
      await page.waitForTimeout(400)
    }
    const RETRY_VIEWPORTS = [[320, 800], [390, 844], [768, 900], [1920, 1080]]
    /** Document + editor overflow at one viewport, with the editor's box placed. */
    const retryOverflowAt = async (width, height) => {
      await page.setViewportSize({ width, height })
      await page.waitForTimeout(450)
      return page.evaluate(() => {
        const pageEl = document.querySelector('.dmc-page')
        const editor = document.querySelector('.dmc-retry')
        const pageRect = pageEl === null ? null : pageEl.getBoundingClientRect()
        const editorRect = editor === null ? null : editor.getBoundingClientRect()
        return {
          vw: innerWidth,
          overflow: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
          contentWidth: pageEl === null ? null : pageEl.clientWidth,
          pageContentOverflow: pageEl === null ? null : pageEl.scrollWidth - pageEl.clientWidth,
          editorInside: editorRect === null || pageRect === null
            ? null
            : editorRect.left >= pageRect.left - 1 && editorRect.right <= pageRect.right + 1,
          editorOverflow: editor === null ? null : editor.scrollWidth - editor.clientWidth,
          editorRight: editorRect === null ? null : +editorRect.right.toFixed(1),
          pageRight: pageRect === null ? null : +pageRect.right.toFixed(1),
        }
      })
    }

    const retryTriggers = await page.locator('.dmc-retry-action').count()
    if (retryTriggers === 0) {
      record('A14', '可重试的行有 .dmc-retry-action 入口', false,
        '页面上一行重试入口都没有：schema 里声明了 retryPolicy 的行没拿到门与见 model-config 单元门的 retryCapable）')
      for (const id of ['A15', 'A16', 'A17', 'A18']) {
        record(id, '与依赖 A14 的行内重试编辑器）', false, 'skipped: A14 没找到入口')
      }
    } else {
      // A14 — the entry point, and the ARIA wiring that names what it opens. The
      // trigger is NOT disabled on a read-only deployment (the policy is still
      // readable), so a disabled one is a regression rather than a stricter state.
      const entry = await page.evaluate(() => {
        const triggers = [...document.querySelectorAll('.dmc-retry-action')]
        return {
          triggers: triggers.length,
          rows: document.querySelectorAll('.dmc-row').length,
          editors: document.querySelectorAll('.dmc-retry').length,
          expanded: triggers.map((t) => t.getAttribute('aria-expanded')),
          controls: triggers.map((t) => t.getAttribute('aria-controls')),
          disabled: triggers.filter((t) => t.disabled).length,
        }
      })
      const entryOk = entry.triggers > 0 && entry.triggers <= entry.rows
        && entry.editors === 0
        && entry.expanded.every((value) => value === 'false')
        && entry.controls.every((value) => value !== null && value.startsWith('dmc-retry-'))
        && entry.disabled === 0
      record('A14', '可重试的「已添加」行有 .dmc-retry-action 入口：初始收起与aria-expanded=false 且无编辑器）、aria-controls 指向 dmc-retry-*、只读部署也不禁用',
        entryOk, JSON.stringify(entry))

      await openRetry()
      // The retired chart's whole vocabulary, named: the deleted card drew a plot
      // (`.drc-chart` / `.drc-bars` / `.drc-bar-slot` / `.drc-bar` / `.drc-cap-mark` /
      // `.drc-axis`), so anything that is a chart NODE or still carries one of those
      // names is a regression, in the editor and anywhere else on the page.
      const CHART_SELECTORS = ['svg', 'canvas', '[class*=chart]', '[class*=bars]',
        '[class*=bar-slot]', '[class*=cap-mark]', '[class*=axis]', '[class*=drc-]']
      const CHART_QUERY = CHART_SELECTORS.join(', ')
      const opened = await page.evaluate((chartQuery) => {
        const editor = document.querySelector('.dmc-retry')
        const trigger = document.querySelector('.dmc-retry-action')
        if (editor === null) return { open: false }
        const inputs = [...editor.querySelectorAll('.dmc-retry-input')]
        const editorRect = editor.getBoundingClientRect()
        const pageRect = document.querySelector('.dmc-page').getBoundingClientRect()
        return {
          open: true,
          id: editor.id,
          inputs: inputs.length,
          inputTypes: inputs.map((input) => input.type),
          summaries: editor.querySelectorAll('.dmc-retry-summary').length,
          state: editor.querySelector('.dmc-retry-state')?.textContent?.trim() ?? null,
          doubling: (editor.querySelector('.dmc-notice')?.textContent || '').trim(),
          editorCharts: editor.querySelectorAll(chartQuery).length,
          pageCharts: document.querySelectorAll('.dmc-page ' + chartQuery).length,
          expanded: trigger?.getAttribute('aria-expanded'),
          controlsMatch: trigger !== null && editor.id === trigger.getAttribute('aria-controls'),
          insideColumn: editorRect.left >= pageRect.left - 1 && editorRect.right <= pageRect.right + 1,
          rect: { left: +editorRect.left.toFixed(1), right: +editorRect.right.toFixed(1) },
          pageRect: { left: +pageRect.left.toFixed(1), right: +pageRect.right.toFixed(1) },
        }
      }, CHART_QUERY)
      const openedOk = opened.open === true && opened.inputs === 2
        && opened.summaries === 1 && opened.editorCharts === 0 && opened.pageCharts === 0
        && opened.expanded === 'true' && opened.controlsMatch === true
        && opened.insideColumn === true && opened.doubling.length > 0
      record('A15', '点击后 .dmc-retry 在该行下方展开：恰好 2 个 .dmc-retry-input + 1 个 .dmc-retry-summary + 一句说明，aria-expanded=true 且 aria-controls 命中它的 id，页面内图表节点一律为 0',
        openedOk, JSON.stringify(opened))

      // A16 — the state word is one of the two the copy owns. Asserted against the
      // copy table rather than a literal, so rewording the label cannot fail the
      // check while the two MEANINGS stay the only two it may state.
      const stateWords = [copy.zh.retryDeclared, copy.zh.retryInherits, copy.en.retryDeclared, copy.en.retryInherits]
      const stateOk = opened.state !== null && stateWords.includes(opened.state)
      record('A16', '.dmc-retry-state 的文案是「已单独设置 / 使用默认值」之一与语义 = declared）',
        stateOk, `state=${JSON.stringify(opened.state)} accepted=${JSON.stringify(stateWords)}`)

      // A17 — the editor may not push the page sideways at any width, in either
      // state. The collapsed pass is included because the TRIGGER is a new cell in
      // the control grid: the closed row is the state every user sees, and it is
      // where a new fixed track shows up as overflow.
      //
      // WHAT IS ASSERTED, AND WHAT IS ONLY REPORTED. The task's two criteria hold at
      // all four widths: no document-level horizontal scroll (`scrollWidth -
      // clientWidth <= 1`, measured 0 everywhere) and `.dmc-retry` inside the
      // content column. A THIRD criterion — the editor's own content fitting its own
      // box — is asserted only where the page's box already contains the page's own
      // content. That qualifier is a measurement, not a concession: at a 320px
      // viewport the host hands `.dmc-page` a **36px** column, and the page ALREADY
      // overflows it by 32px with the editor closed (`.dmc-catalog` right=304 vs the
      // column's right=272), because its own control row is wider than that column.
      // Holding the new editor to a content-fit bar that the page's own pre-existing
      // controls miss at the same width would be a different rule for the same page.
      // The numbers at that width are printed in the detail below rather than
      // hidden, so the degenerate case stays visible in the evidence.
      const expandedMatrix = []
      for (const [w, h] of RETRY_VIEWPORTS) expandedMatrix.push(await retryOverflowAt(w, h))
      await closeRetry()
      const collapsedMatrix = []
      for (const [w, h] of RETRY_VIEWPORTS) collapsedMatrix.push(await retryOverflowAt(w, h))
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.waitForTimeout(400)
      /** The contract, at every width: no page scroll, and the editor stays inside the column. */
      const inContract = (probe) => probe.overflow <= 1
        && (probe.editorInside === null || probe.editorInside === true)
      /** Content-fit, only where the page's own column is not already overflowing. */
      const contentFits = (probe) => (probe.pageContentOverflow ?? 0) > 1
        || (probe.editorOverflow ?? 0) <= 1
      const expandedOk = expandedMatrix.every((probe) => inContract(probe) && contentFits(probe))
      const collapsedOk = collapsedMatrix.every((probe) => inContract(probe)
        && probe.editorInside === null && contentFits(probe))
      record('A17', '320/390/768/1920 四档视口、展开前后都无横向溢出与document scrollWidth-clientWidth ≤1），且展开时 .dmc-retry 不越出内容列；内容列可用与未被页面自身撑破）时编辑器内容也必须装进自己的盒子',
        expandedOk && collapsedOk,
        `expanded=${JSON.stringify(expandedMatrix)} collapsed=${JSON.stringify(collapsedMatrix)}`)

      // A18 — nothing reaches the store before an explicit commit.
      //
      // THIS IS THE STORE HALF, and A20 below is the AFFORDANCE half. They are
      // separate on purpose: this one types a different number into the field
      // WITHOUT focusing it, waits, and requires that (a) no 已保存 line appeared,
      // (b) the draft is still local, and then (c) collapse and re-open the
      // editor — the field must show the value the store still holds, because the
      // draft lives in the component and dies with it. A page that had written on
      // input would show the typed number after the remount, and a page that wrote
      // on blur could not show the original either (the field is never focused
      // here, so no blur happens).
      //
      // A20 then proves the same intent through the button's own gating, which the
      // catalog's commit has too (A9). Both are needed: a disabled button that still
      // wrote would pass A20's first state and fail this one, and a store that is
      // untouched while the button invites the click would pass this one and fail
      // A20.
      //
      // The edit is applied through the native value setter with an `input` event —
      // the same technique A9 uses on the inline catalog region.
      await openRetry()
      const savedWords = [copy.zh.retrySaved, copy.en.retrySaved].filter((word) => word !== null)
      const cleanDraft = await page.evaluate(() => {
        const editor = document.querySelector('.dmc-retry')
        const save = editor.querySelectorAll('.dmc-retry-actions .dmc-key-action')[0]
        return {
          value: editor.querySelector('.dmc-retry-input').value,
          savePresent: save !== undefined,
          saveDisabled: save === undefined ? null : save.disabled,
        }
      })
      const typed = await page.evaluate(() => {
        const editor = document.querySelector('.dmc-retry')
        const input = editor.querySelector('.dmc-retry-input')
        const next = String(Number(input.value) + 1)
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(input, next)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        return next
      })
      await page.waitForTimeout(800)
      const dirtyDraft = await page.evaluate((words) => {
        const editor = document.querySelector('.dmc-retry')
        const notices = [...editor.querySelectorAll('.dmc-notice')]
        return {
          value: editor.querySelector('.dmc-retry-input').value,
          saved: notices.some((node) => words.some((word) => (node.textContent || '').includes(word))),
          summary: (editor.querySelector('.dmc-retry-summary')?.textContent || '').trim(),
        }
      }, savedWords)
      await closeRetry()
      const afterClose = await page.locator('.dmc-retry').count()
      await openRetry()
      const afterReopen = await page.evaluate((words) => {
        const editor = document.querySelector('.dmc-retry')
        return {
          value: editor.querySelector('.dmc-retry-input').value,
          saved: [...editor.querySelectorAll('.dmc-notice')]
            .some((node) => words.some((word) => (node.textContent || '').includes(word))),
        }
      }, savedWords)
      const draftOk = cleanDraft.savePresent === true
        && dirtyDraft.value === typed && dirtyDraft.saved === false
        && afterClose === 0 && afterReopen.value === cleanDraft.value && afterReopen.saved === false
      record('A18', '不点保存就不写：脏草稿在未 commit 时没有写回与无「已保存」痕迹），折叠再展开后字段回到 store 的值、草稿随组件卸载消失',
        draftOk,
        `original=${cleanDraft.value} typed=${typed} cleanSaveDisabled=${cleanDraft.saveDisabled} `
        + `draftAfterTyping=${dirtyDraft.value} savedAfterTyping=${dirtyDraft.saved} summary=${JSON.stringify(dirtyDraft.summary)} `
        + `editorsAfterClose=${afterClose} valueAfterReopen=${afterReopen.value} savedAfterReopen=${afterReopen.saved}`)

      // A20 — the 保存 button is DIRT-GATED, the way the catalog's commit is (A9).
      // This is the half A18 cannot carry: A18 proves the store is untouched, A20
      // proves the AFFORDANCE tells the reader the same thing before they click.
      // Three states, in order: freshly opened (pristine → disabled), a different
      // number typed (→ enabled), the original text written back (→ disabled
      // again). The comparison is TEXTUAL on purpose — a draft reading `05` where
      // the store says `5` is dirty and presses 保存 to be normalised, and a draft
      // that does not parse yet is exactly when the reader wants to press it and be
      // told what is wrong.
      //
      // The no-write half is re-proved here as well: nothing shows 已保存 at any
      // point, and collapsing/re-opening the editor still shows the store's own
      // value — so neither the typed value nor the write-back reached the store.
      // (The field is never focused, so no blur-commit fires; what is measured is
      // the button's own gating.)
      const saveState = () => page.evaluate(() => {
        const editor = document.querySelector('.dmc-retry')
        const save = editor.querySelectorAll('.dmc-retry-actions .dmc-key-action')[0]
        const input = editor.querySelector('.dmc-retry-input')
        return {
          disabled: save.disabled,
          value: input.value,
          summary: (editor.querySelector('.dmc-retry-summary')?.textContent || '').trim(),
        }
      })
      const writeRetries = (value) => page.evaluate((next) => {
        const editor = document.querySelector('.dmc-retry')
        const input = editor.querySelector('.dmc-retry-input')
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(input, next)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }, value)
      const pristineSave = await saveState()
      await writeRetries(String(Number(pristineSave.value) + 1))
      await page.waitForTimeout(400)
      const dirtySave = await saveState()
      await writeRetries(pristineSave.value)
      await page.waitForTimeout(400)
      const restoredSave = await saveState()
      const savedTraces = await page.evaluate((words) => [...document.querySelectorAll('.dmc-retry .dmc-notice')]
        .filter((node) => words.some((word) => (node.textContent || '').includes(word))).length, savedWords)
      await closeRetry()
      await openRetry()
      const afterSaveProbe = await saveState()
      const saveGatingOk = pristineSave.disabled === true && dirtySave.disabled === false
        && restoredSave.disabled === true && restoredSave.value === pristineSave.value
        && savedTraces === 0 && afterSaveProbe.value === pristineSave.value && afterSaveProbe.disabled === true
      record('A20', '保存按钮是脏门控与与抽屉 A9 一致）：刚展开禁用 → 写入不同值启用 → 改回原值再次禁用；全程无「已保存」痕迹且没有产生写入与折叠重开后仍是 store 的值）',
        saveGatingOk,
        `pristine=${JSON.stringify(pristineSave)} dirty=${JSON.stringify(dirtySave)} restored=${JSON.stringify(restoredSave)} `
        + `savedTraces=${savedTraces} afterReopen=${JSON.stringify(afterSaveProbe)}`)

      // The evidence images: the editor OPEN, one per theme, following the same
      // 通用设置 → 外观 path R5 established (the theme is a host setting, so flipping
      // localStorage would produce two identical shots). Each shot lifts the host
      // pane's clipping for its duration, exactly as R5 does, because the expanded
      // editor can sit below the ~746px the pane shows.
      const retryShotFile = (dark) => path.join(SHOTS_DIR,
        dark ? 'model-config-33-retry-inline-open-dark.png' : 'model-config-34-retry-inline-open-light.png')
      const retryShotBytes = {}
      const retryShotThemes = {}
      const shootRetry = async (dark) => {
        await openModelConfig(page)
        await openRetry()
        await page.evaluate(() => {
          const editor = document.querySelector('.dmc-retry')
          if (editor !== null) editor.scrollIntoView({ block: 'center' })
        })
        await page.setViewportSize(TALL_VIEWPORT)
        await page.waitForTimeout(600)
        let pane = await page.evaluate(PANE_PROBE)
        if (pane.addPainted !== true) {
          await liftPane()
          pane = await page.evaluate(PANE_PROBE)
        }
        const theme = await page.evaluate(THEME_PROBE)
        const file = retryShotFile(dark)
        await page.locator('.dmc-page').screenshot({ path: file })
          .catch(async () => { await page.screenshot({ path: file }) })
        retryShotBytes[dark ? 'dark' : 'light'] = fs.existsSync(file) ? fs.statSync(file).size : 0
        retryShotThemes[dark ? 'dark' : 'light'] = theme.dark
        await dropPane()
        await page.setViewportSize({ width: 1920, height: 1080 })
        await page.waitForTimeout(400)
        return pane
      }
      const beforeShots = await page.evaluate(THEME_PROBE)
      const firstDark = beforeShots.dark === true
      await shootRetry(firstDark)
      await openAppearance(page)
      const opposite = page.getByRole('button', { name: firstDark ? '浅色' : '深色', exact: true })
      if (await opposite.count() > 0) {
        await opposite.first().click().catch(() => {})
        await page.waitForTimeout(1000)
      }
      const secondPane = await shootRetry(!firstDark)
      const afterShots = await page.evaluate(THEME_PROBE)
      if (afterShots.dark !== beforeShots.dark) {
        await openAppearance(page)
        const back = page.getByRole('button', { name: firstDark ? '深色' : '浅色', exact: true })
        if (await back.count() > 0) {
          await back.first().click().catch(() => {})
          await page.waitForTimeout(1000)
        }
      }
      const restoredTheme = await page.evaluate(THEME_PROBE)
      await openModelConfig(page)
      await openRetry()
      const shotOverflow = await page.evaluate(() => {
        const editor = document.querySelector('.dmc-retry')
        if (editor === null) return null
        const r = editor.getBoundingClientRect()
        return { width: +r.width.toFixed(1), height: +r.height.toFixed(1), inputs: editor.querySelectorAll('.dmc-retry-input').length }
      })
      note(`retry shots: ${JSON.stringify(retryShotBytes)} editor=${JSON.stringify(shotOverflow)} `
        + `theme restored=${restoredTheme.dark === beforeShots.dark} secondPaneAddPainted=${secondPane.addPainted}`)
      for (const [name, bytes] of Object.entries(retryShotBytes)) {
        record(`A19-${name}`, `§5.33 证据截图 ${name}与行内重试编辑器展开态）存在且非空`,
          bytes > 5000, `bytes=${bytes} file=${path.basename(retryShotFile(name === 'dark'))}`)
      }
      record('A19', '§5.33 两张展开态截图取自两个不同主题与拍时各自实测），且拍摄时编辑器确实展开、主题已恢复原选择',
        retryShotBytes.dark > 5000 && retryShotBytes.light > 5000
        && retryShotThemes.dark === true && retryShotThemes.light === false
        && restoredTheme.dark === beforeShots.dark
        && shotOverflow !== null && shotOverflow.inputs === 2,
        `bytes=${JSON.stringify(retryShotBytes)} themesAtShutter=${JSON.stringify(retryShotThemes)} `
        + `width=${shotOverflow?.width} height=${shotOverflow?.height} restored=${restoredTheme.dark} before=${beforeShots.dark}`)
      await closeRetry()
      await openModelConfig(page)
    }

    // ---------------------------------------------------------------------
    // The gate's own gate: break each measurement and watch it go red.
    // ---------------------------------------------------------------------
    if (process.env.DMC_VERIFY_MUTATE === '1') {
      const broken = []
      const snapshotNow = async () => {
        await parkPointer(page)
        return page.evaluate(SNAPSHOT)
      }
      /**
       * A snapshot that does NOT touch focus or the pointer.
       *
       * `parkPointer` blurs, a blur can commit a draft, and the resulting React
       * re-render puts every attribute back where the component wants it — which
       * silently reverted a DOM mutation the R10 probe depends on. Judges that read
       * nothing focus-dependent (R10 reads accessible names) therefore use this one.
       */
      const snapshotQuiet = async () => page.evaluate(SNAPSHOT)
      // A mutation that "goes red" on a check that was ALREADY red proves nothing,
      // so every probe below is skipped unless its judge was green first. That
      // distinction is the whole point of this pass: a detector that cannot fail is
      // not a detector, and neither is one whose baseline is a failing page.
      const baseline = {
        R1: judgeR1(snapshot, copy).ok,
        R2: judgeR2(snapshot, copy).ok,
        R3: judgeR3(snapshot).ok,
        R4: judgeR4(snapshot).ok,
        R8: judgeR8(snapshot).ok,
        R9: disabledInk.ok,
        R10: judgeR10(snapshot).ok,
        R11: judgeR11(container).ok,
        R13: collision.ok,
      }
      console.log(`  note mutation baseline: ${JSON.stringify(baseline)}`)
      /**
       * Apply one DOM mutation, re-measure, restore, and demand the detector fails.
       * Every mutation here is REVERSIBLE by construction (text, one inline
       * property, or one appended node) so the page is left as it was found.
       */
      const probe = async (id, judgeId, what, apply, judge, undo, takeSnapshot = snapshotNow) => {
        if (baseline[judgeId] !== true) {
          broken.push({ id, what, ok: null, detail: `skipped: ${judgeId} was already red before the mutation` })
          return
        }
        // A probe that throws is a FAILED probe, not a crash: the run still has to
        // report every other check, and a harness error must not be mistaken for a
        // caught mutation.
        try {
          await apply()
          // `judgeR9` is async (it waits for colour transitions), so the verdict is
          // awaited here as well — a promise is never `ok === false`.
          const result = await judge(await takeSnapshot())
          await undo()
          await page.waitForTimeout(150)
          broken.push({ id, what, ok: result.ok === false, detail: result.detail })
        } catch (error) {
          await undo().catch(() => {})
          broken.push({ id, what, ok: false, detail: `the probe threw: ${String(error && error.message).slice(0, 200)}` })
        }
      }
      const textUndo = (selector, original) => async () => {
        await page.evaluate(({ sel, value }) => {
          const el = document.querySelector(sel)
          if (el !== null && value !== null) el.textContent = value
        }, { sel: selector, value: original })
      }
      const clearInline = (selector, property) => async () => {
        await page.evaluate(({ sel, prop }) => {
          document.querySelectorAll(sel).forEach((el) => el.style.removeProperty(prop))
        }, { sel: selector, prop: property })
      }

      const readoutText = await page.evaluate(() => {
        const el = document.querySelector('.dmc-readout')
        return el === null ? null : el.textContent
      })
      await probe('M-R1a', 'R1', 'the readout states a false count', async () => {
        await page.evaluate(() => { const el = document.querySelector('.dmc-readout'); if (el !== null) el.textContent = '99 个提供商，全部可用' })
      }, (snap) => judgeR1(snap, copy), textUndo('.dmc-readout', readoutText))
      await probe('M-R1b', 'R1', 'the readout sentence is emptied', async () => {
        await page.evaluate(() => { const el = document.querySelector('.dmc-readout'); if (el !== null) el.textContent = '' })
      }, (snap) => judgeR1(snap, copy), textUndo('.dmc-readout', readoutText))

      const readyVerdict = await page.evaluate(() => {
        const el = document.querySelector('.dmc-row[data-state="ready"] .dmc-verdict')
        return el === null ? null : el.textContent
      })
      await probe('M-R2a', 'R2', 'a ready row states the unavailable word', async () => {
        await page.evaluate(() => {
          const el = document.querySelector('.dmc-row[data-state="ready"] .dmc-verdict')
          if (el !== null) el.textContent = '不可用'
        })
      }, (snap) => judgeR2(snap, copy), textUndo('.dmc-row[data-state="ready"] .dmc-verdict', readyVerdict))
      await probe('M-R2b', 'R2', 'a ready row paints its rail', async () => {
        await page.evaluate(() => {
          const el = document.querySelector('.dmc-row[data-state="ready"] .dmc-rail')
          if (el !== null) el.style.background = 'rgb(200, 20, 20)'
        })
      }, (snap) => judgeR2(snap, copy), clearInline('.dmc-rail', 'background'))
      await probe('M-R3', 'R3', 'one row shifts its protocol select out of the column', async () => {
        await page.evaluate(() => {
          const el = document.querySelector('.dmc-row .dmc-protocol')
          if (el !== null) el.style.marginLeft = '24px'
        })
      }, (snap) => judgeR3(snap), clearInline('.dmc-protocol', 'margin-left'))
      await probe('M-R4a', 'R4', 'a second 1px-edged control appears in a row', async () => {
        await page.evaluate(() => {
          const row = document.querySelector('.dmc-row')
          if (row === null) return
          const box = document.createElement('span')
          box.id = 'verify-outlined'
          box.style.border = '1px solid currentColor'
          box.style.width = '8px'
          box.style.height = '8px'
          row.append(box)
        })
      }, (snap) => judgeR4(snap), async () => { await page.evaluate(() => document.getElementById('verify-outlined')?.remove()) })
      await probe('M-R4b', 'R4', 'one verdict slides off the shared right edge', async () => {
        await page.evaluate(() => {
          const el = document.querySelector('.dmc-row .dmc-verdict')
          if (el !== null) el.style.marginRight = '12px'
        })
      }, (snap) => judgeR4(snap), clearInline('.dmc-verdict', 'margin-right'))
      await probe('M-R8', 'R8', 'a ready row is given a rest fill', async () => {
        await page.evaluate(() => {
          const row = document.querySelector('.dmc-row[data-state="ready"]')
          if (row !== null) row.style.background = 'rgb(60, 60, 60)'
        })
      }, (snap) => judgeR8(snap), clearInline('.dmc-row', 'background'))
      // R10's comparison is a pure function of the snapshot, and a DOM mutation of
      // that attribute does NOT survive: the component owns `aria-label`, and it was
      // measured rewriting the value back between two evaluates (twice, with and
      // without the focus blur). So this detector is exercised on a snapshot whose
      // two names are equal — the same predicate-level style R5/R6/R7 already use.
      const collidedSnapshot = JSON.parse(JSON.stringify(await snapshotQuiet()))
      let collidedRows = 0
      for (const row of collidedSnapshot.rows) {
        if (row.accessNames.clear !== null && row.accessNames.lifecycle !== null) {
          row.accessNames.clear = row.accessNames.lifecycle
          collidedRows += 1
          break
        }
      }
      const collidedVerdict = judgeR10(collidedSnapshot)
      broken.push({
        id: 'M-R10',
        what: 'two entries in one row share an accessible name',
        ok: collidedRows === 1 && collidedVerdict.ok === false,
        detail: `mutatedRows=${collidedRows} verdict=${collidedVerdict.detail}`,
      })
      await probe('M-R11', 'R11', 'the protocol track is squeezed until its own text cannot fit (wide widths truncate)', async () => {
        await page.evaluate(() => {
          document.head.insertAdjacentHTML('beforeend', '<style id="verify-squeeze">.dmc-protocol{width:40px!important;max-width:40px!important}</style>')
        })
      }, () => judgeR11FromPage(page), async () => {
        await page.evaluate(() => document.getElementById('verify-squeeze')?.remove())
      })
      await probe('M-R11b', 'R11', 'the protocol select is forced wider than its track in the 106px container (overflow)', async () => {
        await page.evaluate(() => {
          document.head.insertAdjacentHTML('beforeend',
            '<style id="verify-narrow-overflow">@container (max-width: 360px) { .dmc-protocol { min-width: 300px !important; } }</style>')
        })
      }, () => judgeR11FromPage(page), async () => {
        await page.evaluate(() => document.getElementById('verify-narrow-overflow')?.remove())
      })
      await probe('M-R13', 'R13', 'a full-viewport overlay covers the page', async () => {
        await page.evaluate(() => {
          const veil = document.createElement('div')
          veil.id = 'verify-veil'
          veil.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.01);z-index:2147483647'
          document.body.append(veil)
        })
      }, () => judgeR13(page), async () => { await page.evaluate(() => document.getElementById('verify-veil')?.remove()) })
      await probe('M-R9', 'R9', 'a disabled text action keeps its resting ink', async () => {
        await page.evaluate(() => {
          document.head.insertAdjacentHTML('beforeend',
            '<style id="verify-disabled-ink">.dmc-key-action:disabled,.dmc-key-clear:disabled,.dmc-catalog:disabled,.dmc-protocol:disabled,.dmc-enable:disabled{color:inherit!important}</style>')
        })
      }, () => judgeR9(page), async () => {
        await page.evaluate(() => document.getElementById('verify-disabled-ink')?.remove())
      })

      // R6 and R7 decide by construction (a frame that moved, a container that lost
      // its type), so their detectors are exercised directly rather than through a
      // mutation that would have to be a fabricated animation.
      const stillBefore = await page.evaluate(MOTION_RECTS)
      await page.evaluate(() => { const el = document.querySelector('.dmc-readout'); if (el !== null) el.style.transform = 'translateY(30px)' })
      const stillAfter = await page.evaluate(MOTION_RECTS)
      await page.evaluate(() => document.querySelector('.dmc-readout')?.style.removeProperty('transform'))
      broken.push({
        id: 'M-R6',
        what: 'a readout that moved between two frames',
        ok: sameFrame(stillBefore, stillAfter) === false,
        detail: `before=${JSON.stringify(stillBefore.rects.readout)} after=${JSON.stringify(stillAfter.rects.readout)}`,
      })

      await page.evaluate(() => { const el = document.querySelector('.dmc-page'); if (el !== null) el.style.containerType = 'normal' })
      const stripped = await containerProbe(page, 484)
      await clearContainerOverride(page)
      await page.evaluate(() => document.querySelector('.dmc-page')?.style.removeProperty('container-type'))
      broken.push({
        id: 'M-R7',
        what: 'container-type stripped from .dmc-page',
        ok: stripped.containerType !== 'inline-size',
        detail: `containerType=${stripped.containerType}`,
      })

      broken.push({
        id: 'M-R5',
        what: 'two probes that report the same theme',
        ok: bothThemes({ dark: true }, { dark: true }) === false && bothThemes({ dark: true }, { dark: false }) === true,
        detail: 'light/dark pair predicate',
      })

      const missed = broken.filter((entry) => entry.ok === false)
      const skipped = broken.filter((entry) => entry.ok === null)
      for (const entry of broken) {
        const mark = entry.ok === null ? 'skip' : entry.ok ? 'ok  ' : 'BAD '
        console.log(`  ${mark} mutation ${entry.id}: ${entry.what}${entry.ok === true ? '' : ` — ${entry.detail}`}`)
      }
      record('M', '改坏验证：本轮新增的每条 R 断言改坏后都变红',
        missed.length === 0 && skipped.length === 0,
        missed.length === 0
          ? `${broken.length - skipped.length}/${broken.length} mutations caught${skipped.length > 0 ? `, ${skipped.length} skipped because their check was already red` : ''}`
          : JSON.stringify(missed.map((entry) => ({ id: entry.id, what: entry.what, detail: entry.detail }))))

      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2500)
      await ensureModelConfig(page)
    }

    // A13 — no console noise across the whole pass. Recorded LAST on purpose: the
    // R phase reloads the page and drives the theme switch, and its noise belongs
    // to this pass too.
    record('A13', '整轮操作 console 无 error/warning、无未捕获异常',
      consoleNoise.length === 0 && pageErrors.length === 0,
      `console=${JSON.stringify(consoleNoise)} pageErrors=${JSON.stringify(pageErrors)}`)
  } catch (error) {
    record('harness', '驱动 GUI 时抛出异常', false, String(error && error.message).slice(0, 500))
  } finally {
    await browser.close().catch(() => {})
  }

  const failed = results.filter((r) => !r.ok)
  console.log('')
  console.log(`checks: ${results.length}, passed: ${results.length - failed.length}, failed: ${failed.length}`)
  if (failed.length > 0) console.log(`failed ids: ${failed.map((r) => r.id).join(', ')}`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.log(`FAIL  harness  ${error && error.message}`)
  process.exit(1)
})
