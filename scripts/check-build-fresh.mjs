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
