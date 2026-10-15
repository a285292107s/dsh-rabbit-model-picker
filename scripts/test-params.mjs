/**
 * Unit gates for the parameter resolution and the row facts — the part of the
 * panel that decides WHICH settings path a route's parameters live at, and the
 * part of a model row that decides what its badges may claim. A wrong index or
 * field name would silently write into another model's declaration; a wrongly
 * derived fact would put a claim on screen that no declaration backs. So these
 * assertions run against synthetic snapshots rather than a browser, and the
 * browser acceptance (`scripts/_accept-anchor-loss.cjs`) covers the live Host half.
 *
 * The modules under test import types only, so they bundle to a
 * dependency-free ESM file that plain node can import. The dictionary is
 * bundled too: the badge copy assertions run against the REAL zh/en strings.
 *
 * Run: node scripts/test-params.mjs
 *
 * @module dsh-rabbit-model-picker/test-params
 */

import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
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

/** Compare two values structurally, printing the first difference. */
function equal(label, actual, expected) {
  const left = JSON.stringify(actual)
  const right = JSON.stringify(expected)
  check(label, left === right, { actual, expected })
}

const work = mkdtempSync(join(tmpdir(), 'dmp-params-'))
const outfile = join(work, 'params.mjs')

try {
  await build({
    stdin: {
      contents: [
        "export * from './src/client/params.ts'",
        "export * from './src/client/format.ts'",
        "export * from './src/client/badges.ts'",
        "export * from './src/client/retiredScope.ts'",
        "export * from './src/client/dictionary.ts'",
        "export * from './src/client/panelCopy.ts'",
        "export * from './src/client/capabilities.ts'",
        "export * from './src/client/adapterCatalog.ts'",
      ].join('\n'),
      resolveDir: root,
      sourcefile: 'unit-entry.ts',
      loader: 'ts',
    },
    outfile,
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    target: 'es2022',
    logLevel: 'silent',
  })

  const {
    resolveRoute, parseContext, formatContext, formatWindow, PANEL_MODALITIES,
    BADGE_FACTS, badgeSpecsOf, zh, en, interpolate,
    retireStoredScope,
    noticeOf, inputHintOf, contextHintOf, contextFieldOf, shownInputOf, showsContextField, capacityAction,
    showsInputSection, routeCapabilityOf, CapabilityStore, ParamsStore,
    restoreIsEmpty,
    readCatalog, ADAPTER_CATALOGS,
  } = await import(pathToFileURL(outfile).href)

  /** A translator over the real dictionary, the way the shell binds it. */
  const t = (key, params) => interpolate(zh[key] ?? en[key] ?? key, params)
  /** The badge facts of one route: [fact, off, value] triples, copy left aside. */
  const shapeOf = (specs) => specs.map(spec => [spec.fact, spec.off, spec.value])

  // --- capacity parsing -----------------------------------------------------
  equal('capacity: 128K parses', parseContext('128K'), 128000)
  equal('capacity: 1M parses', parseContext('1M'), 1000000)
  equal('capacity: 262144 parses', parseContext('262144'), 262144)
  equal('capacity: text is refused', parseContext('two fifty six'), null)
  equal('capacity: below the floor is refused', parseContext('0'), null)
  equal('capacity: above the ceiling is refused', parseContext('11M'), null)
  equal('capacity: 1000000 renders as 1M', formatContext(1000000), '1M')
  equal('capacity: 262144 renders verbatim', formatContext(262144), '262144')
  equal('panel modalities are text then image', [...PANEL_MODALITIES], ['text', 'image'])

  // --- the row's window figure ---------------------------------------------
  // The badge states a size; the panel field has to survive a round trip. The
  // two formats are asserted apart so neither can be "fixed" into the other.
  equal('window: 1000000 reads as 1M', formatWindow(1000000), '1M')
  equal('window: 1048576 reads as 1M (no written-out binaries)', formatWindow(1048576), '1M')
  equal('window: 128000 reads as 128K', formatWindow(128000), '128K')
  equal('window: 262144 reads as 262K', formatWindow(262144), '262K')
  equal('window: 786432 reads as 786K (never a fraction)', formatWindow(786432), '786K')
  equal('window: 700000 reads as 700K', formatWindow(700000), '700K')
  equal('window: 250000 reads as 250K', formatWindow(250000), '250K')
  equal('window: 65536 reads as 66K', formatWindow(65536), '66K')
  equal('window: 4096 reads as 4K', formatWindow(4096), '4K')
  equal('window: 999 is too small to have a unit', formatWindow(999), '999')
  equal('window: 1000 is the first K', formatWindow(1000), '1K')
  equal('window: a rounding into the next unit is spelled right', formatWindow(999_900), '1M')
  equal('window: a just-under-a-million figure is still K', formatWindow(999_499), '999K')
  // Big declared defaults: the panel clamps at MAX_CONTEXT, but the badge reads
  // the Host's defaultContextWindow unbounded, so the M branch has to stay
  // whole-numbered and unit-correct rather than silently rereading 1e9 as 1M.
  equal('window: a thousand million tokens reads 1000M, not 1M', formatWindow(1_000_000_000), '1000M')
  equal('window: 5M stays 5M', formatWindow(5_000_000), '5M')
  equal('window: the largest safe integer stays a whole number',
    /^\d+M$/.test(formatWindow(Number.MAX_SAFE_INTEGER)), true)
  // An unusable count is reported as absent, never spelled: a badge that says
  // "context: NaNK" is a claim no declaration backs.
  for (const unusable of [0, -1, NaN, Infinity, -Infinity]) {
    equal(`window: ${String(unusable)} is reported as absent`, formatWindow(unusable), '')
  }
  // Every reachable figure is digits plus at most one K/M: no decimal point can
  // reach the capsule, which is the user-visible requirement here.
  const offenders = []
  for (let tokens = 1; tokens <= 2_000_000; tokens += 137) {
    const text = formatWindow(tokens)
    if (!/^\d+[KM]?$/.test(text)) offenders.push([tokens, text])
  }
  equal('window: no figure in range carries a decimal point', offenders, [])

  // --- the RETIRED provider-scope record --------------------------------------
  // §5.26 stopped remembering the scope, so nothing reads a stored value any more
  // — but the keys an older build wrote are still in users' browsers, and the one
  // thing that must keep working is the sweep that removes them: every shape the
  // record ever had (per-session and the single unscoped one), only keys under this
  // plugin's own prefix, and never a throw when the store is denied or absent.
  const fakeStore = (initial = {}) => {
    const data = { ...initial }
    return {
      key: index => Object.keys(data)[index] ?? null,
      get length() { return Object.keys(data).length },
      getItem: key => (key in data ? data[key] : null),
      setItem: (key, value) => { data[key] = String(value) },
      removeItem: key => { delete data[key] },
    }
  }
  const withStore = store => { globalThis.window = store === null ? {} : { localStorage: store } }
  const SESSION = 'session-a'
  const OTHER = 'session-b'
  const KEY = `dsh-model-picker.provider.v1:${SESSION}`
  const OTHER_KEY = `dsh-model-picker.provider.v1:${OTHER}`
  const LEGACY_KEY = 'dsh-model-picker.provider.v1'

  {
    const store = fakeStore({
      [KEY]: 'opencode-go',
      [OTHER_KEY]: 'commandcode',
      [LEGACY_KEY]: 'xiaomi',
      'dsh-model-picker.other-setting': 'keep me',
      'unrelated.key': 'keep me too',
    })
    withStore(store)
    retireStoredScope()
    equal('retired scope: this session\'s record is gone', store.getItem(KEY), null)
    equal('retired scope: another session\'s record is gone too', store.getItem(OTHER_KEY), null)
    equal('retired scope: the unscoped key from the single-key era is gone', store.getItem(LEGACY_KEY), null)
    equal('retired scope: a neighbouring key of this plugin is untouched',
      store.getItem('dsh-model-picker.other-setting'), 'keep me')
    equal('retired scope: an unrelated plugin\'s key is untouched', store.getItem('unrelated.key'), 'keep me too')
    equal('retired scope: the store is left with exactly the two survivors', store.length, 2)
  }
  // The sweep must be a real sweep, not "remove the key for this session": a store
  // holding several prefixed keys has to come out empty of all of them. (Removing
  // while walking the index would skip every other one — the reason the
  // implementation collects first and removes after.)
  {
    const store = fakeStore(Object.fromEntries(
      Array.from({ length: 8 }, (_, index) => [`dsh-model-picker.provider.v1:s${index}`, `p${index}`]),
    ))
    withStore(store)
    retireStoredScope()
    equal('retired scope: every prefixed key is removed in one pass', store.length, 0)
  }
  withStore(null)
  check('retired scope: an absent store does not throw', (() => {
    try { retireStoredScope(); return true } catch { return false }
  })(), {})
  withStore({ get length() { throw new Error('denied') }, key: () => { throw new Error('denied') }, removeItem: () => { throw new Error('denied') } })
  check('retired scope: a denied store does not throw', (() => {
    try { retireStoredScope(); return true } catch { return false }
  })(), {})
  delete globalThis.window

  // --- a provider-keyed declaration (llm-pi-ai) -----------------------------
  const piAi = {
    status: 'ready',
    error: null,
    writable: true,
    providers: [
      { provider: 'opencode-go', displayName: 'opencode', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'opencode-go'] },
    ],
    namespaces: {
      'llm-pi-ai': {
        ns: 'llm-pi-ai',
        revision: 7,
        value: {
          providers: {
            'opencode-go': {
              defaultContextWindow: 1000000,
              defaultInput: ['text', 'image'],
              models: [
                { id: 'first' },
                { id: 'second', contextWindow: 800000, input: ['text'], maxTokens: 384000 },
              ],
            },
          },
        },
        user: {
          providers: {
            'opencode-go': {
              models: [{ id: 'first' }, { id: 'second', contextWindow: 800000, input: ['text'] }],
            },
          },
        },
      },
    },
  }

  const second = resolveRoute(piAi, { provider: 'opencode-go', model: 'second' })
  equal('pi-ai: addresses the matching entry by index', second?.entryPath, ['providers', 'opencode-go', 'models', '1'])
  equal('pi-ai: reads the modality field the entry declares', second?.inputField, 'input')
  equal('pi-ai: reads the declared modalities', second?.input, ['text'])
  equal('pi-ai: reads the declared window', second?.contextWindow, 800000)
  equal('pi-ai: reads the declared output cap', second?.maxTokens, 384000)
  equal('pi-ai: reads the adapter default window', second?.defaultContextWindow, 1000000)
  equal('pi-ai: reads the adapter default modalities', second?.defaultInput, ['text', 'image'])
  equal('pi-ai: marks a route the profile patch declares', second?.declared, true)
  equal('pi-ai: carries the namespace revision', second?.revision, 7)

  const first = resolveRoute(piAi, { provider: 'opencode-go', model: 'first' })
  equal('pi-ai: an undeclared entry still resolves', first?.entryPath, ['providers', 'opencode-go', 'models', '0'])
  equal('pi-ai: an undeclared entry declares no modalities', first?.input, [])
  equal('pi-ai: an undeclared entry declares no window', first?.contextWindow, undefined)
  equal('pi-ai: an undeclared entry is not marked as the patch\'s own', first?.declared, false)

  // --- a root-keyed declaration (llm-deepseek) ------------------------------
  const deepseek = {
    status: 'ready',
    error: null,
    writable: true,
    providers: [{ provider: 'deepseek-official', displayName: 'DeepSeek', settingsNs: 'llm-deepseek', settingsPath: [] }],
    namespaces: {
      'llm-deepseek': {
        ns: 'llm-deepseek',
        revision: 2,
        value: { models: [{ id: 'official-flash', contextWindow: 65536, inputModalities: ['text'] }] },
        user: {},
      },
    },
  }
  const official = resolveRoute(deepseek, { provider: 'deepseek-official', model: 'official-flash' })
  equal('deepseek: addresses the namespace root list', official?.entryPath, ['models', '0'])
  equal('deepseek: picks the field this adapter uses', official?.inputField, 'inputModalities')
  equal('deepseek: reads the declared modalities', official?.input, ['text'])
  equal('deepseek: reads the declared window', official?.contextWindow, 65536)

  // --- the modelOverrides shape (pi-ai, no models list) ---------------------
  const overrides = {
    status: 'ready',
    error: null,
    writable: true,
    providers: [
      { provider: 'staryears', displayName: 'StarYears', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'staryears'] },
    ],
    namespaces: {
      'llm-pi-ai': {
        ns: 'llm-pi-ai',
        revision: 3,
        value: { providers: { staryears: { modelOverrides: { 'gpt-x': { contextWindow: 123456 } } } } },
      },
    },
  }
  const overridden = resolveRoute(overrides, { provider: 'staryears', model: 'gpt-x' })
  equal('modelOverrides: addressed by model id', overridden?.entryPath, ['providers', 'staryears', 'modelOverrides', 'gpt-x'])
  equal('modelOverrides: reads the window', overridden?.contextWindow, 123456)

  // --- what stays unaddressable --------------------------------------------
  equal('unknown provider: no address', resolveRoute(piAi, { provider: 'nope', model: 'second' }), null)
  equal('unlisted model: no address', resolveRoute(piAi, { provider: 'opencode-go', model: 'third' }), null)
  equal('no selection: no address', resolveRoute(piAi, null), null)
  equal(
    'missing namespace: no address',
    resolveRoute({ ...piAi, namespaces: {} }, { provider: 'opencode-go', model: 'second' }),
    null,
  )
  equal(
    'a path-less, model-less namespace: no address',
    resolveRoute({ ...deepseek, namespaces: { 'llm-deepseek': { ns: 'llm-deepseek', revision: 1, value: {} } } },
      { provider: 'deepseek-official', model: 'official-flash' }),
    null,
  )

  // --- addressing a route whose provider path is nested twice ---------------
  const nested = {
    status: 'ready',
    error: null,
    writable: true,
    providers: [{ provider: 'x', displayName: 'x', settingsNs: 'ns', settingsPath: ['a', 'b'] }],
    namespaces: { ns: { ns: 'ns', revision: 1, value: { a: { b: { models: [{ id: 'm', contextWindow: 4096 }] } } } } },
  }
  equal('nested settings path: addressed in full',
    resolveRoute(nested, { provider: 'x', model: 'm' })?.entryPath, ['a', 'b', 'models', '0'])

  // --- row facts (the badge strip) -----------------------------------------
  // `second` declares input ['text'] and a window; the provider's defaults are
  // ['text','image'] and 1M; `first` declares neither.
  const reasoning = { efforts: [{ id: 'off', name: 'Off' }, { id: 'high', name: 'High' }], defaultEffort: 'high' }
  const factsOf = (snapshot, route, extra = {}) => shapeOf(badgeSpecsOf({
    address: resolveRoute(snapshot, route),
    // An explicit `reasoning: undefined` must mean "no metadata", which is why
    // presence of the key — not its value — picks the fixture.
    reasoning: 'reasoning' in extra ? extra.reasoning : reasoning,
    t,
  }))

  equal('facts: a declared list is stated as-is',
    factsOf(piAi, { provider: 'opencode-go', model: 'second' }),
    [['text', false, ''], ['image', true, ''], ['effort', false, ''], ['context', false, '800K']])
  equal('facts: an undeclared entry falls back to the adapter default list',
    factsOf(piAi, { provider: 'opencode-go', model: 'first' }),
    [['text', false, ''], ['image', false, ''], ['effort', false, ''], ['context', false, '1M']])
  equal('facts: order is text, image, effort, context',
    factsOf(piAi, { provider: 'opencode-go', model: 'second' }).map(spec => spec[0]),
    ['text', 'image', 'effort', 'context'])
  equal('facts: the canonical order is published once', [...BADGE_FACTS],
    ['text', 'image', 'effort', 'context'])
  equal('facts: the strip never repeats a fact',
    new Set(badgeSpecsOf({
      address: resolveRoute(piAi, { provider: 'opencode-go', model: 'first' }),
      reasoning,
      t,
    }).map(spec => spec.fact)).size, 4)
  equal('facts: the effort badge names no level — the row states the ability, not the setting',
    factsOf(piAi, { provider: 'opencode-go', model: 'first' })[2],
    ['effort', false, ''])
  equal('facts: no reasoning metadata states no ability, slashed',
    factsOf(piAi, { provider: 'opencode-go', model: 'second' }, { reasoning: undefined })[2],
    ['effort', true, ''])
  equal('facts: an unaddressable route still states the floor text fact, no image',
    factsOf(piAi, { provider: 'nope', model: 'second' }),
    [['text', false, ''], ['image', true, ''], ['effort', false, '']])
  equal('facts: nothing declared and no default → text by floor, image unclaimed',
    factsOf(nested, { provider: 'x', model: 'm' }),
    [['text', false, ''], ['image', true, ''], ['effort', false, ''], ['context', false, '4K']])

  // The copy itself is asserted, not just the shape: a badge whose sentence is
  // wrong is worse than a missing badge, because it is a claim.
  const sentences = badgeSpecsOf({
    address: resolveRoute(piAi, { provider: 'opencode-go', model: 'second' }),
    reasoning,
    t,
  }).map(spec => spec.sentence)
  equal('facts: every badge sentence is localized', sentences,
    ['文字输入', '不支持图片输入', '支持思考', '上下文窗口 800K'])
  equal('facts: the row name carries them all', t('badge.rowAria', { model: 'M', facts: sentences.join(t('settings.listJoin')) }),
    'M，文字输入、不支持图片输入、支持思考、上下文窗口 800K')

  // --- what the parameter panel says in each state --------------------------
  // The panel's copy is a decision per state, not a paragraph: which single line
  // explains an inert control, and which line states where a value comes from.
  // Getting that wrong is invisible in a screenshot (three sentences saying the
  // same thing still look fine) and the busy state — where the user's own click
  // disables the card — had no sentence at all. So the DECISION is asserted here
  // against the real dictionary, and the panel only renders the result.
  const ready = { status: 'ready', error: null, writable: true }
  const copyState = (address, extra = {}) =>
    ({ address, capability: null, snapshot: ready, busy: false, capacityError: false, ...extra })
  /** The resolved copy line, as the panel would paint it. */
  const line = (copy) => copy === null ? null : t(copy.key, copy.params)
  const notice = (state) => line(noticeOf(state))
  const inputHint = (state) => line(inputHintOf(state, t))
  const contextHint = (state) => line(contextHintOf(state))

  // An editable route that declares both fields: no notice at all.
  equal('panel copy: an editable declared route needs no notice', notice(copyState(second)), null)
  equal('panel copy: its input hint cites the declared list',
    inputHint(copyState(second)), '已声明：文字')
  equal('panel copy: its capacity hint says declared',
    contextHint(copyState(second)), '已声明；留空并回车 = 恢复适配器默认')

  // An editable route that declares neither: the hints cite the adapter defaults.
  equal('panel copy: an undeclared route needs no notice', notice(copyState(first)), null)
  equal('panel copy: its input hint cites the adapter default list',
    inputHint(copyState(first)), '尚未声明，当前按适配器默认：文字、图片')
  equal('panel copy: its capacity hint names that fallback as a fallback, not as the value in force',
    contextHint(copyState(first)), '尚未声明；适配器声明的兜底值是 1M，实际容量由它内部决定')
  equal('panel copy: its field holds nothing and shows the provider default',
    contextFieldOf(first), { value: '', placeholder: '1M' })
  equal('panel copy: its switches show the adapter default list',
    [...shownInputOf(first)], ['text', 'image'])

  // The unaddressable route: ONE explanation, and nothing below repeats it.
  const unaddressable = copyState(resolveRoute(piAi, { provider: 'nope', model: 'second' }))
  equal('panel copy: an unaddressable route states why, once',
    notice(unaddressable), '这个模型来自适配器内置目录，没有可编辑的声明，只能查看。')
  equal('panel copy: its input hint says nothing at all', inputHint(unaddressable), null)
  equal('panel copy: its capacity section is not rendered at all',
    contextHint(unaddressable), null)
  equal('panel copy: so the field has no place on screen',
    showsContextField(resolveRoute(piAi, { provider: 'nope', model: 'second' })), false)
  equal('panel copy: an addressable route does render the field',
    showsContextField(second), true)

  // The read-only profile: same rule, different reason, and still no repetition.
  const readOnly = copyState(second, { snapshot: { status: 'ready', error: null, writable: false } })
  equal('panel copy: a read-only configuration states why',
    notice(readOnly), '当前配置不接受表单修改，参数面板只能查看。')
  equal('panel copy: its hints stay quiet too', inputHint(readOnly), null)
  equal('panel copy: including the capacity hint when the field is addressable',
    contextHint(readOnly), null)

  // A selection in flight disables every control, and says so: this is the state
  // the panel used to leave unexplained while the user was looking at it.
  equal('panel copy: a selection in flight is explained',
    notice(copyState(second, { busy: true })), '正在应用这次选择，参数暂时不能改…')
  equal('panel copy: busy is explained even while the settings load',
    notice(copyState(null, { busy: true, snapshot: { status: 'idle', error: null, writable: true } })),
    '正在应用这次选择，参数暂时不能改…')

  // The settings service being absent, loading, and failing each have their own
  // line, and a refusal outranks them all.
  equal('panel copy: a missing settings service is explained',
    notice(copyState(second, { snapshot: { status: 'unavailable', error: null, writable: false } })),
    '这个部署没有挂载设置服务，参数面板只能查看（思考强度仍可用）。')
  equal('panel copy: loading is stated',
    notice(copyState(second, { snapshot: { status: 'loading', error: null, writable: true } })),
    '正在读取当前参数…')
  equal('panel copy: a read failure shows the service message',
    notice(copyState(second, { snapshot: { status: 'error', error: 'boom', writable: true } })),
    '读不到当前设置：boom')

  // A declared route whose adapter states a fallback: the hint names it as a
  // fallback, not as the value in force, because the installed catalog may
  // override it and this plugin cannot see the catalog.
  const fallbackOnly = {
    ...piAi,
    namespaces: {
      'llm-pi-ai': {
        ...piAi.namespaces['llm-pi-ai'],
        value: {
          providers: {
            'opencode-go': {
              defaultContextWindow: 1000000,
              defaultInput: ['text', 'image'],
              models: [{ id: 'first' }],
            },
          },
        },
      },
    },
  }
  const fallbackState = copyState(resolveRoute(fallbackOnly, { provider: 'opencode-go', model: 'first' }))
  equal('panel copy: an undeclared window names the fallback as a fallback',
    contextHint(fallbackState), '尚未声明；适配器声明的兜底值是 1M，实际容量由它内部决定')
  equal('panel copy: an undeclared modality list names the adapter default',
    inputHint(fallbackState), '尚未声明，当前按适配器默认：文字、图片')

  // An unreadable capacity names the range it enforces, not just a format. The
  // bounds are the exact integers `parseContext` enforces: the floor is not a
  // round token count, and rounding the ceiling up would overstate it.
  equal('panel copy: an unreadable capacity states the accepted range',
    contextHint(copyState(second, { capacityError: true })),
    '读不出这个数值：请写 128K、1M 或 131072，范围 1024–10485760')
  equal('panel copy: a rejected value outranks every other hint reason',
    contextHint(copyState(unaddressable, { capacityError: true })),
    '读不出这个数值：请写 128K、1M 或 131072，范围 1024–10485760')

  // Every line above is a real dictionary entry, not a raw key leaking through.
  const panelLines = [
    notice(copyState(second, { busy: true })),
    notice(copyState(second, { snapshot: { status: 'unavailable', error: null, writable: false } })),
    notice(unaddressable),
    notice(readOnly),
    inputHint(copyState(second)),
    inputHint(copyState(first)),
    contextHint(copyState(second)),
    contextHint(fallbackState),
    contextHint(copyState(second, { capacityError: true })),
  ]
  const leaked = panelLines.filter(text => text !== null && /^settings\./.test(text))
  equal('panel copy: no line renders a raw dictionary key', leaked, [])

  // Every key the copy table can emit has to exist in BOTH dictionaries. The
  // static selfcheck sees the `key:` literals but cannot tell a typo'd key from a
  // real one; this resolves each key through both dictionaries and demands a hit.
  const everyKey = [
    noticeOf(copyState(null, { busy: true }))?.key,
    noticeOf(copyState(second, { snapshot: { status: 'idle', error: null, writable: true } }))?.key,
    noticeOf(copyState(second, { snapshot: { status: 'loading', error: null, writable: true } }))?.key,
    noticeOf(copyState(second, { snapshot: { status: 'unavailable', error: null, writable: false } }))?.key,
    noticeOf(copyState(second, { snapshot: { status: 'error', error: 'x', writable: true } }))?.key,
    noticeOf(unaddressable)?.key,
    noticeOf(readOnly)?.key,
    inputHintOf(copyState(first), t)?.key,
    inputHintOf(copyState(second), t)?.key,
    contextHintOf(copyState(second))?.key,
    contextHintOf(fallbackState)?.key,
    contextHintOf(copyState(second, { capacityError: true }))?.key,
  ].filter(key => key !== undefined)
  const missingInZh = everyKey.filter(key => zh[key] === undefined)
  const missingInEn = everyKey.filter(key => en[key] === undefined)
  equal('panel copy: every emittable key exists in zh', missingInZh, [])
  equal('panel copy: every emittable key exists in en', missingInEn, [])
  equal('panel copy: the busy state is a real entry, not a placeholder',
    typeof zh['settings.busy'] === 'string' && zh['settings.busy'].length > 0, true)

  // --- the RULES, not just today's strings ----------------------------------
  // The assertions above are snapshots: they catch a change to any of these
  // sentences, but nothing stops someone from writing the duplicate explanation
  // back in AND updating the snapshot to match. These assertions are the rules
  // the snapshots are examples of, swept over a grid of states, so the decision
  // cannot be inverted without a red gate.
  const states = []
  /** One adapter-published fact set, and the empty one: both axes are swept. */
  const PUBLISHED = { inputModalities: ['text', 'image'], contextWindow: 1000000 }
  for (const address of [second, first, resolveRoute(piAi, { provider: 'nope', model: 'second' }), null]) {
    for (const capability of [null, PUBLISHED]) {
      for (const status of ['ready', 'loading', 'idle', 'unavailable', 'error']) {
        for (const writable of [true, false]) {
          for (const busy of [true, false]) {
            for (const capacityError of [true, false]) {
              states.push({
                address,
                capability,
                snapshot: { status, error: status === 'error' ? 'x' : null, writable },
                busy,
                capacityError,
              })
            }
          }
        }
      }
    }
  }
  check('panel copy: the state grid is broad enough to be worth sweeping', states.length >= 100, {
    states: states.length,
  })

  // Rule 1: the notice is the ONLY place an unusable state is explained. When it
  // is present, no section repeats it — with two exceptions, both of which are
  // statements the notice does not make: a value the user just typed that could
  // not be read (their own immediate problem), and a fact the ADAPTER published,
  // which answers "where did the value on screen come from" rather than "why can
  // I not edit it".
  const besideANotice = new Set(['settings.input.capability', 'settings.context.capability'])
  const repeated = states.filter((state) => {
    if (noticeOf(state) === null || state.capacityError) return false
    return [inputHintOf(state, t), contextHintOf(state)]
      .filter(hint => hint !== null)
      .some(hint => !besideANotice.has(hint.key))
  })
  equal('panel copy rule: a state with a notice emits no section hint but a published fact', repeated.length, 0)
  const rejectedOutranks = states.filter(state =>
    state.capacityError && contextHintOf(state)?.key !== 'settings.context.invalid')
  equal('panel copy rule: a rejected value is always the capacity hint', rejectedOutranks.length, 0)

  // Rule 2: busy is always explained, whatever else is going on — it is the
  // state the user caused themselves, and it had no sentence before.
  const unexplainedBusy = states.filter(state => state.busy && noticeOf(state) === null)
  equal('panel copy rule: every busy state states why', unexplainedBusy.length, 0)

  // Rule 3: no two rendered lines of one state are the same SENTENCE. Compared
  // as rendered text, not as keys: two distinct keys could still resolve to the
  // same words, and that is the duplication this rule is named after.
  const duplicated = states.filter((state) => {
    const lines = [
      line(noticeOf(state)),
      line(inputHintOf(state, t)),
      line(contextHintOf(state)),
    ].filter(text => text !== null)
    return new Set(lines).size !== lines.length
  })
  equal('panel copy rule: one state never says the same thing twice', duplicated.length, 0)

  // Rule 4: when nothing outranks it, the capacity hint agrees with the field —
  // "declared" never appears over an empty box, and an undeclared window is never
  // called declared. A notice clears the hint entirely (rule 1), and a rejected
  // value replaces it (the rule above), so both of those are checked first. The
  // one hint a notice leaves standing is the published window, and only where the
  // declaration supplies none.
  const mismatched = states.filter((state) => {
    if (state.address === null) return false
    if (state.capacityError) return false
    if (noticeOf(state) !== null) {
      const hint = contextHintOf(state)
      if (hint === null) return false
      return !(hint.key === 'settings.context.capability' && state.address.contextWindow === undefined)
    }
    const declared = state.address.contextWindow !== undefined
    return declared
      ? contextHintOf(state)?.key !== 'settings.context.declared'
      : contextHintOf(state)?.key === 'settings.context.declared'
  })
  equal('panel copy rule: the capacity hint always matches the field', mismatched.length, 0)

  // Rule 5: the input hint, when it says "declared", lists exactly what the two
  // switches show as on — a hint that names a modality the switches do not offer
  // is the kind of untruth no screenshot catches.
  const wrongSwitchReport = states.filter((state) => {
    const line = inputHintOf(state, t)
    if (line === null || line.key !== 'settings.input.declared') return false
    const shown = shownInputOf(state.address, state.capability)
      .map(item => (item === 'text' ? t('settings.input.text') : item === 'image' ? t('settings.input.image') : item))
      .join(t('settings.listJoin'))
    return line.params.list !== shown
  })
  equal('panel copy rule: a "declared" input hint matches what the switches show',
    wrongSwitchReport.length, 0)

  // Rule 6: a hint that cites the adapter's catalog names exactly the list the
  // switches are drawn from, for the same reason Rule 5 exists. It is the new
  // sentence, so it gets the same guard.
  const wrongPublishedReport = states.filter((state) => {
    const line = inputHintOf(state, t)
    if (line === null || line.key !== 'settings.input.capability') return false
    const shown = shownInputOf(state.address, state.capability)
      .map(item => (item === 'text' ? t('settings.input.text') : item === 'image' ? t('settings.input.image') : item))
      .join(t('settings.listJoin'))
    return line.params.list !== shown
  })
  equal('panel copy rule: a published input hint matches what the switches show',
    wrongPublishedReport.length, 0)

  // --- facts the ADAPTER published ------------------------------------------
  // The route no settings document can address at all: this is the state that
  // used to produce no modality badge, no window, and a panel whose two modality
  // switches were drawn as OFF — a claim about the model that nothing had
  // verified. The adapter publishes the truth; these assertions are what make the
  // panel say it, and say where it came from, without ever offering an edit.
  const unpublishedRoute = { provider: 'nope', model: 'second' }
  const publishedCapability = { inputModalities: ['text', 'image'], contextWindow: 1000000 }
  const publishedState = copyState(resolveRoute(piAi, unpublishedRoute), { capability: publishedCapability })
  equal('published: the view-only reason is still stated exactly once',
    notice(publishedState), '这个模型来自适配器内置目录，没有可编辑的声明，只能查看。')
  equal('published: the input hint names the adapter catalog as the source',
    inputHint(publishedState), '适配器内置目录公布：文字、图片')
  equal('published: the capacity hint names the published window',
    contextHint(publishedState), '适配器内置目录公布：1M（不可编辑）')
  equal('published: the switches show the published list, not two offs',
    [...shownInputOf(null, publishedCapability)], ['text', 'image'])
  equal('published: the input section is on screen for it',
    showsInputSection(null, publishedCapability), true)
  equal('published: the field shows the published window as the fallback in force',
    contextFieldOf(null, publishedCapability), { value: '', placeholder: '1M' })
  equal('published: the capacity section is on screen for it',
    showsContextField(null, publishedCapability), true)
  equal('published: with nothing published, neither section is drawn',
    [showsInputSection(null, null), showsContextField(null, null)], [false, false])
  equal('published: an unpublished, unaddressable route states no input fact',
    [...shownInputOf(null, null)], [])

  // Precedence is the adapters' OWN (`declared ?? installed catalog ?? configured
  // default`), so a declaration still wins, and the catalog beats the default.
  equal('published: a declaration outranks the published window',
    contextFieldOf(second, { contextWindow: 4000 }), { value: '800K', placeholder: '800K' })
  equal('published: a declaration outranks the published modalities',
    [...shownInputOf(second, { inputModalities: ['text', 'image'] })], ['text'])
  const catalogOverDefault = copyState(first, { capability: { inputModalities: ['text'], contextWindow: 250000 } })
  equal('published: the catalog outranks the provider-wide default window',
    contextHint(catalogOverDefault), '适配器内置目录公布：250K（不可编辑）')
  equal('published: the catalog outranks the provider-wide default modalities',
    inputHint(catalogOverDefault), '适配器内置目录公布：文字')
  equal('published: and the field carries that catalog number',
    contextFieldOf(first, catalogOverDefault.capability), { value: '', placeholder: '250K' })

  // The same facts on the row. A published route now states all four instead of
  // dropping the three the settings document could not answer.
  equal('facts: a published route states its modalities and its window',
    shapeOf(badgeSpecsOf({
      address: null, capability: publishedCapability, reasoning: undefined, t,
    })),
    [['text', false, ''], ['image', false, ''], ['effort', true, ''], ['context', false, '1M']])
  equal('facts: a declaration still outranks the published catalog',
    shapeOf(badgeSpecsOf({
      address: second,
      capability: publishedCapability,
      reasoning: undefined,
      t,
    })),
    [['text', false, ''], ['image', true, ''], ['effort', true, ''], ['context', false, '800K']])
  equal('facts: the published window outranks the provider default behind it',
    shapeOf(badgeSpecsOf({
      address: first, capability: { contextWindow: 250000 }, reasoning: undefined, t,
    })),
    [['text', false, ''], ['image', false, ''], ['effort', true, ''], ['context', false, '250K']])

  // --- the one disabled control with no notice -------------------------------
  // "恢复默认" is disabled when the route declares nothing. That state has no
  // notice, so the reason rides on the section hint instead of the button's
  // `title` (which a disabled button cannot be focused to reveal).
  equal('panel copy: an empty declaration states why nothing can be restored',
    restoreIsEmpty(copyState(first)), true)
  equal('panel copy: a declared route has something to restore',
    restoreIsEmpty(copyState(second)), false)
  equal('panel copy: an unaddressable route explains itself through the notice instead',
    restoreIsEmpty(unaddressable), false)
  equal('panel copy: a busy panel does not also claim an empty declaration',
    restoreIsEmpty(copyState(first, { busy: true })), false)
  equal('panel copy: a read-only panel explains itself through the notice instead',
    restoreIsEmpty(copyState(first, { snapshot: { status: 'ready', error: null, writable: false } })), false)
  // The sentence itself is real copy in both dictionaries.
  equal('panel copy: the restore explanation is a real entry',
    typeof zh['settings.resetNothing'] === 'string' && typeof en['settings.resetNothing'] === 'string', true)
  // Swept: whenever the button is disabled for THIS reason, the panel says so.
  const silentRestore = states.filter(state =>
    restoreIsEmpty(state) && inputHintOf(state, t) === null)
  equal('panel copy rule: an empty declaration is never a silent dead button',
    silentRestore.length, 0)

  // --- committing the capacity field ----------------------------------------
  // The decision is pure (`capacityAction`), and two of its branches exist only
  // because an adversarial review found them broken in the component: an
  // untouched field that wrote anyway, and a rejected value whose warning a mere
  // blur dismissed. Both are asserted here so they cannot come back.
  equal('capacity commit: an untouched field writes nothing',
    capacityAction(null, '1M', 1_000_000, parseContext), { kind: 'skip' })
  equal('capacity commit: a draft equal to the declared value writes nothing',
    capacityAction('1M', '1M', 1_000_000, parseContext), { kind: 'skip' })
  equal('capacity commit: whitespace around the declared value only normalizes',
    capacityAction('  1M  ', '1M', 1_000_000, parseContext), { kind: 'normalize', text: '1M' })
  equal('capacity commit: a new value is declared',
    capacityAction('800K', '1M', 1_000_000, parseContext), { kind: 'set', value: 800_000 })
  equal('capacity commit: another spelling of the declared value only normalizes',
    capacityAction('1m', '1M', 1_000_000, parseContext), { kind: 'normalize', text: '1M' })
  equal('capacity commit: the same count in K normalizes too',
    capacityAction('1000K', '1M', 1_000_000, parseContext), { kind: 'normalize', text: '1M' })
  equal('capacity commit: empty on a declared route un-declares',
    capacityAction('', '1M', 1_000_000, parseContext), { kind: 'unset' })
  equal('capacity commit: empty on an undeclared route writes nothing',
    capacityAction('', '', undefined, parseContext), { kind: 'skip' })
  // Sticky, by construction: the same unreadable text always reports `reject`, so
  // the warning cannot be cleared by looking away.
  for (const bad of ['abc', 'two fifty six', '0', '11M', '-1']) {
    equal(`capacity commit: ${JSON.stringify(bad)} is rejected and stays rejected`,
      capacityAction(bad, '1M', 1_000_000, parseContext), { kind: 'reject' })
  }

  // --- the store: which routes may be read, and how often --------------------
  // The store is where "read the adapter's catalog" stops being a decoration and
  // becomes a decision: a route the adapter only knows from configuration must
  // NEVER be interrogated (that call leaves the process and talks to the
  // endpoint), a route it ships is read once, and an adapter-owned Remote answers
  // for routes no settings directory even names.
  /** Let the store's fire-and-forget reads settle; they are not awaited by design. */
  const settle = async () => {
    await new Promise(done => setTimeout(done, 0))
    await new Promise(done => setTimeout(done, 0))
  }
  const entryOf = (extra = {}) =>
    ({ provider: 'p', displayName: 'P', settingsNs: 'ns', settingsPath: [], ...extra })
  const llmOf = (entries, discovered, log) => ({
    listConfigurableProviders: async () => ({ ok: true, value: entries }),
    discoverModels: async (ns, request) => {
      log.push(`${ns}:${request.provider}`)
      return { ok: true, value: discovered }
    },
  })

  {
    const log = []
    const store = new CapabilityStore(() => llmOf([entryOf({ declared: true })], [{ id: 'm', contextWindow: 1000 }], log))
    store.ensure(['p'])
    await settle()
    equal('capabilities: a configuration-only route is never interrogated', log, [])
    equal('capabilities: and it publishes no facts', store.getSnapshot().routes, {})
  }
  {
    const log = []
    const store = new CapabilityStore(() => llmOf(
      [entryOf()], [{ id: 'm', contextWindow: 1000, inputModalities: ['text'] }], log,
    ))
    store.ensure(['p', 'p'])
    await settle()
    equal('capabilities: a shipped route is read once, through its own namespace', log, ['ns:p'])
    equal('capabilities: the answer is indexed by the row key',
      store.getSnapshot().routes, { 'p/m': { inputModalities: ['text'], contextWindow: 1000 } })
    equal('capabilities: the read settles to ready', store.getSnapshot().status, 'ready')
  }
  {
    const store = new CapabilityStore(() => null)
    store.ensure(['dsh-opencode-go'])
    await settle()
    equal('capabilities: a route with no reader publishes nothing', store.getSnapshot().routes, {})
    store.addSource({
      providers: ['dsh-opencode-go'],
      read: async () => [{ id: 'deepseek-v4.1-flash', contextWindow: 1000000, inputModalities: ['text', 'image'] }],
    })
    await settle()
    equal('capabilities: a reader that mounts later still answers the earlier ask',
      store.getSnapshot().routes,
      { 'dsh-opencode-go/deepseek-v4.1-flash': { inputModalities: ['text', 'image'], contextWindow: 1000000 } })
  }
  {
    // The LLM face is ABSENT at the first ask — the async-mount race the store
    // is built around. The ask must publish nothing AND stay retryable: a later
    // open, with the face mounted, has to land the facts.
    const log = []
    let face = null
    const store = new CapabilityStore(() => face)
    store.ensure(['p'])
    await settle()
    equal('capabilities: an ask with no llm face publishes nothing', store.getSnapshot().routes, {})
    face = llmOf([entryOf()], [{ id: 'm', contextWindow: 2000 }], log)
    store.ensure(['p'])
    await settle()
    equal('capabilities: the unanswered ask is retried once the face mounts', log, ['ns:p'])
    equal('capabilities: the retry indexes the facts',
      store.getSnapshot().routes, { 'p/m': { contextWindow: 2000 } })
  }
  {
    // A failed provider-directory read is not an answer either: the ask stays
    // retryable, and success is the only thing cached.
    const log = []
    let directoryOk = false
    const store = new CapabilityStore(() => ({
      listConfigurableProviders: async () => directoryOk
        ? { ok: true, value: [entryOf()] }
        : { ok: false, error: { code: 'x', message: 'boom' } },
      discoverModels: async (ns, request) => {
        log.push(`${ns}:${request.provider}`)
        return { ok: true, value: [{ id: 'm', contextWindow: 3000 }] }
      },
    }))
    store.ensure(['p'])
    await settle()
    equal('capabilities: a failed directory read answers nothing', log, [])
    directoryOk = true
    store.ensure(['p'])
    await settle()
    equal('capabilities: a failed directory read is retried on the next ask', log, ['ns:p'])
  }
  {
    // A refusal the adapter itself returned IS an answer: the ask is consumed,
    // and no later open re-sends it.
    const log = []
    let refuse = true
    const store = new CapabilityStore(() => ({
      listConfigurableProviders: async () => ({ ok: true, value: [entryOf()] }),
      discoverModels: async (ns, request) => {
        log.push(`${ns}:${request.provider}`)
        return refuse
          ? { ok: false, error: { code: 'llm/discovery-refused', message: 'no' } }
          : { ok: true, value: [{ id: 'm', contextWindow: 5000 }] }
      },
    }))
    store.ensure(['p'])
    await settle()
    equal('capabilities: a discovery refusal publishes no facts', store.getSnapshot().routes, {})
    refuse = false
    store.ensure(['p'])
    await settle()
    equal('capabilities: a refusal is an answer, so it is never retried', log, ['ns:p'])
  }
  {
    // A reader registered while the racing read is STILL IN FLIGHT must not be
    // swallowed by the inflight guard: the settled read re-runs the ask through
    // the reader that now exists.
    let release
    const gate = new Promise(done => { release = done })
    const log = []
    const store = new CapabilityStore(() => ({
      listConfigurableProviders: async () => ({ ok: true, value: [entryOf()] }),
      discoverModels: async (ns, request) => {
        log.push(`llm:${request.provider}`)
        await gate
        return { ok: true, value: [] }
      },
    }))
    store.ensure(['p'])
    await new Promise(done => setTimeout(done, 0))
    store.addSource({
      providers: ['p'],
      read: async () => { log.push('source:p'); return [{ id: 'm', contextWindow: 4000 }] },
    })
    equal('capabilities: a reader registered mid-flight does not re-run yet', log, ['llm:p'])
    release()
    await settle()
    equal('capabilities: the racing ask is re-run through the reader once it settles',
      log, ['llm:p', 'source:p'])
    equal('capabilities: and the re-run lands the reader\'s facts',
      store.getSnapshot().routes, { 'p/m': { contextWindow: 4000 } })
  }
  {
    // The SAME mid-flight race, settled the OTHER way. The re-run above used to
    // hang off the success path alone, so a reader that arrived during the ask
    // that FAILS — which is precisely the async-mount race this store is built
    // around, an unmounted LLM face or a dead transport — was left in the
    // requeue set forever. Two defects in one: its facts never arrived (the
    // mount order the store promises to be independent of decided the answer
    // instead), and the stale entry later forced a SECOND read of a provider
    // that had already been answered, breaking the "one call per provider per
    // page load" budget.
    const log = []
    const store = new CapabilityStore(() => null) // the LLM face is not mounted yet
    store.ensure(['p']) // the racing ask goes out against nothing
    store.addSource({ // the reader mounts while that ask is still in flight
      providers: ['p'],
      read: async () => { log.push('source:p'); return [{ id: 'm', contextWindow: 4000 }] },
    })
    await settle()
    equal('capabilities: a reader registered mid-flight survives a FAILING settle', log, ['source:p'])
    equal('capabilities: and its facts land',
      store.getSnapshot().routes, { 'p/m': { contextWindow: 4000 } })
    // The re-run consumed the ask: the next open must not send a second read.
    store.ensure(['p'])
    await settle()
    equal('capabilities: the failing re-run leaves no stale ask to read again', log, ['source:p'])
  }

  // --- the adapter-owned catalog reader: "not mounted" vs "published none" ----
  // The reader is the join between this plugin and an adapter's OWN Remote, and
  // the one place where two answers that look alike are not: `[]` is an ANSWER
  // the store never re-asks, while a throw releases the ask for a later open. An
  // absent namespace used to return `[]`, so an adapter whose Remote was still
  // mounting when the card first opened had its single ask consumed — no facts
  // for the rest of the page, the exact race the store is built to absorb.
  {
    const catalogFace = (models) => ({
      read: async () => ({ ok: true, value: { models } }),
    })
    // A client context whose namespaces mount on demand.
    const faces = {}
    const ctx = { get: (name) => faces[name] }

    equal('adapter catalog: names the adapter route it answers for',
      ADAPTER_CATALOGS.map(entry => [...entry.providers]), [['dsh-opencode-go']])

    // 1. Not mounted yet: a THROW, not an empty list.
    let threw = false
    try {
      await readCatalog(ctx, 'opencodeGoModels')
    } catch {
      threw = true
    }
    equal('adapter catalog: an unmounted namespace is NOT reported as "published none"', threw, true)

    // 2. Mounted and answering: its models come through.
    faces['remote.opencodeGoModels'] = catalogFace([{ id: 'm', contextWindow: 1000 }])
    equal('adapter catalog: a mounted namespace yields its models',
      await readCatalog(ctx, 'opencodeGoModels'), [{ id: 'm', contextWindow: 1000 }])

    // 3. Mounted and empty: an ANSWER, distinct from case 1.
    faces['remote.opencodeGoModels'] = catalogFace([])
    equal('adapter catalog: a mounted but empty catalog is an answer', await readCatalog(ctx, 'opencodeGoModels'), [])

    // 4. A refusal the adapter itself returned is also an answer.
    faces['remote.opencodeGoModels'] = {
      read: async () => ({ ok: false, error: { code: 'x', message: 'no' } }),
    }
    equal('adapter catalog: the adapter\'s own refusal is an answer',
      await readCatalog(ctx, 'opencodeGoModels'), [])

    // 5. A face that is mounted but not yet callable: still "not mounted yet".
    faces['remote.opencodeGoModels'] = {}
    let threwNoRead = false
    try {
      await readCatalog(ctx, 'opencodeGoModels')
    } catch {
      threwNoRead = true
    }
    equal('adapter catalog: a face without read() is not yet answerable', threwNoRead, true)
  }

  {
    // End to end through the store: the mount race a user actually hits. The
    // card opens before the adapter's Remote is up; the fact must still arrive,
    // either through the mid-flight re-run or through the next open.
    const faces = {}
    const ctx = { get: (name) => faces[name] }
    const store = new CapabilityStore(() => null)
    store.addSource({
      providers: ['dsh-opencode-go'],
      read: () => readCatalog(ctx, 'opencodeGoModels'),
    })
    store.ensure(['dsh-opencode-go'])
    await settle()
    equal('adapter catalog: the first ask, before the namespace mounts, states nothing',
      store.getSnapshot().routes, {})
    faces['remote.opencodeGoModels'] = {
      read: async () => ({ ok: true, value: { models: [{ id: 'flash', contextWindow: 1000000 }] } }),
    }
    // The next open, which is what the store's retry contract is for.
    store.ensure(['dsh-opencode-go'])
    await settle()
    equal('adapter catalog: the ask survives the mount race and lands the facts',
      store.getSnapshot().routes,
      { 'dsh-opencode-go/flash': { contextWindow: 1000000 } })
  }

  // --- the write path: a transport failure is an outcome, not a hang ---------
  // `settings/mutate` REJECTS on a dead transport instead of answering
  // { ok: false }. The panel consumes `write` with a `then` and no `catch`, so
  // the store itself must never reject: a rejection would leave `writing` set
  // forever — every control disabled, no message, no way out.
  {
    const store = new ParamsStore(() => ({
      settings: {
        describe: async () => ({ ok: true, value: { writable: true, hasDocument: true, namespaces: [] } }),
        mutate: async () => { throw new Error('transport down') },
      },
      llm: { listConfigurableProviders: async () => ({ ok: true, value: [] }) },
    }))
    equal('params store: a transport failure fails the write instead of rejecting',
      await store.write('ns', [{ op: 'set', path: ['a'], value: 1 }], 3),
      { ok: false, conflict: false, message: 'transport down' })
  }
  {
    // The documented retry: a revision conflict re-reads and re-applies once,
    // with the revision the fresh read answered.
    const calls = []
    const store = new ParamsStore(() => ({
      settings: {
        describe: async () => ({
          ok: true,
          value: { writable: true, hasDocument: true, namespaces: [{ ns: 'ns', revision: 2, value: {} }] },
        }),
        mutate: async (ns, ops, expectedRevision) => {
          calls.push(expectedRevision)
          return calls.length === 1
            ? { ok: false, error: { code: 'settings/conflict', message: 'stale' } }
            : { ok: true, value: { ns, revision: 2, value: {} } }
        },
      },
      llm: { listConfigurableProviders: async () => ({ ok: true, value: [] }) },
    }))
    equal('params store: a revision conflict retries against the fresh revision',
      await store.write('ns', [{ op: 'set', path: ['a'], value: 1 }], 1), { ok: true })
    equal('params store: the retry went out with the re-read revision', calls, [1, 2])
  }
  equal('params store: no settings face fails the write softly',
    await new ParamsStore(() => null).write('ns', [], 1),
    { ok: false, conflict: false, message: 'settings are unavailable' })

  // --- the settings faces are RESOLVED per read, not captured at activation ---
  // Remote namespaces are mounted by their owners when those owners activate
  // (DESIGN §2.2), so `ctx.get('remote.settings')` at THIS plugin's activation
  // can honestly be "not yet". Captured once, that ordering became permanent and
  // was then reported to the user as a fact about the deployment: "this
  // deployment mounts no settings service", with every write refused. The
  // CapabilityStore already took a resolver for exactly this reason; these pin
  // that ParamsStore does too.
  {
    const settings = {
      describe: async () => ({
        ok: true,
        value: { writable: true, namespaces: [{ ns: 'ns', revision: 4, value: { a: 1 } }] },
      }),
      mutate: async (ns) => ({ ok: true, value: { ns, revision: 5, value: {} } }),
    }
    const llm = { listConfigurableProviders: async () => ({ ok: true, value: [] }) }
    // Not mounted yet when the store is built — the race.
    let mounted = false
    const store = new ParamsStore(() => (mounted ? { settings, llm } : null))

    store.ensure()
    await settle()
    equal('params store: an unmounted settings face reads as unavailable, not as an error',
      store.getSnapshot().status, 'unavailable')

    // The namespaces mount; the user opens the menu and the panel.
    mounted = true
    await store.refresh()
    await settle()
    equal('params store: the panel recovers once the faces mount (no permanent "no settings service")',
      store.getSnapshot().status, 'ready')
    equal('params store: and the namespaces it read are the ones now mounted',
      Object.keys(store.getSnapshot().namespaces), ['ns'])
    equal('params store: a write works through the late-mounted face',
      await store.write('ns', [{ op: 'set', path: ['a'], value: 2 }], 4), { ok: true })

    // The negative case must still hold: a deployment that never mounts them
    // keeps reporting exactly that.
    const none = new ParamsStore(() => null)
    none.ensure()
    await settle()
    equal('params store: a deployment that mounts none is still reported as unavailable',
      none.getSnapshot().status, 'unavailable')
  }
  // A model an adapter published nothing about yields NO facts rather than an
  // empty fact set, which would read as "this model takes nothing".
  equal('capabilities: a model with no published fact is not indexed',
    routeCapabilityOf({ id: 'm', name: 'M' }), null)
  equal('capabilities: an empty modality list is not a fact',
    routeCapabilityOf({ id: 'm', inputModalities: [] }), null)
  equal('capabilities: a useless window is dropped and the rest is kept',
    routeCapabilityOf({ id: 'm', contextWindow: 0, maxTokens: 4096 }), { maxTokens: 4096 })

  // The copy that reaches a user must not name internals they cannot act on.
  const jargon = panelLines.filter(text => text !== null && /Host|适配器内置目录的模型|走会话选择/.test(text))
  equal('panel copy: no line talks about internals instead of the user\'s options', jargon, [])
} finally {
  rmSync(work, { recursive: true, force: true })
}

console.log(failures === 0 ? 'params unit: all good' : `params unit: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
