/**
 * Gate: the COMMITTED `lib/` must match what `src/` currently builds.
 *
 * `lib/` is committed because git installs
 * (`github:a285292107s/dsh-rabbit-model-picker`) receive the repository verbatim and run
 * no build step. That makes staleness a *distribution* defect, not a local
 * inconvenience: ship an out-of-date `lib/` and every user's install imports the
 * previous behaviour — or, if `lib/` is missing entirely, fails with
 * "failed to import" and the seat silently never appears.
 *
 * The check builds HEAD's SOURCE and compares the result against HEAD's
 * ARTIFACT — the pair a git install actually receives — so it fails on shipped
 * drift without touching the working tree, and without caring where in the
 * pipeline it runs. `npm test` happens to run `npm run build` first; this gate
 * no longer notices, because the build's output is not what it judges. A tree
 * that is merely half-edited (new `src/`, `lib/` not yet rebuilt) therefore does
 * NOT fail it: that state is not what anyone installs. Commit both together and
 * the gate follows.
 *
 * Run: node scripts/check-build-fresh.mjs
 *
 * @module dsh-rabbit-model-picker/check-build-fresh
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Must stay identical to the list in {@link module:dsh-rabbit-model-picker/build-client}. */
const BASELINE_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/dsh-client-ui-primitives',
]

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const CLIENT_ID = String(pkg.name)

const failures = []
const check = (label, ok, detail) => {
  if (!ok) failures.push(`${label}${detail === undefined ? '' : ` — ${detail}`}`)
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`)
}

/** Rebuild both halves in memory, exactly as build-client.mjs does.
 * @param srcRoot - directory holding the `src/` tree to build (the working tree,
 *   or an extraction of HEAD).
 */
async function renderBuild(srcRoot = root) {
  // `absWorkingDir` matters even though every entry point is absolute: esbuild
  // writes each module's path into a `// src/…` banner comment RELATIVE to the
  // working directory, and the committed artifact carries the repository-relative
  // spelling. Without this, building from the temp extraction emitted
  // `// ../../AppData/Local/Temp/dmp-fresh-XXXX/src/index.ts`, so the gate
  // reported drift on every coherent commit. Identical bytes are the whole
  // precondition for comparing two artifacts by string equality.
  const host = await build({
    entryPoints: [resolve(srcRoot, 'src/index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
    packages: 'external',
    write: false,
    absWorkingDir: srcRoot,
  })
  const client = await build({
    entryPoints: [resolve(srcRoot, 'src/client/index.ts')],
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    target: 'es2022',
    charset: 'utf8',
    external: BASELINE_EXTERNALS,
    write: false,
    absWorkingDir: srcRoot,
  })
  const factory = [
    'var module = { exports: {} }; var exports = module.exports;',
    client.outputFiles[0].text,
    'return module.exports;',
  ].join('\n')
  const wrapped =
    `window.__ModuleLoader__.load({\n` +
    `  id: ${JSON.stringify(CLIENT_ID)},\n` +
    `  factory: (require) => {\n` +
    factory.split('\n').map((line) => `    ${line}`).join('\n') +
    `\n  },\n` +
    `});\n`
  return { host: host.outputFiles[0].text, client: wrapped }
}

/**
 * Extract the committed `src/` tree into a temp directory.
 *
 * The gate builds HEAD's SOURCE and compares against HEAD's ARTIFACT, and it
 * needs the sources on disk to bundle them. `git archive` rather than a working
 * tree copy, because the working tree is exactly what must NOT influence this
 * comparison — see the module note.
 * @returns the directory containing `src/`, or null when git/HEAD is unavailable.
 */
function extractCommittedSource() {
  const dir = mkdtempSync(join(tmpdir(), 'dmp-fresh-'))
  try {
    // `tsconfig.json` is part of the build INPUT, not decoration: esbuild
    // discovers it from the entry point to decide the JSX mode, and
    // `"jsx": "react-jsx"` is what makes the bundle import `react/jsx-runtime`.
    // Extracting `src/` alone silently fell back to CLASSIC JSX — 116
    // `createElement` calls, zero `jsx-runtime` imports, ~6KB smaller — so the
    // gate compared a coherent commit against the wrong artifact and reported
    // drift that did not exist.
    const tar = execFileSync('git', ['archive', '--format=tar', 'HEAD', 'src', 'tsconfig.json'], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
    })
    execFileSync('tar', ['-x', '-C', dir], { input: tar, maxBuffer: 64 * 1024 * 1024 })
    return dir
  } catch {
    rmSync(dir, { recursive: true, force: true })
    return null
  }
}

/**
 * Read one path as a git install would receive it: the COMMITTED blob.
 *
 * `git show HEAD:<path>` and not the working tree, and that distinction is the
 * whole gate. A git install (`github:…`) receives the repository verbatim, so
 * the pair that matters is (committed `src/`, committed `lib/`) — the working
 * tree is not distributed at all.
 *
 * Reading the working tree made this gate vacuously true under `npm test`, which
 * runs `npm run build` FIRST: the build rewrote `lib/`, the gate then compared
 * that fresh output against itself, and a commit whose `lib/` had never been
 * rebuilt passed with exit 0. (Measured: a deliberately stale `lib/client.js` —
 * 3171 lines, no `dmp-rail` in it — sailed through the full `npm test` while the
 * standalone gate failed it correctly.) Judging the commit also makes the gate
 * ORDER-INDEPENDENT, and independent of whatever is half-edited on disk.
 * @param path - repository-relative artifact path.
 * @returns the committed text, or null when the commit does not carry it.
 */
function readCommittedArtifact(path) {
  try {
    return execFileSync('git', ['show', `HEAD:${path}`], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}

/** Whether one path is committed at `HEAD`.
 *
 * A path that exists on disk but is not tracked ships as nothing, so
 * tracked-ness is part of the artifact being installable at all.
 * @param path - repository-relative artifact path.
 * @returns whether the commit carries it.
 */
function isCommitted(path) {
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${path}`], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    return true
  } catch {
    return false
  }
}

const ARTIFACTS = [
  ['lib/index.js (host)', 'host', 'lib/index.js'],
  ['lib/client.js (browser)', 'client', 'lib/client.js'],
]

// --- the embedded design system and face, as COMMITTED ----------------------
// §8 of docs/endfield-design-language.md puts the token layer and the embedded
// Latin face into the shipped artifact: `designSystem.ts` is imported by the
// client entry and `fontAsset.ts` is a generated 46.7KB base64 payload inside it.
// The generic equality above already notices a stale `lib/`, but it reports a
// 110-line bundle diff, not "the face is not in the build". These assertions name
// the two modules and their three independent byte counts, and prove the
// committed artifact actually carries them.
const FONT_ASSET = 'src/client/fontAsset.ts'
const DESIGN_SYSTEM = 'src/client/designSystem.ts'
const OFL_LICENSE = 'docs/fonts/Archivo-OFL.txt'

/**
 * The reviewable facts of the generated font asset.
 * @param source - fontAsset.ts's text.
 * @returns family, base64, the three byte counts and the provenance.
 */
function fontFactsOf(source) {
  const base64 = /export const FONT_WOFF2_BASE64 = "([A-Za-z0-9+/=]+)"/.exec(source)?.[1] ?? null
  const decoded = base64 === null ? null : Buffer.from(base64, 'base64')
  return {
    family: /export const FONT_FAMILY = "([^"]+)"/.exec(source)?.[1] ?? null,
    base64,
    decoded,
    bytes: decoded === null ? NaN : decoded.length,
    headerBytes: Number.parseInt(/Raw woff2: (\d+) bytes/.exec(source)?.[1] ?? 'NaN', 10),
    provenanceBytes: Number.parseInt(/"bytes": (\d+)/.exec(source)?.[1] ?? 'NaN', 10),
    license: /"license": "([^"]+)"/.exec(source)?.[1] ?? null,
    source: /"source": "([^"]+)"/.exec(source)?.[1] ?? null,
    magic: decoded === null ? '' : decoded.slice(0, 4).toString('latin1'),
  }
}

/**
 * The font contract, on whichever text pair is available.
 * @param fontSource - fontAsset.ts's text.
 * @param licenseText - the OFL notice's text (or '' when missing).
 * @returns one problem per violated fact.
 */
function fontProblems(fontSource, licenseText) {
  const facts = fontFactsOf(fontSource)
  const problems = []
  if (facts.family !== 'ZMD Archivo') problems.push(`FONT_FAMILY is ${facts.family}`)
  if (facts.base64 === null) problems.push('FONT_WOFF2_BASE64 is missing')
  else if (facts.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(facts.base64)) {
    problems.push('FONT_WOFF2_BASE64 is not valid base64')
  }
  if (!(facts.bytes <= 64 * 1024)) problems.push(`the woff2 is ${facts.bytes} bytes (budget 64KB)`)
  if (facts.magic !== 'wOF2') problems.push('the payload does not start with the wOF2 magic')
  if (facts.headerBytes !== facts.bytes) problems.push(`header says ${facts.headerBytes} bytes, decoded ${facts.bytes}`)
  if (facts.provenanceBytes !== facts.bytes) problems.push(`provenance says ${facts.provenanceBytes} bytes, decoded ${facts.bytes}`)
  if (facts.license !== 'SIL Open Font License 1.1') problems.push(`license is ${facts.license}`)
  if (facts.source === null || !/^https:\/\/raw\.githubusercontent\.com\/google\/fonts\//.test(facts.source)) {
    problems.push(`source is ${facts.source}`)
  }
  if (!licenseText.includes('SIL OPEN FONT LICENSE')) problems.push('the OFL notice is missing its header')
  if (!/Copyright/.test(licenseText)) problems.push('the OFL notice is missing the copyright line')
  return { facts, problems }
}

/** The markers a built client must carry for the ink design system to be installed. */
const DESIGN_MARKERS = [
  'injectDesignSystem', '@font-face', '--zmd-panel', '--zmd-hover', '--zmd-line-control',
  '--zmd-wash-top', '--zmd-wash-bottom', '--zmd-accent', '--zmd-on-accent',
  '.zmd-wash', '.zmd-grain',
]

// What a git install receives: HEAD's sources built, compared to HEAD's files.
const committedSrc = extractCommittedSource()
if (committedSrc === null) {
  // No git or no commits (a tarball checkout): fall back to the working tree, so
  // the suite still runs — but say so, because this is the weaker comparison.
  console.log('  note freshness: no HEAD to judge; comparing the working tree instead')
  const rendered = await renderBuild()
  for (const [artifact, key, path] of ARTIFACTS) {
    check(`${artifact} matches src/`, readFileSync(resolve(root, path), 'utf8') === rendered[key],
      'stale: run `npm run build` and commit lib/ with the src/ change')
  }
  const workingFont = readFileSync(resolve(root, FONT_ASSET), 'utf8')
  const workingLicense = readFileSync(resolve(root, OFL_LICENSE), 'utf8')
  const working = fontProblems(workingFont, workingLicense)
  check('font: the working-tree face passes its byte-count/OFL contract', working.problems.length === 0,
    working.problems.join('; '))
} else {
  try {
    const rendered = await renderBuild(committedSrc)
    for (const [artifact, key, path] of ARTIFACTS) {
      if (!isCommitted(path)) {
        check(
          `${artifact} is committed`,
          false,
          `${path} is not in HEAD — a git install has no entry point`,
        )
        continue
      }
      check(`${artifact} is committed`, true)
      check(
        `${artifact} matches the committed src/`,
        readCommittedArtifact(path) === rendered[key],
        'stale: the committed lib/ was not rebuilt from the committed src/ — run `npm run build`, '
        + 'then `git add lib` and commit it together with the src/ change',
      )
    }

    // --- the committed design system and face -------------------------------
    const committedFont = readCommittedArtifact(FONT_ASSET)
    const committedDesign = readCommittedArtifact(DESIGN_SYSTEM)
    const committedLicense = readCommittedArtifact(OFL_LICENSE)
    const committedEntry = readCommittedArtifact('src/client/index.ts')
    const committedClient = readCommittedArtifact('lib/client.js')
    for (const [label, value] of [
      [FONT_ASSET, committedFont],
      [DESIGN_SYSTEM, committedDesign],
      [OFL_LICENSE, committedLicense],
    ]) {
      check(`${label} is committed`, value !== null && isCommitted(label))
    }
    if (committedFont !== null && committedLicense !== null) {
      const font = fontProblems(committedFont, committedLicense)
      check('font: the committed face passes its byte-count/OFL contract', font.problems.length === 0,
        font.problems.join('; '))
      // …and the committed client really carries it. This is the half the byte
      // counts cannot prove: a correct asset on disk that the bundle never
      // included ships as nothing.
      if (committedClient !== null && font.facts.base64 !== null) {
        check('build: the committed client carries the committed font payload',
          committedClient.includes(font.facts.base64),
          'the committed lib/client.js does not embed the committed fontAsset base64 — rebuild and commit lib/')
      }
      if (committedDesign !== null) {
        check('design system: the committed token block is the ink-language revision',
          /const TOKENS = `/.test(committedDesign)
          && /--zmd-wash-top:/.test(committedDesign)
          && /--zmd-wash-bottom:/.test(committedDesign)
          && /--zmd-accent: var\(--dsw-alias-state-business-primary\)/.test(committedDesign)
          && !/--zmd-signal/.test(committedDesign),
          'the committed designSystem.ts is not the ink-language token block (wash + host-blue accent, no signal tokens)')
      }
      if (committedClient !== null) {
        const missing = DESIGN_MARKERS.filter(marker => !committedClient.includes(marker))
        check('build: the committed client carries the design system markers',
          missing.length === 0, { missing })
      }
      if (committedEntry !== null) {
        check('design system: the committed client entry injects the token layer',
          committedEntry.includes('injectDesignSystem'),
          'src/client/index.ts does not install designSystem.ts — the tokens and face would never load')
      }
    }
  } finally {
    rmSync(committedSrc, { recursive: true, force: true })
  }
}

if (failures.length > 0) {
  console.error(
    `\nbuild freshness: ${failures.length} problem${failures.length === 1 ? '' : 's'}\n` +
    failures.map((line) => `  - ${line}`).join('\n') +
    '\n\nlib/ is committed on purpose: git installs run no build step, so a stale\n' +
    'artifact ships the wrong code to every user. Build, then commit both.\n',
  )
  process.exit(1)
}
console.log('build freshness: all good')
