/**
 * Unit gates for the 模型配置 page's pure logic.
 *
 * WHY THESE ASSERTIONS EXIST. Every function under test mirrors a decision the
 * official Models page already made, and each one is invisible when it is wrong:
 * a join that drops dormant routes looks like "the provider isn't there"; a key
 * reference derived with the wrong rule stores the secret where nothing reads it;
 * and an op diff that emits a no-op write bumps the revision and so manufactures
 * the conflict the fence exists to catch. None of those surface as an error —
 * they surface as "the page is slightly wrong", which no screenshot catches.
 *
 * The key-reference and op-diff blocks compare against samples taken from the
 * official source (`dsh-client-ui-settings-models/lib/client.js:1230-1232` and
 * `:1822-1838`) so a drift between this re-derivation and the code that actually
 * reads those references fails here instead of on the user's next write.
 *
 * Run: node scripts/test-model-config.mjs
 *
 * @module dsh-rabbit-model-picker/test-model-config
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

const work = mkdtempSync(join(tmpdir(), 'dmp-config-'))
const outfile = join(work, 'model.mjs')

try {
  await build({
    stdin: {
      contents: "export * from './src/client/modelConfigModel.ts'",
      resolveDir: root,
      sourcefile: 'model-entry.ts',
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
    apiKeyEnvOf, credentialRefFor, deriveKeyRef, hasPath, isAdded, isRemovable,
    joinProviderDirectory, keyConfigured, keyRefOf, keyWritable, modelsOf,
    pathOps, protocolChoices, providerUsable, readPath, reasoningLevelChoices,
    retryCapable, validateModels,
  } = await import(pathToFileURL(outfile).href)

  console.log('\n# deriveKeyRef — the reference a typed key is stored under')
  // Samples mirror the official rule (uppercase, then each non-alphanumeric RUN
  // becomes one underscore). A wrong rule does not throw; it stores the secret
  // under a name no adapter reads, so these are pinned literally.
  equal('dots-ai', deriveKeyRef('dots-ai'), 'DOTS_AI_API_KEY')
  equal('opencode-go', deriveKeyRef('opencode-go'), 'OPENCODE_GO_API_KEY')
  equal('deepseek-account', deriveKeyRef('deepseek-account'), 'DEEPSEEK_ACCOUNT_API_KEY')
  equal('a route with spaces', deriveKeyRef('a route'), 'A_ROUTE_API_KEY')
  equal('already upper', deriveKeyRef('MINIMAX'), 'MINIMAX_API_KEY')
  // A RUN of separators collapses to ONE underscore, not one per character.
  equal('collapses a run', deriveKeyRef('a--b'), 'A_B_API_KEY')
  equal('digits survive', deriveKeyRef('gpt-5.6'), 'GPT_5_6_API_KEY')
  // Boundaries the first pass never covered, and they are genuinely surprising: a
  // LEADING or TRAILING separator each produce their own underscore, so a derived
  // reference can begin or end with one — and a name with no alphanumerics at all
  // collapses to a single underscore between two literals. Anything that ever
  // validates these names has to expect that.
  equal('leading+trailing separators each survive', deriveKeyRef('-lead-'), '_LEAD__API_KEY')
  equal('no alphanumerics at all', deriveKeyRef('\u6a21\u578b'), '__API_KEY')
  equal('the empty route', deriveKeyRef(''), '_API_KEY')

  console.log('\n# joinProviderDirectory — every catalog row gets a row')
  const directory = [
    { provider: 'zeta', displayName: 'Zeta', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'zeta'], active: false },
    { provider: 'deepseek-account', displayName: 'Account', settingsNs: '', settingsPath: [], active: true },
    { provider: 'alpha', displayName: 'Alpha', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'alpha'], active: false, error: 'boom' },
    { provider: 'deepseek-official', displayName: 'Official', settingsNs: 'llm-deepseek', settingsPath: [], active: true },
  ]
  const registered = [
    { id: 'zeta', name: 'Zeta Live' },
    { id: 'lonely-route', name: 'Lonely' },
  ]

  const joined = joinProviderDirectory(registered, directory)
  equal('account leads, then official, then the rest',
    joined.map(row => row.provider),
    ['deepseek-account', 'deepseek-official', 'zeta', 'alpha', 'lonely-route'])

  const zeta = joined.find(row => row.provider === 'zeta')
  const alpha = joined.find(row => row.provider === 'alpha')
  const lonely = joined.find(row => row.provider === 'lonely-route')

  check('a registered catalog route is active', zeta.active === true, zeta)
  check('a dormant catalog route still gets a row, marked inactive', alpha.active === false, alpha)
  check('the entry error survives the join', alpha.error === 'boom', alpha)
  check('a live route absent from the catalog is appended', lonely !== undefined, joined.map(r => r.provider))
  equal('the appended route carries no settings address', [lonely.settingsNs, lonely.settingsPath], ['', []])
  check('the appended route is active', lonely.active === true, lonely)

  console.log('\n# providerUsable — the three ways a provider owes no key')
  /** Build a row with the parts each usability branch reads. */
  function rowOf(overrides) {
    return {
      entry: {
        provider: 'x', displayName: 'X', settingsNs: 'llm-pi-ai',
        settingsPath: ['providers', 'x'], active: true,
      },
      configured: true, removable: false, apiKeyEnv: undefined,
      credential: undefined, firstRun: false,
      ...overrides,
    }
  }

  check('an inactive route cannot serve',
    providerUsable(rowOf({ entry: { ...rowOf({}).entry, active: false } })) === false)
  check('a profile naming no reference owes no key',
    providerUsable(rowOf({ apiKeyEnv: undefined })) === true)
  check('a profile naming a configured reference is usable',
    providerUsable(rowOf({ apiKeyEnv: 'X_API_KEY', credential: { configured: true, writable: true } })) === true)
  check('a profile naming an unconfigured reference is not usable',
    providerUsable(rowOf({ apiKeyEnv: 'X_API_KEY', credential: { configured: false, writable: true } })) === false)
  check('a named reference with no credential read at all is not usable',
    providerUsable(rowOf({ apiKeyEnv: 'X_API_KEY', credential: undefined })) === false)
  // The account route is a SESSION fact: it has no apiKeyEnv, so without this
  // branch it would fall through to the "owes no key" line and read usable while
  // the user is signed out.
  check('the account route is unusable while signed out',
    providerUsable(rowOf({
      entry: { ...rowOf({}).entry, provider: 'deepseek-account' },
      apiKeyEnv: undefined, accountAvailable: false,
    })) === false)
  check('the account route is usable while signed in',
    providerUsable(rowOf({
      entry: { ...rowOf({}).entry, provider: 'deepseek-account' },
      apiKeyEnv: undefined, accountAvailable: true,
    })) === true)

  console.log('\n# keyConfigured / keyWritable — named versus derived reference')
  check('named reference decides when present',
    keyConfigured(rowOf({ apiKeyEnv: 'X_API_KEY', credential: { configured: true, writable: false } })) === true)
  check('derived reference decides when the profile names none',
    keyConfigured(rowOf({ apiKeyEnv: undefined, derivedCredential: { configured: true, writable: true } })) === true)
  check('an unread named reference never falls back to the derived one',
    keyConfigured(rowOf({
      apiKeyEnv: 'X_API_KEY', credential: undefined,
      derivedCredential: { configured: true, writable: true },
    })) === false)
  check('writability is read separately from configuredness',
    keyWritable(rowOf({ apiKeyEnv: 'X_API_KEY', credential: { configured: true, writable: false } })) === false)

  console.log('\n# credentialRefFor — exactly one reference per row')
  equal('the named reference wins',
    credentialRefFor(rowOf({ apiKeyEnv: 'CUSTOM_KEY' })), 'CUSTOM_KEY')
  equal('the derived reference is the fallback',
    credentialRefFor(rowOf({ apiKeyEnv: undefined })), 'X_API_KEY')
  equal('a route with no settings address reads nothing',
    credentialRefFor(rowOf({
      entry: { provider: 'x', displayName: 'X', settingsNs: '', settingsPath: [], active: true },
      apiKeyEnv: undefined,
    })), undefined)

  console.log('\n# pathOps — only what moved, and unset what went away')
  equal('no change produces no op',
    pathOps(['providers', 'x'], { api: 'openai-completions' }, { api: 'openai-completions' }), [])
  equal('a changed field produces one set',
    pathOps(['providers', 'x'], { api: 'a' }, { api: 'b' }),
    [{ op: 'set', path: ['providers', 'x', 'api'], value: 'b' }])
  equal('a new field produces one set',
    pathOps(['providers', 'x'], {}, { models: [] }),
    [{ op: 'set', path: ['providers', 'x', 'models'], value: [] }])
  equal('a removed field produces one unset',
    pathOps(['providers', 'x'], { api: 'a', baseURL: 'u' }, { api: 'a' }),
    [{ op: 'unset', path: ['providers', 'x', 'baseURL'] }])
  // Equality is by JSON shape, not identity: a rebuilt draft with equal contents
  // must write nothing, or every save would bump the revision for no reason.
  equal('a deep-equal rebuild produces no op',
    pathOps(['p'], { models: [{ id: 'a' }] }, { models: [{ id: 'a' }] }), [])
  equal('a deep-equal nested change is detected',
    pathOps(['p'], { models: [{ id: 'a' }] }, { models: [{ id: 'b' }] }),
    [{ op: 'set', path: ['p', 'models'], value: [{ id: 'b' }] }])
  // The empty path addresses the section root: removing a whole profile.
  equal('an empty base addresses the root',
    pathOps([], undefined, { providers: {} }),
    [{ op: 'set', path: ['providers'], value: {} }])

  console.log('\n# readPath / hasPath — absent is ordinary, not an error')
  equal('reads through objects', readPath({ a: { b: 1 } }, ['a', 'b']), 1)
  equal('reads through arrays', readPath({ a: [{ b: 2 }] }, ['a', '0', 'b']), 2)
  equal('a missing step is undefined', readPath({ a: 1 }, ['a', 'b']), undefined)
  equal('walking into a scalar is undefined', readPath({ a: 1 }, ['a', 'b', 'c']), undefined)
  // hasPath exists for one reason: a key can EXIST while its value is null, and
  // presence is what decides whether a remove control appears. Asserting the read
  // value separately pins the difference rather than assuming it.
  check('hasPath sees a null field that readPath yields as null',
    hasPath({ a: null }, ['a']) === true && readPath({ a: null }, ['a']) === null)
  check('hasPath is false where readPath would also fail, but for the other reason',
    hasPath({ a: 1 }, ['b']) === false && readPath({ a: 1 }, ['b']) === undefined)
  check('hasPath is false for an absent field', hasPath({ a: 1 }, ['b']) === false)
  check('hasPath reads an array index', hasPath({ a: [1, 2] }, ['a', '1']) === true)
  check('hasPath is false past the end of an array', hasPath({ a: [1] }, ['a', '1']) === false)
  check('hasPath on the empty path tests the value itself',
    hasPath(undefined, []) === false && hasPath({}, []) === true)

  console.log('\n# isRemovable — the base layer is not the user’s to delete')
  check('user-only profile is removable',
    isRemovable({ ns: 'n', revision: 1, value: {}, user: { providers: { x: {} } } }, ['providers', 'x']) === true)
  check('base-layer profile is not removable',
    isRemovable({
      ns: 'n', revision: 1, value: {},
      user: { providers: { x: {} } }, base: { providers: { x: {} } },
    }, ['providers', 'x']) === false)
  check('a namespace that was never read removes nothing',
    isRemovable(undefined, ['providers', 'x']) === false)
  // An EMPTY path addresses the namespace ROOT, so "removing" it would unset the
  // whole namespace rather than one provider. The official page guards this too
  // (`entry.settingsPath.length > 0`); without the guard the row offers a delete
  // that would wipe every provider in the namespace at once.
  check('an empty path is never removable, even with a user layer present',
    isRemovable({ ns: 'n', revision: 1, value: {}, user: {} }, []) === false)

  console.log('\n# isAdded — what the page lists is "added", not "configured"')
  // The distinction is the whole point: the directory gives every servable
  // provider a row, so listing on `configured` alone would show dozens of
  // providers the user never added, and listing without the empty-path arm would
  // DROP the account route, which is live but has no profile to configure.
  check('a configured provider is listed', isAdded(true, ['providers', 'x']) === true)
  check('a catalog entry with an address and no profile is NOT listed',
    isAdded(false, ['providers', 'x']) === false)
  check('a live route with no settings address is listed',
    isAdded(false, []) === true)
  check('an empty path is listed even when it also reads configured',
    isAdded(true, []) === true)

  console.log('\n# apiKeyEnvOf / keyRefOf')
  equal('reads the named reference',
    apiKeyEnvOf({ providers: { x: { apiKeyEnv: 'MY_KEY' } } }, ['providers', 'x']), 'MY_KEY')
  equal('an empty string is not a reference',
    apiKeyEnvOf({ providers: { x: { apiKeyEnv: '' } } }, ['providers', 'x']), undefined)
  equal('a missing profile names nothing',
    apiKeyEnvOf({}, ['providers', 'x']), undefined)
  equal('keyRefOf prefers the named reference',
    keyRefOf(rowOf({ apiKeyEnv: 'NAMED' })), 'NAMED')
  equal('keyRefOf derives when the profile names none',
    keyRefOf(rowOf({ apiKeyEnv: undefined })), 'X_API_KEY')

  console.log('\n# modelsOf — an undeclared catalog is empty, not an error')
  equal('reads declared models in order',
    modelsOf({ providers: { x: { models: [{ id: 'a' }, { id: 'b', name: 'B' }] } } }, ['providers', 'x'])
      .map(model => model.id),
    ['a', 'b'])
  equal('a profile declaring no models reads as none',
    modelsOf({ providers: { x: {} } }, ['providers', 'x']), [])
  equal('a mistyped models field reads as none',
    modelsOf({ providers: { x: { models: 'nope' } } }, ['providers', 'x']), [])
  equal('entries without an id are skipped',
    modelsOf({ providers: { x: { models: [{ id: 'a' }, {}, { name: 'no id' }] } } }, ['providers', 'x'])
      .map(model => model.id),
    ['a'])

  console.log('\n# validateModels — the one structural rule')
  equal('a clean catalog validates',
    validateModels([{ id: 'a' }, { id: 'b' }]), undefined)
  equal('an empty id is refused at its index',
    validateModels([{ id: 'a' }, { id: '' }]), { index: 1, reason: 'idEmpty' })
  equal('a duplicate id is refused at the SECOND index',
    validateModels([{ id: 'a' }, { id: 'a' }]), { index: 1, reason: 'idDuplicate' })
  // TRIMMED BEFORE JUDGING, which is the official rule. Untrimmed, a pasted id
  // with a trailing space passes as "not empty" and hides the duplicate the paste
  // just created — and the adapter rejects it later, after the draft was accepted.
  equal('a whitespace-only id is refused',
    validateModels([{ id: '   ' }]), { index: 0, reason: 'idEmpty' })
  equal('a pasted id differing only by whitespace IS a duplicate',
    validateModels([{ id: 'a' }, { id: ' a ' }]), { index: 1, reason: 'idDuplicate' })

  console.log('\n# protocolChoices / reasoningLevelChoices — read from the serialized envelope')
  // THE FIXTURES ARE THE SERIALIZED ENVELOPE, NOT A NESTED OBJECT TREE.
  // A namespace's `schema` is `{ uid, refs }`: a node table addressed by NUMBER,
  // where every structural field — `dict` entries, `inner`, `sKey`, `list`
  // members — holds a ref id rather than a nested node.
  //
  // Every earlier revision of this gate built a nested tree, and so stayed GREEN
  // through six rounds of "fixed but still empty" on the real deployment: the gate
  // was measuring a shape that existed only inside the gate. That is the third
  // time in this work that the verification手段 rather than the code was wrong, so
  // the fixture now mirrors the wire form the page actually receives.
  const withRefs = (refs, uid = 1) =>
    ({ ns: 'llm-pi-ai', revision: 1, value: {}, schema: { uid, refs } })

  // `providers` is a DICT, and a dict's VALUE shape lives under `inner` — its
  // `sKey` is the KEY shape. So the profile is `refs[refs[root.dict.providers].inner]`,
  // which is also why no route key (and no `'\0probe'` sentinel) is needed at all.
  const profileRefs = (fields) => ({
    1: { type: 'object', dict: { providers: 2 } },
    2: { type: 'dict', inner: 3 },
    3: { type: 'object', dict: { ...fields } },
  })

  equal('protocols are read out of the serialized envelope, non-strings dropped',
    protocolChoices(withRefs({
      ...profileRefs({ api: 4 }),
      4: { type: 'union', list: [5, 6, 7] },
      5: { type: 'const', value: 'openai-completions' },
      6: { type: 'const', value: 'anthropic-messages' },
      7: { type: 'const', value: 42 },
    })), ['openai-completions', 'anthropic-messages'])

  // The levels live one level deeper than the protocols: profile → models (ARRAY,
  // whose `inner` is the element shape) → that element's `reasoningEfforts` (a
  // UNION) → its DICT branch → that dict's `sKey` list.
  equal('reasoning levels come from the union branch dict, through its sKey',
    reasoningLevelChoices(withRefs({
      ...profileRefs({ models: 4 }),
      4: { type: 'array', inner: 5 },
      5: { type: 'object', dict: { reasoningEfforts: 6 } },
      6: { type: 'union', list: [7, 8] },
      7: { type: 'const', value: false },
      8: { type: 'dict', sKey: 9 },
      9: { type: 'dict', list: [10, 11, 12] },
      10: { type: 'const', value: 'off' },
      11: { type: 'const', value: 'high' },
      12: { type: 'const', value: 'max' },
    })), ['off', 'high', 'max'])

  // Degenerate shapes: each must yield nothing rather than throwing, because a
  // malformed schema should cost the choices, not the surface.
  equal('a namespace with no schema offers no protocols',
    protocolChoices({ ns: 'n', revision: 1, value: {} }), [])
  equal('a namespace that was never read offers no protocols',
    protocolChoices(undefined), [])
  equal('an envelope whose root id is absent offers no protocols',
    protocolChoices(withRefs({}, 99)), [])
  equal('a profile that declares no api field offers no protocols',
    protocolChoices(withRefs(profileRefs({}))), [])
  equal('a union with no dict branch offers no levels',
    reasoningLevelChoices(withRefs({
      ...profileRefs({ models: 4 }),
      4: { type: 'array', inner: 5 },
      5: { type: 'object', dict: { reasoningEfforts: 6 } },
      6: { type: 'union', list: [7] },
      7: { type: 'const', value: false },
    })), [])
  // A DANGLING REF ID must drop out silently. This is the case the old reader got
  // wrong in the other direction (it dropped EVERYTHING), so it is pinned here.
  equal('a dangling ref id drops out instead of throwing',
    protocolChoices(withRefs({
      ...profileRefs({ api: 4 }),
      4: { type: 'union', list: [5, 999] },
      5: { type: 'const', value: 'openai-completions' },
    })), ['openai-completions'])
  equal('a node table that is not a record offers no protocols',
    protocolChoices({ ns: 'n', revision: 1, value: {}, schema: { uid: 1, refs: 'nope' } }), [])

  console.log('\n# retryCapable — the schema, not a list of adapter names, picks the editor')
  // WHY THIS IS A GATE AND NOT A ONE-LINE HELPER. The inline retry editor OFFERS A
  // WRITE, so it may exist exactly where the schema declares the field. One
  // provider too many and the Host refuses a write the user could see coming; one
  // too few and the official DeepSeek route has no editor at all — which is the
  // specific hole the move out of the keyed `settings.models.provider-card` seat
  // exists to close (that seat dispatched by `settingsNs`, so it could only ever
  // name ONE adapter family). Both halves of the boundary are pinned below.
  //
  // THE TWO FIXTURES ARE THE TWO REAL SHAPES:
  //   pi-ai     `providers` is a `z.dict(profile)` and `retryPolicy` is a field of
  //             the profile, so a route's path is `['providers', <route>]`;
  //   deepseek  the namespace ROOT is itself the profile and the path is `[]`.
  // One walk serves both because a `dict`/`array` node consumes its step as a KEY
  // and continues in its value shape (`inner`) — the "dict 再下钻" case, which is
  // exactly what makes the pi-ai shape work.
  const retryProfileRefs = (fields) => ({
    1: { type: 'object', dict: { providers: 2 } },
    2: { type: 'dict', inner: 3 },
    3: { type: 'object', dict: { ...fields } },
  })
  const retryPolicyShape = { 4: { type: 'object', dict: {} } }
  const piAi = withRefs({ ...retryProfileRefs({ retryPolicy: 4 }), ...retryPolicyShape })

  equal('through the providers dict, at the route path',
    retryCapable(piAi, ['providers', 'naizi']), true)
  // A path that walks PAST the profile into a field it does not declare is not
  // capable — the walk lands somewhere real and still finds no `retryPolicy`.
  equal('a path past the profile is not capable',
    retryCapable(piAi, ['providers', 'naizi', 'nope']), false)
  equal('a path whose first step is absent is not capable',
    retryCapable(piAi, ['notAProviderField']), false)

  // The official route: the namespace root IS the profile, so the empty path must
  // resolve to the root node rather than to nothing. This is the case the old
  // keyed seat could not express at all.
  const deepseek = withRefs({
    1: { type: 'object', dict: { retryPolicy: 2 } },
    2: { type: 'object', dict: {} },
  }, 1)
  equal('the root profile at the empty path is capable',
    retryCapable(deepseek, []), true)
  equal('the root profile without the field is not capable',
    retryCapable(withRefs({ 1: { type: 'object', dict: {} } }, 1), []), false)
  equal('a step off the root profile is not capable',
    retryCapable(deepseek, ['nope']), false)

  // An ARRAY consumes its step the same way, which is the `models` list's shape.
  equal('an array step lands on its element shape',
    retryCapable(withRefs({
      1: { type: 'object', dict: { models: 2 } },
      2: { type: 'array', inner: 3 },
      3: { type: 'object', dict: { retryPolicy: 4 } },
      4: { type: 'object', dict: {} },
    }), ['models', '0']), true)

  // FAIL CLOSED, the same discipline `protocolChoices` keeps: "cannot tell" is
  // false, because guessing true is what offers a write the schema would reject.
  equal('a profile with only api/models is not capable',
    retryCapable(withRefs(retryProfileRefs({ api: 4, models: 5 })), ['providers', 'naizi']), false)
  equal('a namespace with no schema is not capable',
    retryCapable({ ns: 'n', revision: 1, value: {} }, ['providers', 'naizi']), false)
  equal('a namespace that was never read is not capable',
    retryCapable(undefined, ['providers', 'naizi']), false)
  equal('an envelope whose root id is absent is not capable',
    retryCapable(withRefs({}, 99), ['providers', 'naizi']), false)
  equal('a node table that is not a record is not capable',
    retryCapable({ ns: 'n', revision: 1, value: {}, schema: { uid: 1, refs: 'nope' } }, ['providers', 'naizi']), false)
  // A DANGLING REF ID must drop out rather than throw, exactly as it does for the
  // protocol choices: the envelope is data from the Host, not a value this reader
  // may assume the shape of.
  equal('a dangling retryPolicy ref id reads as not capable',
    retryCapable(withRefs({
      ...retryProfileRefs({ retryPolicy: 999 }),
    }), ['providers', 'naizi']), false)
} finally {
  rmSync(work, { recursive: true, force: true })
}

console.log(`\n${failures === 0 ? 'all model-config checks passed' : `${failures} check(s) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
