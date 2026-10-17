#!/usr/bin/env node
/**
 * Static preview fixtures for the INK design language (not shipped, not gated).
 *
 * WHAT THIS RENDERS. The plugin's surfaces as the TSX builds them today, against
 * the REAL sheets from `src/` (through `scripts/_fixture-css.mjs`): the composer
 * seat + model card + parameter panel, and the model-config page (page head,
 * ledger, settings well, retry editor, catalog region, discovery checklist). It
 * is a hand-written mirror of the JSX, so the rule is simple: every class name
 * and every element here exists in the component that renders that subtree, and
 * nothing else is added. The HUD round's inventions (field-code spans, display
 * numerals, corner cuts, wipe bars) are gone from both the implementation and
 * these fixtures.
 *
 * STATE CONSISTENCY. The card's two facts ride on two channels and the fixture
 * keeps them apart, the way `ProviderRail.tsx` documents:
 *   - the SCOPE (`aria-selected`) = sunken fill + 1px inset strong-line ring. The
 *     fixture then renders ONLY that provider's models;
 *   - the SESSION (`aria-current`) = the 2px host-blue bar + weight 500. It is
 *     marked on the conversation's provider in both scopes.
 * The "all providers" card selects the rail's first row and renders the models
 * grouped by provider — a card whose rail selects a provider never shows another
 * provider's models.
 *
 * OUTPUT (all under `shots/_*`, which the repo ignores — they rebuild):
 *   shots/_ink-card.html         two wide cards (scoped / all providers)
 *   shots/_ink-card-narrow.html  the ≤536px collapsed card (shot at a 520px
 *                                viewport, because the collapse is a viewport
 *                                @media branch)
 *   shots/_ink-seat.html         seat rows (closed / open / long name) + panel
 *   shots/_ink-settings.html     settings page at 560 / 484 / 106, an expanded
 *                                row + well, a catalog region, and the empty state
 *
 * Run: node scripts/_preview-ink.mjs   (writes every fixture)
 *      The page/row/trigger preview scripts call the individual writers.
 *
 * @module dsh-rabbit-model-picker/preview-ink
 */

import { fileURLToPath } from 'node:url'
import { writeFixture } from './_fixture-css.mjs'

/**
 * Escape text for an HTML attribute or text node.
 * @param value - raw text.
 * @returns the escaped text.
 */
const esc = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

/**
 * One inline SVG in the shared 16-unit box.
 * @param options - drawing options.
 * @returns the `<svg>` markup.
 */
function svg({ className = '', paths, width = 16, height = 16, stroke = 1.3, cap = 'round', fill = 'none' }) {
  return `<svg${className === '' ? '' : ` class="${className}"`} width="${width}" height="${height}" `
    + `viewBox="0 0 16 16" fill="${fill}" stroke="currentColor" stroke-width="${stroke}" `
    + `stroke-linecap="${cap}" stroke-linejoin="miter" aria-hidden="true" focusable="false">${paths}</svg>`
}

/* Host icon stand-ins. Their glyphs come from the host icon set and are not under
   test; only their boxes participate in layout (the chevron, the gear, the check,
   the data mark, the info / warning marks). */
const chevronIcon = (className) => svg({ className, paths: '<path d="m4 6 4 4 4-4" />' })
const gearIcon = (className) => svg({ className, paths: '<circle cx="8" cy="8" r="2.2" /><path d="M8 2v1.6M8 12.4V14M2 8h1.6M12.4 8H14M3.8 3.8l1.1 1.1M11.1 11.1l1.1 1.1M12.2 3.8l-1.1 1.1M4.9 11.1l-1.1 1.1" />' })
const dataIcon = (className) => svg({ className, paths: '<path d="M3 4.2h10v7.6H3z" /><path d="M3 6.6h10" />' })
const checkIcon = (className = '') => svg({ className, paths: '<path d="M3 8.5 6.5 12 13 4.5" />', stroke: 1.6, cap: 'square' })
const infoIcon = (className) => svg({ className, paths: '<circle cx="8" cy="8" r="5.6" /><path d="M8 7.3v3.4M8 5.1v.6" />' })

/* ------------------------------------------------------------------------- *
 * The badge strip (Picker.tsx rows)
 * ------------------------------------------------------------------------- */

/** The badge artwork, path for path from `BadgeIcons.tsx`: one frame, one stroke, four interiors. */
const BADGE_ART = {
  text: '<path d="M3 2.5 H13 V13.5 H3 Z" /><path d="M5.4 6.6 H10.6" /><path d="M5.4 9.8 H10.6" />',
  image: '<path d="M3 2.5 H13 V13.5 H3 Z" /><path d="M4.8 11.2 L6.9 8.4 L8.4 10.2 L10.2 8.1 L11.2 11.2" />',
  effort: '<path d="M3 2.5 H13 V13.5 H3 Z" /><path d="M5.6 10.6 V9.4" /><path d="M8 10.6 V7.6" /><path d="M10.4 10.6 V5.8" />',
  context: '<path d="M3 2.5 H13 V13.5 H3 Z" /><path d="M6.4 5.8 H5.4 V10.6 H6.4" /><path d="M9.6 5.8 H10.6 V10.6 H9.6" />',
}

/** The four tracks, in canonical order, with the word the spec strip states for each. */
const BADGE_TRACKS = [
  ['text', '文字'],
  ['image', '图片'],
  ['effort', '推理'],
  ['context', '窗口'],
]

/**
 * One badge: `Tag` renders a span with the icon cell then the value cell.
 * @param fact - which fact.
 * @param value - the value cell's text; empty for the yes/no facts.
 * @returns the badge markup.
 */
function badge(fact, value) {
  const valueCell = value === '' ? '' : `<span class="dmp-badge-value">${esc(value)}</span>`
  return `<span class="tag dmp-badge" data-tone="neutral">`
    + `<span class="dmp-badge-fact">${svg({ className: 'dmp-badge-icon', paths: BADGE_ART[fact], width: 14, height: 14, stroke: 1.6, cap: 'square' })}</span>`
    + `${valueCell}</span>`
}

/**
 * The facts a model states, as their sentence.
 * @param facts - `{ text?, image?, effort?, context? }`; `context` carries a value.
 * @returns the joined sentence.
 */
function factsSentence(facts) {
  return BADGE_TRACKS
    .filter(([fact]) => (fact === 'context' ? facts.context !== undefined : facts[fact] === true))
    .map(([fact, word]) => (fact === 'context' ? `${word} ${facts.context}` : word))
    .join('、')
}

/**
 * The four-track strip. A fact the model does not have leaves its OWN track
 * empty (`.dmp-badge-slot`), which is what keeps the columns aligned row to row.
 * @param facts - `{ text?, image?, effort?, context? }`.
 * @returns the strip markup (empty string when the model states nothing).
 */
function badgeStrip(facts) {
  const sentence = factsSentence(facts)
  if (sentence === '') return ''
  const tracks = BADGE_TRACKS.map(([fact]) => {
    if (fact === 'context') return facts.context === undefined ? '<span class="dmp-badge-slot"></span>' : badge(fact, facts.context)
    return facts[fact] === true ? badge(fact, '') : '<span class="dmp-badge-slot"></span>'
  }).join('')
  return `<span class="dmp-badges" title="${esc(sentence)}" aria-hidden="true">${tracks}</span>`
}

/**
 * The spec strip above the model list (`role="note"`). Four Chinese column
 * names, no count (the ink direction removed the right-end tally).
 * @returns the strip markup.
 */
function legend() {
  const items = BADGE_TRACKS.map(([fact, word]) => `<span class="dmp-legend-item">`
    + `<span class="dmp-legend-icon">${svg({ className: 'dmp-badge-icon', paths: BADGE_ART[fact], width: 14, height: 14, stroke: 1.6, cap: 'square' })}</span>`
    + `<span class="dmp-legend-word">${word}</span></span>`).join('')
  return `<div class="dmp-legend" role="note" aria-label="每一行右侧陈述的四个事实">${items}</div>`
}

/* ------------------------------------------------------------------------- *
 * The model card (Picker.tsx + ProviderRail.tsx)
 * ------------------------------------------------------------------------- */

/** A provider rail option, mirroring `ProviderOption` + the row ProviderRail renders. */
const RAIL_OPTIONS = [
  { id: 'all', label: '全部', count: 13 },
  { id: 'deepseek-account', label: 'DeepSeek 账号', count: 0 },
  { id: 'deepseek-official', label: 'DeepSeek', count: 2 },
  { id: 'opencode-go', label: 'opencode-go', count: 4, session: true },
  { id: 'openrouter', label: 'openrouter', count: 3 },
  { id: 'xiaomi', label: 'xiaomi', count: 0 },
  { id: 'dots-ai', label: '小红书', count: 1 },
  { id: 'staryears', label: 'StarYears', count: 2 },
  { id: 'magpie', label: 'Magpie', count: 1 },
  { id: 'fangzhou', label: '方舟 Coding Plan', failed: true },
]

/** The catalog's models per provider (one row = one model's read-only facts). */
const MODELS = {
  'opencode-go': [
    { name: 'DeepSeek V4.1 Flash', facts: { text: true, image: true, effort: true, context: '1M' }, selected: true },
    { name: 'Qwen3.8-Flash · 免费', facts: { text: true, image: true, context: '128K' } },
    { name: 'DeepSeek-V4.1-Prev', facts: { text: true, effort: true, context: '262K' } },
    { name: 'dots3-note-prev', facts: { text: true, context: '128K' } },
  ],
  openrouter: [
    { name: 'Anthropic: Claude Opus 5.5', facts: { text: true, image: true, effort: true, context: '1M' } },
    { name: 'Google: Gemini 3.8 Flash', facts: { text: true, image: true, effort: true, context: '1M' } },
    { name: 'DeepSeek: DeepSeek V4.1 Flash', facts: { text: true, image: true, effort: true, context: '1M' } },
  ],
  'deepseek-official': [
    { name: 'DeepSeek V4.1 Pro', facts: { text: true, effort: true, context: '262K' } },
    { name: 'DeepSeek V4.1 Flash', facts: { text: true, image: true, effort: true, context: '1M' } },
  ],
}

/**
 * One model row, exactly the subtree Picker.tsx builds.
 * @param model - the row's fixture record.
 * @returns the row markup.
 */
function modelRow(model) {
  const sentence = factsSentence(model.facts)
  const aria = sentence === '' ? model.name : `${model.name}，${sentence}`
  return `<div class="dmp-row" role="menuitemradio" aria-checked="${model.selected === true}" `
    + `aria-label="${esc(aria)}" tabindex="-1">`
    + `<span class="dmp-row-copy"><span class="dmp-row-name" title="${esc(model.name)}">${esc(model.name)}</span>`
    + `${badgeStrip(model.facts)}</span>`
    + `<span class="dmp-check"${model.selected === true ? ' data-on=""' : ''}>`
    + `${model.selected === true ? checkIcon() : ''}</span></div>`
}

/**
 * One provider rail row (the scope list's option).
 * @param option - the provider option.
 * @param index - its position (the two-digit ordinal is drawn from it).
 * @param scope - the active scope id, or null for "全部".
 * @param stop - whether this row holds the rail's single tab stop.
 * @returns the row markup.
 */
function railRow(option, index, scope, stop) {
  const selected = (scope === null ? option.id === 'all' : option.id === scope)
  const current = option.session === true ? ' aria-current="true"' : ''
  const trailing = option.failed === true
    ? `<span class="dmp-provider-failed"><span class="dmp-provider-failed-dot" aria-hidden="true"></span>加载失败</span>`
    : `<span class="dmp-provider-count">${option.count}</span>`
  return `<button type="button" role="option" class="dmp-rail-row" aria-selected="${selected}"${current} `
    + `tabindex="${stop ? 0 : -1}"${option.failed === true ? ' disabled' : ''} title="${esc(option.label)}">`
    + `<span class="dmp-rail-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>`
    + `<span class="dmp-rail-copy"><span class="dmp-rail-name">${esc(option.label)}</span></span>`
    + `${trailing}</button>`
}

/**
 * One `MenuGroup` (the host primitive renders a `section role="group"` with a
 * heading band the sheet pins with `position: sticky`).
 * @param label - the group's heading text.
 * @param rows - the rows' markup.
 * @returns the group markup.
 */
function menuGroup(label, rows) {
  const id = `pv-group-${label.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`
  return `<section role="group" aria-labelledby="${id}" data-menu-group="">`
    + `<span aria-hidden="true" data-menu-group-start=""></span>`
    + `<div id="${id}" data-menu-group-heading="">${esc(label)}</div>${rows}</section>`
}

/**
 * The whole model card, in one of the two consistent scopes.
 * @param options - `{ scope, pane }`: the selected scope id (null = 全部) and the
 *   pane label used by the shot script.
 * @returns the card markup.
 */
function modelCard({ scope, pane }) {
  const groups = scope !== null
    ? [menuGroup(scope, MODELS[scope].map(modelRow).join(''))]
    : [
        menuGroup('opencode-go', MODELS['opencode-go'].slice(0, 2).map(modelRow).join('')),
        menuGroup('openrouter', MODELS.openrouter.map(modelRow).join('')),
        menuGroup('DeepSeek', MODELS['deepseek-official'].map(modelRow).join('')),
      ]
  const stopIndex = RAIL_OPTIONS.findIndex(option => (scope === null ? option.id === 'all' : option.id === scope))
  const rail = RAIL_OPTIONS.map((option, index) => railRow(option, index, scope, index === stopIndex)).join('')
  return `<div class="dmp-menu dmp-card zmd-wash zmd-grain" data-menu-material="translucent" `
    + `role="group" aria-label="模型与推理等级" data-pane="${pane}">`
    + `<div class="material" aria-hidden="true"></div>`
    + `<div class="dmp-rail" role="listbox" aria-label="模型提供商">${rail}</div>`
    + `<div class="dmp-models">`
    + `<div class="dmp-search-row"><span class="dmp-search"><input type="text" role="searchbox" `
    + `aria-label="搜索模型…" aria-controls="pv-models" placeholder="搜索模型…" value=""></span></div>`
    + `${legend()}`
    + `<div class="dmp-groups scrollable" id="pv-models" role="menu" aria-label="模型">${groups.join('')}</div>`
    + `</div></div>`
}

/* ------------------------------------------------------------------------- *
 * The composer seat + parameter panel (Picker.tsx + SettingsMenu.tsx)
 * ------------------------------------------------------------------------- */

/**
 * One seat: trigger + gear. `open` paints the card-up state; `edited` is the
 * gear's `data-edited` (the route has a declaration).
 * @param options - the seat's state.
 * @returns the seat markup.
 */
function seat({ provider, model, effort, open, edited }) {
  const openClass = open === true ? ' dmp-trigger-open' : ''
  const chevronClass = open === true ? 'dmp-chevron dmp-chevron-open' : 'dmp-chevron'
  return `<div class="dmp-root" data-seat="${open === true ? 'open' : 'closed'}">`
    + `<button type="button" class="dmp-trigger${openClass}" aria-label="${esc(`${provider}/${model}，推理等级 ${effort}`)}" `
    + `aria-haspopup="menu" aria-expanded="${open === true}"${open === true ? ' data-open=""' : ''}>`
    + `${dataIcon('dmp-trigger-icon')}`
    + `<span class="dmp-trigger-label">${esc(`${provider}/${model}`)}</span>`
    + `<span class="dmp-trigger-effort">${esc(effort)}</span>`
    + `${chevronIcon(chevronClass)}</button>`
    + `<button type="button" class="dmp-settings-button${open === true ? ' dmp-settings-open' : ''}" `
    + `aria-label="打开模型参数" aria-haspopup="menu" aria-expanded="${open === true}"`
    + `${edited === true ? ' data-edited=""' : ''}>`
    + `${gearIcon('dmp-settings-icon')}</button></div>`
}

/** One settings section header: the Chinese word + the hairline that closes the row. */
function sectionLabel(word) {
  return `<div class="dmp-settings-label"><span>${esc(word)}</span>`
    + `<span class="zmd-rule" aria-hidden="true"></span></div>`
}

/** One effort choice row (`role="radio"`, chosen = sunken fill + 2px accent bar + accent check). */
function effortRow(label, checked) {
  return `<button type="button" role="radio" aria-checked="${checked}" class="dmp-effort-item">`
    + `<span class="dmp-effort-name">${esc(label)}</span>`
    + `<span class="dmp-effort-check"${checked ? ' data-on=""' : ''}>${checked ? checkIcon() : ''}</span></button>`
}

/** The parameter panel, as `SettingsMenu.tsx` renders it. */
function settingsPanel() {
  return `<div class="dmp-menu dmp-settings zmd-wash zmd-grain" data-menu-material="translucent" `
    + `role="group" aria-label="DeepSeek V4.1 Flash 的模型参数" tabindex="-1">`
    + `<div class="material" aria-hidden="true"></div>`
    + `<div class="dmp-settings-head"><span class="dmp-settings-title">DeepSeek V4.1 Flash</span>`
    + `<button type="button" class="dmp-settings-reset">恢复默认</button></div>`
    + `<div class="dmp-settings-body">`
    + `<div class="dmp-settings-section">${sectionLabel('输入类型')}`
    + `<div class="dmp-settings-row"><span class="dmp-settings-name">文字</span>`
    + `<button type="button" class="dmp-settings-switch" role="switch" aria-checked="true"><span></span></button></div>`
    + `<div class="dmp-settings-row"><span class="dmp-settings-name">图片</span>`
    + `<button type="button" class="dmp-settings-switch" role="switch" aria-checked="false"><span></span></button></div>`
    + `</div>`
    + `<div class="dmp-settings-section">${sectionLabel('上下文窗口')}`
    + `<div class="dmp-settings-row"><div class="dmp-settings-input">`
    + `<input type="text" inputmode="numeric" aria-label="上下文窗口" placeholder="128K / 1M / 262144" value=""></div></div>`
    + `</div>`
    + `<div class="dmp-settings-section">${sectionLabel('推理等级')}`
    + `<div class="dmp-effort-list" role="radiogroup" aria-label="推理等级">`
    + `${effortRow('Default', true)}${effortRow('Minimal', false)}${effortRow('Low', false)}`
    + `${effortRow('Medium', false)}${effortRow('High', false)}</div></div>`
    + `<div class="dmp-settings-target" title="llm-pi-ai · providers.opencode-go.models.4">`
    + `写入位置：llm-pi-ai · providers.opencode-go.models.4</div>`
    + `<div class="dmp-settings-note">${infoIcon('dmp-settings-note-icon')}`
    + `<span>输入类型与上下文窗口会直接写进适配器对这个模型的声明，立即生效，与「设置 → 模型」页改的是同一处；`
    + `推理等级是会话级设置，不写进声明。</span></div>`
    + `</div></div>`
}

/* ------------------------------------------------------------------------- *
 * The model-config page (ModelConfigPage.tsx + ModelCatalog.tsx + RetryEditor.tsx)
 * ------------------------------------------------------------------------- */

/**
 * The settings well's three field lines and its lifecycle entry.
 * `session` renders the credential line the way a session provider states it,
 * and such a route has no settings path, so its well carries no lifecycle entry
 * (the JSX renders that block only when `settingsPath.length > 0`).
 * @param options - the well's state.
 * @returns the well markup.
 */
function providerWell({ provider, configured, retryOpen, session }) {
  const credential = session === true
    ? `<span class="dmc-field-label">凭据</span>`
      + `<span class="dmc-field-value"><span class="dmc-quiet">由账号提供</span></span>`
    : `<span class="dmc-field-label">凭据</span>`
      + `<span class="dmc-field-value">`
      + (configured === true
        ? '<span class="dmc-quiet">已配置</span><button type="button" class="dmc-key-action">替换</button>'
          + '<button type="button" class="dmc-key-clear">清除</button>'
        : '<span class="dmc-quiet">未配置</span><button type="button" class="dmc-key-action">填写密钥</button>')
      + `</span>`
  return `<div class="dmc-well" id="dmc-well-${esc(provider)}">`
    + `${credential}`
    + `<span class="dmc-field-label">API 协议</span>`
    + `<span class="dmc-field-value"><select class="dmc-protocol" aria-label="API 协议">`
    + `<option>OpenAI Chat Completions</option><option>OpenAI Responses</option><option>Anthropic Messages</option>`
    + `</select></span>`
    + `<span class="dmc-field-label">自动重试</span>`
    + `<span class="dmc-field-value"><button type="button" class="dmc-retry-action" aria-expanded="${retryOpen === true}">修改</button></span>`
    + `${retryOpen === true ? retryEditor() : ''}`
    + `${session === true ? '' : `<span class="dmc-well-rule" aria-hidden="true"></span>`
      + `<span class="dmc-field-label" aria-hidden="true"></span>`
      + `<span class="dmc-field-value"><button type="button" class="dmc-danger" aria-label="删除 ${esc(provider)}">删除 ${esc(provider)}</button></span>`}`
    + `</div>`
}

/**
 * The inline retry editor, as `RetryEditor.tsx` renders it.
 *
 * The two numbers are a declared policy of 2 retries with a 30s cap, so the
 * schedule below is the one `retryWaitCurve` really produces: waits of 500ms and
 * 1s, a 1.7s high bound (jitter included), and the backoff scale's first TWO
 * slots filled (4 and 2) with three baseline slots left — never invented data.
 * @returns the editor markup.
 */
function retryEditor() {
  const field = (id, label, value, unit) => `<div class="dmc-retry-field">`
    + `<label class="dmc-retry-label" for="${id}">${esc(label)}</label>`
    + `<div class="dmc-retry-row"><input id="${id}" class="dmc-retry-input" type="text" inputmode="decimal" `
    + `autocomplete="off" spellcheck="false" value="${esc(value)}"><span class="dmc-retry-unit">${esc(unit)}</span></div></div>`
  const ticks = [2, 4, 0, 0, 0]
    .map((level, index) => `<span class="dmc-backoff-cell" data-level="${level}" data-index="${index}"></span>`)
    .join('')
  return `<div class="dmc-retry" id="dmc-retry-opencode-go">`
    + `<p class="dmc-retry-state">已单独设置</p>`
    + `<div class="dmc-retry-fields">`
    + `${field('pv-retry-count', '重试次数', '2', '次')}${field('pv-retry-cap', '间隔上限', '30', '秒')}`
    + `</div>`
    + `<p class="dmc-notice">每次等待翻倍，直到触达上限。</p>`
    + `<p class="dmc-notice">中文限流文案（如「请求过于频繁」）也按这里设置重试。</p>`
    + `<p class="dmc-retry-summary"><span class="dmc-retry-tally">2</span>`
    + `<span class="dmc-retry-tally-unit">次</span>`
    + `<span class="dmc-retry-detail">首次等待 500ms · 最长合计 1.7s</span></p>`
    + `<span class="dmc-backoff" aria-hidden="true">${ticks}</span>`
    + `<div class="dmc-retry-actions"><button type="button" class="dmc-key-action">保存</button>`
    + `<button type="button" class="dmc-key-action">恢复默认</button></div>`
    + `</div>`
}

/**
 * One roster line, plus the four-field well it opens.
 * @param model - the model record.
 * @param position - its 1-based position (the two-digit mark).
 * @param open - whether its editor is expanded.
 * @returns the roster line markup.
 */
function rosterRow(model, position, open) {
  const alias = model.alias
  const facts = model.context === '' && model.output === ''
    ? '<span class="dmc-model-fact">使用默认容量</span>'
    : `${model.context === '' ? '' : `<span class="dmc-model-fact">上下文 ${esc(model.context)}</span>`}`
      + `${model.output === '' ? '' : `<span class="dmc-model-fact">输出 ${esc(model.output)}</span>`}`
  const well = open !== true ? '' : `<div class="dmc-model-well" id="dmc-model-well-${esc(model.key)}">`
    + `<div class="dmc-model-fields">`
    + `<div class="dmc-model-id"><label class="dmc-model-label" for="pv-model-id">模型 ID</label>`
    + `<input class="dmc-model-input" id="pv-model-id" type="text" value="${esc(model.id)}"></div>`
    + `<div class="dmc-model-name"><label class="dmc-model-label" for="pv-model-name">显示名称</label>`
    + `<input class="dmc-model-input" id="pv-model-name" type="text" value="${esc(alias)}" placeholder="留空时使用模型 ID"></div>`
    + `<div class="dmc-model-window"><label class="dmc-model-label" for="pv-model-window">上下文窗口</label>`
    + `<input class="dmc-model-input" id="pv-model-window" type="text" inputmode="decimal" value="${esc(model.context)}" placeholder="使用提供商默认值"></div>`
    + `<div class="dmc-model-tokens"><label class="dmc-model-label" for="pv-model-tokens">最大输出 token 数</label>`
    + `<input class="dmc-model-input" id="pv-model-tokens" type="text" inputmode="decimal" value="${esc(model.output)}" placeholder="使用提供商默认值"></div>`
    + `</div>`
    + `<div class="dmc-reasoning"><span class="dmc-model-label">推理等级</span>`
    + `<div class="dmc-reasoning-head"><span class="dmc-model-label">档位</span>`
    + `<span class="dmc-model-label">API 参数值</span><span></span></div>`
    + `<div class="dmc-reasoning-row"><select class="dmc-reasoning-level" aria-label="档位">`
    + `<option>High</option><option selected>Max</option><option>Off</option></select>`
    + `<input class="dmc-reasoning-value" type="text" aria-label="API 参数值" value="max">`
    + `<button type="button" class="dmc-btn dmc-reasoning-remove">删除档位</button></div>`
    + `<div class="dmc-reasoning-row"><select class="dmc-reasoning-level" aria-label="档位">`
    + `<option selected>Off</option><option>High</option><option>Max</option></select>`
    + `<input class="dmc-reasoning-value" type="text" aria-label="API 参数值" value="" placeholder="关闭思考" disabled>`
    + `<button type="button" class="dmc-btn dmc-reasoning-remove">删除档位</button></div>`
    + `<button type="button" class="dmc-btn dmc-reasoning-add">添加档位</button>`
    + `<p class="dmc-reasoning-help">API 参数值会写入请求的推理强度字段（如 OpenAI 的 reasoning_effort），`
    + `默认与档位名相同；如有不同，以模型提供商的 API 文档为准。Off 表示关闭思考，不需要填写参数值；`
    + `配置中已写入的值会保留并发送。</p></div>`
    + `<button type="button" class="dmc-model-danger">删除模型</button></div>`
  return `<li class="dmc-model-row" data-key="${esc(model.key)}"${open === true ? ' data-well="true"' : ''}>`
    + `<span class="dmc-model-index" aria-hidden="true">${String(position).padStart(2, '0')}</span>`
    + `<span class="dmc-model-ref" title="${esc(model.id)}">${esc(model.id)}</span>`
    + `<button type="button" class="dmc-model-edit" aria-expanded="${open === true}">编辑</button>`
    + `<span class="dmc-model-sub"><span class="dmc-model-alias">${esc(alias)}</span>`
    + `<span class="dmc-model-facts">${facts}</span></span>${well}</li>`
}

/**
 * The catalog region: the roster, the add line and the discovery checklist
 * (three candidate states: unchecked / checked / already in the catalog).
 * @param provider - the route id the region belongs to.
 * @returns the region markup.
 */
function catalogRegion(provider) {
  const models = [
    { key: 'anthropic', id: 'anthropic/claude-opus-5.5', alias: 'Anthropic: Claude Opus 5.5', context: '1M', output: '128K' },
    { key: 'deepseek', id: 'deepseek/deepseek-v4.1-flash', alias: 'DeepSeek: DeepSeek V4.1 Flash', context: '1048576', output: '384K' },
    { key: 'gemini', id: 'google/gemini-3.8-flash', alias: 'Google: Gemini 3.8 Flash', context: '1048576', output: '65536' },
    { key: 'gpt', id: 'openai/gpt-6-sol-pro', alias: 'OpenAI: GPT-6 Sol Pro', context: '', output: '', open: true },
  ]
  const candidates = [
    { id: 'anthropic/claude-opus-6', name: 'Claude Opus 6', state: 'checked' },
    { id: 'google/gemini-3.9-flash', name: 'Gemini 3.9 Flash', state: 'unchecked' },
    { id: 'deepseek/deepseek-v4.1-flash', name: '', state: 'present' },
  ]
  const checklist = candidates.map(candidate => {
    const present = candidate.state === 'present'
    const checked = candidate.state === 'checked'
    return `<li class="dmc-discover-candidate" data-present="${present}">`
      + `<label class="dmc-discover-label"><input class="dmc-discover-check" type="checkbox"`
      + `${checked ? ' checked' : ''}${present ? ' disabled' : ''}>`
      + `<span class="dmc-discover-id">${esc(candidate.id)}</span></label>`
      + `${candidate.name === '' ? '' : `<span class="dmc-discover-name">${esc(candidate.name)}</span>`}</li>`
  }).join('')
  return `<div class="dmc-catalog-panel zmd-wash zmd-grain" id="dmc-catalog-${esc(provider)}">`
    + `<div class="dmc-catalog-head"><div class="dmc-catalog-heading">`
    + `<h2 class="dmc-catalog-title">模型目录</h2>`
    + `<span class="dmc-catalog-status">已自定义模型目录</span></div>`
    + `<span class="dmc-roster-count zmd-num">04</span>`
    + `<button type="button" class="dmc-btn dmc-catalog-close">收起</button></div>`
    + `<div class="dmc-catalog-body">`
    + `<ul class="dmc-model-list">${models.map((model, index) => rosterRow(model, index + 1, model.open === true)).join('')}</ul>`
    + `<button type="button" class="dmc-btn dmc-model-add">+ 添加模型</button>`
    + `<div class="dmc-discover-actions"><button type="button" class="dmc-btn dmc-discover">获取可用模型</button></div>`
    + `<div class="dmc-discover-panel">`
    + `<h3 class="dmc-catalog-section">选择要添加的模型</h3>`
    + `<p class="dmc-catalog-notice">以下是模型提供商的可用模型，勾选要添加的模型。</p>`
    + `<input class="dmc-discover-search" type="search" autocomplete="off" spellcheck="false" `
    + `aria-label="搜索模型" placeholder="搜索模型">`
    + `<div class="dmc-discover-tools"><span class="dmc-catalog-status">共 3 个候选，其中 1 个已在目录里</span>`
    + `<button type="button" class="dmc-btn dmc-discover-tool">全选</button>`
    + `<button type="button" class="dmc-btn dmc-discover-tool">取消全选</button></div>`
    + `<ul class="dmc-discover-list">${checklist}</ul>`
    + `<div class="dmc-discover-actions"><button type="button" class="dmc-btn dmc-btn-commit dmc-discover-adopt">添加所选</button></div>`
    + `</div></div>`
    + `<div class="dmc-catalog-foot"><button type="button" class="dmc-btn dmc-btn-commit">保存</button>`
    + `<button type="button" class="dmc-btn">恢复默认模型</button></div></div>`
}

/**
 * One provider row on the page: identity, model cell, answer word, door, and the
 * row's own two collapsible regions (well then catalog), in that order.
 * @param row - the row's fixture record.
 * @returns the row markup.
 */
function providerRow(row) {
  const state = row.state
  const models = row.models
  const cell = models > 0 ? `${models} 个模型` : '默认'
  const verdictWord = { ready: row.verdict ?? '可用', 'missing-key': '缺密钥', unreachable: '不可用' }[state]
  const well = row.well === undefined ? '' : providerWell({ provider: row.provider, ...row.well })
  const catalog = row.catalog === true ? catalogRegion(row.provider) : ''
  return `<li class="dmc-row" data-state="${state}" data-usable="${state === 'unreachable' ? 'false' : 'true'}"`
    + `${row.error === true ? ' data-error="true"' : ''}`
    + `${row.catalog === true ? ' data-catalog="true"' : ''}`
    + `${row.well === undefined ? '' : ' data-well="true"'}>`
    + `<span class="dmc-rail" data-state="${state}" data-usable="${state === 'unreachable' ? 'false' : 'true'}" aria-hidden="true"></span>`
    + `<span class="dmc-name"><span class="dmc-index" aria-hidden="true">${String(row.index).padStart(2, '0')}</span>`
    + `${esc(row.name)}<span class="dmc-route">${esc(row.provider)}</span></span>`
    + `<button type="button" class="dmc-catalog"${models === 0 ? ' title="正在使用适配器默认模型"' : ''}>${cell}</button>`
    + `<span class="dmc-verdict" data-state="${state}">${esc(verdictWord)}</span>`
    + `<button type="button" class="dmc-manage" aria-expanded="${row.well !== undefined}">管理</button>`
    + `${well}${catalog}</li>`
}

/**
 * One whole `.dmc-page` at the given container width.
 * @param options - `{ width, pane, readout, rows, empty }`.
 * @returns the page markup.
 */
function settingsPage({ width, pane, readout, rows, empty = false }) {
  const addLine = `<div class="dmc-actions"><button type="button" class="dmc-add">添加模型提供商</button></div>`
  return `<section class="dmc-page" id="${pane}" data-pane="${pane}" style="width:${width}px" aria-label="模型配置">`
    + `<div class="dmc-head zmd-wash zmd-grain"><p class="dmc-readout">${esc(readout)}</p></div>`
    + `${empty ? `<p class="dmc-empty"><strong>添加一个 API Key 开始使用</strong> 配置 DeepSeek 官方模型，即可开始使用。</p>` : ''}`
    + `<ul class="dmc-list">${rows.map(providerRow).join('')}</ul>`
    + `${addLine}</section>`
}

/* ------------------------------------------------------------------------- *
 * The fixture records
 * ------------------------------------------------------------------------- */

/** The 11-row ledger the 560px pane renders (9 ready, 2 needing the reader). */
const LEDGER_560 = [
  { index: 1, name: 'DeepSeek 账号', provider: 'deepseek-account', models: 0, state: 'ready', verdict: '已登录', well: { configured: false, session: true } },
  { index: 2, name: 'DeepSeek', provider: 'deepseek-official', models: 2, state: 'ready' },
  { index: 3, name: 'opencode-go', provider: 'opencode-go', models: 4, state: 'ready', well: { configured: true, retryOpen: true } },
  { index: 4, name: 'openrouter', provider: 'openrouter', models: 3, state: 'ready', catalog: true },
  { index: 5, name: 'xiaomi', provider: 'xiaomi', models: 0, state: 'ready' },
  { index: 6, name: '小红书', provider: 'dots-ai', models: 1, state: 'ready' },
  { index: 7, name: 'StarYears', provider: 'staryears', models: 2, state: 'ready' },
  { index: 8, name: 'commandcode', provider: 'commandcode', models: 1, state: 'ready' },
  { index: 9, name: 'naizi DSx0.1', provider: 'naizi', models: 1, state: 'ready' },
  { index: 10, name: 'Magpie', provider: 'magpie', models: 1, state: 'missing-key' },
  { index: 11, name: '方舟 Coding Plan', provider: 'fangzhou', models: 1, state: 'unreachable' },
]

/** The 484px pane: the same grammar with one well open to show the 484 branch. */
const LEDGER_484 = [
  { index: 1, name: 'DeepSeek 账号', provider: 'deepseek-account', models: 0, state: 'ready', verdict: '已登录', well: { configured: false, session: true } },
  { index: 2, name: 'DeepSeek', provider: 'deepseek-official', models: 2, state: 'ready', well: { configured: true } },
  { index: 3, name: 'opencode-go', provider: 'opencode-go', models: 4, state: 'ready' },
  { index: 4, name: 'Magpie', provider: 'magpie', models: 1, state: 'missing-key' },
  { index: 5, name: '方舟 Coding Plan', provider: 'fangzhou', models: 1, state: 'unreachable' },
]

/** The 106px pane: three rows, one well open, everything stacked. */
const LEDGER_106 = [
  { index: 1, name: 'DeepSeek', provider: 'deepseek-official', models: 2, state: 'ready' },
  { index: 2, name: 'opencode-go', provider: 'opencode-go', models: 4, state: 'ready', well: { configured: true } },
  { index: 3, name: 'StarYears', provider: 'staryears', models: 2, state: 'ready' },
]

/* ------------------------------------------------------------------------- *
 * Writers
 * ------------------------------------------------------------------------- */

/**
 * Write the wide-card fixture (two consistent scopes) and the narrow-card one.
 * @returns the paths written.
 */
export async function writeCardFixtures() {
  const wide = await writeFixture('_ink-card.html', {
    title: '模型卡 · 墨色静态预览（宽卡）',
    body: `<div class="pv-stage">`
      + `<div class="pv-pane"><p class="pv-label">范围 = 当前会话的提供商（列表只列它）</p>${modelCard({ scope: 'opencode-go', pane: 'scoped' })}</div>`
      + `<div class="pv-pane"><p class="pv-label">范围 = 全部（列表按 provider 分组）</p>${modelCard({ scope: null, pane: 'all' })}</div>`
      + `</div>`,
  })
  const narrow = await writeFixture('_ink-card-narrow.html', {
    title: '模型卡 · 墨色静态预览（窄屏折叠）',
    // The collapse is an @media (max-width: 536px) branch, so this page is shot at
    // a ≤536px viewport; the stage padding is reduced to fit the card's own
    // `calc(100vw - 32px)` width.
    body: `<div class="pv-stage">${modelCard({ scope: 'opencode-go', pane: 'narrow' })}</div>`,
    extraCss: 'body { padding: 8px; }',
  })
  return [wide, narrow]
}

/**
 * Write the seat + parameter-panel fixture.
 * @returns the path written.
 */
export async function writeSeatFixtures() {
  return [await writeFixture('_ink-seat.html', {
    title: '座位行与参数面板 · 墨色静态预览',
    body: `<div class="pv-stage">`
      + `<div class="pv-pane"><p class="pv-label">座位行：收起</p>`
      + `<div class="pv-seat">${seat({ provider: 'opencode-go', model: 'DeepSeek V4.1 Flash', effort: 'Default', open: false, edited: false })}</div>`
      + `<p class="pv-label" style="margin-top:16px">座位行：模型卡已打开（底为沉底墨、chevron 旋转、齿轮选中）</p>`
      + `<div class="pv-seat">${seat({ provider: 'opencode-go', model: 'DeepSeek V4.1 Flash', effort: 'Default', open: true, edited: true })}</div>`
      + `<p class="pv-label" style="margin-top:16px">座位行：长模型名先省略号（等级不消失）</p>`
      + `<div class="pv-seat">${seat({ provider: 'xiaomi', model: 'Mixtral-8x7B-Instruct-v0.1-super-long-model-name-tail', effort: 'High', open: false, edited: false })}</div>`
      + `</div>`
      + `<div class="pv-pane"><p class="pv-label">参数面板（齿轮）</p>${settingsPanel()}</div>`
      + `</div>`,
    extraCss: '.pv-seat { width: 360px; padding: 8px 0; border-top: 1px solid var(--zmd-line); border-bottom: 1px solid var(--zmd-line); }',
  })]
}

/**
 * Write the settings-page fixture: the 560 ledger (well open + retry editor +
 * catalog region with the discovery checklist), 484, 106 and the empty state.
 * @returns the path written.
 */
export async function writeSettingsFixtures() {
  return [await writeFixture('_ink-settings.html', {
    title: '模型配置页 · 墨色静态预览',
    body: `<div class="pv-stage">`
      + `<div class="pv-pane"><p class="pv-label">560：页首陈述 + 账本 + 设置井展开（重试编辑器）+ 目录区展开（发现清单）</p>`
      + `${settingsPage({ width: 560, pane: 'settings-560', readout: '9 个提供商可用，2 个需要处理', rows: LEDGER_560 })}</div>`
      + `<div class="pv-pane"><p class="pv-label">484：井标签列 56px，账本行仍 48px</p>`
      + `${settingsPage({ width: 484, pane: 'settings-484', readout: '4 个提供商可用，1 个需要处理', rows: LEDGER_484 })}</div>`
      + `<div class="pv-pane"><p class="pv-label">106：宿主真机最窄内容列，全部堆叠</p>`
      + `${settingsPage({ width: 106, pane: 'settings-106', readout: '3 个提供商，全部可用', rows: LEDGER_106 })}</div>`
      + `<div class="pv-pane"><p class="pv-label">空态：一句就绪陈述 + 添加入口</p>`
      + `${settingsPage({ width: 560, pane: 'settings-empty', readout: '尚未添加任何提供商', rows: [], empty: true })}</div>`
      + `</div>`,
  })]
}

/** Write every fixture of this language. */
export async function writeAllFixtures() {
  const cards = await writeCardFixtures()
  const seats = await writeSeatFixtures()
  const settings = await writeSettingsFixtures()
  return [...cards, ...seats, ...settings]
}

/* `node scripts/_preview-ink.mjs` writes every fixture; imported use calls a writer. */
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const written = await writeAllFixtures()
  for (const path of written) console.log(`wrote ${path}`)
}
