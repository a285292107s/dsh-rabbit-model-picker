/**
 * Copy for this plugin's own surfaces.
 *
 * The dictionaries register into the Client locale service under this plugin's
 * own namespace, so the seat follows the active language like every other
 * surface. A local lookup is kept as well: an external plugin must still render
 * readable copy if the locale face is unavailable, and the registration then
 * simply omits its `locale` seat.
 *
 * @module dsh-rabbit-model-picker/client/dictionary
 */

import type { Translate } from './contract.ts'

/** Locale namespace owned by this plugin. */
export const NS = 'dsh-rabbit-model-picker'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<string, string> = {
  'provider.account': 'DeepSeek 账号',
  'provider.all': '全部',
  'provider.group': '模型提供商',
  // The rail scopes the LIST, never the search: a query that hits models under
  // another provider says how many instead of reading as "no such model".
  'provider.elsewhere': '其他提供商还有 {count} 个匹配',
  'provider.showAll': '显示全部',
  'provider.failed': '加载失败',
  'empty.provider': '该提供商没有可用模型。',
  'empty.providerSearch': '这个提供商里没有匹配的模型。',
  'trigger.fallback': '请选择模型',
  'trigger.loading': '正在加载模型…',
  'trigger.selectAria': '请选择模型',
  // The trigger shows `provider/model` (§5.26), so the sentence names both: the
  // provider is what tells two same-named models apart, and a screen reader user
  // gets the same two-part identity the visible label carries.
  'trigger.aria': '选择模型，当前 {provider}/{model}',
  'trigger.ariaEffort': '选择模型，当前 {provider}/{model}，推理等级 {effort}',
  'menu.aria': '模型与推理等级',
  'menu.model': '模型',
  'search.placeholder': '搜索模型…',
  'search.clear': '清除搜索',
  'effort.providerDefault': 'Default',
  'badge.text.on': '文字输入',
  'badge.text.off': '不支持文字输入',
  'badge.image.on': '图片输入',
  'badge.image.off': '不支持图片输入',
  // "推理" is the verb form of the fact the column states, and the stem of the
  // panel's "推理等级" — the strip's key and the section title therefore call
  // the same concept by the same word (CONTEXT.md: 推理等级, matching the host's
  // own zh copy for `reasoning effort`).
  'badge.effort.on': '支持推理',
  'badge.effort.off': '不支持推理',
  'badge.context': '上下文窗口 {value}',
  'badge.rowAria': '{model}，{facts}',
  // The key to the strip's four columns, read once per card (see §5.24). One
  // short noun per fact, in the same order the columns are drawn: the words name
  // the columns so the row's glyphs do not have to be learned by hovering.
  'badge.key.text': '文字',
  'badge.key.image': '图片',
  'badge.key.effort': '推理',
  'badge.key.context': '窗口',
  'badge.keyAria': '每一行右侧陈述的四个事实',
  'status.loading': '正在刷新模型列表…',
  'error.action': '模型操作失败：{message}',
  'error.sessionInUse': '当前会话已被占用，可能是其他正在运行的 DSH 导致的（如其他 dsh web、桌面端），请退出其他正在运行的 DSH 后重试。',
  'action.reload': '重新加载',
  'warning.groupLoad': '{name} 加载失败：{message}',
  'search.empty': '没有匹配的模型。',
  'empty.models': '没有可用的模型。',
  'settings.open': '模型参数',
  'settings.openDeclared': '已自定义',
  'settings.openNoModel': '先选择模型，再编辑它的参数',
  'settings.openAria': '编辑 {model} 的模型参数',
  'settings.aria': '{model} 的模型参数',
  'settings.reset': '恢复默认',
  'settings.resetAria': '把 {model} 的参数恢复为适配器默认',
  'settings.resetNothing': '这条模型声明里没有可恢复的改动',
  'settings.listJoin': '、',
  'settings.loading': '正在读取当前参数…',
  'settings.busy': '正在应用这次选择，参数暂时不能改…',
  'settings.unavailable': '这个部署没有挂载设置服务，参数面板只能查看（推理等级仍可用）。',
  'settings.loadFailed': '读不到当前设置：{message}',
  'settings.unaddressable': '这个模型来自适配器内置目录，没有可编辑的声明，只能查看。',
  'settings.readonly': '当前配置不接受表单修改，参数面板只能查看。',
  'settings.writeFailed': '设置服务拒绝了这次修改：{message}',
  'settings.target': '写入位置：{ns} · {path}',
  'settings.input.title': '输入类型',
  'settings.input.text': '文字',
  'settings.input.image': '图片',
  'settings.input.audio': '音频',
  'settings.input.video': '视频',
  'settings.input.pdf': 'PDF',
  'settings.input.declared': '已声明：{list}',
  'settings.input.default': '尚未声明，当前按适配器默认：{list}',
  'settings.input.defaultUnknown': '尚未声明，也没有适配器默认；实际输入类型由适配器内部决定。',
  'settings.input.capability': '适配器内置目录公布：{list}',
  'settings.input.needOne': '至少要保留一项输入类型；要回到默认请用「恢复默认」。',
  'settings.context.title': '上下文窗口',
  'settings.context.declared': '已声明；留空并回车 = 恢复适配器默认',
  'settings.context.default': '尚未声明；适配器声明的兜底值是 {value}，实际容量由它内部决定',
  'settings.context.capability': '适配器内置目录公布：{value}（不可编辑）',
  'settings.context.unset': '尚未声明，也没有兜底值；只有这里填了才会覆盖适配器内部的值。',
  'settings.context.invalid': '读不出这个数值：请写 128K、1M 或 131072，范围 1024–10485760',
  'settings.effort.title': '推理等级',
  'settings.note': '输入类型与上下文窗口会直接写进适配器对这个模型的声明，立即生效，与「设置 → 模型」页改的是同一处；推理等级是会话级设置，不写进声明。',
}

/** English dictionary, complete against the zh key set. */
export const en: Record<string, string> = {
  'provider.account': 'DeepSeek Account',
  'provider.all': 'All',
  'provider.group': 'Model providers',
  'provider.elsewhere': '{count} more matching models in other providers',
  'provider.showAll': 'Show all',
  'provider.failed': 'Failed to load',
  'empty.provider': 'This provider has no available models.',
  'empty.providerSearch': 'No matching models in this provider.',
  'trigger.fallback': 'Select model',
  'trigger.loading': 'Loading models…',
  'trigger.selectAria': 'Select model',
  'trigger.aria': 'Select model, current {provider}/{model}',
  'trigger.ariaEffort': 'Select model, current {provider}/{model}, reasoning effort {effort}',
  'menu.aria': 'Model and reasoning effort',
  'menu.model': 'Model',
  'search.placeholder': 'Search models…',
  'search.clear': 'Clear search',
  'effort.providerDefault': 'Default',
  'badge.text.on': 'Text input',
  'badge.text.off': 'No text input',
  'badge.image.on': 'Image input',
  'badge.image.off': 'No image input',
  'badge.effort.on': 'Supports reasoning',
  'badge.effort.off': 'No reasoning',
  'badge.context': 'Context window {value}',
  'badge.rowAria': '{model}: {facts}',
  'badge.key.text': 'Text',
  'badge.key.image': 'Images',
  'badge.key.effort': 'Reasoning',
  'badge.key.context': 'Window',
  'badge.keyAria': 'The four facts each row states',
  'status.loading': 'Refreshing model list…',
  'error.action': 'Model operation failed: {message}',
  'error.sessionInUse': 'This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.',
  'action.reload': 'Reload',
  'warning.groupLoad': '{name} failed to load: {message}',
  'search.empty': 'No matching models.',
  'empty.models': 'No models available.',
  'settings.open': 'Model parameters',
  'settings.openDeclared': 'customized',
  'settings.openNoModel': 'Select a model first, then edit its parameters',
  'settings.openAria': 'Edit parameters of {model}',
  'settings.aria': 'Model parameters for {model}',
  'settings.reset': 'Restore defaults',
  'settings.resetAria': 'Restore the adapter defaults for {model}',
  'settings.resetNothing': 'This model has no declared change to restore',
  'settings.listJoin': ', ',
  'settings.loading': 'Reading the current parameters…',
  'settings.busy': 'Applying this selection; the parameters cannot be changed for a moment…',
  'settings.unavailable': 'This deployment mounts no settings service, so the panel is view-only (reasoning effort still works).',
  'settings.loadFailed': 'Cannot read the current settings: {message}',
  'settings.unaddressable': 'This model comes from the adapter’s installed catalog and has no declaration to edit, so it is view-only.',
  'settings.readonly': 'This configuration does not accept changes; the parameters are view-only.',
  'settings.writeFailed': 'The settings service refused this change: {message}',
  'settings.target': 'Written to: {ns} · {path}',
  'settings.input.title': 'Input types',
  'settings.input.text': 'Text',
  'settings.input.image': 'Image',
  'settings.input.audio': 'Audio',
  'settings.input.video': 'Video',
  'settings.input.pdf': 'PDF',
  'settings.input.declared': 'Declared: {list}',
  'settings.input.default': 'Not declared yet; the adapter default is: {list}',
  'settings.input.defaultUnknown': 'Not declared, and the adapter states no default; the adapter decides which input types it serves.',
  'settings.input.capability': 'The adapter’s installed catalog publishes: {list}',
  'settings.input.needOne': 'Keep at least one input type; use “Restore defaults” to go back to the default.',
  'settings.context.title': 'Context window',
  'settings.context.declared': 'Declared; clear it and press Enter to fall back to the adapter default',
  'settings.context.default': 'Not declared; the adapter states a fallback of {value}, but the capacity it actually uses is its own decision',
  'settings.context.capability': 'The adapter’s installed catalog publishes {value} (not editable)',
  'settings.context.unset': 'Not declared, and there is no fallback; only a value here overrides whatever the adapter uses internally.',
  'settings.context.invalid': 'That is not a capacity: use 128K, 1M or 131072, between 1024 and 10485760',
  'settings.effort.title': 'Reasoning effort',
  'settings.note': 'Input types and the context window are written straight into the adapter’s declaration for this model and take effect immediately — the same place Settings → Models edits. The reasoning effort is a session setting and is not written into the declaration.',
}

/**
 * Substitute `{name}` placeholders in one template.
 *
 * Exported so the unit gate can build a translator out of this dictionary and
 * assert the real copy rather than a stub of it.
 * @param template - the dictionary entry.
 * @param params - placeholder values.
 * @returns the resolved text.
 */
export function interpolate(template: string, params?: Record<string, string>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match)
}

/**
 * Pick a dictionary without the locale service: the locale plugin keeps
 * `<html lang>` in sync with the active language, so it is the one signal a
 * plugin can read here.
 * @returns the local translator.
 */
export function localTranslate(): Translate {
  const language = typeof document === 'undefined' ? '' : document.documentElement.lang
  const dictionary = language.toLowerCase().startsWith('zh') ? zh : en
  return (key, params) => interpolate(dictionary[key] ?? en[key] ?? key, params)
}

/** Dictionaries in the shape `locale.register(ns, { zh, en })` expects. */
export const dictionaries: Record<string, Record<string, string>> = { zh, en }
