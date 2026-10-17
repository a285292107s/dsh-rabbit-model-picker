/**
 * Unit gate for the 模型配置 tab's copy: two dictionaries, one key set.
 *
 * WHY THIS GATE EXISTS. Bilingual copy fails in ways a screenshot cannot show.
 * A key that exists in zh but not en renders the raw key in one language only; a
 * `{provider}` that was typed `{providerId}` in one dictionary renders the
 * placeholder itself; an empty string ships as a blank line; and a key renamed
 * after the page imported `KEYS` breaks the page silently, because `t()` still
 * returns SOMETHING. All four are asserted below.
 *
 * The KEY SET is the contract (ADR 0003: the tab is written against these names),
 * so the assertions are deliberately two-directional: zh missing an en key and en
 * carrying a key zh does not are separate failures, because they mean different
 * edits went wrong. Parity checklist E1 also promises the same key ORDER, so the
 * three tables are compared as ordered lists, not as sets.
 *
 * The reason union of `modelConfigModel.ts` is bundled in on purpose: the data
 * layer can return exactly `idEmpty` and `idDuplicate`, and this gate proves both
 * have copy, so a new reason cannot ship as an unstyled failure.
 *
 * Run: node scripts/test-model-config-copy.mjs
 *
 * @module dsh-rabbit-model-picker/test-model-config-copy
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

/**
 * The `{name}` placeholders one template interpolates, deduplicated and sorted.
 * @param text - the dictionary value.
 * @returns the placeholder names.
 */
function placeholdersOf(text) {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort()
}

const work = mkdtempSync(join(tmpdir(), 'dmp-config-copy-'))
const outfile = join(work, 'copy.mjs')

try {
  await build({
    stdin: {
      contents: [
        "export * from './src/client/modelConfigCopy.ts'",
        "export * from './src/client/modelConfigModel.ts'",
      ].join('\n'),
      resolveDir: root,
      sourcefile: 'config-copy-entry.ts',
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
    NS, KEYS, zh, en, dictionaries, VALIDATION_KEYS,
    t, localTranslate, configTranslate, validateModels,
  } = await import(pathToFileURL(outfile).href)

  const keys = Object.keys(KEYS)
  const zhKeys = Object.keys(zh)
  const enKeys = Object.keys(en)

  // --- the contract ---------------------------------------------------------
  equal('contract: KEYS is a self-mapping table',
    KEYS, Object.fromEntries(keys.map(key => [key, key])))
  equal('contract: KEYS names exactly the zh key set',
    [...keys].sort(), [...zhKeys].sort())
  equal('contract: the namespace is this plugin namespace, not a second one',
    NS, 'dsh-rabbit-model-picker')

  // --- parity: same keys, both directions, same order ------------------------
  const zhOnly = zhKeys.filter(key => !enKeys.includes(key)).sort()
  const enOnly = enKeys.filter(key => !zhKeys.includes(key)).sort()
  check('parity: zh defines no key en lacks', zhOnly.length === 0, { zhOnly })
  check('parity: en defines no key zh lacks', enOnly.length === 0, { enOnly })
  equal('parity: the two dictionaries define the same number of keys',
    [zhKeys.length, enKeys.length], [keys.length, keys.length])
  equal('parity: zh, en and KEYS share one key ORDER (E1: 同 key 同序)',
    [zhKeys.join('|'), enKeys.join('|')], [keys.join('|'), keys.join('|')])

  // --- every value carries copy ---------------------------------------------
  const blank = [...new Set([...zhKeys, ...enKeys])]
    .filter(key => (zh[key] ?? '').trim() === '' || (en[key] ?? '').trim() === '')
  check('copy: every value is non-empty in both languages', blank.length === 0, { blank })

  const chineseLeftInEnglish = enKeys.filter(key => /[\u3400-\u9fff\uf900-\ufaff]/.test(en[key]))
  check('copy: no English value was left in Chinese',
    chineseLeftInEnglish.length === 0, { chineseLeftInEnglish })

  // --- placeholders: same names, both languages ------------------------------
  const mismatched = keys
    .map(key => ({ key, zh: placeholdersOf(zh[key]), en: placeholdersOf(en[key]) }))
    .filter(entry => entry.zh.join('|') !== entry.en.join('|'))
  check('placeholders: both languages interpolate the same names per key',
    mismatched.length === 0, { mismatched })
  equal('placeholders: the whole vocabulary is {provider} {hint} {env} {url} {count} {issues} {inCatalog}',
    [...new Set(keys.flatMap(key => [...placeholdersOf(zh[key]), ...placeholdersOf(en[key])]))].sort(),
    ['count', 'env', 'hint', 'inCatalog', 'issues', 'provider', 'url'])

  // --- the local translator (no locale face, no document) --------------------
  equal('t: with no document it renders the zh dictionary, key for key',
    keys.map(key => t(key)), keys.map(key => zh[key]))
  check('t: no key ever renders as its own name',
    keys.every(key => t(key) !== key), { leaked: keys.filter(key => t(key) === key) })
  equal('t: one placeholder is interpolated',
    t('config.editProvider', { provider: 'anthropic' }), '编辑 anthropic')
  equal('t: a second sentence shape interpolates too',
    t('config.delete.title', { provider: 'anthropic' }), '删除 anthropic？')
  equal('t: the env hint lands inside the sentence',
    t('config.key.placeholderFallback', { hint: 'ANTHROPIC_API_KEY' }),
    '留空使用环境认证（ANTHROPIC_API_KEY）')
  equal('t: an unsupplied placeholder stays visible instead of vanishing',
    t('config.editProvider'), '编辑 {provider}')

  // --- language selection once a document exists -----------------------------
  globalThis.document = { documentElement: { lang: 'en-US' } }
  equal('t: an English document reads the en dictionary', t('config.retry'), 'Retry')
  equal('t: an English document interpolates through the en dictionary',
    t('config.editProvider', { provider: 'anthropic' }), 'Edit anthropic')
  globalThis.document.documentElement.lang = 'zh-CN'
  equal('t: a Chinese document reads the zh dictionary', t('config.retry'), '重试')
  globalThis.document.documentElement.lang = ''
  equal('t: an empty lang falls back to zh rather than leaking a key',
    t('config.retry'), '重试')
  delete globalThis.document

  // --- the locale-face entry point -------------------------------------------
  equal('configTranslate: no face at all means the local translator',
    configTranslate()('config.retry'), '重试')
  equal('configTranslate: a face that lacks this namespace falls back to local copy',
    configTranslate(key => key)('config.retry'), '重试')
  equal('configTranslate: a face that has the key wins',
    configTranslate(key => (key === 'config.retry' ? 'RETRY-FROM-FACE' : key))('config.retry'),
    'RETRY-FROM-FACE')
  equal('configTranslate: placeholders still resolve through the local fallback',
    configTranslate(key => key)('config.apply'), '保存')
  equal('localTranslate: the factory shape `locale.bind` returns',
    localTranslate()('config.apply'), '保存')

  // --- the shape locale.register takes ---------------------------------------
  check('dictionaries: the { zh, en } shape `locale.register(ns, …)` expects',
    Object.keys(dictionaries).sort().join(',') === 'en,zh'
      && Object.keys(dictionaries.zh).length === keys.length
      && Object.keys(dictionaries.en).length === keys.length,
    { top: Object.keys(dictionaries), zh: Object.keys(dictionaries.zh).length })

  // --- the data layer's two reasons ------------------------------------------
  equal('validation: validateModels still returns exactly the two gated reasons',
    [validateModels([{ id: '' }])?.reason, validateModels([{ id: 'a' }, { id: 'a' }])?.reason],
    ['idEmpty', 'idDuplicate'])
  equal('validation: each reason maps to a defined key',
    [Object.keys(VALIDATION_KEYS).sort(), Object.values(VALIDATION_KEYS).every(key => keys.includes(key))],
    [['idDuplicate', 'idEmpty'], true])
  equal('validation: the reason copy is the official wording',
    [t(VALIDATION_KEYS.idEmpty), t(VALIDATION_KEYS.idDuplicate)],
    ['模型 ID 不能为空。', '模型 ID 不能重复。'])

  // --- the row verdict words, and the one vocabulary they must avoid ---------
  // The host has NO enable/disable action (feasibility §7.5): a provider's state
  // is whether its profile exists and whether its route is registered. A word like
  // 已停用 / Disabled would claim an action that does not exist — a lie on screen —
  // so the WHOLE dictionary is swept for it, not only the keys added for it.
  const claimsAnAction = keys.filter(key => /停用|禁用/.test(zh[key]) || /disabled/i.test(en[key]))
  check('verdict: no key claims an enable/disable action the host does not have',
    claimsAnAction.length === 0, { claimsAnAction })
  equal('verdict: the four row verdicts are single words in both languages',
    ['config.verdict.ready', 'config.verdict.missingKey', 'config.verdict.dormant', 'config.verdict.unavailable']
      .map(key => [zh[key], en[key]]),
    [['可用', 'Ready'], ['缺密钥', 'Missing key'], ['未注册', 'Not registered'], ['不可用', 'Unavailable']])
  equal('verdict: the account row states its signed-out half too',
    [zh['config.account.signedOut'], en['config.account.signedOut']],
    ['会话未登录', 'Not signed in'])

  // --- the concepts the task requires, by name -------------------------------
  // The concepts the task requires, by name. `config.intro` was REPLACED by the
  // three `config.summary.*` sentences (brief §8 as amended by §13.2): the generic
  // "enter your API keys" line stated nothing the ten rows did not already state,
  // and the ready statement is the page's one live sentence. `config.fetch.count`
  // joins them because the 396-candidate discovery list has to state a real count.
  const required = [
    'config.title', 'config.loadFailed', 'config.retry', 'config.readOnly',
    'config.empty.title',
    'config.summary.ready', 'config.summary.attention', 'config.summary.none',
    'config.provider.label', 'config.credential.configured', 'config.credential.missing',
    'config.account.signedOut',
    'config.verdict.ready', 'config.verdict.missingKey', 'config.verdict.dormant',
    'config.verdict.unavailable',
    'config.key.replace', 'config.key.placeholder', 'config.key.placeholderFallback',
    // The credential-clear entry's own word (§16/V2): the lifecycle entry next to it
    // already says 删除 / Delete, and two destructive entries with one name is the
    // reading the juror reported. Its difference from `config.remove` is asserted in
    // the static selfcheck as well; this list is what keeps the key from vanishing.
    'config.key.clear',
    'config.key.fallbackDetected', 'config.key.fallbackMissing', 'config.api.label',
    'config.add', 'config.add.catalog', 'config.add.custom', 'config.remove',
    'config.delete.title', 'config.delete.descriptionWithCredential',
    'config.apply', 'config.applying', 'config.cancel', 'config.edit',
    'config.models.label', 'config.model.add', 'config.model.remove', 'config.model.id',
    'config.model.name', 'config.model.contextWindow', 'config.model.maxTokens',
    'config.model.contextWindowPlaceholder', 'config.model.maxTokensPlaceholder',
    'config.reasoning.label', 'config.reasoning.level', 'config.reasoning.value',
    'config.reasoning.add', 'config.reasoning.remove', 'config.reasoning.off',
    'config.reasoning.needsLevel', 'config.reasoning.valueRequired',
    'config.fetch.action', 'config.fetch.fetching', 'config.fetch.empty',
    'config.fetch.title', 'config.fetch.adopt', 'config.fetch.needsBaseUrl',
    'config.fetch.count',
    'config.model.idRequired', 'config.model.idDuplicate', 'config.model.nameInvalid',
  ]
  const uncovered = required.filter(key => !keys.includes(key))
  check('coverage: every concept the task names has a key', uncovered.length === 0, { uncovered })
} finally {
  rmSync(work, { recursive: true, force: true })
}

console.log(failures === 0 ? 'model config copy unit: all good' : `model config copy unit: ${failures} failure(s)`)
process.exitCode = failures > 0 ? 1 : 0
