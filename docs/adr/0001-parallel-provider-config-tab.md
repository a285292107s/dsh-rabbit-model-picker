---
status: superseded by 0003
date: 2026-10-16
---

# 0001. 以新增平行 tab「模型配置」承载提供商级配置，不遮蔽官方「模型」页

> ⚠️ **本决策已被 [0003](./0003-parallel-tab-with-full-parity.md) 取代**（中途曾短暂被 0002 取代）。
> 「新增平行 tab、用新 id 并存、不遮蔽官方页」的部分被继承；
> 「官方页永久作全功能兜底、本插件**不复刻**官方语义层、只做提供商级主干」的部分被推翻——
> 最终决定是**功能对等**。

## 状态

`superseded by 0003`

## 背景

用户要一个「设置 → 模型 页的优化版」，重点是把配置提供商的步骤数压到最少。

既有分析 `docs/settings-models-tab-feasibility.md` 把选项收敛为两条：
路线 A（用 `settings.models.provider-card` / `footer` 三个官方扩展位加卡片）、
路线 B（以 `priority: -10` 遮蔽 `settings.section` 的 `id: 'models'`，整体替换）。

追问中重新核对宿主 slot 契约，发现第三条路：`settings.section` 的 `kind` 是 `list`，
**一个 list 条目就是一个设置页**，registrant options 只有 `id` / `order` / `label`。
因此用**新 id** 注册就是新增一个 tab，与官方 `id: 'models'` 并存，不触发按 id 遮蔽。

同时核对到官方模型页背后有一整套语义层：`ModelsSettingsStore` 的代际控制与只读态、
`ModelsOperations` 的乐观并发（`expectedRevision` → `conflict`）、首启姿态、
删除的两步语义、五个推送失效事件。路线 B 要逐条复刻。

## 决策

我们**新增**一个平行的设置 tab「模型配置」，只承载**提供商级**主干
（凭据 / 协议 / 启停 / 模型发现），**不遮蔽**官方「模型」页——
官方页保留为全功能兜底，本插件不复刻官方页的语义层。

## 后果

**正面**

- 纯加法：不注册就没有任何影响，卸载即还原；官方页行为完全不受本插件影响。
- 不必复刻 `ModelsSettingsStore` / `ModelsOperations`，省掉一整层并发、凭据与首启语义。
- 与官方页共用同一套写入通道，两边看到的是同一份设置文档。

**负面**

- **设置里将出现两个与模型相关的 tab**，其中一个叫「模型配置」却不含模型列表。
  这是刻意的，但只有本文与 `CONTEXT.md` 能阻止后人把它误读为功能遗漏。
- 写入必须自己承担乐观并发：`expectedRevision` 不匹配会回 `conflict`，
  而官方页同时开着是真实场景，不是理论边界。
- 功能边界要长期守：任何「把某个官方页功能也搬过来」的请求都得先判断它属不属于主干，
  否则本页会退化成第二个官方页，白白付了并存的双份维护成本。

**中性**

- 导航位置由注册的 `order` 决定；侧栏导航行类型是 `{ id, order, label }`，
  **没有 icon 字段**，所以新 tab 与现有 tab 在导航里同构。

## 替代方案

| 方案 | 为何未采用 |
|---|---|
| 路线 A：挂 `settings.models.provider-card` / `footer` 扩展位加卡片 | 只能拿到「卡片内的附加区」，碰不到官方页的 provider 行与按钮，无法把四项操作压到一屏，满足不了 Q1 |
| 路线 B：遮蔽 `id: 'models'` 整体替换 | 需逐条复刻官方语义层，成本高一个数量级；遮蔽是全局的，且升级时失败模式是「页面还在但功能不对」，不是干净报错 |
| 新增 tab，但功能对齐到可以取代官方页 | 与「减少步骤」的目标无关，却承担了全部复刻成本；官方页仍作兜底时这层成本没有对应收益 |

## 相关

- `CONTEXT.md` → 「配置域」（凭据 / 协议 / 模型发现 / 休眠提供商 / 收养）、「表面」→ 模型配置
- [docs/settings-models-tab-feasibility.md](../settings-models-tab-feasibility.md) §7：本决策的核查过程与 Q1–Q4 结论
