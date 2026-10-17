#!/usr/bin/env node
/**
 * THROWAWAY preview (not shipped, not gated): renders the SHIPPED
 * modelConfigStyles + catalogStyles sheets against the host's real token values,
 * with the row markup ModelConfigPage.tsx / ModelCatalog.tsx produce, at the two
 * container widths the host settings panel actually hands this section (560 and
 * 484), plus the phone column (106). One row is drawn with its catalog region
 * expanded, so the inline form is visible next to the collapsed ledger.
 *
 * Output: shots/_page-preview.html.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const shots = join(root, 'shots')

const source = readFileSync(join(shots, '_row-compare.html'), 'utf8')
const head = source.slice(0, source.indexOf('<body>')).replace(/<\/head>\s*$/, '')

/** Pull one sheet's CSS template literal out of its module. */
function sheetOf (file) {
  const sheetSource = readFileSync(join(root, 'src', 'client', file), 'utf8')
  const open = sheetSource.indexOf('const CSS = `')
  const from = open + 'const CSS = `'.length
  return sheetSource.slice(from, sheetSource.indexOf('`', from))
}

const css = `${sheetOf('modelConfigStyles.ts')}
${sheetOf('catalogStyles.ts')}`

/** One row. `open` renders the settings well with `well` as its body. */
function row ({ name, route, models, verdict, state, open: isOpen, well = '', error = false, catalog = '' }) {
  const modelCell = models === 0 ? '默认' : `${models} 个模型`
  return `<li class="dmc-row" data-state="${state}"${error ? ' data-error="true"' : ''}${isOpen ? ' data-well="true"' : ''}${catalog !== '' ? ' data-catalog="true"' : ''}>
  <span class="dmc-rail" data-state="${state}" aria-hidden="true"></span>
  <span class="dmc-name">${name}<span class="dmc-route">${route}</span></span>
  <button type="button" class="dmc-catalog" title="${models === 0 ? '正在使用适配器默认模型' : ''}">${modelCell}</button>
  <span class="dmc-verdict" data-state="${state}">${verdict}</span>
  <button type="button" class="dmc-manage">管理</button>
  ${isOpen ? `<div class="dmc-well">${well}</div>` : ''}
  ${catalog}
</li>`
}

/** A field line. */
function field (label, value) {
  return `<span class="dmc-field-label">${label}</span><span class="dmc-field-value">${value}</span>`
}

const configuredWell = `
  ${field('凭据', '<span class="dmc-quiet">已配置</span><button type="button" class="dmc-key-action">替换</button><button type="button" class="dmc-key-clear">清除</button>')}
  ${field('API 协议', '<select class="dmc-protocol"><option>OpenAI Chat Completions</option><option>OpenAI Responses</option><option>Anthropic Messages</option></select>')}
  ${field('自动重试', '<button type="button" class="dmc-retry-action">修改</button>')}
  <span class="dmc-field-label" aria-hidden="true"></span><span class="dmc-field-value"><button type="button" class="dmc-danger">删除 opencode-go</button></span>`

const missingWell = `
  <p class="dmc-diagnostic">保存失败：这个设置文档在打开期间已被改动。请关闭后重新打开，在当前值上编辑。</p>
  ${field('凭据', '<span class="dmc-quiet">未配置</span><button type="button" class="dmc-key-action">填写密钥</button>')}
  ${field('API 协议', '<select class="dmc-protocol"><option value="">未选择</option><option>OpenAI Chat Completions</option></select>')}
  ${field('自动重试', '<button type="button" class="dmc-retry-action">修改</button>')}
  <span class="dmc-field-label" aria-hidden="true"></span><span class="dmc-field-value"><button type="button" class="dmc-danger">删除 Magpie</button></span>`

/** One roster line, collapsed. */
function modelLine (id, alias, facts) {
  return `<li class="dmc-model-row">
    <span class="dmc-model-ref" title="${id}">${id}</span>
    <button type="button" class="dmc-model-edit">编辑</button>
    <span class="dmc-model-sub"><span class="dmc-model-alias">${alias}</span>${facts}</span>
  </li>`
}

/** The inline catalog region, as ModelCatalog.tsx renders it. */
const catalogRegion = `<div class="dmc-catalog-panel">
  <div class="dmc-catalog-head">
    <div class="dmc-catalog-heading"><h2 class="dmc-catalog-title">模型目录</h2><span class="dmc-catalog-status">已自定义模型目录</span></div>
    <button type="button" class="dmc-btn dmc-catalog-close">收起</button>
  </div>
  <div class="dmc-catalog-body">
    <ul class="dmc-model-list">
      ${modelLine('anthropic/claude-opus-5.5', 'Anthropic: Claude Opus 5.5', '<span class="dmc-model-fact">上下文 1M</span><span class="dmc-model-fact">输出 128K</span>')}
      ${modelLine('deepseek/deepseek-v4.1-flash', 'DeepSeek: DeepSeek V4.1 Flash', '<span class="dmc-model-fact">上下文 1048576</span><span class="dmc-model-fact">输出 384K</span>')}
      ${modelLine('google/gemini-3.8-flash', 'Google: Gemini 3.8 Flash', '<span class="dmc-model-fact">上下文 1048576</span><span class="dmc-model-fact">输出 65536</span>')}
      ${modelLine('openai/gpt-6-sol-pro', 'OpenAI: GPT-6 Sol Pro', '<span class="dmc-model-fact">使用默认容量</span>')}
    </ul>
    <button type="button" class="dmc-btn dmc-model-add">+ 添加模型</button>
    <div class="dmc-discover-actions"><button type="button" class="dmc-btn dmc-discover">获取可用模型</button></div>
  </div>
  <div class="dmc-catalog-foot">
    <button type="button" class="dmc-btn dmc-btn-commit">保存</button>
    <button type="button" class="dmc-btn">恢复默认模型</button>
  </div>
</div>`

const rows = [
  { name: 'DeepSeek 账号', route: 'deepseek-account', models: 0, verdict: '已登录', state: 'ready' },
  { name: 'DeepSeek', route: 'deepseek-official', models: 2, verdict: '可用', state: 'ready' },
  { name: 'opencode-go', route: 'opencode-go', models: 4, verdict: '可用', state: 'ready', open: true, well: configuredWell },
  { name: 'openrouter', route: 'openrouter', models: 7, verdict: '可用', state: 'ready' },
  { name: 'xiaomi', route: 'xiaomi', models: 0, verdict: '可用', state: 'ready' },
  { name: '小红书', route: 'dots-ai', models: 1, verdict: '可用', state: 'ready' },
  { name: 'StarYears', route: 'staryears', models: 8, verdict: '可用', state: 'ready' },
  { name: 'commandcode', route: 'commandcode', models: 7, verdict: '可用', state: 'ready' },
  { name: 'naizi DSx0.1', route: 'naizi', models: 1, verdict: '可用', state: 'ready' },
  { name: 'Magpie', route: 'magpie', models: 5, verdict: '缺密钥', state: 'missing-key' },
  { name: '方舟 Coding Plan', route: 'fangzhou', models: 1, verdict: '不可用', state: 'unreachable' },
]

const rowsA = rows.map(entry => entry.route === 'openrouter'
  ? { ...entry, catalog: catalogRegion }
  : entry)

const rowsB = rows.map(entry => entry.route === 'magpie'
  ? { ...entry, open: true, error: true, well: missingWell }
  : entry)

function page (list, width) {
  return `<section class="dmc-page" style="width:${width}px">
  <div class="dmc-head"><p class="dmc-readout">11 个提供商，全部可用</p></div>
  <ul class="dmc-list">
${list.map(entry => row(entry)).join('\n')}
  </ul>
  <div class="dmc-actions"><button type="button" class="dmc-add">添加模型提供商</button></div>
</section>`
}

const body = `<body>
<div class="pv-wrap">
  <div class="pv-pane">${page(rowsA, 560)}</div>
  <div class="pv-pane">${page(rowsB, 484)}</div>
  <div class="pv-pane">${page([
    { ...rows[2], open: false, well: '' },
    { ...rows[9], open: true, error: true, well: missingWell },
    { ...rows[3], catalog: catalogRegion },
  ], 106)}</div>
  <div class="pv-pane">${page(rows, 560)}</div>
</div>
</body></html>`

const fixture = `<style>${css}
body { margin: 0; padding: 24px; background: var(--dsw-alias-bg-base); }
.pv-wrap { display: flex; gap: 32px; align-items: flex-start; }
.pv-pane { flex: none; }
</style>`

writeFileSync(join(shots, '_page-preview.html'), head + fixture + body)
console.log('wrote _page-preview.html')
