/**
 * Offline render of the composer SEAT (provider chip + model trigger + gear),
 * built from the real pieces, to check the effort tail the trigger now paints
 * beside the model name.
 *
 *   - the host's own token sheet, pulled from the theme bundle the same way
 *     `check-contrast.mjs` and `_render-row.cjs` pull it;
 *   - this plugin's COMPILED sheet, extracted from `lib/client.js`, so what is
 *     measured is what ships rather than a hand copy;
 *   - the exact DOM `Picker.tsx` renders for the seat, with the chevrons and the
 *     data icon as simple stand-ins (their glyphs are host icons; only the TEXT
 *     half is under test here).
 *
 * This exists because the GUI needs a token this script will not invent. It is a
 * faithful reproduction of the seat's own subtree and nothing else.
 *
 * Run: node scripts/_render-trigger.cjs
 */
const { readFileSync, writeFileSync } = require('node:fs')
const { resolve, join } = require('node:path')

const root = resolve(__dirname, '..')
const hostModules = join(
  process.env.APPDATA ?? '',
  'npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai',
)

/**
 * The host's token sheet, unwrapped from the theme bundle's JS string literals.
 * @returns the concatenated token CSS.
 */
function tokenCss() {
  const source = readFileSync(join(hostModules, 'dsh-client-ui-theme/lib/client.js'), 'utf8')
  const chunks = []
  for (const match of source.matchAll(/var\s+\w*_?css_default\s*=\s*"((?:[^"\\]|\\.)*)"/g)) {
    const body = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/')
    if (body.includes('--dsw-')) chunks.push(body)
  }
  if (chunks.length === 0) throw new Error('the theme bundle published no token CSS')
  return chunks.join('\n')
}

/** The plugin's compiled sheet. */
const pluginSheet = readFileSync(resolve(root, 'shots/_extracted.css'), 'utf8')

/** A chevron drawn as a tiny inline svg, so the seat's flex layout is honest. */
const chevron = `<svg class="dmp-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4" /></svg>`

/**
 * One seat: provider chip, model trigger (name + optional effort tail), gear.
 * @param name - the model name shown in the trigger.
 * @param effort - the effort label, or null for a model that states none.
 */
function seat(name, effort) {
  const tail = effort === null
    ? ''
    : `<span class="dmp-trigger-effort">${effort}</span>`
  return `<div class="dmp-root">
  <button type="button" class="dmp-provider" aria-label="provider">
    <span class="dmp-provider-label">OpenAI</span>${chevron}
  </button>
  <button type="button" class="dmp-trigger" aria-label="trigger">
    <span class="dmp-trigger-label">${name}</span>${tail}${chevron}
  </button>
  <button type="button" class="dmp-settings-button" aria-label="settings">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="2.2" /><path d="M8 2v1.6M8 12.4V14M2 8h1.6M12.4 8H14M3.8 3.8l1.1 1.1M11.1 11.1l1.1 1.1M12.2 3.8l-1.1 1.1M4.9 11.1l-1.1 1.1" /></svg>
  </button>
</div>`
}

const seats = [
  seat('Qwen3.8-Flash · 免费', 'Default'),
  seat('DeepSeek-V4-Pro', 'High'),
  seat('A very long model name that must ellipsize first', 'Minimal'),
  seat('Legacy Model With No Effort', null),
].join('\n')

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
${tokenCss()}
body { margin: 0; padding: 28px; background: var(--dsw-alias-bg-base); }
${pluginSheet}
/* The seat is a flex row; give each a fixed frame so the width fight is visible. */
.dmp-root { width: 360px; margin-bottom: 12px; }
</style></head>
<body>
${seats}
</body></html>`

const out = resolve(root, 'shots/_trigger-compare.html')
writeFileSync(out, html)
console.log(`wrote ${out} (${html.length} bytes)`)
