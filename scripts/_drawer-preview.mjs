#!/usr/bin/env node
/**
 * THROWAWAY preview (not shipped, not gated): renders the SHIPPED drawer sheet
 * against the host's real token values, with the roster markup ModelDrawer.tsx
 * now produces (§5.36).
 *
 * Output: shots/_drawer-preview.html (shot by scripts/_shot-page.cjs siblings:
 * see scripts/_shot-drawer.cjs).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const shots = join(root, 'shots')

const source = readFileSync(join(shots, '_row-compare.html'), 'utf8')
const head = source.slice(0, source.indexOf('<body>')).replace(/<\/head>\s*$/, '')

const sheetSource = readFileSync(join(root, 'src', 'client', 'drawerStyles.ts'), 'utf8')
const open = sheetSource.indexOf('const CSS = `')
const from = open + 'const CSS = `'.length
const drawerCss = sheetSource.slice(from, sheetSource.indexOf('`', from))

const models = [
  { id: 'anthropic/claude-opus-5.5', name: 'Anthropic: Claude Opus 5.5', window: '1M', tokens: '128K' },
  { id: 'anthropic/claude-opus-5.5:batch', name: 'Anthropic: Claude Opus 5.5 (batch)', window: '1M', tokens: '128K' },
  { id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek: DeepSeek V4.1 Flash', window: '1048576', tokens: '384K', open: true },
  { id: 'dots-studio/dots-3-note-preview', name: 'Dots Studio: Dots3-Note Preview', window: '512K', tokens: '460800' },
  { id: 'google/gemini-3.8-flash', name: 'Google: Gemini 3.8 Flash', window: '1048576', tokens: '65536' },
  { id: 'openai/gpt-6-sol-pro', name: 'OpenAI: GPT-6 Sol Pro', window: '', tokens: '' },
]

/** One roster row. */
function row (model) {
  const facts = []
  if (model.name !== undefined && model.name !== '') facts.push(`<span class="dmc-model-alias">${model.name}</span>`)
  if (model.window !== '' && model.window !== undefined) {
    facts.push(`<span class="dmc-model-fact">上下文 ${model.window}</span>`)
  }
  if (model.tokens !== '' && model.tokens !== undefined) {
    facts.push(`<span class="dmc-model-fact">输出 ${model.tokens}</span>`)
  }
  if (facts.length === 1) facts.push('<span class="dmc-model-fact">使用默认容量</span>')
  return `<li class="dmc-model-row"${model.open === true ? ' data-well="true"' : ''}>
  <span class="dmc-model-ref" title="${model.id}">${model.id}</span>
  <button type="button" class="dmc-model-edit" aria-expanded="${model.open === true}">编辑</button>
  <span class="dmc-model-sub">${facts.join('')}</span>
  ${model.open === true ? well() : ''}
</li>`
}

/** The open model's well. */
function well () {
  return `<div class="dmc-model-well">
  <div class="dmc-model-fields">
    <div class="dmc-model-id"><label class="dmc-model-label">模型 ID</label><input class="dmc-model-input" value="deepseek/deepseek-v4.1-flash"></div>
    <div class="dmc-model-name"><label class="dmc-model-label">显示名称</label><input class="dmc-model-input" value="DeepSeek: DeepSeek V4.1 Flash"></div>
    <div class="dmc-model-window"><label class="dmc-model-label">上下文窗口</label><input class="dmc-model-input" value="1048576"></div>
    <div class="dmc-model-tokens"><label class="dmc-model-label">最大输出 token 数</label><input class="dmc-model-input" value="384K"></div>
  </div>
  <div class="dmc-reasoning">
    <span class="dmc-model-label">推理等级</span>
    <button type="button" class="dmc-btn dmc-reasoning-add">添加档位</button>
  </div>
  <button type="button" class="dmc-model-danger">删除模型</button>
</div>`
}

const body = `<body>
<div class="dmc-drawer" role="dialog" aria-modal="true">
  <div class="dmc-drawer-head">
    <div class="dmc-drawer-heading">
      <h2 class="dmc-drawer-title">openrouter</h2>
      <span class="dmc-drawer-sub">openrouter</span>
    </div>
    <button type="button" class="dmc-btn dmc-drawer-close">关闭</button>
  </div>
  <div class="dmc-drawer-body">
    <h3 class="dmc-drawer-section">模型目录<span class="dmc-drawer-status">已自定义模型目录</span></h3>
    <ul class="dmc-model-list">
${models.map(model => row(model)).join('\n')}
    </ul>
    <button type="button" class="dmc-btn dmc-model-add">+ 添加模型</button>
    <div class="dmc-discover-actions">
      <button type="button" class="dmc-btn dmc-discover">获取可用模型</button>
    </div>
  </div>
  <div class="dmc-drawer-foot">
    <button type="button" class="dmc-btn dmc-btn-commit">保存</button>
    <button type="button" class="dmc-btn">恢复默认模型</button>
  </div>
</div>
</body></html>`

const fixture = `<style>${drawerCss}
body { margin: 0; background: var(--dsw-alias-bg-base); }
</style>`

writeFileSync(join(shots, '_drawer-preview.html'), head + fixture + body)
console.log('wrote _drawer-preview.html')
