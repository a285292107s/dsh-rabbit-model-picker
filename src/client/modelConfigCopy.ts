/**
 * The 模型配置 tab's copy, in both languages, as data.
 *
 * WHAT THIS MODULE IS FOR. The tab ADR 0003 adds is a parallel, full-parity
 * surface, so almost every string it renders is taken verbatim from the official
 * Models page. `KEYS` is the CONTRACT the page (W4) and the drawer (W5) import:
 * those files are written against the key names below, so a key that is renamed
 * after this file lands is a breaking change, not a copy edit.
 *
 * WHERE THE WORDS COME FROM. The official page's dictionaries are the source:
 * `dsh-client-ui-settings-models/lib/client.js:3228-3363` (en) and `:3364-3500`
 * (zh). Each group below names the official key it was copied from, so a reviewer
 * can diff this file against that one instead of re-translating. Forty-five keys have
 * no official counterpart — the official page has no such control, word or surface —
 * and each is marked AUTHORED in place:
 *
 *   1. `config.nav` / `config.title`: ours is a NEW tab, and 模型 / Models is the
 *      official page's own name (it keeps it);
 *   2. `config.key.replace`: the official card always draws the key field, so it
 *      never needs a "replace" verb (A6: a stored secret is never echoed);
 *   3. `config.reasoning.off`: the official page renders the raw level id `off`.
 *      `Off` is the protocol's own name, so it is identical in both dictionaries;
 *   4. `config.account.signedOut` and the four `config.verdict.*` words: the
 *      official row states a credential DOT and never a word (`client.js:2574-
 *      2578`), so a row's state has no official vocabulary. The words chosen here
 *      carry one discipline: the host has NO enable/disable action (feasibility
 *      §7.5), a provider's "state" is the existence of its profile and whether its
 *      route is registered, so a row reads 可用 / 缺密钥 / 未注册 / 不可用 and never
 *      已停用 / Disabled, which would claim an action that does not exist.
 *   5. `config.summary.ready` / `.attention` / `.none`: the ready statement counts
 *      the rows' own state, and the official page has no counting sentence to
 *      copy. They REPLACE `config.intro` (official `intro`), whose generic
 *      "enter your API keys" line stated nothing the ten rows did not already
 *      state; see `docs/design-model-config-tab.md` §11.
 *   6. `config.fetch.count`: the official discovery panel renders the fetched set
 *      as-is and never counts it, so this counting sentence is ours. The drawer
 *      prints it above the candidate list, and its `{inCatalog}` placeholder is
 *      deliberately not called `{present}` — that name belongs to the row hook
 *      `data-present` on the same list.
 *   7. `config.key.clear`: the official card draws no clear entry at all, and the
 *      row needs one that is not the provider's lifecycle verb: 删除 removes the
 *      provider profile, while this clears the credential the row stores.
 *   8. the seventeen `config.retryPolicy.*`: the retry editor moved INTO this page's
 *      rows (it used to be a card in the official Models section, which had no
 *      editor vocabulary of its own either), so the trigger word, the two field
 *      labels and units, the doubling rule that replaces the deleted bar chart,
 *      the recovery sentence (which states that the Chinese rate-limit wording the
 *      shipped classifier leaves terminal is retried on the same settings), the
 *      two schedule figures, the declared/inherited state, the reset verb, the
 *      saved line, the two validation sentences and the read-only notice are all
 *      ours. `config.apply` / `config.applying` are reused rather than repeated.
 *   9. §5.35's eleven: the ledger row's one door (`config.manage`), the settings
 *      well's three field names and its short credential words (凭据 /
 *      已配置 / 未配置 / 由账号提供 / 替换 / 清除 / 填写密钥), the model cell's count
 *      and its 默认 word, and the retry field's 修改 verb. Each exists because the
 *      row stopped carrying five controls and became a scan line plus a well;
 *      none of these words is the official page's, which edits in place.
 *  10. §5.36's four: the drawer roster's two short capacity names (上下文 / 输出),
 *      its "使用默认容量" sentence for a model with no overrides, and the "新模型"
 *      placeholder a just-added row states before it has an id.
 *
 * ZH IS THE KEY-SET SOURCE OF TRUTH, the convention `dictionary.ts:18` states.
 * `KEYS` is written once and both dictionaries are typed `Record<ConfigKey,
 * string>`, so `tsc` refuses a dictionary that misses a key or carries one `KEYS`
 * does not name. `scripts/test-model-config-copy.mjs` re-checks both directions at
 * runtime, plus non-empty values and identical interpolation placeholders per key.
 *
 * THE LOCALE FACE MAY BE ABSENT. This plugin is external, so it still renders when
 * the locale service is not there to bind a namespace. {@link configTranslate} is
 * the page's entry point: it prefers the seat's translator and falls back to the
 * local one when the seat is missing OR answers with the key itself (which is what
 * a face without this namespace does). The local one reads `<html lang>` and
 * treats a missing or empty language signal as Chinese, so a surface with no
 * locale face at all renders the source-of-truth dictionary rather than raw keys.
 *
 * @module dsh-rabbit-model-picker/client/modelConfigCopy
 */

import { interpolate, NS } from './dictionary.ts'
import type { Translate } from './contract.ts'

// The namespace is the plugin's own (`dictionary.ts:16`), NOT a second one: the
// seat's `locale.bind(NS)` must reach both dictionaries through one registration.
export { interpolate, NS }

/**
 * Every key this module defines, as a self-mapping table.
 *
 * The page imports this instead of spelling key strings, so a typo is a compile
 * error (`KEYS['config.titel']`) rather than a raw key on screen. The table is
 * also the key-set source of truth the two dictionaries are typed against.
 *
 * Official source keys are named per group in the comments.
 */
export const KEYS = {
  // --- page chrome ----------------------------------------------------------
  // AUTHORED: ours is the new parallel tab; the official `nav`/`title` are
  // 模型 / Models and stay with the official page.
  'config.nav': 'config.nav',
  // AUTHORED, same reason (the official page separates nav from title too).
  'config.title': 'config.title',
  // AUTHORED, all three: the ready statement `.dmc-readout` counts the rows' own
  // `data-state` — the page's one live sentence — and the official page has no
  // counting sentence to copy. They REPLACE `config.intro` (official `intro`
  // :3232/:3369), retired with the rewrite because "enter your API keys" stated
  // nothing the ten rows did not already state. `{count}` / `{issues}` follow the
  // existing `{name}` interpolation habit. See `docs/design-model-config-tab.md` §11.
  'config.summary.ready': 'config.summary.ready',
  'config.summary.attention': 'config.summary.attention',
  'config.summary.none': 'config.summary.none',
  // Official: onboardingTitle :3357/:3494. Q13 does NOT copy the official
  // onboarding CARD; this is the page-top hint that replaces it, and its wording
  // is the official sentence rather than a new one.
  'config.empty.title': 'config.empty.title',
  // Official: onboardingDescription :3358/:3495.
  'config.empty.description': 'config.empty.description',
  // Official: loadFailed :3260/:3397.
  'config.loadFailed': 'config.loadFailed',
  // Official: retry :3262/:3399.
  'config.retry': 'config.retry',
  // Official: readOnly :3259/:3396.
  'config.readOnly': 'config.readOnly',
  // Official: conflict :3261/:3398. Host verbatim, so its zh says 「这张卡片」; the
  // official sentence assumes the official card, and D1 applies it to OUR row or
  // drawer. Kept verbatim on purpose — if the surface word must change, it changes
  // here, once, and the gate stays green.
  'config.conflict': 'config.conflict',

  // --- provider row: auto-retry policy --------------------------------------
  // AUTHORED, all sixteen: the official Models page has no retry-policy editor,
  // so this vocabulary is ours. It arrived with the retry EDITOR, which used to be
  // a card in the official page and now opens inline under this page's own row
  // (docs/design-model-config-tab.md): the trigger word, the two field labels and
  // their units, the doubling rule that replaces the deleted bar chart, the two
  // figures that state the schedule (first wait / longest total), the
  // declared-versus-inherited state, the reset verb, the saved line, the two
  // validation sentences and the read-only notice. `{count}` is the only
  // placeholder any of them takes. Save / saving are deliberately NOT repeated
  // here — the editor reuses `config.apply` / `config.applying`.
  'config.retryPolicy.trigger': 'config.retryPolicy.trigger',
  // AUTHORED (§5.35): the settings well states 自动重试 as a labelled FIELD, so the
  // action inside it cannot repeat the field's own name — it says 修改 / Edit and
  // the editor below it states the policy in force.
  'config.retryPolicy.edit': 'config.retryPolicy.edit',
  'config.retryPolicy.retries': 'config.retryPolicy.retries',
  'config.retryPolicy.retriesUnit': 'config.retryPolicy.retriesUnit',
  'config.retryPolicy.cap': 'config.retryPolicy.cap',
  'config.retryPolicy.capUnit': 'config.retryPolicy.capUnit',
  'config.retryPolicy.doubling': 'config.retryPolicy.doubling',
  'config.retryPolicy.recovery': 'config.retryPolicy.recovery',
  'config.retryPolicy.declared': 'config.retryPolicy.declared',
  'config.retryPolicy.inherits': 'config.retryPolicy.inherits',
  'config.retryPolicy.first': 'config.retryPolicy.first',
  'config.retryPolicy.total': 'config.retryPolicy.total',
  'config.retryPolicy.always': 'config.retryPolicy.always',
  'config.retryPolicy.reset': 'config.retryPolicy.reset',
  'config.retryPolicy.saved': 'config.retryPolicy.saved',
  'config.retryPolicy.badRetries': 'config.retryPolicy.badRetries',
  'config.retryPolicy.badCap': 'config.retryPolicy.badCap',
  'config.retryPolicy.unavailable': 'config.retryPolicy.unavailable',

  // --- provider row: identity and credential --------------------------------
  // Official: provider :3250/:3387.
  'config.provider.label': 'config.provider.label',
  // Official: deepSeekAccount :3230/:3367.
  'config.account.name': 'config.account.name',
  // Official: accountSignedIn :3258/:3395.
  'config.account.signedIn': 'config.account.signedIn',
  // AUTHORED: the same account row when the session is NOT signed in. The official
  // page only ever draws the signed-in state, so it has no word for the other one.
  'config.account.signedOut': 'config.account.signedOut',

  // --- provider row: the verdict word ---------------------------------------
  // AUTHORED, all four: the official row states a credential DOT and never a word
  // (`client.js:2574-2578`), so this vocabulary is ours. It states the host's own
  // facts instead of inventing an action: `ready` = can serve requests,
  // `missingKey` = the named/derived reference has no value, `dormant` = the
  // route's live/dormant state (CONTEXT.md「休眠提供商」, the host's own word
  // `dormant`), `unavailable` = the catch-all. 已停用 / Disabled is FORBIDDEN here:
  // the host has no enable/disable action at all (`docs/settings-models-tab-
  // feasibility.md` §7.5), so that word would claim an action that does not exist.
  'config.verdict.ready': 'config.verdict.ready',
  'config.verdict.missingKey': 'config.verdict.missingKey',
  'config.verdict.dormant': 'config.verdict.dormant',
  'config.verdict.unavailable': 'config.verdict.unavailable',

  // Official: credentialConfigured :3256/:3393.
  'config.credential.configured': 'config.credential.configured',
  // Official: credentialMissing :3257/:3394.
  'config.credential.missing': 'config.credential.missing',
  // AUTHORED (§5.35): the row's settings well states the credential as ONE short
  // word beside its two actions, because the field's own label already says 凭据.
  // The long official sentences above would repeat that label as a sentence.
  'config.credential.configuredShort': 'config.credential.configuredShort',
  'config.credential.missingShort': 'config.credential.missingShort',
  // AUTHORED (§5.35): the label of that field in the settings well — the well is a
  // three-field form (凭据 / API 协议 / 自动重试), so each field needs a name.
  'config.credential.label': 'config.credential.label',
  // AUTHORED (§5.35): the session route is the one row whose credential comes from
  // the signed-in account instead of a key this page could write.
  'config.credential.session': 'config.credential.session',
  // Official: keyInput :3263/:3400. Also the label of the replace entry, which is
  // the field the official card always shows.
  'config.key.input': 'config.key.input',
  // AUTHORED: the entry that replaces a stored key. The official card has no such
  // verb because its field is always on screen; A6 needs one, because ours shows
  // status only until the user asks to replace.
  'config.key.replace': 'config.key.replace',
  // AUTHORED (brief §14 D1): the credential cell's own clear verb. Without it the
  // row stated 删除 twice — once here (clear the stored key) and once for the
  // provider's lifecycle (delete its profile) — and a reviewer read that as a
  // duplicated delete entry. No placeholder.
  'config.key.clear': 'config.key.clear',
  // AUTHORED (§5.35): the SHORT verbs of the settings well, where the field label
  // (凭据) already names the object, so 替换 API 密钥 / 清除密钥 would repeat it. The
  // long forms above stay: the drawer and the row's own aria labels still use them.
  'config.key.replaceShort': 'config.key.replaceShort',
  'config.key.clearShort': 'config.key.clearShort',
  // AUTHORED (§5.35): the credential field's PRIMARY action on a row that owes a
  // key — the only place this page asks for a value rather than reporting one.
  'config.key.add': 'config.key.add',
  // Official: keyReveal :3264/:3401.
  'config.key.reveal': 'config.key.reveal',
  // Official: keyHide :3265/:3402.
  'config.key.hide': 'config.key.hide',
  // Official: keyPlaceholder :3266/:3403.
  'config.key.placeholder': 'config.key.placeholder',
  // Official: keyPlaceholderFallback :3267/:3404. `{hint}` is the env var name.
  'config.key.placeholderFallback': 'config.key.placeholderFallback',
  // Official: keyPlaceholderSaved :3268/:3405.
  'config.key.placeholderSaved': 'config.key.placeholderSaved',
  // Official: keyFallbackDetected :3270/:3407. `{hint}`.
  'config.key.fallbackDetected': 'config.key.fallbackDetected',
  // Official: keyFallbackDetectedHidden :3271/:3408.
  'config.key.fallbackDetectedHidden': 'config.key.fallbackDetectedHidden',
  // Official: keyFallbackMissing :3269/:3406. `{hint}`.
  'config.key.fallbackMissing': 'config.key.fallbackMissing',
  // Official: keyFallbackUnchecked :3272/:3409.
  'config.key.fallbackUnchecked': 'config.key.fallbackUnchecked',
  // Official: keyHelp :3273/:3410. `{env}` is the ordered fallback list.
  'config.key.help': 'config.key.help',
  // Official: keyBlank :3312/:3449.
  'config.key.blank': 'config.key.blank',
  // Official: keyBlankNew :3313/:3450.
  'config.key.blankNew': 'config.key.blankNew',
  // Official: keyIllegalCharacters :3314/:3451.
  'config.key.illegal': 'config.key.illegal',
  // Official: authHelp :3274/:3411.
  'config.authHelp': 'config.authHelp',

  // --- endpoint and protocol -------------------------------------------------
  // Official: baseUrl :3276/:3413.
  'config.baseUrl.label': 'config.baseUrl.label',
  // Official: baseUrlDefault :3277/:3414.
  'config.baseUrl.default': 'config.baseUrl.default',
  // Official: baseUrlEnvironment :3278/:3415. `{env}`.
  'config.baseUrl.environment': 'config.baseUrl.environment',
  // Official: baseUrlConfigured :3279/:3416.
  'config.baseUrl.configured': 'config.baseUrl.configured',
  // Official: baseUrlPlaceholder :3280/:3417. `{url}`: the current value.
  'config.baseUrl.placeholder': 'config.baseUrl.placeholder',
  // Official: customBaseUrlInvalid :3346/:3483.
  'config.baseUrl.invalid': 'config.baseUrl.invalid',
  // Official: customNeedsBaseUrl :3345/:3482.
  'config.baseUrl.required': 'config.baseUrl.required',
  // Official: customBaseUrlPlaceholder :3348/:3485.
  'config.baseUrl.placeholderGateway': 'config.baseUrl.placeholderGateway',
  // Official: customAnthropicBaseUrlPlaceholder :3349/:3486.
  'config.baseUrl.placeholderAnthropic': 'config.baseUrl.placeholderAnthropic',
  // Official: customApi :3340/:3477.
  'config.api.label': 'config.api.label',
  // Official: customApiUnset :3341/:3478.
  'config.api.unset': 'config.api.unset',
  // Official: protocolOpenAiCompletions :3342/:3479.
  'config.api.openaiCompletions': 'config.api.openaiCompletions',
  // Official: protocolOpenAiResponses :3343/:3480.
  'config.api.openaiResponses': 'config.api.openaiResponses',
  // Official: protocolAnthropicMessages :3344/:3481.
  'config.api.anthropicMessages': 'config.api.anthropicMessages',

  // --- hand-declared provider (custom model API) -----------------------------
  // Official: customRoute :3335/:3472.
  'config.route.label': 'config.route.label',
  // Official: customRouteHint :3336/:3473.
  'config.route.hint': 'config.route.hint',
  // Official: customRouteInvalid :3337/:3474.
  'config.route.invalid': 'config.route.invalid',
  // Official: customRouteTaken :3338/:3475.
  'config.route.taken': 'config.route.taken',
  // Official: customDisplayName :3339/:3476.
  'config.route.displayName': 'config.route.displayName',
  // Official: customNeedsModels :3347/:3484.
  'config.route.needsModels': 'config.route.needsModels',
  // Official: create :3351/:3488.
  'config.route.create': 'config.route.create',
  // Official: creating :3352/:3489.
  'config.route.creating': 'config.route.creating',

  // --- provider lifecycle ----------------------------------------------------
  // Official: add :3242/:3379.
  'config.add': 'config.add',
  // Official: addMode :3243/:3380.
  'config.add.mode': 'config.add.mode',
  // Official: addCatalog :3244/:3381.
  'config.add.catalog': 'config.add.catalog',
  // Official: addCustom :3245/:3382.
  'config.add.custom': 'config.add.custom',
  // Official: addCatalogHint :3246/:3383.
  'config.add.catalogHint': 'config.add.catalogHint',
  // Official: addCustomHint :3247/:3384.
  'config.add.customHint': 'config.add.customHint',
  // Official: addCatalogExhausted :3248/:3385.
  'config.add.catalogExhausted': 'config.add.catalogExhausted',
  // Official: addCustomUnavailable :3249/:3386.
  'config.add.customUnavailable': 'config.add.customUnavailable',
  // Official: edit :3233/:3370.
  'config.edit': 'config.edit',
  // AUTHORED (§5.35): the row's one door. The official page edits providers inside
  // a card that is always open; this page keeps the ledger scan line clean and
  // opens the row's settings well from this one word, which is why it needs a
  // word of its own rather than reusing 编辑 (that verb is for a field value).
  'config.manage': 'config.manage',
  // Official: editProvider :3234/:3371. `{provider}`.
  'config.editProvider': 'config.editProvider',
  // Official: remove :3235/:3372.
  'config.remove': 'config.remove',
  // Official: removeProvider :3236/:3373. `{provider}`.
  'config.removeProvider': 'config.removeProvider',
  // Official: deleteTitle :3237/:3374. `{provider}`.
  'config.delete.title': 'config.delete.title',
  // Official: deleteDescription :3238/:3375. `{provider}`.
  'config.delete.description': 'config.delete.description',
  // Official: deleteDescriptionWithCredential :3239/:3376. The 「连带删除 API
  // 密钥」 branch (B3): the row may delete the stored key too. `{provider}`.
  'config.delete.descriptionWithCredential': 'config.delete.descriptionWithCredential',
  // Official: deleteConfirm :3240/:3377. `{provider}`.
  'config.delete.confirm': 'config.delete.confirm',
  // Official: deleting :3241/:3378. `{provider}`.
  'config.deleting': 'config.deleting',
  // Official: apply :3253/:3390 (zh 保存).
  'config.apply': 'config.apply',
  // Official: applying :3254/:3391 (zh 保存中…).
  'config.applying': 'config.applying',
  // Official: cancel :3252/:3389.
  'config.cancel': 'config.cancel',
  // Official: close :3251/:3388.
  'config.close': 'config.close',
  // Official: savedProvider :3255/:3392. `{provider}`.
  'config.savedProvider': 'config.savedProvider',
  // Official: customized :3275/:3412.
  'config.customized': 'config.customized',
  // Official: customTag :3334/:3471.
  'config.customTag': 'config.customTag',

  // --- model catalog (the drawer) --------------------------------------------
  // Official: models :3283/:3420 (zh 模型目录).
  'config.models.label': 'config.models.label',
  // Official: modelsInherited :3284/:3421.
  'config.models.inherited': 'config.models.inherited',
  // AUTHORED (§5.35): the scan line's model cell states the provider's OWN catalog
  // size, and a provider with none inherits the adapter's list — the long official
  // sentence above would not fit a 64px column, so the cell says 默认 / Default and
  // the button's title carries the full sentence. `{count}`.
  'config.models.count': 'config.models.count',
  'config.models.default': 'config.models.default',
  // Official: modelsCustomized :3285/:3422.
  'config.models.customized': 'config.models.customized',
  // Official: modelsEmpty :3311/:3448.
  'config.models.empty': 'config.models.empty',
  // Official: resetModels :3286/:3423 (zh 恢复默认模型).
  'config.models.reset': 'config.models.reset',
  // Official: model :3287/:3424.
  'config.model.label': 'config.model.label',
  // Official: modelAdvanced :3295/:3432.
  'config.model.advanced': 'config.model.advanced',
  // Official: modelInputTypes :3296/:3433.
  'config.model.inputTypes': 'config.model.inputTypes',
  // Official: modelInputText :3297/:3434.
  'config.model.inputText': 'config.model.inputText',
  // Official: modelInputImage :3298/:3435.
  'config.model.inputImage': 'config.model.inputImage',
  // Official: addModel :3309/:3446.
  'config.model.add': 'config.model.add',
  // Official: removeModel :3310/:3447.
  'config.model.remove': 'config.model.remove',
  // Official: modelId :3288/:3425.
  'config.model.id': 'config.model.id',
  // Official: modelName :3289/:3426.
  'config.model.name': 'config.model.name',
  // Official: modelNamePlaceholder :3290/:3427.
  'config.model.namePlaceholder': 'config.model.namePlaceholder',
  // Official: contextWindow :3291/:3428.
  'config.model.contextWindow': 'config.model.contextWindow',
  // Official: contextWindowPlaceholder :3292/:3429 (使用提供商默认值).
  'config.model.contextWindowPlaceholder': 'config.model.contextWindowPlaceholder',
  // Official: maxTokens :3293/:3430 (最大输出 token 数).
  'config.model.maxTokens': 'config.model.maxTokens',
  // Official: maxTokensPlaceholder :3294/:3431 (使用提供商默认值).
  'config.model.maxTokensPlaceholder': 'config.model.maxTokensPlaceholder',
  // AUTHORED (§5.36): the drawer is a ROSTER now — one line per model — so the two
  // capacity overrides are stated as facts beside the model, with these two short
  // field names instead of the official eight-character labels. `{value}` is the
  // stored draft literal ("1M", "128K"), shown as typed because this page never
  // parses a capacity it is only carrying.
  'config.model.contextShort': 'config.model.contextShort',
  'config.model.outputShort': 'config.model.outputShort',
  // AUTHORED (§5.36): both overrides empty means "use the provider's capacity", and
  // the roster line says so once instead of leaving the fact line blank.
  'config.model.capacityDefault': 'config.model.capacityDefault',
  // AUTHORED (§5.36): a model row added but not named yet still needs an identity on
  // its roster line; this is that placeholder word, not a field label.
  'config.model.newLabel': 'config.model.newLabel',

  // --- model validation ------------------------------------------------------
  // Official: modelIdRequired :3315/:3452. `validateModels` -> 'idEmpty'
  // (see VALIDATION_KEYS).
  'config.model.idRequired': 'config.model.idRequired',
  // Official: modelIdDuplicate :3316/:3453. `validateModels` -> 'idDuplicate'.
  'config.model.idDuplicate': 'config.model.idDuplicate',
  // Official: modelNameInvalid :3317/:3454.
  'config.model.nameInvalid': 'config.model.nameInvalid',
  // Official: modelContextInvalid :3318/:3455.
  'config.model.contextWindowInvalid': 'config.model.contextWindowInvalid',
  // Official: modelMaxTokensInvalid :3319/:3456.
  'config.model.maxTokensInvalid': 'config.model.maxTokensInvalid',
  // Official: modelCapacityInvalid :3321/:3458.
  'config.model.capacityInvalid': 'config.model.capacityInvalid',
  // Official: modelDuplicate :3322/:3459. Distinct from modelIdDuplicate: the
  // official page states the rule in two places and both strings exist.
  'config.model.duplicate': 'config.model.duplicate',

  // --- reasoning levels ------------------------------------------------------
  // Official: modelReasoning :3299/:3436.
  'config.reasoning.label': 'config.reasoning.label',
  // Official: modelReasoningLevel :3300/:3437.
  'config.reasoning.level': 'config.reasoning.level',
  // Official: modelReasoningValue :3301/:3438.
  'config.reasoning.value': 'config.reasoning.value',
  // Official: modelReasoningHelp :3302/:3439.
  'config.reasoning.help': 'config.reasoning.help',
  // Official: modelReasoningHelpText :3303/:3440.
  'config.reasoning.helpText': 'config.reasoning.helpText',
  // Official: modelReasoningNeedsLevel :3304/:3441. Validation one of two (C3).
  'config.reasoning.needsLevel': 'config.reasoning.needsLevel',
  // Official: modelReasoningValueRequired :3305/:3442. Validation two of two.
  'config.reasoning.valueRequired': 'config.reasoning.valueRequired',
  // Official: modelReasoningAdd :3306/:3443.
  'config.reasoning.add': 'config.reasoning.add',
  // Official: modelReasoningRemove :3307/:3444.
  'config.reasoning.remove': 'config.reasoning.remove',
  // AUTHORED: the wire level id the official page renders raw (`'off'` in its
  // source, `client.js:266`). A protocol name, not a translation — identical in
  // both dictionaries on purpose.
  'config.reasoning.off': 'config.reasoning.off',
  // Official: modelReasoningOffValuePlaceholder :3308/:3445 (关闭思考).
  'config.reasoning.offPlaceholder': 'config.reasoning.offPlaceholder',

  // --- model discovery -------------------------------------------------------
  // Official: fetchModels :3323/:3460 (获取可用模型).
  'config.fetch.action': 'config.fetch.action',
  // Official: fetching :3324/:3461 (正在询问提供商…).
  'config.fetch.fetching': 'config.fetch.fetching',
  // Official: fetchNeedsBaseUrl :3325/:3462.
  'config.fetch.needsBaseUrl': 'config.fetch.needsBaseUrl',
  // Official: fetchEmpty :3326/:3463.
  'config.fetch.empty': 'config.fetch.empty',
  // Official: fetchTitle :3327/:3464 (选择要添加的模型).
  'config.fetch.title': 'config.fetch.title',
  // Official: fetchDescription :3328/:3465.
  'config.fetch.description': 'config.fetch.description',
  // Official: fetchSearch :3329/:3466.
  'config.fetch.search': 'config.fetch.search',
  // Official: fetchNoMatches :3330/:3467.
  'config.fetch.noMatches': 'config.fetch.noMatches',
  // Official: fetchSelectAll :3331/:3468.
  'config.fetch.selectAll': 'config.fetch.selectAll',
  // Official: fetchDeselectAll :3332/:3469.
  'config.fetch.deselectAll': 'config.fetch.deselectAll',
  // Official: fetchAdopt :3333/:3470 (添加所选).
  'config.fetch.adopt': 'config.fetch.adopt',
  // AUTHORED (brief §13.2): the discovery list prints one counting sentence for the
  // whole candidate set. `{count}` is the candidate total, `{inCatalog}` the number
  // already in the catalog. The placeholder is `{inCatalog}` on purpose — NOT
  // `{present}`, which would collide with the `data-present` row hook the same
  // list uses for its per-row state.
  'config.fetch.count': 'config.fetch.count',
} as const

/** Any key this module defines. */
export type ConfigKey = keyof typeof KEYS

/**
 * The copy key for each reason `validateModels` can return.
 *
 * `modelConfigModel.ts` gates a catalog on exactly two structural failures, and a
 * union alone would let the caller forget one: this table makes the mapping total,
 * so adding a reason without copy is a compile error at the data layer's edge.
 */
export const VALIDATION_KEYS: Record<'idEmpty' | 'idDuplicate', ConfigKey> = {
  idEmpty: KEYS['config.model.idRequired'],
  idDuplicate: KEYS['config.model.idDuplicate'],
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<ConfigKey, string> = {
  'config.nav': '模型配置',
  'config.title': '模型配置',
  'config.summary.ready': '{count} 个提供商，全部可用',
  'config.summary.attention': '{count} 个提供商可用，{issues} 个需要处理',
  'config.summary.none': '尚未添加任何提供商',
  'config.empty.title': '添加一个 API Key 开始使用',
  'config.empty.description': '配置 DeepSeek 官方模型，即可开始使用。',
  'config.loadFailed': '加载提供商目录失败',
  'config.retry': '重试',
  'config.readOnly': '当前部署的设置文档为只读。',
  'config.conflict': '这张卡片打开期间，这些设置已被其他地方改动。请关闭后重新打开，在当前值上编辑。',

  // AUTHORED (see the KEYS group above): the inline auto-retry editor's whole
  // vocabulary. Same order as `KEYS` and `en`, key for key.
  'config.retryPolicy.trigger': '自动重试',
  'config.retryPolicy.edit': '修改',
  'config.retryPolicy.retries': '重试次数',
  'config.retryPolicy.retriesUnit': '次',
  'config.retryPolicy.cap': '间隔上限',
  'config.retryPolicy.capUnit': '秒',
  'config.retryPolicy.doubling': '每次等待翻倍，直到触达上限。',
  'config.retryPolicy.recovery': '中文限流文案（如「请求过于频繁」）也按这里设置重试。',
  'config.retryPolicy.declared': '已单独设置',
  'config.retryPolicy.inherits': '使用默认值',
  'config.retryPolicy.first': '首次等待 {count}',
  'config.retryPolicy.total': '最长合计 {count}',
  'config.retryPolicy.always': '此提供商设为无限重试，次数不影响它。',
  'config.retryPolicy.reset': '恢复默认',
  'config.retryPolicy.saved': '已保存',
  'config.retryPolicy.badRetries': '请输入 0 到 {count} 之间的整数。',
  'config.retryPolicy.badCap': '请输入 0.5 到 {count} 之间的秒数。',
  'config.retryPolicy.unavailable': '此部署已只读，无法修改重试设置。',

  'config.provider.label': '提供商',
  'config.account.name': 'DeepSeek 账号',
  'config.account.signedIn': '已登录',
  'config.account.signedOut': '会话未登录',
  'config.verdict.ready': '可用',
  'config.verdict.missingKey': '缺密钥',
  'config.verdict.dormant': '未注册',
  'config.verdict.unavailable': '不可用',
  'config.credential.configured': 'API 密钥已配置',
  'config.credential.missing': 'API 密钥缺失',
  'config.credential.configuredShort': '已配置',
  'config.credential.missingShort': '未配置',
  'config.credential.label': '凭据',
  'config.credential.session': '由账号提供',
  'config.key.input': 'API 密钥',
  'config.key.replace': '替换 API 密钥',
  'config.key.clear': '清除密钥',
  'config.key.replaceShort': '替换',
  'config.key.clearShort': '清除',
  'config.key.add': '填写密钥',
  'config.key.reveal': '显示密钥',
  'config.key.hide': '隐藏密钥',
  'config.key.placeholder': '输入 API 密钥',
  'config.key.placeholderFallback': '留空使用环境认证（{hint}）',
  'config.key.placeholderSaved': '留空使用已保存凭据',
  'config.key.fallbackDetected': '已检测到环境变量（{hint}）',
  'config.key.fallbackDetectedHidden': '已检测到环境变量',
  'config.key.fallbackMissing': '未检测到环境变量。请填写 API 密钥，或设置环境变量 {hint}。',
  'config.key.fallbackUnchecked': '环境凭据状态尚未确认',
  'config.key.help': '优先使用已保存的凭据。此处显示的环境后备按以下顺序排列：{env}。来源依次为启动环境、$cwd/.env、$DSH_HOME/.env。',
  'config.key.blank': '请输入 API 密钥；留空则保持已存储的密钥。',
  'config.key.blankNew': '请输入 API 密钥；若该提供商以其他方式鉴权，可以留空。',
  'config.key.illegal': '该 API 密钥格式错误，请检查。',
  'config.authHelp': '认证说明',

  'config.baseUrl.label': 'API 地址',
  'config.baseUrl.default': '没有默认地址',
  'config.baseUrl.environment': '提供方地址配置：{env}',
  'config.baseUrl.configured': '由提供方配置地址',
  'config.baseUrl.placeholder': '{url}',
  'config.baseUrl.invalid': '请输入有效的 HTTP 或 HTTPS 地址。',
  'config.baseUrl.required': '自定义模型 API 需要填写 API 地址。',
  'config.baseUrl.placeholderGateway': 'https://gateway.example/v1',
  'config.baseUrl.placeholderAnthropic': 'https://gateway.example',
  'config.api.label': 'API 协议',
  'config.api.unset': '未选择',
  'config.api.openaiCompletions': 'OpenAI Chat Completions',
  'config.api.openaiResponses': 'OpenAI Responses',
  'config.api.anthropicMessages': 'Anthropic Messages',

  'config.route.label': 'Provider ID',
  'config.route.hint': '以小写字母开头的标识，在请求中唯一标识该提供商，并用于派生凭据名。',
  'config.route.invalid': '需以小写字母开头，之后可用小写字母、数字和短横线。',
  'config.route.taken': '已有提供商使用了这个 ID。',
  'config.route.displayName': '显示名称',
  'config.route.needsModels': '自定义模型 API 至少需要一个模型。',
  'config.route.create': '创建提供商',
  'config.route.creating': '创建中…',

  'config.add': '添加模型提供商',
  'config.add.mode': '添加方式',
  'config.add.catalog': '第三方模型提供商',
  'config.add.custom': '自定义模型 API',
  'config.add.catalogHint': '从内置目录中选择 OpenAI、Anthropic、Kimi 等提供商，填入其 API 密钥即可使用。',
  'config.add.customHint': '连接中转站、自部署服务或其他兼容 OpenAI / Anthropic 协议的接口，需填写 API 地址、协议和模型。',
  'config.add.catalogExhausted': '目录中的提供商都已添加。',
  'config.add.customUnavailable': '没有可用的 API 协议。',
  'config.edit': '编辑',
  'config.manage': '管理',
  'config.editProvider': '编辑 {provider}',
  'config.remove': '删除',
  'config.removeProvider': '删除 {provider}',
  'config.delete.title': '删除 {provider}？',
  'config.delete.description': '删除 {provider} 会移除其配置；其使用的凭证（如有）由其他位置管理，将会保留。',
  'config.delete.descriptionWithCredential': '删除 {provider} 会移除其配置和存储的 API 密钥。',
  'config.delete.confirm': '删除 {provider}',
  'config.deleting': '正在删除 {provider}…',
  'config.apply': '保存',
  'config.applying': '保存中…',
  'config.cancel': '取消',
  'config.close': '关闭',
  'config.savedProvider': '已保存 {provider}。',
  'config.customized': '自定义设置',
  'config.customTag': '自定义',

  'config.models.label': '模型目录',
  'config.models.inherited': '正在使用适配器默认模型',
  'config.models.count': '{count} 个模型',
  'config.models.default': '默认',
  'config.models.customized': '已自定义模型目录',
  'config.models.empty': '模型选择器中将不显示任何模型；目录外 ID 仍可直接发送。',
  'config.models.reset': '恢复默认模型',
  'config.model.label': '模型',
  'config.model.advanced': '模型选项',
  'config.model.inputTypes': '输入类型',
  'config.model.inputText': '文本',
  'config.model.inputImage': '图片',
  'config.model.add': '添加模型',
  'config.model.remove': '删除模型',
  'config.model.id': '模型 ID',
  'config.model.name': '显示名称',
  'config.model.namePlaceholder': '留空时使用模型 ID',
  'config.model.contextWindow': '上下文窗口',
  'config.model.contextWindowPlaceholder': '使用提供商默认值',
  'config.model.maxTokens': '最大输出 token 数',
  'config.model.maxTokensPlaceholder': '使用提供商默认值',
  'config.model.contextShort': '上下文',
  'config.model.outputShort': '输出',
  'config.model.capacityDefault': '使用默认容量',
  'config.model.newLabel': '新模型',

  'config.model.idRequired': '模型 ID 不能为空。',
  'config.model.idDuplicate': '模型 ID 不能重复。',
  'config.model.nameInvalid': '显示名称不能为空。',
  'config.model.contextWindowInvalid': '上下文窗口必须是正数，例如 131072、256K 或 1M。',
  'config.model.maxTokensInvalid': '最大输出 token 数必须是正数，例如 8192、64K 或 1M。',
  'config.model.capacityInvalid': '容量需为数字，可加 K 或 M 后缀。',
  'config.model.duplicate': '每个模型 ID 只能出现一次。',

  'config.reasoning.label': '推理等级',
  'config.reasoning.level': '档位',
  'config.reasoning.value': 'API 参数值',
  'config.reasoning.help': '推理等级说明',
  'config.reasoning.helpText': 'API 参数值会写入请求的推理强度字段（如 OpenAI 的 reasoning_effort），默认与档位名相同；如有不同，以模型提供商的 API 文档为准。Off 表示关闭思考，不需要填写参数值；配置中已写入的值会保留并发送。',
  'config.reasoning.needsLevel': '至少添加一个 Off 以外的档位；不需要思考请关闭推理等级。',
  'config.reasoning.valueRequired': 'Off 以外的档位都需要填写 API 参数值，且参数值不能为空字符串。',
  'config.reasoning.add': '添加档位',
  'config.reasoning.remove': '删除档位',
  'config.reasoning.off': 'Off',
  'config.reasoning.offPlaceholder': '关闭思考',

  'config.fetch.action': '获取可用模型',
  'config.fetch.fetching': '正在询问提供商…',
  'config.fetch.needsBaseUrl': '请先填写 API 地址，再获取。',
  'config.fetch.empty': '该提供商没有列出任何模型，请手动添加。',
  'config.fetch.title': '选择要添加的模型',
  'config.fetch.description': '以下是模型提供商的可用模型，勾选要添加的模型。',
  'config.fetch.search': '搜索模型',
  'config.fetch.noMatches': '没有匹配的模型。',
  'config.fetch.selectAll': '全选',
  'config.fetch.deselectAll': '取消全选',
  'config.fetch.adopt': '添加所选',
  'config.fetch.count': '共 {count} 个候选，其中 {inCatalog} 个已在目录里',
}

/** English dictionary, complete against the zh key set. */
export const en: Record<ConfigKey, string> = {
  'config.nav': 'Model configuration',
  'config.title': 'Model configuration',
  'config.summary.ready': '{count} providers, all usable',
  'config.summary.attention': '{count} usable, {issues} need attention',
  'config.summary.none': 'No providers added yet',
  'config.empty.title': 'Add an API key to get started',
  'config.empty.description': 'Configure the official DeepSeek provider to start building.',
  'config.loadFailed': 'Loading the provider directory failed',
  'config.retry': 'Retry',
  'config.readOnly': 'The settings document is read-only in this deployment.',
  'config.conflict': 'Someone else changed these settings while this card was open. Close it and reopen to edit the current values.',

  // AUTHORED (see the KEYS group above): the inline auto-retry editor's whole
  // vocabulary. Same order as `KEYS` and `zh`, key for key.
  'config.retryPolicy.trigger': 'Auto-retry',
  'config.retryPolicy.edit': 'Edit',
  'config.retryPolicy.retries': 'Retries',
  'config.retryPolicy.retriesUnit': 'times',
  'config.retryPolicy.cap': 'Wait cap',
  'config.retryPolicy.capUnit': 's',
  'config.retryPolicy.doubling': 'Each wait doubles until it reaches the cap.',
  'config.retryPolicy.recovery': 'Chinese rate-limit wording is retried on these settings too.',
  'config.retryPolicy.declared': 'Set here',
  'config.retryPolicy.inherits': 'Using defaults',
  'config.retryPolicy.first': 'first wait {count}',
  'config.retryPolicy.total': 'longest total {count}',
  'config.retryPolicy.always': 'This provider retries without limit; the count does not apply.',
  'config.retryPolicy.reset': 'Restore default',
  'config.retryPolicy.saved': 'Saved',
  'config.retryPolicy.badRetries': 'Enter a whole number between 0 and {count}.',
  'config.retryPolicy.badCap': 'Enter between 0.5 and {count} seconds.',
  'config.retryPolicy.unavailable': 'This deployment is read-only; retry settings cannot be changed.',

  'config.provider.label': 'Provider',
  'config.account.name': 'DeepSeek Account',
  'config.account.signedIn': 'Signed in',
  'config.account.signedOut': 'Not signed in',
  'config.verdict.ready': 'Ready',
  'config.verdict.missingKey': 'Missing key',
  'config.verdict.dormant': 'Not registered',
  'config.verdict.unavailable': 'Unavailable',
  'config.credential.configured': 'API key configured',
  'config.credential.missing': 'API key missing',
  'config.credential.configuredShort': 'Configured',
  'config.credential.missingShort': 'Not configured',
  'config.credential.label': 'Credential',
  'config.credential.session': 'Provided by your account',
  'config.key.input': 'API key',
  'config.key.replace': 'Replace API key',
  'config.key.clear': 'Clear key',
  'config.key.replaceShort': 'Replace',
  'config.key.clearShort': 'Clear',
  'config.key.add': 'Add key',
  'config.key.reveal': 'Show secret',
  'config.key.hide': 'Hide secret',
  'config.key.placeholder': 'Enter your API key',
  'config.key.placeholderFallback': 'Leave blank to use env as auth ({hint})',
  'config.key.placeholderSaved': 'Leave blank to use saved credentials',
  'config.key.fallbackDetected': 'Env var detected. ({hint})',
  'config.key.fallbackDetectedHidden': 'Env var detected.',
  'config.key.fallbackMissing': 'Env var not detected. Enter an API key, or configure {hint} in your env.',
  'config.key.fallbackUnchecked': 'Environment credential status has not been confirmed.',
  'config.key.help': 'Saved credentials are used first. Environment fallbacks shown here, in order: {env}. Sources are launch environment, $cwd/.env, then $DSH_HOME/.env.',
  'config.key.blank': 'Enter the API key, or leave the field empty to keep the stored one.',
  'config.key.blankNew': 'Enter the API key, or leave the field empty if this provider authenticates another way.',
  'config.key.illegal': 'This API key is not in a valid format. Please check it.',
  'config.authHelp': 'Authentication details',

  'config.baseUrl.label': 'Base URL',
  'config.baseUrl.default': 'No default endpoint',
  'config.baseUrl.environment': 'Provider endpoint configuration: {env}',
  'config.baseUrl.configured': 'Provider-configured endpoint',
  'config.baseUrl.placeholder': '{url}',
  'config.baseUrl.invalid': 'Enter a valid HTTP or HTTPS URL.',
  'config.baseUrl.required': 'A custom provider needs a base URL.',
  'config.baseUrl.placeholderGateway': 'https://gateway.example/v1',
  'config.baseUrl.placeholderAnthropic': 'https://gateway.example',
  'config.api.label': 'API protocol',
  'config.api.unset': 'Not selected',
  'config.api.openaiCompletions': 'OpenAI Chat Completions',
  'config.api.openaiResponses': 'OpenAI Responses',
  'config.api.anthropicMessages': 'Anthropic Messages',

  'config.route.label': 'Provider ID',
  'config.route.hint': 'Lowercase identifier, starting with a letter, that uniquely names this provider in requests and as its credential name.',
  'config.route.invalid': 'Start with a lowercase letter; then lowercase letters, digits, and dashes.',
  'config.route.taken': 'A provider already uses this ID.',
  'config.route.displayName': 'Display name',
  'config.route.needsModels': 'A custom provider needs at least one model.',
  'config.route.create': 'Create provider',
  'config.route.creating': 'Creating…',

  'config.add': 'Add model provider',
  'config.add.mode': 'How to add',
  'config.add.catalog': 'Third-party model provider',
  'config.add.custom': 'Custom model API',
  'config.add.catalogHint': 'Pick OpenAI, Anthropic, Kimi, or another provider from the built-in catalog and enter its API key.',
  'config.add.customHint': 'Connect a relay, a self-hosted server, or any other OpenAI- or Anthropic-compatible endpoint by its base URL, protocol, and models.',
  'config.add.catalogExhausted': 'Every catalog provider is already configured.',
  'config.add.customUnavailable': 'No API protocol is available to declare.',
  'config.edit': 'Edit',
  'config.manage': 'Manage',
  'config.editProvider': 'Edit {provider}',
  'config.remove': 'Delete',
  'config.removeProvider': 'Delete {provider}',
  'config.delete.title': 'Delete {provider}?',
  'config.delete.description': 'Deleting {provider} removes its configuration. Any credential it uses is managed elsewhere and will be kept.',
  'config.delete.descriptionWithCredential': 'Deleting {provider} removes its configuration and stored API key.',
  'config.delete.confirm': 'Delete {provider}',
  'config.deleting': 'Deleting {provider}…',
  'config.apply': 'Apply',
  'config.applying': 'Applying…',
  'config.cancel': 'Cancel',
  'config.close': 'Close',
  'config.savedProvider': 'Saved {provider}.',
  'config.customized': 'Customized settings',
  'config.customTag': 'Custom',

  'config.models.label': 'Models',
  'config.models.inherited': 'Using the adapter defaults',
  'config.models.count': '{count} models',
  'config.models.default': 'Default',
  'config.models.customized': 'Customized model catalog',
  'config.models.empty': 'No models will be shown in the selector. Unlisted IDs can still be sent directly.',
  'config.models.reset': 'Restore defaults',
  'config.model.label': 'Model',
  'config.model.advanced': 'Model options',
  'config.model.inputTypes': 'Input types',
  'config.model.inputText': 'Text',
  'config.model.inputImage': 'Image',
  'config.model.add': 'Add model',
  'config.model.remove': 'Delete model',
  'config.model.id': 'Model ID',
  'config.model.name': 'Display name',
  'config.model.namePlaceholder': 'Uses the model ID when empty',
  'config.model.contextWindow': 'Context window',
  'config.model.contextWindowPlaceholder': 'Uses the provider default',
  'config.model.maxTokens': 'Max output tokens',
  'config.model.maxTokensPlaceholder': 'Uses the provider default',
  'config.model.contextShort': 'Context',
  'config.model.outputShort': 'Output',
  'config.model.capacityDefault': 'Default capacity',
  'config.model.newLabel': 'New model',

  'config.model.idRequired': 'Model ID is required.',
  'config.model.idDuplicate': 'Model ID must be unique.',
  'config.model.nameInvalid': 'Display name cannot be empty.',
  'config.model.contextWindowInvalid': 'Context window must be a positive count, like 131072, 256K, or 1M.',
  'config.model.maxTokensInvalid': 'Max output tokens must be a positive count, like 8192, 64K, or 1M.',
  'config.model.capacityInvalid': 'A capacity must be a number, optionally suffixed K or M.',
  'config.model.duplicate': 'Each model ID may appear once.',

  'config.reasoning.label': 'Reasoning levels',
  'config.reasoning.level': 'Level',
  'config.reasoning.value': 'API value',
  'config.reasoning.help': 'About reasoning levels',
  'config.reasoning.helpText': 'The API value is sent in the request\'s reasoning-effort field, such as OpenAI\'s reasoning_effort. It defaults to the level name; where the model provider\'s API documentation specifies a different value, follow it. Off turns reasoning off and needs no value; a value already written in the configuration is kept and sent.',
  'config.reasoning.needsLevel': 'Add at least one level besides Off, or turn reasoning levels off.',
  'config.reasoning.valueRequired': 'Every level besides Off needs an API value, and no value can be empty.',
  'config.reasoning.add': 'Add level',
  'config.reasoning.remove': 'Delete level',
  'config.reasoning.off': 'Off',
  'config.reasoning.offPlaceholder': 'Turns reasoning off',

  'config.fetch.action': 'Fetch available models',
  'config.fetch.fetching': 'Asking the provider…',
  'config.fetch.needsBaseUrl': 'Enter the base URL first, then fetch.',
  'config.fetch.empty': 'The provider listed no models. Add them by hand.',
  'config.fetch.title': 'Choose models to add',
  'config.fetch.description': 'These are the models this provider has available. Choose the ones to add.',
  'config.fetch.search': 'Search models',
  'config.fetch.noMatches': 'No matching models.',
  'config.fetch.selectAll': 'Select all',
  'config.fetch.deselectAll': 'Deselect all',
  'config.fetch.adopt': 'Add selected',
  'config.fetch.count': '{count} candidates, {inCatalog} already in the catalog',
}

/** Dictionaries in the shape `locale.register(ns, { zh, en })` expects. */
export const dictionaries: Record<string, Record<string, string>> = { zh, en }

/** The zh dictionary widened for lookup by a key that arrived as a string. */
const zhTable: Record<string, string> = zh

/** The en dictionary widened for lookup by a key that arrived as a string. */
const enTable: Record<string, string> = en

/**
 * The language the host page declares, or null when there is no document.
 *
 * An empty `lang` reads as "no signal" rather than as a language: it is what a
 * document that never declared one looks like, and the fallback below decides.
 * @returns the declared language tag, or null.
 */
function documentLanguage(): string | null {
  if (typeof document === 'undefined') return null
  const language = document.documentElement.lang
  return language === '' ? null : language
}

/**
 * Render one key with the LOCAL dictionary, with no locale service at all.
 *
 * The lookup ladder is `declared language` -> `zh` -> the key itself. The last
 * rung is what makes a surface with no locale face readable instead of showing
 * `config.title`: `zh` is the key-set source of truth, so it is the one
 * dictionary guaranteed to have every key.
 * @param key - the dictionary key.
 * @param params - values for the `{name}` placeholders.
 * @returns the resolved text.
 */
export function t(key: string, params?: Record<string, string>): string {
  const language = documentLanguage()
  const table = language !== null && !language.toLowerCase().startsWith('zh') ? enTable : zhTable
  const template = table[key] ?? zhTable[key] ?? key
  return interpolate(template, params)
}

/**
 * The local translator as a `Translate`, for wiring that expects a factory.
 * @returns the translator {@link t} implements.
 */
export function localTranslate(): Translate {
  return t
}

/**
 * The page's translator: the seat's when it is there, the local one otherwise.
 *
 * A locale face is preferred, but a face is not proof that the copy exists: a
 * namespace that was never registered makes `bind` answer with the key itself,
 * and rendering `config.title` on screen is exactly the failure the local
 * dictionary exists to prevent. So an answer that EQUALS the key is treated as a
 * miss and re-resolved locally. (A face with a real translation for this
 * namespace always wins, including one that deliberately returns a key string as
 * its text — that combination cannot be told apart from a miss, and no surface
 * here wants it.)
 * @param face - the seat-bound translator, or undefined when there is no seat.
 * @returns the translator the surface should render through.
 */
export function configTranslate(face?: Translate): Translate {
  if (face === undefined) return t
  return (key, params) => {
    const text = face(key, params)
    return text === key ? t(key, params) : text
  }
}
