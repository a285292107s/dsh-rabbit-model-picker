# 设计方案：`dsh-rabbit-model-picker`（替换输入框右下角模型选择器）

> 状态：**已实现**（本文档在动工前逐条核对了宿主契约，见 §2 的「核对结果」）。
> 目标：在不改 DSH 安装目录的前提下，用本地外部插件遮蔽 `conversation.input.model` 座位，
> 解决两个痛点：**模型太多难找**、**两级菜单太绕**。`/model` 弹窗与数据层保持原样。
>
> **2026-10-02 改版（§5.11）**：行内不再是"改等级的控件"——既然模型参数面板已经能改等级，
> 每行改成**四个只读事实徽章**（文字 / 图片 / 推理 / 上下文窗口），图标自绘；等级只在齿轮里改。
>
> **2026-10-02 第三次反馈（§5.13）**：提供商范围改为**记住的偏好**；修掉参数面板滚到下半截
> 就没有底色的缺陷（根因是 `MenuSurface` 的底色层是绝对定位子元素，参数面板自己滚就把它带走了）；
> 触发器不再在模型名旁边重复推理等级。
>
> **2026-10-02 第四次反馈（§5.14）**：参数面板的说明文字做**价值与可读性**审查——11px 说明文字
> 原本用 `label-caption`，在浅色卡片上只有 2.08:1（深色 3.82:1），全部换成
> `label-secondary`（浅 5.64:1 / 深 9.40:1）、层级改由字号承担；"哪个状态说哪句话"
> 从 JSX 三元移进纯模块 `panelCopy.ts` 并由单元门按真实文案断言（顺带补上没有解释的 `busy` 状态、
> 去掉不可寻址分支里说三遍的同一句话）；新增 `scripts/check-contrast.mjs`：
> 读宿主令牌表、按两种可能的下层底色合成卡片底色、逐样式按其**画出来的字号**判 WCAG AA。
>
> **2026-10-15 第十二次反馈（§5.25）**：提供商栏与模型列表合成**一张卡的两个窗格**（左范围、右模型）；
> 卡片放宽到 520px 并新增 ≤536px 的单栏/横向条折叠；`全部` 回到提供商栏第一行，收窄的出口就是它；
> 座位上的 chip 退化成**只陈述"当前模型所属 provider"的只读事实**（不再是控件、不再有两态）；
> 搜索不被范围限制（越界命中被计数并给出口）；`ProviderMenu.tsx` 与九个文案键一并删除。
>
> **2026-10-15 第十三次反馈（§5.26）**：提供商名**并进触发器**，座位行变成
> `提供商/模型名 · 推理等级`（那个只读 chip 删除——同一件事不说两遍）；提供商栏的范围**不再持久化**，
> **每次打开都从当前会话的 provider 开始**（`prefs.ts` 及其单元门删除，改为 `retiredScope.ts`
> 一次性清理旧键）。

---

## 1. 目标与非目标

**目标（可验收）**

1. 输入框右下角显示新控件，且只有**一层**列表：模型与提供商范围都不需要进二级面板；
   每行把自己的事实（输入模态 / 等级 / 上下文窗口）以**只读徽章**陈述出来，行内没有任何子控件。
   （2026-10-15 起"一层"改述为**一张卡两个窗格**：提供商不是二级面板，而是同一张卡的提供商栏，见 §5.25。）
2. 搜索**常驻**，跨 provider 模糊匹配；**按 provider 分组、可按 provider 窄化**，长目录不用滚很久。
   （原目标是"'最近使用'置顶"：先被 §5.16 改成菜单里的一个选项，再被 §5.21 整体删除。）
3. 与 `/model` 弹窗共享同一份选择状态（任一处切换，另一处同步）。
4. 浅/深两主题可读；窄屏折叠为图标不挤爆工具行；键盘可完整操作。
5. 不修改 DSH 安装目录；删除 profile 中的插行即可完全回退。
6. **（追加需求）** 模型触发器**左边**再放一个提供商选择器：选中某个提供商后，模型列表
   只列该提供商的模型——这是「提供商太多 / 列表太长」的第二道闸门。
   （2026-10-15 起这个选择器**移进模型卡的提供商栏**，座位上的同名 chip 变成只读事实，见 §5.25；
   同日晚些时候那条只读事实**并入触发器标签**（`提供商/模型名`），范围也不再记忆、每次打开
   取当前会话的 provider，见 §5.26。）
7. **（追加需求，2026-10-02）** 右侧齿轮打开模型参数面板，真读写输入类型 / 上下文窗口 / 推理等级；
   行内徽章只陈述这些参数的事实，**不做**任何就地修改。

**非目标**

- 不替换 `/model` 命令弹窗，不改 Host 侧选择逻辑。
- 不做任意 effort 输入（只提供适配器声明的档位），不新增收藏/置顶/快捷键（后续增强）。
- 行内徽章不提供"就地把这个模型改成支持图片"之类的编辑动作：写入只有一个门（参数面板），
  免得同一件事有两个入口、两份反馈。

---

## 2. 约束（既有契约）与逐条核对结果

核对基准：源码 checkout `C:\Users\28529\Desktop\deepseek-harness`（git `639ed01539`）与
运行中的安装版 `@deepseek-ai/dsh@0.2.0-rc.2`（两者版本号一致，且安装版 `lib/client.js`
内嵌注释与源码逐段一致，故行号引用可信）。

| 契约 | 核对结果 | 出处 |
|---|---|---|
| 插槽 `conversation.input.model`，`kind: 'single'`，`scope: 'session'`，owner props 仅 `locked` | ✅ 一致 | `packages/client/ui-conversation/src/client/contract/slots.ts:218-223` |
| 同优先级重复注册**抛错**；不同优先级＝遮蔽，**最低者渲染** | ✅ 一致（安装版含同一句错误文案） | `packages/client/ui-slots/src/index.ts:1212-1219, 1278-1284` |
| `priority` 是 register 选项，默认 0，升序、最低者胜 | ✅ 一致 | 同上 `:787-793` |
| 声明等待：必须 `ctx.slots.inject(name, cb)` | ✅ 官方占用者同样如此 | `ui-model-selection/src/client/index.ts:172` |
| 座位面 `ModelSelectInjected = { available, directory: SnapshotStore<ModelDirectoryState>, load(), select() }` | ✅ 字段名逐一比对 | `ui-model-selection/src/client/slots.ts:13-26` |
| 目录状态字段 `current / retainedEffort / routable / groups / failures / status / pending / error` | ✅ 逐一比对 | `ui-model-selection/src/client/directory.ts:18-35` |
| 与 `/model` 共用同一实例：`ctx.modelDirectories.directoryFor(sessionId)` | ✅ 同一 service（`ModelDirectoryResolver`） | `ui-model-selection/src/client/service.ts:37-90` |
| **调用方注入要求**：service 方法跑在 Cordis 调用方上下文追踪下，`directoryFor()` 内部读 `this.ctx.remote.session`——**调用方 fiber 必须自己 inject `remote` + `remote.session`**，否则 `cannot get property "remote.session" without inject` 从 inject 面抛出、该座位**让位**给原占用者（静默回退） | ⚠️ 初版漏了这两项，实测被检出并修好（见 §8 验收记录） | `ui-model-selection/src/client/service.ts:38,76`；官方占用者 `ui-model-selection/src/client/index.ts:107` 同样声明 |
| 会话可用性：`sessions.subagentAddress(sessionId) !== undefined` → 不可用 | ✅ 照搬 | `ui-model-selection/src/client/index.ts:176-188` |
| 窄屏折叠：宿主设 `--dsh-composer-model-text-display` / `--dsh-composer-model-icon-display`，座位必须消费 | ✅ 两个变量名的**默认值方向**与官方 CSS 完全一致（text 默认 `block`，icon 默认 `none`） | `ui-conversation/.../InputBar.module.css:269-272`；`ui-model-selection/.../ModelSelect.module.css:66-76` |
| 共享模块基线 | ✅ `react`、`react/jsx-runtime`、`react-dom`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`、`@deepseek-ai/cordis` | `packages/client/web/src/platform.ts:8-14` |
| 基线是**隐式**外部依赖，**不要**写进 `dsh.client.external` | ✅ 明确规则 | `packages/client/AGENTS.md:78` |
| `dsh.client.inject` 只是**信息性**包名边，不决定激活顺序；激活顺序由 Cordis service inject 决定 | ✅ 明确规则 | `packages/client/AGENTS.md:144` |
| 产物形态：`exports["./client"]` + `dsh.client.platform='web'`，文件是 `window.__ModuleLoader__.load({ id, factory })` | ✅ 照抄 tokbook 构建脚本的接线自检 | `packages/client/modules/README.md:34-50` |
| 外部插件不能用仓库 CSS Modules；用 `--dsw-*` 语义令牌 + 自注入样式表 | ✅ 本插件 CSS 零硬编码色值（自检强制） | `docs/web-styling.md` |
| 菜单硬性要求：可外点/Esc 关闭、视口内不越界（留边距）、不被 `overflow` 裁剪（portal） | ✅ 用 `MenuSurface` + `useAnchoredPosition` + `createPortal` | `ui-primitives/src/useAnchoredPosition.ts`、`MenuSurface.tsx` |
| 允许运行时 import `ui-primitives` | ✅ 明文允许："Shared runtime code belongs only in a narrow static owner such as `client/store`, `ui-primitives`…" | `packages/client/AGENTS.md:37` |

**核对中发现的两处设计稿偏差（已按实际实现修正，不改变验收目标）**

1. `useAnchoredPosition` **只做锚定 + 视口内夹取，不做翻转**（它按 `side` 单向计算后 clamp）。
   因此「翻转」由本插件自己做决定：参数面板在打开瞬间按齿轮的视口余量选择 `top`/`bottom`
   （提供商菜单同理；行内的小菜单已在 §5.3 的改版中删除，这条现在是两处而非三处）。
2. 设计稿说「抄 tokbook 的 `selfcheck-ui`」，但 tokbook 的 `selfcheck-ui.ts` 其实是**静态样式禁令检查**，
   不是 Playwright。因此拆成两层：`scripts/selfcheck-static.mjs`（静态禁令 + 座位契约断言）＋
   浏览器人工/工具验证（Playwright CLI）。

### 2.1 追加契约核对：模型参数到底能不能真的写进去（2026-10-02 复核）

参数面板初版把「文字 / 图片 / 上下文窗口」做成**本插件自己的 localStorage 记录**，理由是座位目录
`session/modelCatalog` 每条只有 `{ provider, model, reasoning }`。这次复核把结论推翻了一半：
**座位目录确实没有这些字段，但 Host 的配置面可以直接读写模型参数**，而且适配器把参数声明为
volatile（= 允许在线改）——这正是「设置 → 模型」页改同一批字段所走的路。

| 契约 | 核对结果 | 出处（安装版 `@deepseek-ai/dsh`） |
|---|---|---|
| `llm/listConfigurableProviders(): { provider, displayName, settingsNs, settingsPath, declared?, error? }[]` | ✅ 存在，且是"路由 → 配置位置"的权威映射 | `dsh-llm/lib/typert.host.js:21-29`；`dsh-api-settings-controller/lib/types/index.js:122-129` |
| `settings/describe(): { writable, hasDocument, namespaces: [{ ns, schema, value, base?, user?, applies, secrets, revision }] }` | ✅ 无参数；`value` 是合并后的有效值、`user` 是 profile patch、`revision` 是写入门票 | `dsh-settings/lib/types/index.js:270-311`；`dsh-api-settings-controller/lib/types/index.js:61-72` |
| `settings/mutate(ns, ops, expectedRevision)`，ops 形态 `{ op:'set'\|'unset', path, value? }` | ✅ 只接受 volatile 路径；非 volatile 抛 `Config field "…" is not volatile` | `dsh-settings/lib/types/index.js:330-357`；`dsh-settings/lib/index.js:188-215` |
| 冲突码：`settings/conflict`（revision 不匹配）/ `settings/rejected`（schema 拒绝） | ✅ 客户端要重读再重试，并把拒绝原话显示出来 | `dsh-api-settings-controller/lib/index.js:493-507` |
| `llm-pi-ai`：模型参数字段 `contextWindow / maxTokens / input（模态）/ reasoningEfforts`，整个 `providers` 是 volatile | ✅ 写路径合法且生效 | `dsh-llm-pi-ai/lib/index.js:1003-1010, 1051`（`z.dict(profile).default({}).volatile()`）；解析顺序 `entry.contextWindow ?? base?.contextWindow ?? request.defaultContextWindow`（`:675-687`） |
| `llm-deepseek`：`models[]` 的 `contextWindow / inputModalities / maxTokens`，`models` 数组 volatile | ✅ 同上 | `dsh-llm-deepseek/lib/index.js:301-303, 321` |
| 适配器监听 `loader/volatile-update` 并重解析目录 | ✅ 在线改完不需要重启 | `dsh-llm-pi-ai/lib/index.js:2628`；`dsh-llm-deepseek/lib/index.js:2269` |
| 座位目录仍只有 `{ provider, model, reasoning }` | ✅ 复核确认：面板显示的值只能从 `settings/describe` 读，不能从座位读 | `dsh-api-session-controller/lib/types/catalog.js:10-59` |

**由此定稿**：面板三个字段全部走真实写入口；「路由 → 位置」用 `listConfigurableProviders`，
值用 `describe.value`，「这一项是不是你自己声明的」用 `describe.user`，写入用 `mutate` + revision。
模型来自适配器内置目录（配置里没有声明条目）时**没有可编辑的声明**——`modelOverrides` 是 pi-ai 给这类
路由的入口，但它与 `models` 列表互斥（`dsh-llm-pi-ai/lib/index.js:645-655`），不能凭空造。

### 2.2 追加契约核对：内置目录里的模型，能力到底读不读得到（2026-10-04 复核）

用户提问原文：「当前模型来自适配器内置目录，没有可编辑的声明，只能查看。那么能够读取这个模型是否支持
图文、上下文窗口大小等数据吗？能就展示出来。」读不到就只能承认读不到，所以先把通路逐条核实：

| 契约 | 结论 | 证据 |
|---|---|---|
| 座位目录仍只有 `{ provider, model, reasoning }`（`buildModelCatalog` 解析了 `inputModalities` / `context` 却**只保留 reasoning**） | ✅ 座位目录读不到 | `dsh-api-session-controller/lib/types/catalog.js:10-59`（第 16 行 resolve，第 29-34 行只留 id/name/description/reasoning） |
| `llm/discoverModels(settingsNs, { provider })` 是 `@Remote`，返回 `{ id, name?, contextWindow?, maxTokens?, inputModalities? }` | ✅ 客户端可调，且字段够用 | `dsh-llm/lib/typert.remote-client.js:40-75`（`implementation: remoteDiscoverModels`）；返回结构同文件 `:14-20` 的 zod schema |
| 官方 pi-ai 的 discovery 对**自己发布过**的路由直接回答安装目录，对**只在配置里出现**的路由会去问 endpoint | ⚠️ 后者会联网 + 用凭据，**因此必须避开** | `dsh-llm-pi-ai/lib/index.js:2286-2298`（`catalogModels(provider)` 命中即返回，否则要求 baseURL 并 fetch 列表） |
| 适配器目录里的 `declared` 正是"它只从配置知道这个路由"的自述 | ✅ 这就是避开的判据 | `dsh-llm/lib/types/types.d.ts:236-244`（`declared?: boolean` 的语义就是这条） |
| `dsh-opencode-go` 不注册 configurable provider，**在设置目录里根本不存在**，所以第 2 行那条路对它无效 | ✅ 它对 `resolveRoute` 永远是 null（这正是用户看到的状态） | `dsh-opencode-go/lib/index.js` 全文无 `registerConfigurableProviders`；本机 profile 的 `cordis.patch.yml` 里也没有 `dsh-opencode-go` 的声明条目 |
| 但它把自己的目录挂在 `opencodeGoModels/read` 上，条目含 `inputModalities`（models.dev 的 5 个 token）/ `contextWindow` / `maxTokens` | ✅ 唯一读得到它的路 | `dsh-opencode-go/lib/types/models-contract.d.ts`（`GoModel` + `INPUT_MODALITIES`）；`lib/index.js:1417-1430`（`describeConfiguredModels`）、`:1466-1476`（`discoverSettingsModels` 把 `details` 的 modalities 合进条目） |
| 适配器自己的解析顺序是 `声明 ?? 安装目录 ?? provider 默认` | ✅ 徽章按同一顺序才对得上实际生效值 | pi-ai `:675-687`（`entry.contextWindow ?? base?.contextWindow ?? request.defaultContextWindow`、`declaredInput(entry.input) ?? base?.input ?? defaultInput`）；opencode-go `modelInfo()` `:1615-1622` |
| remote 命名空间一律注册成 `remote.<namespace>` 服务，且由**拥有者**在自己激活时 `$mount` | ✅ 只能按需 `ctx.get`，不能激活时抓一次 | `dsh-api-gateway/lib/client.js:1919-1930`（`super(ctx, remoteServiceKey(name))`）、`:2040-2042`（键名 `remote.${namespace}`）、`:1964-1970`（方法调用用的是命名空间服务自己的 ctx，**不要求调用方 inject**） |

**由此定稿**：能力事实走**两层**读取——先看适配器**自有**的目录 Remote（按 provider 路由登记），
没有登记才用 `llm/discoverModels`，且**只在 `entry.declared !== true` 时**用。两者都答不了就
保持"什么都没公布"，面板不画分区、行内不出徽章。

---

## 3. 三处细节的定稿（已确认）

1. **effort 交互**（2026-10-02 改版，见 §5.11）：**行内不改等级**。参数面板的推理等级的档位是唯一入口；
   行内只用一个只读徽章陈述"这一行生效的档位"。初版的行内 `pill` + 锚定小菜单已删除
   （`EffortMenu.tsx` 不再存在）——同一件事有两个入口时，两侧反馈必然出现分歧。
2. ~~**最近使用范围**：**全局共享**一份 `localStorage`（模型偏好通常不分会话）。~~
   **已作废（§5.21）**：「最近使用」机制整体删除，这条没有对象了。
3. **搜索时的分组**：**保留 provider 分组**，组内用 `rankByName` 排序、**组间按各自最佳匹配名次重排**。
4. **（追加需求）提供商范围**：做成**纯视图状态**——只在模型列表里收窄，**绝不写 Host**。
   因此 `/model` 弹窗照旧列全部提供商，触发器也**始终显示真实选择**，即使它被当前范围排除。
   范围是**记住的偏好**：切完模型仍是那个提供商（便于连续挑同家模型），刷新页面/重开会话也还是它
   （存本插件自己的 `localStorage`，见 §5.9 与 §5.13）。

---

## 4. 包结构

```
dsh-rabbit-model-picker/
  package.json             # exports "."/"./client"/"./package.json"；dsh.client.platform=web
  tsconfig.json            # 仅用于 tsc --noEmit 类型检查
  src/index.ts             # 宿主半边：空 apply（行必须存在，行为为空）
  src/client/index.ts      # inject 声明（含 remote/remote.session）；ctx.get 取 settings/llm 面（取值函数，非激活时抓取）；slots.inject → register(priority:-10)
  src/client/contract.ts   # 外部结构类型（座位面/目录 store/插槽 registry/settings+llm remote/locale 面）+ 行身份 `rowKey`（原住 recent.ts，§5.21）
  src/client/Picker.tsx    # 触发器（`提供商/模型名 · 等级`）+ 齿轮 + 单层模型卡（搜索 / 分组 / 行内只读事实徽章）
  src/client/BadgeIcons.tsx# 四个徽章图标（16×16 自绘；只有"具备这个事实"一种形态）
  src/client/badges.ts     # 行内事实推导（纯函数）：resolveRoute + 能力目录 + reasoning → 该行能说的 1–4 条事实
  src/client/capabilities.ts # 适配器发布的能力目录（只读）：登记 reader、按需读取、按 rowKey 索引（§5.19）
  src/client/adapterCatalog.ts # 适配器自有目录的路由表与读取器（"还没挂载"≠"什么都没发布"，§5.27）
  src/client/snapshotEq.ts # "订阅者看得见的东西变了吗"——两个 store 的 publish guard 共用（§5.28）
  src/client/focusChain.ts # 卡片的 Tab 链：从渲出的 DOM 里读，只在某状态下出现的控件也够得到（§5.29）
  src/client/effort.ts     # 推理等级的档位的命名与列表（参数面板与行内徽章共用同一套说法）
  src/client/SettingsMenu.tsx # 模型参数面板（输入类型 / 上下文窗口 / 推理等级 + 写入位置与失败原话）
  src/client/params.ts     # 参数寻址与读写：show 快照 ← describe，resolveRoute(route) → 地址，write() → mutate
  src/client/ProviderRail.tsx # 模型卡提供商栏：范围列表（全部 + 各 provider + 失败行），listbox + roving focus（§5.25）
  src/client/retiredScope.ts # 旧范围记录的键前缀 + 一次性清理（§5.26 起这里只剩数据契约，没有行为）
  src/client/RetryEditor.tsx # 「模型配置」页提供商行内展开的重试编辑器（§5.33）
  src/client/retryPolicy.ts # 重试策略的解析与等待曲线（纯函数：编辑器渲染的每个数都由它算出，§5.33）
  src/client/dictionary.ts # zh/en 文案 + 无 locale 服务时的本地兜底
  src/client/styles.ts     # 注入样式表（幂等）
  src/client/primitives.d.ts # 唯一运行时基线依赖（ui-primitives）的类型边界
  scripts/build-client.mjs # esbuild（宿主 + 浏览器）+ 接线自检
  scripts/selfcheck-static.mjs # 样式禁令 + 座位契约 + 死类双向比对 + 文案键 + 写入口契约 + 行内无控件契约 + 面板滚动/触发器/范围持久化契约 + 宽度预算（走一遍盒模型，§5.30）
  scripts/test-params.mjs  # 参数寻址/容量 + 行内事实推导 + 锚点丢失决策的单元门（假 DOM/假观察者/可控时钟）
  scripts/mutate-anchor-loss.mjs # "门自己的门"：15 条改坏必须条条变红；打不上去算失败（§5.31）
  scripts/_icons-probe.cjs # 徽章图标候选的浏览器对比图（开发用）
  scripts/_accept-capabilities.cjs # §5.19 浏览器验收（只读）：行内徽章 + 面板 + 两张证据截图
  scripts/_verify-fixes.cjs # 三次返工的浏览器验收（范围持久化 / 面板底色 / 触发器文案；只写 localStorage）
  DESIGN.md / README.md
```

**注册与数据流**

```
ui-conversation 声明 conversation.input.model
        │  ctx.slots.inject(name, cb)          ← 与声明顺序无关
        ▼
dsh-rabbit-model-picker  register({ priority: -10 })  ← 遮蔽默认 0 的 ModelSelect
        │  inject: (sessionId) => ({ sessionId, directory, available, params, ... })
        ▼
Picker ── useSyncExternalStore(directory.store) ──► 列表/搜索/每一行的事实徽章
        ├─ directory.select({provider, model, reasoningEffort}) ──► Host
        │           （与 /model 弹窗同一 store → 双向同步，无需额外代码）
        ├─（§5.26 起不再有任何持久化）范围只是组件状态，每次打开重置为当前会话的 provider
        ├─ useSyncExternalStore(params) ──► ① 齿轮的"已自定义"标记 ② 行内徽章的事实（只读快照）
        │         └─ badges.ts badgeSpecsOf(resolveRoute(snapshot, route), capabilityOf(route), reasoning, effort)
        │                    ──► 1–4 条 { fact, off, value, sentence }（纯函数，单元门覆盖）
        ├─ useSyncExternalStore(capabilities) ──► §5.19：适配器发布的能力事实（模型卡打开时 ensure）
        │         └─ capabilities.ts ensure(providers) ──┬─ 登记的适配器自有 Remote（opencodeGoModels/read）
        │                                                └─ llm/discoverModels（仅 declared !== true 的路由）
        └─ SettingsMenu ── resolveRoute(snapshot, route) ──► 地址（ns + entryPath + revision）
                     ├─ 显示：describe.value / describe.user / adapter 默认值 / 适配器目录公布的事实
                     └─ 写入：settings.mutate(ns, ops, revision) ──► profile 的 cordis.patch.yml
                                  └─ 冲突 → 重读一次再重试；拒绝 → 原话显示、值不动
                     等级那一项仍走 directory.select() ──► Host（面板是唯一入口）
```

状态划分：**外部数据**（catalog/current/pending/error）全部读 `directory.store`；
**设置快照**（provider 目录 + 各命名空间有效值/revision）读插件级的 `ParamsStore`（`useSyncExternalStore`），
行内徽章与参数面板读的是**同一份恢复值**；
**能力目录快照**（适配器自报的模态/窗口）读插件级的 `CapabilityStore`，同样是行内与面板共读一份（§5.19）；
**视图状态**（打开、查询、高亮行、toast、参数面板的输入框草稿与写入中/错误）用组件本地 `useState`；
**提供商范围**（`providerFilter`）也是本地状态，**生命周期只有一次打开**（§5.26），没有任何存储：
旧版本写在 `localStorage['dsh-model-picker.provider.*']` 的记录由 `retiredScope.ts` 在激活时清掉，
之后不再写。
模型参数**不落本地**——面板显示的一切都来自 Host 的 `describe`，
所以提交被拒时不会留下一个假的"已写入"；行内徽章同理（"查不到"就不画，绝不画成"不支持"）。

> 偏离说明（有意）：`packages/client/AGENTS.md:25` 要求业务组件不自己接订阅。
> 本插件与官方占用者 `ModelSelect.tsx:68-71` 用**同一写法**（`useSyncExternalStore` 读座位面的
> `directory` store）。理由：外部插件没有 `store` / `hooks` 隔间的声明通道（那是 register 选项里
> 面向同仓包的机制），而 `directory` 正是宿主提供的唯一共享快照。行为与官方座位逐字一致。

---

## 5. 交互规格

### 5.1 触发按钮

| 状态 | 表现 |
|---|---|
| 常态 | `[模型图标] 模型名`（**不带等级**：等级是参数，行内徽章陈述它、齿轮面板改它，见 §5.13）；完整信息进 `aria-label` 与 hover/focus 气泡 |
| 窄屏 | 由宿主 CSS 变量切换为仅图标；`Tooltip`（portal）在 hover/focus 显示完整信息 |
| 选择中 | 右侧 chevron 换成 `StateDot state="ongoing"`，`aria-busy` |
| `locked` | disabled |
| 当前模型不在目录 | 显示 `provider/model` 原文（沿用现行为） |

偏离说明：设计稿同时要求 `title` 与 `Tooltip`；两者并存会出现「原生气泡 + 自绘气泡」双气泡，
故只保留 `Tooltip`（portal，`side="top"`，`align="end"`）＋ `aria-label`，菜单打开时 `disabled`。

注记（2026-10-02 第三次反馈后定稿）：触发器**只写模型名**，不再跟一段 ` · 等级`。理由是等级本身
的边界变了——它现在是一个可以被齿轮面板修改的参数，行内用徽章陈述它、面板改它，触发器再重复一遍
只会在窄屏上和模型名抢宽度（§5.12 那次已经把名字宽度争到 122px，再挂一段等级又打回去一半）。
早先那版注释里关于「分隔符不能用伪元素画、必须作为独立元素渲染」的坑随之一并消失：
`.dmp-trigger-sep` / `.dmp-trigger-effort` 已删除，`selfcheck-static.mjs` 第 11 组断言它们不得回来。
`aria-label` **保留**「推理等级 {effort}」（`trigger.ariaEffort`）：那不是显示，屏幕阅读器不该因为这次
减负而少一条事实。

> **2026-10-15（§5.26）的补充**：触发器标签从"模型名 [+ 等级]"变成 **`提供商/模型名 · 等级`**——
> 提供商前缀并进来了（两个 provider 真的有同名模型），那个只读 provider chip 删除；`aria-label`
> 随之从"当前 {model}"改成"当前 {provider}/{model}"。等级分段的形态与理由（§5.13 反向恢复的那段）不变。

### 5.2 单层模型卡（核心改动）

从上到下：

1. **常驻搜索框**（打开即聚焦，带清除按钮；placeholder「搜索模型」）。
2. **provider 分组**（DeepSeek Account → DeepSeek → 其他按目录顺序；空组隐藏，粘性头）。
   列表里**从来没有过**除 provider 之外的分组：置顶的「最近使用」分组在 2026-10-03 被挪进提供商菜单
   （§5.16），「最近使用」本身又在 §5.21 被彻底删除。
3. **状态区**：加载中、整体失败+重试、部分 provider 失败+重试、空目录 / 无匹配 / 该提供商没有模型
   （`role="status"` 播报）。

**行结构**：`模型名（400 字重，可省略号）` + 右侧 **四个只读事实徽章** + 选中勾，
**同一行**内完成（2026-10-02 改版：初版是"模型名 + 行内 effort pill"，pill 已删）。

> 2026-10-15（§5.25）起，本节描述的"从上到下"改成了**左右两栏**：搜索框 / 表头 / 列表在模型列表，
> 提供商范围在提供商栏（窄屏时折成横向条放到模型列表上方）。第 2 条的"provider 分组"仍在，
> 但同一件事不再同时出现在 chip、popover 单选组和卡内提示条三处。

### 5.3 行内事实徽章（2026-10-02 改版，取代初版的"effort 原位切换"）

**为什么删掉行内改等级**：参数面板（§5.10）已经能改等级，而且是**唯一能真写进去**的地方；
行内再放一个改等级的入口，等于同一件事有两个反馈源。所以行内改成**只陈述事实**，
四个徽章的形态、顺序、语义都固定：

| 徽章 | 图标（自绘，见 §5.11） | 值 | 事实来源 |
|---|---|---|---|
| 文字输入 | 字母 `T` | 无（图标即结论） | `resolveRoute(...).input`，空则 `defaultInput` |
| 图片输入 | 相框 + 地平线 + 太阳 | 无 | 同上 |
| 推理 | 大脑（24×24 宿主同款造型） | 档位名（`High` / `Off` / `Default`） | 目录条目的 `reasoning` + 该行生效档位 |
| 上下文窗口 | 窗口（框 + 标题栏 + 内容线） | `1M` / `128K` / `786K`（**只出现整数 + K/M**） | `contextWindow`，空则 `defaultContextWindow` |

- **两态而不是三态（§5.24 收敛）**：supported（neutral 色调胶囊，图标 + 值）/
  **unknown（整条不渲染）**。这里曾经有第三态 unsupported（同一图标 + 斜杠 + quiet 色调），
  §5.24 把徽章条改成**固定四轨**之后它就成了死代码：行只渲染 `!off` 的事实，
  "没有这一项"由**空的轨道**陈述，比一个 14px 的斜杠图标清楚得多；`off` 事实的整句仍然
  进 `title` 与 `aria-label`（`badges.ts` 的 `off` 字段就是为这句话留的）。
  斜杠变体与其样式已于 2026-10-15 删除——**画不出来的东西不该留在代码和设计记录里**。
- **"查不到"绝不画成"不支持"**：这是 §6 里"不给按了没反应的开关"同一条原则的镜像。
- **推理徽章永远在**：模型没有 `reasoning` 元数据时，它说的是"未声明推理档位"（整句在 `aria-label` / `title` 里），
  因为"没有档位"本身就是一条事实；模态/窗口则可能整条缺席（见上）。
- **值来自 Host，不来自记忆**：`badges.ts` 的 `badgeSpecsOf` 是纯函数，输入是
  `resolveRoute(params 快照, route)` + `reasoning` + 该行生效档位 + 本地化函数，
  输出 1–4 条 `{ fact, off, value, sentence }`。Picker 每份目录/设置版本只算一遍（`useMemo` 成 `Map`），
  行渲染只取值——行会因鼠标移动重渲染，这一层不能每次重算寻址。
- **宽度预算（2026-10-02 二次返工，见 §5.12）**：一行要在 320px 卡片里同时装下「模型名 + 4 枚事实徽章
  + 选中勾」。`.dmp-badges` 是 `flex: 0 0 auto` 的**固定半边**（4 枚常见胶囊合计 ~151px），
  `.dmp-row-name` 是 `flex: 1 1 auto` 的**弹性半边**（`min-width: 48px` 是"还能认出是哪个模型"的下限，
  不是宽度预算）。名字长先省略号；档位名是适配器自由文本，所以 `.dmp-badge-value` 带
  `max-width: 64px` + 省略号，极端长的档位名只会截断自己的值，不会把最后那枚**上下文窗口**徽章顶出卡片。
  徽章条**不换行**（`flex-wrap: nowrap`）：换行会让行高随名字长度变化（实测 46px），列表扫读时会跳。
- **点徽章 = 点行**：徽章是 `Tag`（渲染 `span`）+ 属地 `aria-hidden`，行是唯一目标。
- 触发器**不再重复**这一行的事实（`模型 · 等级` 已去掉，见 §5.1/§5.13）：等级归徽章与参数面板，
  触发器只回答"现在是哪个模型"。

### 5.4 搜索

- 常驻，无「>4 个模型才显示」门槛。
- 复用 `rankByName`（前缀优先 → 对齐分 → 目录顺序）；保留 provider 分组，组间按最佳匹配名次上浮。
- 输入即筛；`↑↓` 在搜索框内移动高亮（`aria-activedescendant`，不夺焦点）；高亮行自动滚入视野；`Esc` 清空并保留焦点。

### 5.5 键盘

| 键 | 行为 |
|---|---|
| 打开 | 焦点落在搜索框；`↑↓` 移动行高亮；`Enter` 选中高亮行 |
| 行内 | **没有子控件**（2026-10-02 改版）：行是单一目标，`Enter` 只选行；`→` 不再有任何含义 |
| `Tab` / `Shift+Tab` | 在 提供商栏 → 搜索框 → 各行 之间遍历；链尾 Tab 回到提供商栏，链首 Shift+Tab 关闭并把焦点交还触发器 |
| `Esc` | 有查询→清空；否则关闭并归还焦点到触发器 |
| 外点 | 关闭 |

### 5.6 视觉

- 全部走 `--dsw-*` 语义令牌；材质/模糊/圆角由 `MenuSurface` 提供，不自造。
- 模型卡宽 ≤ 320px（`min(320px, 100vw - 32px)`）；定位 `useAnchoredPosition`（gap 8 / margin 12），`side:'top'`、`align:'end'`。
- 字号：模型名 13px/400；分组头与徽章为 caption 级（徽章 11px/400，`Tag` 胶囊）；字重不超过 600（仅重试按钮）。
- 行高 38px（实测量到的就是这个值）：单行放得下"名字 + 4 个 22px 胶囊 + 选中勾"。
- 胶囊宽度按**紧凑**定：图标格 = 字形本身（14px），水平内边距 4px，图标与文字间距 3px，胶囊间距 2px。
  两枚纯图标胶囊各 22px，`Default` 60.1px，`1M` 40.8px —— 常见四枚合计 **150.9px**。

### 5.7 可访问性

触发器 `aria-haspopup="menu"` / `aria-expanded` / `aria-controls` / `aria-label` / `aria-busy`；
列表 `role="menu"`、分组 `role="group"`、行 `role="menuitemradio"` + `aria-checked`；
行内的徽章条 `aria-hidden="true"`，整行的事实由行的 `aria-label` 一次性给出
（`"{模型名}，文字输入、不支持图片输入、支持推理、上下文窗口 1M"`，用 `badge.rowAria` + `settings.listJoin` 拼）；
模型名的 `title` 与徽章条的 `title` 分别给"完整名字"和"整句事实"；
状态区 `role="status"`；关闭后焦点归还触发器，再开重置查询与高亮。

### 5.8 粘性分组头的背景（缺陷修复，2026-10-01）

`MenuGroup` 的分组头是 `position: sticky; top: 0`，**背景默认透明**，只有
`observeStickyMenuGroups` 给它打上 `data-stuck` 之后才填 `--dsw-alias-menu-group-header-fill`
（`MenuGroup.module.css:19-33`）。问题在于那个观察器跑在渲染管线里
（`IntersectionObserver` + `ResizeObserver`），**页签在后台或窗口被遮挡时整条管线停摆**：
实测在后台页签里三个观察器**一个回调都没有**（`startFired = sizeFired = stripFired = 0`），
于是内容滚到粘性头下面时两层文字直接叠在一起——用户看到的就是这个。

这不是本插件引入的：**把插件摘掉、回到官方 ModelSelect 实测，同样 `anyStuck: false`、
粘性头背景 `rgba(0,0,0,0)`**。官方座位有同样的毛病。

处理：本插件**不依赖那个观察器**，直接给分组头填上宿主自己的那个令牌

```css
.dmp-groups [data-menu-group-heading] { background: var(--dsw-alias-menu-group-header-fill); }
```

代价是分组头**始终**带着这条 22px 的填充带（宿主原意是"只在被钉住时才有底色"），
换来的是任何页签状态下都不会出现两层文字重叠。`observeStickyMenuGroups` 的调用保留着
（它现在只是冗余；宿主哪天修好观察器也不会冲突）。两个卡片（模型 / 提供商）共用这条规则。

### 5.9 提供商范围控件（追加需求，2026-10-01）

> **2026-10-15（§5.25）整节被取代**：范围控件不再是座位上的一个按钮 + 一个独立 popover，
> 而是**模型卡自己的提供商栏**；座位上的 chip 退化为只读事实（只写当前模型所属 provider），
> 该只读事实又在**当日晚些的 §5.26 被并入触发器标签**（`provider/model`）。
> 本节的"位置 / 点击 / 菜单内容 / 选中后 / 键盘 / 与模型菜单的关系"六条按新形态见 §5.25 与 §5.26；
> 仍然成立的是：收窄只影响视图、不写 Host、不影响 `/model` 与触发器；记忆按会话且只记 id
> ——**最后这一条被 §5.26 反向**：范围不再记忆，每次打开都取当前会话的 provider。

| 维度 | 规格 |
|---|---|
| 位置 | 模型触发器**左边**，同一个座位内（同一 `dmp-root` flex 行），保证两个 chip 永远相邻 |
| 常态（2026-10-04 由 §5.22 改写） | `[提供商图标] 主语`——**两种状态、两个主语**：**收窄生效时** chip 写那个 provider，并转强墨色（`data-filtered`），与菜单的单选组逐行一致；**未收窄时** chip 写**当前模型所属的 provider**（次级墨色、`data-filtered` 不亮），它是关于"这个模型住在哪"的事实，**不是**"列表被收窄成了什么"。它仍然**不回答**"列表范围有多大"，也不回答"会话在用哪个模型"（后者是触发器的活，前者由模型卡内的分组头与提示条陈述）。**只有还没选中模型**（目录未答 / 新会话）时 chip 才是「全部」（`provider.all`），那个 `null` 分支不能删 |
| 窄屏 | 与模型 chip 一样消费 `--dsh-composer-model-text-display` / `--…-icon-display`，整对一起折成图标 |
| 点击 | 打开**锚定在 chip 上的**提供商小菜单（`MenuSurface` + `useAnchoredPosition`，portal） |
| 菜单内容 | 常驻搜索框 + 单个粘性分组「模型提供商」：各提供商（模型数）→ **加载失败的提供商排在最后、只列不可选**并标「加载失败」。**菜单里只有真实 provider 行**——`全部` 与 `最近使用` 两行已在 §5.21 删除。**这个会话正在用的那个提供商，行尾多一个「当前会话」**（§5.17） |
| 计数 | 取自已加载目录（`opencode-go 30`、`commandcode 19`…），tabular-nums；每一行的数字都等于点进去能看到的行数 |
| 选中后 | 模型列表收窄到该提供商；chip 写该 provider 名并转强墨色（`data-filtered`、`aria-label` 换成 `provider.chipAria`）；**模型卡内**出现一行 `仅显示 {name}` + 「显示全部」一键清除（§5.21：这是退出收窄的唯一出口；§5.22：清除后 chip 回到当前模型的 provider，不是「全部」） |
| 记住（2026-10-02 追加，2026-10-03 改为**按会话**） | 选择写进本插件自己的 `localStorage['dsh-model-picker.provider.v1:<会话 id>']`（`prefs.ts`），刷新页面/重开**这个会话**后仍是它；清除范围 = 删掉该会话的项。目录里**已经没有**的 id 会在目录 `ready` 后被丢弃（否则用户会面对一个没有解释的空列表）；**失败但仍列在菜单里**的 provider 不算"没有"，保留。详见 §5.13、§5.15 |
| 键盘 | 菜单内 `↑↓` 走行、`Tab` 走整卡的焦点链（`聚焦的 DOM` 顺序：提供商栏 → 搜索框及其按钮 → 各行），`Enter` 选中，`Esc` / `←` 退回 chip；链首 Shift+Tab 关闭并交还触发器。**链是从渲出的卡片里读出来的**，不是手写清单——否则只在某个状态下出现的控件（清除搜索、显示全部、重试）键盘够不到（§5.29） |
| 与模型菜单的关系 | 互斥：开一个就关另一个（它们是两个独立 popover，不嵌套） |
| 空状态 | 收窄后无行 → 「该提供商没有可用模型。」；失败的 provider 该行本来就被禁用，选不到 |
| **不做什么** | 不改 Host、不改 `/model`、不改触发器显示值；范围绝不参与 `select()` 的参数 |

### 5.10 模型参数面板（追加需求，2026-10-02；同日按 §2.1 的复核结论重做）

需求原文：「在模型选择器的右侧，加一个设置按钮，点击编辑当前选中模型的参数：是否支持文字、
图片 / 上下文窗口大小 / 思考强度」。齿轮按钮落在模型触发器的**右侧、座位 flex 行的末尾**。

**初版的边界结论被复核推翻了。** 初版把三项参数里的两项做成"本插件的本地记录"，理由是
`session/modelCatalog` 每条只有 `{ provider, model, reasoning }`、`llm/discoverModels` 只读。
复核（§2.1）发现：座位目录确实读不到这些字段，但 **Host 的配置面可以读写模型参数**，
而且两个适配器都把模型参数声明为 volatile——这就是「设置 → 模型」页改同一批字段所走的路。
所以现在三项都是真写（**没有声明条目的路由**另说：那时**写不了**，但不是"看不到"——
适配器发布的目录仍然可读，见 §2.2 与 §5.19）：

| 参数 | 真值来源 | 写入 |
|---|---|---|
| 文字 / 图片 | `describe.value` 里该条目声明的模态列表（`input` / `inputModalities`） | `mutate · set <entry>.input = ['text'\|'image'…]`；未声明时开关显示适配器默认（见 §5.14：文案只称"当前按适配器默认"，不声称它就是生效值），一旦拨动就写成显式列表 |
| 上下文窗口 | `describe.value` 里该条目的 `contextWindow`；没有则显示 provider 的 `defaultContextWindow`（适配器默认） | `mutate · set <entry>.contextWindow = tokens`；**留空 = `unset`**，回到适配器默认 |
| 推理等级 | 共享目录的 `current.reasoningEffort ?? defaultEffort`（Host 已接受的值） | `directory.select({ provider, model, reasoningEffort })`——**这是全插件唯一能改等级的地方**（§5.3 改版后行内只剩只读徽章） |

**地址怎么来的**（`params.ts` 的 `resolveRoute`，纯函数，单元门覆盖）：
`llm/listConfigurableProviders()` 找到 `route.provider` → `{ settingsNs, settingsPath }`；
在该命名空间的 `value` 里按 `settingsPath + ['models', i]`（条目 `id` 命中）或
`settingsPath + ['modelOverrides', model]` 定位条目；模态字段名先看条目上实际存在的键
（`input` / `inputModalities`），再回落到按命名空间的已知表。**定位不到就只能查看**并写明原因。

| 维度 | 规格 |
|---|---|
| 位置 | 模型触发器右侧、同一 `dmp-root` 行内；28×28 图标按钮（`--dsw-radius-sm`） |
| 标记 | 当前路由在 profile patch 里带着本面板的字段（`describe.user` 命中）时，齿轮加 `data-edited` 小圆点；「恢复默认」同时在此时才可用 |
| 面板 | `createPortal` + `MenuSurface`，`role="group"`，`aria-label="{模型名} 的模型参数"`，宽 `min(280px, 100vw - 32px)` |
| 高度预算 | 由父级按齿轮的**实测余量**传入 `maxHeight`（`clamp(240, 可用空间, 460)`）：输入条贴着视口底部，固定的 460px 会让页脚说明掉到视口外 |
| 滚动（2026-10-02 修缺陷） | **滚动的必须是参数面板里的 `.dmp-settings-body`，不能是参数面板本身**（§5.13）：`MenuSurface` 把参数面板的底色画成自己的绝对定位子元素 `.material`（`inset: 0`），参数面板一旦自己滚，这层底就跟着内容上移，参数面板下半截没有底色、页面从面板自己的页脚透出来。头部（模型名 + 恢复默认）与状态行留在滚动区外，其余滚动 |
| 侧向 | 按齿轮的上下余量选 `top`/`bottom`（`useAnchoredPosition` 只 clamp 不翻转） |
| 状态行 | 面板在控件**上方**给出一行状态：正在应用选择（`busy`，优先）/ 读取中 / 部署没挂设置服务 / 读取失败 / 路由不可寻址 / profile 只能查看；写入被拒时换成设置服务的原话（`role="alert"`）；**这是解释"为什么不能用"的唯一位置**，下面的分区提示不再重复（§5.14） |
| 互斥 | 与模型菜单、提供商菜单互斥：开一个就关另外两个 |
| 键盘 | 打开后**焦点落在参数面板本身**，不落在任何控件上；`Tab` 按**渲染顺序**走 文字 → 图片 → 上下文输入 → 各等级档 → 「恢复默认」（都从渲染出的面板里查，**不靠 ref**）；`Esc` / `←` 关闭并把焦点交还齿轮；`↑↓` 留给输入框自己的光标 |
| 会话切换 | 面板是会话域的（`sessionId` 进座位面），会话一变就自动关闭 |
| 写入位置 | 面板底部用 `命名空间 · 字段路径` 标出这次编辑落在哪（`title` 里给全文）——可直接对着 `cordis.patch.yml` 核对 |

**打开时焦点落在哪里（2026-10-03 改）**

初版把首焦点交给 `chain()[0]`，而链首是上下文窗口输入框。这有两处缺陷，都不是口味问题：

1. **`Tab` 链与渲染顺序相反**。`chain()` 当时是 `上下文输入 → 文字 → 图片 → …`，而卡片把两个模态开关渲染在
   上下文分区**上面**——面板一打开焦点停在第二个区块，按 `Tab` 焦点却往回跑（WCAG 2.4.3 Focus Order）。
2. **把首焦点放进唯一的文本框**。这个字段 `onBlur` 即提交，等于把一次 `settings/mutate` 放在随手一下 `Tab`
   之外；`inputMode="numeric"` 在触屏上会立刻拉起数字键盘，而参数面板贴着输入条底部、被键盘盖掉一半；
   读屏用户听到的第一句是字段和它的 placeholder，而不是「{模型名} 的模型参数」和上面那行状态。

改法：**首焦点落在参数面板本身**（`MenuSurface` 加 `tabIndex={-1}`，测量完成后 `panelRef.current?.focus()`），
`Tab` 的第一跳因此落在阅读顺序的第一个控件上。顺带得到三个好处：只读态不再需要"跳过 disabled 控件"的特判
（参数面板永远可聚焦，而那时所有控件都是 disabled）；`.dmp-settings-input:focus-within` 的蓝框不再默认点亮；
参数面板自带 `:focus-visible` 描边（与该蓝框同一个 token），键盘打开时焦点仍然可见。

两个配套的细节，也是各自独立的缺陷：

- **`chain()` 按渲染顺序重排**（文字 → 图片 → 上下文输入 → 等级档 → 「恢复默认」）。唯一偏离渲染顺序的是
  「恢复默认」：它画在卡片头部右上，却排在链尾——破坏性动作不该是打开面板后第一个 `Tab` 落点。
- **只在第一次测量时取焦点**（`tookFocus`）。`position` 会随滚动/缩放重新测量，每次都重跑会把焦点从用户正在用的
  控件上拽走——正编辑容量输入、或正在等级档上按方向键时。

这三条现在由 selfcheck 的 §5.10 四条门守着（链序 == 渲染序、首焦点是参数面板、重新测量不夺焦点、聚焦的参数面板自带描边）。
其中两条做过**反向注入**验证门会咬：把链首改回输入框 → 链序门红；把 `panelRef.current?.focus()` 改回
`chain()[0]?.focus()` → 首焦点门红。**没有在真实 GUI 上复跑**（新链与新焦点只有静态门与类型门），需要在刷新页面
取到新产物后按 `Tab` 读一遍 `document.activeElement`。

**两类边界的实现取舍**

1. **不可寻址 ≠ 假装可写，也 ≠ 假装不支持**：模型来自适配器内置目录、配置里没有它的声明条目时，
   控件整体禁用并说明；不会出现"拨了没反应"的开关。而两个模态开关**显示适配器目录公布的值**
   （§5.19）——初版在这里把两个开关都画成关闭，等于替模型宣布"既不收文字也不收图片"，这条没人验证过。
   适配器**什么都没公布**时，该分区连开关带字段**整块不渲染**，由状态行说明不可编辑。pi-ai 的
   `modelOverrides` 是给这类路由的入口，但它与 `models` 列表互斥，凭空造条目等于替用户改 provider
   声明——超出本面板的范围。
2. **两项全关**：一个都不接受的模型发不出任何请求，pi-ai 还会把空列表当成"未声明"回落到目录默认，
   所以面板拒绝"关掉最后一项"，提示用「恢复默认」回到默认态。

**实现中踩到并修掉的两个坑（都在真实 GUI 上复现过）**

1. **写入时参数面板自己关掉**：提交瞬间参数面板把控件整体 `disabled`，React 因此把正在聚焦的输入框
   从 DOM 里摘掉，`focusout` 的 `relatedTarget` 为 null —— 座位的 `onBlur` 把"没有去向的焦点变化"
   当成了离场，于是 `close()` 把整个座位关了。修复：`onBlur` 里先看
   `event.currentTarget.contains(document.activeElement)`（或焦点落到 body），这两种情况不算离场。
   现象是"回车提交后参数面板消失、看不到结果"，很容易被误判成写入失败。
2. **`Switch` 不转发 ref**：基线 `Switch` 是普通函数组件（`primitives.d.ts` 里也没有 `ref`），
   初版按 ref 表维护 Tab 链，于是两个开关**静默地不在链里**——键盘根本够不到它们。
   修复：`chain()` 直接查渲染出的面板 DOM（`.dmp-settings-input input` / `[role="switch"]` /
   `.dmp-effort-item` / `.dmp-settings-reset`），不再依赖组件 ref。

**顺带**：初版的"本地记录"（`overrides.ts` + `localStorage['dsh-model-picker.overrides.v1']`）
已经删掉——参数既然真写进 Host，本地再存一份就是第二份真相。
齿轮的"已编辑"标记改为只读 `describe.user`，与面板显示同一份快照，两者不可能各说各话。

### 5.11 徽章图标的定稿（2026-10-02；同日二次返工见 §5.12）

**为什么自绘**：宿主图标集里**没有**文字模态图标、也**没有**图片模态图标（`ui-primitives` 的
`Icon*` 全集里找不到 `IconText*` / `IconImage*`；`IconPaperclipOutline` 是附件、`FileTypeIcon` 是文件类型）。
若剩下两个用宿主的、这两个自造，同一个徽章条里会出现两种画法。所以四个一起画，
但严格照宿主自己的规矩：`fill="none"`、`stroke="currentColor"`、圆角线帽/拐角。
**按 14px 渲染**（不是 12px）：图标过窄是返工的第一条反馈，14px 下字形才立得住。

**两套网格，一个线重。** 前三个字形画在宿主的 16 单位网格上；推理徽章用**宿主自己那颗 24×24 的大脑**
（用户指定造型，9 条 path 原样），保留自己的 `viewBox`。于是线重必须**按网格各写一份**：
`stroke-width` 的单位是自己的 viewBox，屏幕上 = `值 × 渲染尺寸 / viewBox`。16 网格取 1.6、
24 网格取 2.4，两者在 14px 下**都落在 1.4px**（大脑若照搬宿主的 2 单位只有 1.17px，比邻居淡 17%；
继承宿主默认的 1 则只有 0.58px）。这条等式由 `selfcheck-static.mjs` 第 10 组断言锁住。

| 事实 | 造型 | 为什么是它 |
|---|---|---|
| 文字输入 | 带折角的页面 + 两行文字 | 文档本身（参考站 commandcode.ai 的 "Text input"）。**淘汰过**光秃秃的字母 `T`：带衬脚在中文界面里读成「工」 |
| 图片输入 | 圆角相框 + 一条地平线 + 一个小太阳 | 太阳是"图片"和"矩形边框"的分水岭 |
| 推理 | 两个脑叶在脑干处相接的**大脑剪影** | 这是这个产品自己用来说"思考"的记号（聊天的 reasoning 折叠行、输入框的等级 chip 都是它）；用户指定保留 24×24 原稿。**淘汰过**三级递增竖条——它说的是"有几档"，没说是什么的档位 |
| 上下文窗口 | 窗口：圆角框 + 标题栏 + 一行内容 | 直译"窗口"。**淘汰过两个方案**：`[—]`（括号夹一条容量条）与 `|—|`（两端帽夹一条跨度线）——两者在小尺寸都读成一个减号，可能被当成"不支持"，语义正好反了 |

**画不出来的东西不留**：这里曾经定义过第二形态——同一字形叠一条左上到右下的斜杠（通用的
"not available" 记号），去掉斜杠下会糊掉的细节（页面的文字线、眼睛的瞳孔、窗口的内容线），
色调降到 `quiet`——并且斜杠按两套网格各写一份（24 网格 `M5.7 5.7 L18.3 18.3` 是 16 网格
`M3.8 3.8 L12.2 12.2` 的 1.5 倍，都在屏幕上跨 7.35px）。§5.24 把徽章条改成固定四轨后，
行只渲染 `!off` 的事实，**这一整套变体再没有任何渲染点**；2026-10-15 连同 `.dmp-badge[data-tone='quiet']`
样式一起删除，并由 `selfcheck-static.mjs` 第 10 组反过来钉住（不得出现 `off` 分支、`SLASH` 常量，
且行必须仍然 `filter(spec => !spec.off)`）。删掉而不是留着，是因为**设计记录描述一个画不出的形态，
比没有这个形态更容易误导下一个改它的人**。

**"查不到"怎么画**：整条不渲染（§5.3）。"确实没有这一项"由空轨道陈述（§5.24），不是图标。

**决策过程留痕**：`scripts/_icons-probe.cjs` 把候选造型按**真实胶囊底色**渲染成对比条
（`shots/icon-strips-compare.png`），以及放大到 40px 的逐个造型（`shots/icon-candidates.png`）。
`T` 的衬脚就是在这张图里被淘汰的：带脚在中文界面里读成「工」，不带脚才是「T」。
`scripts/_badges-probe.cjs` 把**当前产物**的徽章条按 1x / 3x 渲染（`shots/badge-zoom.png`），
用来复核图标线重到底够不够重——改图标几何时跑它。

### 5.12 徽章宽度的二次返工（2026-10-02，用户反馈）

**反馈原话**：「徽章样式紧凑点，现在的版本占用宽度太多，模型名都没空间显示了。」
这是同一块区域第二次因为尺寸被退回来——第一次是「行高还有空余，不要把图标画的那么窄」。
两次合起来才是这枚胶囊的真实预算：**竖向可以用足行高，横向一寸都不许浪费**。

**改前 / 改后（真实 GUI、320px 卡片、80 行实测）**

| 量 | 改前 | 改后 |
|---|---|---|
| 纯图标胶囊 | 36px | **22px** |
| `Default` 胶囊 | 75.1px | **60.1px** |
| `1M` 胶囊 | 55.8px | **40.8px** |
| 常见四枚合计 | 211.9px | **150.9px** |
| `DeepSeek V4.1 Flash` 分到的名字宽度 | 52.7px（放不下） | **122.1px（完整显示）** |
| 名字宽度中位数 / 最小值 | — | 151.8px / 113.7px |
| 完整显示的名字 | 少数 | **74/80**（宽卡片 80/80） |

**怎么省出来的**：图标格 22px→**14px**（正好是字形自身的盒子；原先那 8px 是空转的宽度）、
胶囊水平内边距 7px→**4px**、图标与文字间距 4px→**3px**、胶囊间距 3px→**2px**；
胶囊高度改用 `min-height: 22px` 明确声明，不再靠图标格撑——**高度和宽度因此解耦**，
可以既用足 38px 行高、又不让图标格贡献无用的横向宽度。

**顺带修掉一个真实缺陷**：档位名是**适配器自由文本**，改前一条 ≥14 字的档位名会把徽章条撑到
262.9px 以上，把最后那枚**上下文窗口**胶囊顶出卡片、被 `.dmp-menu { overflow: hidden }` 裁掉
（评审在无头浏览器里量到的最坏情况是 329px、裁掉 73px）。现在 `.dmp-badge-value` 有
`max-width: 64px` + 省略号：极端长的档位名只截断自己的值，徽章条被**封顶在 161px**，
任何宽度下四枚胶囊都完整留在行内（实测 320/360/420/560/1280 五档视口：0 行被裁、0 行越界）。

**为什么不用"让徽章条换行"来解决**：换行会让行高随名字长度变化（实测 46px vs 38px），
同一个列表里行高不齐，扫读时会跳；也不符合第一次反馈里"行高可以用足"的意思。

**这次返工加的机器门**（`selfcheck-static.mjs` 第 10 组，防止第三次在同一处翻车）：
图标格不得宽于字形、胶囊水平内边距 ≤5px、四枚字形在屏幕上线重必须一致、以及**图标家族只有
"具备这个事实"一种形态**（不得出现 `off` 分支或 `SLASH`，且行仍须 `filter(spec => !spec.off)`）。
每一条都用「改坏 → 断言必须红 → 改回」验证过，不是摆设。

### 5.13 第三次反馈（2026-10-02）：范围持久化、面板底色缺陷、触发器文案

> **其中"范围持久化"这一条已被 §5.26 反向**：范围不再记忆，每次打开都取当前会话的 provider；
> `prefs.ts` 删除，只留 `retiredScope.ts` 清理旧键。本节其余两条（面板底色缺陷、触发器文案）仍然成立。

三条反馈一起改，彼此无关，各自留一条机器门（`selfcheck-static.mjs` 第 11 组）。

**①「模型提供商的选项也持久化」** —— 提供商范围从"组件存活期内保持"变成**记住的偏好**：
`src/client/prefs.ts`（当时的 `localStorage['dsh-model-picker.provider.v1']`，**已由 §5.15 改成按会话分片**；
拿不到 store 就吞掉异常）。范围仍然是**纯视图状态**——它不写 Host、
不改 `/model`、不改触发器显示的真实模型，持久化只改变"这个视图状态活多久"。
（同一次改动里「最近使用」用了同一套读写策略，那个模块与策略已在 §5.21 整体删除。）

丢陈旧 id 的时机是这次实现里唯一的判断：目录 `ready` 之后，若记住的 id 既不在已加载的 provider 里、
也不在失败列表里，就把它丢掉。理由是**空列表必须永远有解释**：目录里没有的提供商，用户打开模型菜单
只会看到「该提供商没有可用模型」，而菜单里根本没有那一行可以取消——那种状态比"没记住"糟得多。
目录还没加载完时**不能**判（`idle/loading` 时"没有任何 provider"是正常的），所以判据挂在 `status === 'ready'` 上。

**②「模型参数列表，样式有 bug」** —— 参数面板滚到下半截时，**参数面板自己的底色没了**，页面从面板页脚
（写入位置 + 说明那一段）透出来，同时那个底层的圆角出现在卡片中间（修复前见
`shots/panel-scroll-before.png`，修复后 `shots/panel-scrolled.png` / `-light.png`）。

根因在宿主的 `MenuSurface`（`ui-primitives/lib/MenuSurface.module.css`）：

```css
:where(.surface) { position: relative; }
.material { position: absolute; inset: 0; z-index: -1; border-radius: inherit; background: var(--dsw-menu-surface-fill); }
```

参数面板底色不是 surface 自身的 `background`，而是它内部一个**绝对定位子元素** `.material`。绝对定位子元素
锚在滚动容器的 padding box 上、并**随内容一起滚动**，所以只要 surface 自己滚（旧版 `.dmp-settings`
写了 `overflow-y: auto`），这层底就会随 `scrollTop` 上移，露出下边 `scrollTop` 那么高的一条**没有底色**
的区域——内容的边框、文字照常画（它们不在那层里），看起来就是"参数面板下半截透明"。用真实 GUI 量到的数字
也对得上：参数面板 337px 高、滚动 ~100px 时，底色正好只盖到 189px 处，与用户截图里那条圆角边界一致。

修法是**把滚动交给内部元素**（模型卡早就是这么做的：surface `overflow: hidden`，`.dmp-groups` 滚）：
`.dmp-settings { overflow: hidden }` + 新增 `.dmp-settings-body { flex: 1 1 auto; min-height: 0; overflow-y: auto }`，
参数面板头部（模型名 + 恢复默认）和状态行留在滚动区外。

**③「模型选择器名称边上没必要显示思考强度」** —— 触发器只写模型名：删除 `.dmp-trigger-sep` /
`.dmp-trigger-effort` 两个元素与它们的样式，气泡文案同步改成只报模型名（见 §5.1）。
`aria-label` 仍走 `trigger.ariaEffort`（"当前 {model}，推理等级 {effort}"）：这不是显示，减负不该让
屏幕阅读器少一条事实。

---

## 6. 失败与边界

| 情形 | 行为 |
|---|---|
| 目录整体加载失败 | 面板内错误行 + 重试；触发器保留上次显示值 |
| 部分 provider 失败 | 警告行 + 重试；可用分组照常可选 |
| 选择被拒 | 保留菜单 + Toast（锚定 composer card）；`session/writer-held` 用专用文案 |
| 会话不可用（subagent）/ `locked` | 不渲染 / disabled |
| 目录为空 / 搜索无结果 | 状态区播报，保留查询 |
| 连接重置 | 由 `modelDirectories` 作废旧 generation，组件只读 store，无需自管 |
| ~~**最近项已不在目录**~~ | **不适用（§5.21）**：「最近使用」机制整体删除，没有"最近项"了 |
| **记住的提供商已不在目录**（被删/改名） | 目录 `ready` 后把该项丢掉、列表回到全部；**不打**开一个只解释"该提供商没有可用模型"的空列表。目录还没加载完（`idle/loading`）时不动它——"还没读到"不等于"没有了" |
| **localStorage 不可用**（隐私模式/沙箱） | 读写都吞掉：范围本身照常工作，只是记不住 |
| **收窄排除了当前模型** | 列表里没有它，但**触发器照旧显示真实模型**（范围是浏览辅助，不是状态改写）；`/model` 弹窗、Host 全部不受影响 |
| **被收窄掉的提供商加载失败** | 该行在提供商菜单里禁用并标「加载失败」；若范围已指向它（此前加载成功、后来失败），列表空 + 空状态文案 + 上方照旧显示 provider 警告行与重试 |
| **参数面板：路由不可寻址** | 控件整体禁用 + 状态行说明"模型来自适配器内置目录、没有可编辑的声明"；不提供按了没反应的开关。适配器**公布过**的事实照常陈述（§5.19），分区提示写明来源；**没公布**的分区整块不渲染 |
| **行内徽章：模态/窗口查不到** | 对应徽章**不渲染**（不是画成"不支持"）：路由不在 `llm/listConfigurableProviders`、条目既没声明、适配器默认也没有、**且适配器目录也没公布**时就是这种情况 |
| **行内徽章：模型没有 reasoning 元数据** | 推理徽章仍然渲染，但**划掉**并说明"未声明推理档位"；四个事实里"没有档位"也是事实，删除徽章会让行看起来缺了一块 |
| **行内徽章：档位名很长**（适配器自由文本） | `.dmp-badge-value` 有 `max-width: 64px` + 省略号：只截断自己的值，徽章条被封顶在 161px，四枚胶囊始终完整留在行内（详见 §5.12） |
| **行内徽章：模型名很长** | 名字先省略号（`min-width: 48px` 兜底），徽章条保持自己的宽度、不换行 |
| **参数面板：读不出的容量** | 红框 + `aria-invalid` + 提示文案，**保持原值不动**（不静默写成 0/NaN），也不发出写入 |
| **参数面板：写入被 Host 拒绝** | 状态行换成 Host 原话（`role="alert"`），值保持不动；`settings/conflict` 由 store 重读一次后自动重试，第二次仍冲突才报给用户 |
| **参数面板：部署没挂设置服务 / 读取失败** | 状态行说明原因，面板只能查看；推理等级与选模型不受影响（设置面是 `ctx.get` 取的可选服务，不进必需注入，见 §6 的静默回退那条） |
| **参数面板：路由不在当前目录里** | 面板照常打开（地址与目录无关）；没有 `reasoning` 元数据就不渲染等级区 |

---

## 7. 安装、迭代、回退

1. **构建**：`node scripts/build-client.mjs` → `lib/index.js`（宿主，空 apply）+ `lib/client.js`（惰性 CJS 包装 + 接线自检）。
2. **挂载**：走 `plugin_manager install_bundle`（绝对包目录）——由 DSH 自己写 profile 的
   `package.json` 与 `cordis.patch.yml`，不手改 profile 文件、不碰 DSH 安装目录。
3. **生效**：`application: applied` 即生效；页面刷新后新座位接管。**重建产物后只需刷新页面**：
   宿主把客户端模块按产物哈希拼成 `/plugins/??…dsh-rabbit-model-picker/client.js&rev=<hash>`，重建会换 `rev`，
   刷新即取到新文件（2026-10-02 实测 `rev` 变化、新代码字符串在刷新后的 bundle 里可读到）。
4. **回退**：删除 profile 里那一行插行（或把 `priority` 改成 `> 0` 让原座位重新胜出）。

---

## 8. 测试与验收

- **构建自检**（`scripts/build-client.mjs`）：包裹形状、入口 id = 包名、所有 `require` 都在基线内、
  命名导出 `apply` + `inject` 且无 `default`、bundle 内含座位键与 `priority: -10`。
- **静态自检**（`scripts/selfcheck-static.mjs`）：零硬编码色值、无虚线、圆角只走 `0/50%/var()`、
  `--dsw-*` 令牌使用、`prefers-reduced-motion` 与 `:focus-visible` 分支存在、
  两个宿主要折叠变量都被消费、`dmp-*` 死类双向比对、座位契约（name/priority/模块级 inject）断言，
  以及三批追加断言：**写入口契约**（`listConfigurableProviders` / `settings.mutate` /
  `settings/conflict` / `user` 层同路径 / 设置面是 `ctx.get` 可选而非必需注入 / 面板渲染写入位置）、
  **文案键**（`t(...)` 用到的键都在字典里、字典里没有多余键、zh/en 键集一致）与
  **行内无控件契约**（三批改版的防回退闸门）：① 整个被扫描范围内不再出现 `EffortMenu` / `dmp-pill`；
  ② 事实条由宿主只读原语 `Tag` 组成（它渲染 `span`，没有能挂 `onClick` 的位置）；
  ③ 每一行的事实都经过 `badgeSpecsOf`，徽章文案只有一个所有者。
  ②③ 这两条正对着这次改版的意图——"徽章只是信息展示"必须是结构上的，而不是约定上的。
- **事实单元门**（`scripts/test-params.mjs`）：把 `params.ts` + `badges.ts` + `dictionary.ts`
  打包成一个无依赖 ESM，在 node 里断言寻址、容量解析**与行内事实推导**。
  徽章那批断言用**真实 zh 文案**（不是桩）比对整句，因为一个"句子写错的徽章"比一个缺失的徽章更糟：
  `['文字输入','不支持图片输入','支持推理','上下文窗口 800K']`、以及行 `aria-label` 的完整拼句。
  退化分支也都有断言：不可寻址的路由只留推理徽章（**适配器也没公布**时）；既没声明又没有适配器默认时模态条整条不出现；
  没有 `reasoning` 元数据时等级是划掉的；而适配器**公布过**的行内事实（§5.19 的能力轴）单独有一批断言。
  能力目录本身（读取顺序、`declared` 守卫、一次一 provider、晚挂载的 reader）在同一门里用假 Remote 覆盖。
  `npm test` = build + selfcheck + test:params + test:mutations（§5.31 把改坏验证也收进来自动跑）。
- **浏览器验收**：座位只有一层（无 root 两格）；搜索常驻并跨 provider；行内四个只读徽章与模型名同行，
  点行（含点徽章）只切模型、`/model` 打开显示同一状态；外点/Esc 关闭；`↑↓/Enter` 选中；
  `locked` / subagent 不渲染；窄屏只剩图标且不溢出；浅/深主题截图。
  参数面板另有脚本化验收（见 §8.2），行内徽章另有 §8.4。
- **人工回归**：三条错误路径文案与重试、两种空状态、pending 菊花、禁用插件后原控件恢复。

### 8.1 实测记录（dsh 0.2.0-rc.2、profile `web`、真实浏览器）

安装走 `plugin_manager install_bundle` → `application: applied`、`warnings: []`。
profile 的 `package.json`（dependency + `dsh.profile.bundles`）由安装器写入；
**profile 的 `cordis.patch.yml` 与 DSH 安装目录都没有被改动**。安装后浏览器侧
`Slots.listSubTree('conversation.input.model')`：

```
occupants:
  priority -10   active: true     ← 本插件
  priority   0   active: false    ← 原 ModelSelect（仍在注册表里，继续服务 /model）
```

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 座位只有一层 | ✅ | `singleLevel: true`——同一面板里既有 `role="searchbox"` 又有 `role="menuitemradio"` 行，没有 root 两格面板 |
| 2 | 搜索常驻且打开即聚焦 | ✅ | `searchFocused: true`，placeholder「搜索模型…」 |
| 3 | 跨 provider 模糊搜索 | ✅ | 输入 `glm` → 分组收敛为 opencode-go / zai / commandcode / WorkBuddy（组间按最佳匹配上移） |
| 4 | ~~最近使用置顶~~ | ⚠️ **已过期** | 当时：分组首位为「最近使用」，`localStorage['dsh-model-picker.recent.v1']` 存在，`/model` 里的切换也会被记录。先被 §5.16 取消"置顶分组"（存储与记录逻辑当时还在），**整个机制又已在 §5.21 连同 `recent.ts` 一起删除——这一行现在描述的东西完全不存在了** |
| 5 | 行内 effort 一次提交切模型+等级 | ✅ | GLM-5.1（pill=Default）→ 小菜单 6 档 → 选 `Off` → 触发器 `GLM-5.1 · Off`，`aria-label` 同步 · **已被 §8.4 的改版取代**（行内不再改等级），此处保留为当时的事实记录 |
| 6 | 触发器格式 | ✅ | `DeepSeek-V41-Flash · Off`：名字、` · ` 分隔符、等级三段；等级取 caption 墨色 |
| 7 | 选择落到 Host（不只是本地状态） | ✅ | 切换后**刷新整页**，触发器仍显示该模型+等级（durable projection 往返） |
| 8 | 与 `/model` 弹窗共享状态 | ✅ | 打开 `/model`：弹窗把 `DeepSeek V4.1 Flash Fast` 标为当前项，与座位触发器逐字一致 |
| 9 | 外点 / Esc 关闭 | ✅ | `outsideCloses: true`；Esc 先清查询、再关面板并把焦点交还触发器（`aria-expanded=false`） |
| 10 | `↑↓` 高亮 + `aria-activedescendant` | ✅ | 搜索框内按 `↓` 后焦点仍在搜索框，`aria-activedescendant` 由 row-0 移到 row-1 |
| 11 | 窄屏消费宿主变量 | ✅ | 置 `--dsh-composer-model-text-display:none` / `--…-icon-display:block` 后：标签 `display:none`、图标 `display:block`、触发器收到 46px |
| 12 | 面板不越界、不被裁剪 | ✅ | 560px 与 420px 下 `insideViewport: true`、`menuOverflowX: 0`；面板 portal 到 body |
| 13 | 面板宽度符合预算 | ✅ | 实测 320px（含 padding，靠 `box-sizing: border-box`）；当时的 effort 小菜单 200px |
| 14 | 浅/深两主题 | ✅ | 同一面板：深 `body #151517` / 行文 `rgb(249,250,251)`；浅 `#fff` / `rgb(15,17,21)`，全部随令牌翻转（截图见 `shots/`） |
| 15 | 无控制台错误 | ✅ | 全程注入 console.error / window.error / unhandledrejection 捕获：`diag: "(empty)"` |
| 16 | 失败即静默回退 | ✅ | 实测命中过一次（缺 `remote`/`remote.session`）：该入口让位、原座位无缝接管，UI 没有坏 |
| 17 | 提供商 chip 在模型触发器**左边** | ✅ | 同一 flex 行的 DOM 顺序 = `全部` → `DeepSeek V4.1 Flash Fast`（当时菜单里还有一行「全部」，chip 也写「全部」）；`chipIsLeftOfTrigger: true`；两个 chip 的墨色分级（caption `rgb(129,133,140)` vs secondary `rgb(207,211,214)`） |
| 18 | 提供商菜单内容 | ✅ **已重测（§8.9 + §8.10）** | 当时：搜索框（打开即聚焦，placeholder「搜索提供商…」）+ 粘性头「模型提供商」+ 11 行带计数：`全部 75`、`DeepSeek 账号 2`、…；当前项打勾。§5.16 加过一行 `最近使用`，**§5.21 又把 `全部` 与 `最近使用` 两行一起删掉**。重测实测：**15 行真 provider**、0 行打勾（未筛选）、卡片 `240×380` 且在视口内、首行 `DeepSeek 账号 2`（行尾带「当前会话」） |
| 19 | 选中提供商后模型列表只列它 | ✅ | 选 `WorkBuddy` → chip 变 `WorkBuddy`（`data-filtered`）、菜单只剩一个分组 `WorkBuddy`、**3 行**（与计数 3 一致）、上方出现 `仅显示 WorkBuddy` + 「显示全部」 |
| 20 | 「显示全部」恢复 | ✅ **已重测（§8.10）** | 当时：清除后 hint 消失、11 个 provider 分组 + `最近使用` 全部回来（79 行）。重测（本机目录更大）：点它 → 提示条消失、**模型行恢复 95**、chip 回到**当前模型的 provider**（§5.22；不再是「全部」）。§5.21 之后这条出口的地位变了：菜单里没有「全部」行，**卡内这个按钮是退出筛选的唯一路径**（门：`filter: the in-card "show all" exit from a narrowing still renders`） |
| 21 | **筛选不改写选择** | ✅ | 筛选到 `WorkBuddy`（当前模型 `commandcode` 的模型不在其中：`currentInFilteredList: false`），触发器仍显示 `DeepSeek V4.1 Flash Fast`；筛选到 `commandcode` 后点当前行 → 文案不变、菜单关闭（**没有发出切换请求**） |
| 22 | 窄屏两个 chip 一起收 | ✅ | 置两个宿主变量后：provider 标签/模型标签 `none`、两个图标 `block`、整行收到 94px；撤销后恢复 |
| 23 | 提供商层的外点关闭 | ✅ | `chipMenuOutsideCloses: true` |
| 24 | **粘性分组头不再重叠** | ✅ | 修复前（后台页签复现）：粘性头 `bg: rgba(0,0,0,0)`、`data-stuck` 缺失、行文字与头文字叠在一起；修复后同一条件：`bg: rgba(48,49,54,0.94)`，滚到头下面的行只剩 6% 幽灵（宿主令牌本身的不透明度）。模型卡与提供商卡都实测过 |
| 25 | 官方座位有同样缺陷（对照实验） | ✅ | 摘掉本插件回到 `ModelSelect`：`anyStuck: false`、粘性头 `rgba(0,0,0,0)` → 证明这不是本插件引入的 |

**未覆盖（留给人工/后续）**：目录整体失败与部分 provider 失败两条错误路径的文案与重试、
选择被拒的 Toast（`session/writer-held`）、subagent 会话下不渲染、`locked` 禁用态、
以及 pending 菊花（切换太快，没抓到那一帧）。这几项在本机不构造故障就无法稳定触发。
提供商筛选的**失败提供商行**（禁用 + 「加载失败」）同样没有实测到——本机没有失败的 provider。

**测试过程中的两个操作注记**：驱动 `/model` 命令弹窗需要 CDP 可信输入
（`Input.insertText` / `Input.dispatchMouseEvent`）——纯合成 DOM 事件打不开它；
测试切换过会话模型，已按「选回原行」的方式把会话恢复到 `commandcode/deepseek/deepseek-v4.1-flash-fast`。

### 8.2 模型参数面板实测（2026-10-02 复核版，playwright-cli 对真实 GUI）

页面用 `dsh web` 打印的 token URL 认证，并且**在一个新建会话里**跑（`Ctrl+Alt+N`），不占用正在对话的
会话。脚本 `scripts/_verify-settings.cjs` 一次跑完；跑完把上下文窗口写回 `1M`、把「图片」开回来，
`cordis.patch.yml` 与开始时语义一致（同一条目、同一批字段）。

| # | 验收项 | 结果 |
|---|---|---|
| 1 | 齿轮在触发器**右侧**且是座位最后一个控件 | ✅ `childOrder: [dmp-provider, dmp-trigger, dmp-settings-button]`，28×28，`rightOfTrigger: true` |
| 2 | 面板读的是 **Host 的真值**（不是本地记录） | ✅ 三个分区 `输入类型 / 上下文窗口 / 思考强度`；提示行「已声明：文字、图片」/「已声明；留空并回车 = 恢复适配器默认」；`1M` 直接来自 `describe.value` |
| 3 | 面板标出**写入位置** | ✅ `title: "llm-pi-ai · providers.opencode-go.models.5"`——对着 `cordis.patch.yml` 核对，正是 `deepseek-v4.1-flash` 那一条（第 106 行起） |
| 4 | 齿轮的"已自定义"标记读 `describe.user` | ✅ 该路由在 profile patch 里有自己的字段 → `data-edited` 存在；`aria-label` 为「编辑 DeepSeek V4.1 Flash 的模型参数」 |
| 5 | **键盘链能走到两个开关** | ✅ 真 `Tab` 键，卡片保持打开（这条是修掉 ref 坑之后才成立的，见 §5.10）。**当时实测的链首是上下文窗口**——2026-10-03 按 §5.10 改成「焦点落卡片 + 链按渲染顺序」，新链为 `文字 → 图片 → 上下文窗口 → 4 档 → 恢复默认`；新链只有静态门与类型门，**尚未在真实 GUI 上复跑**（需刷新页面取到新产物） |
| 6 | 读不出的容量被拒且不写 | ✅ `two fifty six` → 红框 + `aria-invalid="true"` + 「读不出这个数值…」，字段保持输入、配置文件未动 |
| 7 | **上下文窗口真写进 Host** | ✅ 回车提交 `800K` → 面板提示转为「已声明…」；`cordis.patch.yml` 该条变 `contextWindow: 800000`（写入前是 `1000000`） |
| 8 | **输入类型真写进 Host** | ✅ 关「图片」→ `input: [text]`；再开回来 → `input: [text, image]`；文件与面板同步 |
| 9 | **留空 = 撤掉声明** | ✅ 空值 + 回车 → 面板变「尚未声明；适配器声明的兜底值是 262144，实际容量由它内部决定」、placeholder 变默认值；`cordis.patch.yml` 中该条的 `contextWindow` 消失（`mutate · unset` 生效）；卡片不再被写入动作关掉 |
| 10 | 写回原值后刷新整页 | ✅ 字段回读 `1M`、开关 `文字=true/图片=false`…（见下条注）、`target` 与标记不变——**值来自 Host 往返，不是本地状态** |
| 11 | `Esc` 关闭并归还焦点 / 外点关闭 | ✅ `closed: true`、`focusOnGear: true`、`outsideClickClosed: true` |
| 12 | 单元门（无需浏览器） | ✅ `scripts/test-params.mjs` 34 项：provider-keyed / root-keyed / `modelOverrides` 三种寻址、索引与字段名、`describe.user` 判定、容量解析边界、以及"找不到就返回 null"的全部退化分支 |
| 13 | 静态与构建门 | ✅ `npm test` = build + selfcheck（含"写入口契约"与"文案键"两组新断言）+ test:params，全绿；`npm run typecheck` 无错 |

**注（跑批副作用，不是缺陷）**：第 10 条那次刷新读到的是"图片"被关掉的状态——脚本在
`imageOff → 图片=true` 那一步把开关拨回去时，卡片正好因焦点变化被关掉，回去的那次点击落在卡片外。
它**只是脚本自己的手势**，不是写入失败；同一段逻辑在 §8.3 的手工复现里两次都正常。

**本机没有构造的分支**（列出来免得被当成已验证）：profile 不接受表单编辑、
部署没挂设置服务/读取失败、`settings/conflict` 自动重试、Host 拒绝写入（`settings/rejected`）。
前四条需要特定部署或畸形配置（**"路由不可寻址"原本也在这张单子上，§5.19 之后本机默认模型就是
这种路由，已在 §8.8 实测**），第五条需要制造非法值——本机所有写入都被接受。
这几条的**决策逻辑**由 `test-params.mjs` 与 `params.ts` 的分支覆盖，但**没有在真实 Host 上观测到**。

**"即时生效"的证据强度**：写入落盘（文件可查）+ 面板经 Host 往返（刷新后仍是新值）+ 适配器把
这两个字段声明为 volatile 并监听 `loader/volatile-update`（代码可查）——三者构成"改动会被适配器
重新解析"的证据链；**座位的目录至今不发布窗口/模态字段**，所以"发送端实际用了新值"这一步
在 UI 上无法直接观测，本文件不声称观测到了它。

### 8.3 两个坑的复现与修复证据（2026-10-02）

| 现象 | 复现方式 | 修复 |
|---|---|---|
| 回车提交后卡片消失（看不到结果） | `_debug-clear2.cjs`：打开面板 → 清空 → 回车 → 追踪 `panels` 从 1 变 0、焦点落回 `BODY` | `onBlur` 不再把 `relatedTarget === null` 当成离场；修复后同脚本 `panels` 恒为 1、焦点留在输入框 |
| `Tab` 走不到两个开关 | `_debug-tab2.cjs` 在旧产物上跑：`上下文窗口 → 文字 → 文字 → 文字…`（链里只有 3 项，反复回到自己）；修好后同一脚本输出 `文字 → 图片 → 4 档 → 恢复默认`（这次的面板没有渲染上下文分区，所以链里没有它——**与 §8.2 第 5 条记录的链首不是同一状态，链的权威规格以 §5.10 为准**） | `chain()` 改为查面板 DOM，不再依赖 `Switch` 的 ref |
| 打开参数面板时光标自动落进上下文输入框，`Tab` 反而往回跑（2026-10-03） | 静态即可判定：`chain()` 的链首是 `.dmp-settings-input input`，而 JSX 把两个开关渲染在它**上面**；且该字段 `onBlur` 即提交、`inputMode="numeric"` | 首焦点改为卡片本身（`tabIndex={-1}`），`chain()` 按渲染顺序重排，取焦点加一次性守卫；§5.10 新增四条静态门，两条做过反向注入验证会红（记录见 §5.10） |
| "留空 = 撤掉声明"确定性 | `_debug-unset.cjs` 连做两次：空值 + 回车 → 「尚未声明；适配器声明的兜底值是 262144，实际容量由它内部决定」；写回 `1M` → 「已声明」 | 路径本身没有改动，用来说明第 9 条不是碰巧 |

### 8.4 行内事实徽章实测（2026-10-02 改版，playwright-cli 对真实 GUI）

`npm run build` 后**刷新页面**即取到新座位（客户端模块按产物哈希带 `rev`）。在真实 GUI 的模型菜单上
直接读 DOM（77 行、320px 卡片），只读不点选，不改任何会话状态。

| # | 验收项 | 结果 |
|---|---|---|
| 1 | 行内不再有可点的等级控件 | ✅ 全表 0 个 `button[role=menuitem]`、0 个 `.dmp-pill`；`EffortMenu` 已从产物中消失 |
| 2 | 徽章与模型名**同一行** | ✅ 行高 **38px**（改版初稿的双行版是 47px）；`.dmp-row-copy` 是 `flex-direction: row` |
| 3 | 四个事实都画出来了 | ✅ 80 行共 **282** 枚徽章：68 行 × 4 枚 + 12 行 × 1 枚（见第 6 条） |
| 4 | 徽章句子成立 | ✅ 例：`"DeepSeek V4.1 Flash，文字输入、图片输入、思考强度 Default、上下文窗口 1M"`——四个事实的措辞与值都来自 Host 快照 |
| 5 | "没有这一项"由空轨道陈述，不靠颜色也不靠斜杠 | ✅ 例：`"DeepSeek-V4-Pro，文字输入、不支持图片输入、思考强度 High、上下文窗口 1M"`——`aria-label` 说全，行内那一列留空（`dmp-badge-slot`）；无 reasoning 元数据的行读到 `"…，未声明思考档位"` |
| 6 | **查不到就不画**（不猜） | ✅ 9 行只有推理徽章：`xiaomiMiMo` 6 行（`MiMo-V2.5`…）+ `WorkBuddy` 3 行（`Hy4 preview · x0.29`…）——这两个 provider 不在 `llm/listConfigurableProviders` 里，所以模态与窗口读不到，徽章整条不渲染 |
| 7 | 空间预算 | ✅ 行内宽 298px（320px 卡片实测）：名字 **122px** + 徽章条 **151px**（纯图标胶囊各 22px、`Default` 60px、`1M` 41px）+ 选中勾 14px。二次返工把徽章条从 211.9px 压到 150.9px、名字从 52.7px 提到 122.1px，见 §5.12 |
| 8 | 不可交互 | ✅ 徽章是 `Tag` 渲染的 `span`（`data-tone="neutral" / "quiet"`）+ 徽章条 `aria-hidden`，行是唯一目标 |
| 9 | 浅/深两主题 | ✅ 深色 `shots/row-badges-dark.png`、浅色 `shots/row-badges-light.png`（浅色是把 `body[data-ds-dark-theme]` 临时摘掉渲染的，截图后已恢复） |
| 10 | 图标定稿过程留痕 | ✅ `shots/icon-candidates.png`（候选造型放大图）+ `shots/icon-strips-compare.png`（真实 12px 胶囊对比条）；`T` 的衬脚在这一步被淘汰（中文界面读成「工」），上下文窗口的 `[—]` / `\|—\|` 也因读成减号被淘汰（见 §5.11） |
| 11 | 静态与单元门 | ✅ `npm test` = build + selfcheck（新增"行内无控件契约"3 条）+ test:params（新增 13 条事实断言，用真实 zh 文案）；`npm run typecheck` 无错 |

**没做/没覆盖的**：① 本次只做了只读测量，没有在改版后实际切换过模型（选择路径由 §8.1 第 7 条的
Host 往返记录覆盖，且这次没有改动提交逻辑）；② 浅色截图是临时摘 `body[data-ds-dark-theme]` 得到的，
没有走「设置 → 通用」的主题切换（不改用户配置）；③ **极端长档位名**的分支现在有两条证据：
机器门（`max-width: 64px` 由静态门断言）与 §5.12 那次把长档位名写进 DOM 的对抗性实测
（徽章条封顶在 161px、四枚胶囊始终在行内），但"某个真实适配器真的发出 14 字以上的档位名"
这种情况本机没有数据可构造。

### 8.5 第三次反馈的实测（2026-10-02，playwright-cli 对真实 GUI）

脚本 `scripts/_verify-fixes.cjs`（`npm run build` 后刷新页面即取到新产物；脚本只写
`localStorage` 里的提供商偏好，跑完把筛选恢复成「全部」，**不碰会话的模型**）。
`--raw` 返回的原始 JSON：

```json
{
  "chip": { "text": "DeepSeek-V41-Flash", "aria": "选择模型，当前 DeepSeek-V41-Flash，推理等级 High", "effortSpans": 0, "bubble": "DeepSeek-V41-Flash" },
  "providerFilter": { "startLabel": "全部", "pickedLabel": "DeepSeek 账号 2", "afterPick": "DeepSeek 账号",
                      "stored": "deepseek-account", "afterReload": "DeepSeek 账号", "persisted": true,
                      "staleDropped": true, "clearedStorage": null, "restoredTo": "全部" },
  "panel": {
    "viewport": 480,
    "atTop":    { "surfaceOverflow": "hidden/hidden", "surfaceScrolls": false, "bodyOverflowY": "auto",
                  "bodyScrolls": true, "bodyScrollTop": 0,  "surface": [21,385,280], "material": [21,385,280],
                  "materialCoversSurface": true },
    "atBottom": { "surfaceOverflow": "hidden/hidden", "surfaceScrolls": false, "bodyOverflowY": "auto",
                  "bodyScrolls": true, "bodyScrollTop": 67, "surface": [21,385,280], "material": [21,385,280],
                  "materialCoversSurface": true }
  }
}
```

| # | 验收项 | 结果 |
|---|---|---|
| 1 | 触发器不再显示等级 | ✅ `.dmp-trigger` 文本 = `DeepSeek-V41-Flash`；`.dmp-trigger-effort` / `.dmp-trigger-sep` 计数 **0** |
| 2 | 触发器气泡同样只有模型名 | ✅ 气泡 `textContent` = `DeepSeek-V41-Flash`（`role=tooltip`，`data-side=top`） |
| 3 | 屏幕阅读器的名字不缩水 | ✅ `aria-label` = 「选择模型，当前 DeepSeek-V41-Flash，推理等级 High」 |
| 4 | 提供商筛选跨刷新存活 | ✅ 选 `DeepSeek 账号` → chip 变它、`localStorage = deepseek-account` → **刷新整页** → chip 仍是它 |
| 5 | 陈旧的提供商 id 被丢掉 | ✅ 手工写 `no-such-provider` → 刷新 → chip 回到「全部」，且该键被清掉（`clearedStorage: null`）（**§5.22 之后**：chip 会回到当前模型的 provider；这条断言测的是"陈旧 id 被丢弃"，与 chip 写什么无关） |
| 6 | 卡片底色缺陷修好 | ✅ surface `overflow: hidden/hidden` 且 `surfaceScrolls: false`；`.dmp-settings-body` 是滚动元素（`overflow-y: auto`，滚到底 `scrollTop: 67`）；**两个滚动位置下 `.material` 的矩形与卡片矩形逐像素相同**（`[21,385,280]`），`materialCoversSurface: true` |
| 7 | 深/浅两主题 | ✅ `shots/panel-scrolled.png` / `panel-scrolled-light.png`（浅色是临时摘 `body[data-ds-dark-theme]`，截图后已恢复），页脚（写入位置 + 说明）都有底色 |
| 8 | 静态与单元门 | ✅ `npm test`（selfcheck 新增第 11 组 4 条断言）+ `npm run typecheck` 全绿 |

**没覆盖的**：① 面板底色那条只量了几何（`material` 矩形 ≡ 卡片矩形）+ 截图，没有跨浏览器验证
（`inset: 0` 的解析在 Chromium 上实测；`.material` 是宿主的实现，别的内核不在本机范围内）；
② 提供商筛选的"跨会话"也只验到"刷新整页"，新开一个会话没试（存储是按会话分片的，
按实现一定会带上）；③ 从"目录里真的少了一个提供商"这一侧没构造（本机目录稳定），只验了手写非法 id
这条等价路径。

### 8.6 第四次反馈的验收（2026-10-02，对比度门 + 文案单元门 + 对抗性复核）

这次没有可用的真实 GUI 会话（`dsh web` 打印的 token 不在本机环境里，`GET /` 返回 401），
所以验收分三条腿：**测出来的对比度**、**单元门锁住的文案**，以及**一轮独立的对抗性复核**
（复核者拿一个只读副本试图攻破对比度门与文案门，报回来的东西全部处理完）。

**(a) `npm run contrast`（新增，已进 `npm test`）**

读安装版 `@deepseek-ai/dsh-client-ui-theme` 的令牌表（只解析 `const CSS` 模板），
自己解析 `var()` 链并做 alpha 合成。测量基准是**两种下层底色的较差者**：
`--dsw-menu-surface-fill` 合成到 `--dsw-alias-bg-base` 与合成到 `--dsw-specific-input-major`
（面板挂在 composer 的齿轮上，深色下这层更暗）：

| 主题 | 卡片底色（页面 / composer） |
|---|---|
| 浅 | `rgb(251,252,252)` / `rgb(251,252,252)` |
| 深 | `rgb(42,43,46)` / **`rgb(54,55,59)`** |

| 样式 | 修前 | 修后 | 浅 / 深 | AA 门槛 |
|---|---|---|---|---|
| `.dmp-settings-hint` / `-notice` / `-note` / `-label` | caption 2.08:1 / 3.82:1 | secondary | **5.64 / 7.86** | 4.5 ✅ |
| `.dmp-settings-target` | dimmed 1.23:1 | secondary | **5.64 / 7.86** | 4.5 ✅ |
| `.dmp-status` / `.dmp-empty` | tertiary 3.61:1 | secondary | **5.64 / 7.86** | 4.5 ✅ |
| `.dmp-filter-hint` | tertiary 3.61:1 | secondary | **5.64 / 7.86** | 4.5 ✅ |
| `.dmp-provider`（未筛选时的 chip：§5.22 起是当前模型的 provider，未选中模型时是「全部」） | caption 2.08:1 | secondary | **5.64 / 7.86** | 4.5 ✅ |
| `.dmp-provider-count`（模型计数） | caption 2.08:1 | secondary | **5.64 / 7.86** | 4.5 ✅ |
| `.dmp-provider-failed`（"加载失败"） | warn 2.72:1 | secondary + 红点 | **5.64 / 7.86** | 4.5 ✅ |
| `.dmp-settings-alert`（拒绝原话） | error 4.38:1 @11px | secondary + 错误色图标 + danger 底色 | **5.64 / 7.86** | 4.5 ✅ |
| `.dmp-error` / `.dmp-warning` | error 4.38:1 | secondary + 图标 + danger 底色 | **5.64 / 7.86** | 4.5 ✅ |
| `.dmp-effort-item:disabled` | dimmed 1.22:1 | 保留 | 1.22 / 1.23 | 豁免（WCAG 禁用态） |
| 图标槽（`.dmp-*-icon` / `-check` / `-dot` / 齿轮 / chevron） | caption | 保留 | 2.08 / 3.21 | 豁免（不陈述文案） |

现在**最紧的一句是 5.64:1**（浅色主题下的 `label-secondary`），全部样式都在 4.5 以上；
`info tightest` 打印的就是它。**没有任何"文字样式可以不过"的例外。**

**(b) `scripts/test-params.mjs`：从"快照"升级为"规则"**

新增 25 条断言，其中前一半是**逐字快照**（用真实 zh 文案），后一半是**扫过 320 个状态组合的规则**：

| 规则 | 断言 |
|---|---|
| 状态行是唯一解释 | 有状态行（且容量没被拒）时，**两个分区提示都必须是 null** |
| `busy` 一定有解释 | 320 个状态里 `busy === true` 而状态行为 null 的数量 = `0` |
| 同一状态不说两遍 | 三行文案的 key 集合大小 = 行数 |
| 容量提示与字段一致 | 已声明 ⇒ `settings.context.declared`，未声明 ⇒ 不是它；有状态行 ⇒ 提示为 null |
| 被拒的值优先 | `capacityError === true` ⇒ 容量提示必是 `settings.context.invalid` |
| 输入提示与开关一致 | 说"已声明"时，列出的模态必须与开关显示的完全一致 |
| 可发的 key 都存在 | 每个 `CopyLine.key` 在 zh 与 en 都能解析，且不是裸 key |
| 提交动作 | `capacityAction` 的 12 个分支（未触碰/等值/新值/换写法/清空/被拒）逐条断言 |

"(c) 这次仍然没有实测到的"：`busy` 状态在真实 GUI 上的一帧（要抓住 `pending` 期间的渲染，
与 §8.1 未覆盖的 pending 菊花同因）；浅色截图——对比度是**算**出来的，取值来自宿主安装版的
令牌表，不是从像素上采的。

**(d) 对抗性复核发现并已修掉的问题**（这是本轮最有价值的部分）

| 发现 | 性质 | 处理 |
|---|---|---|
| 对比度门漏掉**字号写在另一条规则**里的样式（`.dmp-probe-hint` 只有 `color`，字号在兄弟规则） | 真漏洞 | 扫描改为沿 `CONTAINERS` 解析继承字号；**量不出字号就报错**，不再跳过 |
| 对比度门把**分组选择器**整串当选择器查，什么都匹配不到（`.a, .b { font-size }`） | 真漏洞 | 扫描先按 `,` 拆选择器 |
| `opacity: 0.55` 能绕过对比度门（它量令牌、不量画面） | 真漏洞 | `selfcheck-static.mjs` 新增静态禁令：不许 `opacity` / `filter` / `text-shadow` / `mix-blend-mode` |
| 例外正则 `\.dmp-provider\b` 吞掉了 `.dmp-provider-count` 与未筛选的 `.dmp-provider`（两处真文字，2.08:1） | 真漏洞 | 两处改 `label-secondary`；例外收窄到图标槽，且不再有文字例外 |
| `.dmp-provider-failed` 的琥珀色 2.72:1 被当成"可接受的例外" | 不该接受 | 改普通墨色 + 红点，例外取消 |
| 24px 拒绝行会撑开卡片、或被塞进**没有键盘入口**的内层滚动区 | 真缺陷 | 撤掉 24px；失败信号改由 danger 底色 + 图标 + 文案承担 |
| `capacityAction`：没碰过的字段也会写（每次关卡片一次 `mutate`） | 真缺陷 | `draft === null \|\| draft === committed` ⇒ `skip` |
| `capacityAction`：被拒的值一失焦就"好了"（红框消失、文本还在） | 真缺陷 | `reject` 幂等；标志只在 `onChange` 清 |
| `settings.context.default` 仍写"当前按 provider 默认 {value}"，声称了拿不到的事实，还混入英文 provider | 真缺陷 | 改为「适配器声明的兜底值是 {value}，实际容量由它内部决定」 |
| `settings.readonly` 里的 "profile" 是文件名，不是用户能操作的概念 | 真缺陷 | 改「当前配置不接受表单修改」 |
| 「恢复默认」在"本来就没有可恢复的改动"这个唯一没有解释的禁用态上静默不可用 | 真缺陷 | 补 `title`（`settings.resetNothing`） |
| 「恢复默认」在"本来就没有可恢复的改动"这个唯一没有解释的禁用态上静默不可用 | 真缺陷 | 改成**分区提示**里的一句话（`restoreIsEmpty` + `settings.resetNothing`）——禁用按钮上的 `title` 无法被键盘聚焦到，等于没有解释 |
| `inputHintOf` 在不可寻址时仍返回一句话，与状态行重复 | 真缺陷 | 改返回 `null`，两条 adapter 文案键随之删除（静态门的"死文案"断言逼出来的）。**§5.19 部分撤回**：适配器**公布过**事实时那条提示要留着——它说的是"这个值从哪来"，状态行说的是"为什么不能改"，两件事不再算重复（Rule 1 逐状态重扫） |

**第二轮对抗性复核（针对上面这些修复）发现并已修掉的问题**

| 发现 | 性质 | 处理 |
|---|---|---|
| `style={{ opacity: 0.5 }}` 写在 TSX 上：**全套门全绿**，而说明文字实际 2.28:1 | 真漏洞（唯一一条全绿路径） | 静态门扩到 TSX 行内样式；并把行内样式白名单收成"只许测量用的那一个" |
| `role="img"` + `aria-label` 把提示行从视线上抹掉：全套门全绿 | 真漏洞 | 静态门新增"带 `dmp-*` 类的元素不许把文案藏起来"（白名单只有徽章条与失败圆点） |
| 组件把 `case 'reject'` 的 `setCapacityError(true)` 改掉：纯层测不到，全套门全绿 | 真漏洞 | 第 12 组断言直接锁组件的 `switch` 四个分支 |
| 被拒的写入会**每次失焦都重发**同一个 `settings/mutate`（draft 留着 → blur 重试 → 又拒） | 真缺陷 | 写入被拒时把字段回到 Host 的值（保留拒绝提示），循环消失 |
| `unsized` / `unswept` 的失败详情会重复列同一个选择器 | 小瑕疵 | 去重 |
| `PRIMITIVE_SIZED` 只是"相信"，加类即可绕过字号要求 | 记录在案 | 注明这两个成员是照着宿主 CSS 核对的，且加类只影响"字号从哪来"，不改令牌判定 |
| 行首资源清理：`*.attack-bak` 被留在了源码树里 | 工程卫生 | 已删除；攻击脚本改为内存里恢复，不再落盘 |
| 重置效应的注释说"草稿只在第一次按键到提交之间存在"，但它也随 Host 值变化清零 | 注释失真 | 注释改成实话：外部改动同一模型声明时也会丢掉半截草稿，这是取舍（单用户文档） |

**(e) 改坏验证**：`.dmp-settings-hint` 改回 `label-caption`、`.dmp-provider-count` 改回 caption、
新加一条继承字号的 caption 规则、新加一条分组选择器的 caption 规则、
`.dmp-settings-hint { opacity: 0.55 }`、TSX 行内 `style={{ opacity: 0.5 }}`、
`role="img"` 掉的提示行、去掉 `capacityAction` 的两个守卫、让组件忽略 `reject` 判决、
让 `skip` 也发写入、把重复提示写回 `panelCopy` —— 十一条全部被门拦住，每条都是
"改坏 → 断言必须红 → 改回"实测过的，且攻击脚本在内存里恢复、不往源码树里落文件。


### 5.14 第四次反馈（2026-10-02）：文字说明的价值与颜色对比度

两件事一起做：**面板说的话值不值得读**，以及**读不读得清**。

**① 一个"看不见"的缺陷：11px 说明文字只过 2.08:1。**
`.dmp-settings-hint` / `-notice` / `-note` / `-label` 用的是 `--dsw-alias-label-caption`
（浅色 `#adb2b8`），在本插件自己的面板底色（`--dsw-menu-surface-fill` 合成到 `--dsw-alias-bg-base`
之上，浅色 `rgb(251,252,252)`）上只有 **2.08:1**，深色也只有 **3.82:1**——而它们写着
「尚未声明，当前按适配器默认：文字、图片」「已声明；留空并回车 = 恢复适配器默认」这类**必须先读懂才能
操作**的话。WCAG AA 对这么小的字要求 4.5:1，两条主题都不通过。这个缺陷能活这么久，是因为
2.08:1 的灰看起来**像是刻意的"安静"**，截图评审不会觉得哪里不对。

宿主给得起的墨色只有两级能过：`--dsw-alias-label-secondary`（浅 5.64:1 / 深 9.40:1）与
`--dsw-alias-label-primary`。所以面板里**凡是真话**（分区标题、提示、状态行、页脚说明、
写入位置、字段 placeholder、状态区文案、收窄提示条）一律改用 `label-secondary`，
层级改由**字号**承担（11px / 12px / 13px）。`--dsw-alias-label-caption` 仍然保留给
**图标**（齿轮、chevron、提供商 chip）——图标不是文字，没有对比度下限的问题，
而它作为"最安静的一级"正好是图标该有的位置。

**同类缺陷一并修掉（都是扫描发现、不是猜的）**：

| 位置 | 原墨色 | 实测（浅色） | 改法 |
|---|---|---|---|
| `.dmp-settings-target`（写入位置） | `label-dimmed` | **1.23:1**（约等于不可见） | 改 `label-secondary` 5.64:1；它是"这次编辑落在哪"，不是装饰 |
| `.dmp-status` / `.dmp-empty`（"正在刷新模型列表…"） | `label-tertiary` | 3.61:1 | 改 `label-secondary` |
| `.dmp-filter-hint`（"仅显示 X" + 显示全部） | `label-tertiary` | 3.61:1 | 改 `label-secondary` |
| `.dmp-error` / `.dmp-warning` | `state-error-primary` 11px | 4.38:1 | 改普通墨色 + 错误色图标 + danger 底色（见下） |
| `.dmp-provider-failed`（"加载失败"） | `state-warn-label` | **2.72:1** | 改普通墨色 + 一颗红点（见下） |

**② 失败文案：宿主没有"能读的红色"，所以失败信号不靠红色。**
`.dmp-settings-alert`（设置服务拒绝的原话）一度保留宿主的 `--dsw-alias-state-error-primary`
（浅 `#ec1313` 4.38:1 / 深 `#f25a5a` 3.61:1），并靠 **24px** 进 WCAG"大字"档（3:1）过关。
这个做法被推翻撤掉了：

1. **24px 与面板 11–13px 的字阶严重冲突**，一条拒绝语会把 280px 的参数面板撑成横幅；
2. 24px 的长原话会换行到 3 行以上，被顶出视口，或者只能塞进一个**没有键盘入口**的内层滚动区
   ——那是把"布局缺陷"换成了"内容够不到"的缺陷；
3. 更根本的是：**这套调色板里没有能在两个主题下做正文的红色**
   （`state-error-primary` 浅 4.38 / 深 3.61、`state-warn-label` 浅 2.72 / 深 4.26、
   `static-red-400` 浅 3.20）——这不是挑令牌能解决的问题。

所以失败的**信号**交给不需要可读性门槛的东西：宿主的 danger 底色、一颗错误色的警告图标
（`.dmp-settings-alert-icon`，装饰性，不受文本对比度约束）、以及文案里明写"拒绝了这次修改"。
**文字本身**回到 `label-secondary`（浅 5.64:1 / 深 7.86:1，AA 达标）11px——比原来那版红色
**更**清楚。同一处理用于 `.dmp-error` / `.dmp-warning`（图标 + danger 底色 + 普通墨色）
与 `.dmp-provider-failed`（`label-secondary` + 红点，替换掉浅色下只有 2.72:1 的琥珀）。

**③ 文案：把"解释为什么"和"说明值从哪来"分开。**
改版前，路由不可寻址时同一件事被说了**三遍**（状态行 + 两个分区的提示），三句都在说
"这里不能编辑"；而真正没有解释的状态是 **`busy`**：在面板里点一个等级档会提交共享选择，
`pending` 立刻让整个面板的控件变灰——用户自己点的那一下把自己的面板点停了，屏幕上却一句话都没有
（`aria-busy` 只告诉屏幕阅读器）。

这两件事的根因是同一个：**"哪个状态说哪句话"是散在 JSX 三元里的一条约定**。
现在它是数据：`src/client/panelCopy.ts` 的 `noticeOf` / `noticeKeyOf` / `inputHintOf` / `contextHintOf` /
`contextFieldOf` / `shownInputOf` / `showsContextField` / `restoreIsEmpty` / `capacityAction`，规则是

- 状态行（`notice`）是**唯一**解释"为什么不能用"的地方，`busy` 排在**第一位**（它最短暂，
  但正是用户自己触发的那一下）；有状态行时分区提示一律**不出现**（返回 null，而不是换一句话说）；
  唯一优先于状态行的是**用户刚敲进去、读不出来的容量**——那是他自己的当务之急；
- 分区提示只说**值从哪来**；唯一例外是"这条声明本来就是空的"：那种状态下"恢复默认"按钮不可用
  而没有状态行，所以由 `restoreIsEmpty` 把这句话接到分区提示上（禁用按钮上的 `title` 键盘够不到，
  等于没有解释）；
- 未声明两栏写「当前按适配器默认 / 适配器声明的兜底值是 {value}，实际由它内部决定」——
  **不声称那就是生效值**：pi-ai 的解析链是 `entry.x ?? base?.x ?? request.defaultX`，
  仅当模型在**适配器内置目录**里时目录条目还会插在前面，而座位目录不发布这些字段，
  本插件无从知道（复核确认：`llm/listConfigurableProviders`、目录条目、`settings/describe`
  都没有"这个模型是否在目录里"这个信息）。写"兜底值"比写"就是默认"诚实；
- `panelCopy.ts` 不返回 JSX，只返回 `{ key, params }`，所以 `scripts/test-params.mjs`
  能用**真实 zh 文案**断言每个状态到底渲染出哪一句。

顺带修掉的措辞：`settings.writeFailed` 不再出现 "Host"（改「设置服务拒绝了这次修改」）；
`settings.readonly` 不再出现 "profile"（改「当前配置不接受表单修改」）；
`settings.context.invalid` 补上真实取值范围（`1024–10485760`，即 `MIN_CONTEXT`/`MAX_CONTEXT`）；
`settings.context.unset` 原文案"留空即保持未声明"描述了一个没有可观测后果的动作，改成
"只有这里填了才会覆盖适配器内部的值"；「恢复默认」在"这条声明本来就没有可恢复的改动"这个
唯一没有解释的禁用态上补了 `title`。

**④ 容量输入框的两处写入缺陷（同一轮复核发现）**
字段显示值改为从 `address` 派生、只有"半途输入"是本地状态（`capacityDraft`），
并把"提交时到底该做什么"抽成纯函数 `capacityAction`。抽出来才看清两个缺陷：

1. **没碰过的字段也会写**：`onBlur` 在每次关闭参数面板时都会触发（点触发器、点页面、切窗口），
   而字段显示的就是 Host 的值，于是"提交"等于一次原值 `set`——每次关参数面板都白发一次
   `settings/mutate`、顺带推高 revision。现在 `draft === null || draft === committed` 直接 `skip`。
2. **被拒的值一失焦就"好了"**：旧 `onBlur` 发现 `capacityError` 为真就清掉标志并返回，
   于是按 Tab 出去再回来，红框和提示消失、字段里还是那段读不出来的文本。
   现在 `reject` 是**幂等**的（同样的文本永远判 reject），标志只在 `onChange` 里清。

**⑤ 新增机器门：两条互补的静态/数值门 + 一条"组件必须消费决策"的门。**

`scripts/check-contrast.mjs`（`npm run contrast`，已进 `npm test`）读**安装版宿主的令牌表**
（`dsh-client-ui-theme/lib/client.js`，只解析 `const CSS` 模板本身，不会把模块里的 TypeScript
误当成规则），自己解析 `var()` 链、把半透明的面板底色合成到**两种可能的下层底色**
（页面 `--dsw-alias-bg-base` 与输入条卡 `--dsw-specific-input-major`——深色下后者更暗，
只看页面底色会把深色的 3.61:1 算成 4.30:1），然后：

- 逐个样式**从 styles.ts 里读**它自己的 `color` 令牌与 `font-size`（不在本文件里硬编码期望值，
  所以把某个类改到别的令牌上，量到的是改后的结果，而不是"期望值不匹配"）；
- AA 门槛按**画出来的字号**推：≥24px 或 ≥18.66px 且 ≥700 才是"大字"（3:1），其余 4.5:1；
- 再扫一遍 styles.ts 里**所有会画字的规则**（不看白名单）：拆开分组选择器、沿 `CONTAINERS`
  树解析继承来的字号、`color: inherit` 沿祖先取值；**量不出字号的规则报错而不是跳过**
  （"我看不出它多大"绝不能读成"它没问题"）；
- 例外只有两类、都在本文件里写明理由：禁用态（WCAG 豁免），以及**图标槽**
  （`*-icon` / `-check` / `-dot` / 齿轮 / chevron——不陈述文案，旁边有文字在讲同一件事）。
  **没有任何"文字样式可以不过"的例外。**

`scripts/selfcheck-static.mjs` 补上三条"门看不到的地方"的静态禁令——它们都是被对抗性复核攻破后加的：

1. 样式表里**不许出现 `opacity` / `filter` / `text-shadow` / `mix-blend-mode`**；
2. **TSX 里的行内样式同样不许**做这四件事，而且**除测量用的 `MEASURE_STYLE` 之外不许有别处行内样式**
   （`style={{ opacity: 0.5 }}` 能把 11px 说明文字画成 2.28:1，而数值门量的是令牌、完全看不见）；
3. **不许用 `role="img"` / `aria-hidden` 把带 `dmp-*` 类的文案藏起来**——那会把文字从视线上抹掉
   而所有门都保持绿（唯一白名单是徽章条 `dmp-badges`，它的事实由整行 `aria-label` 重述，
   以及无文字的失败圆点）。

第 12 组断言替组件补上"必须消费纯决策"这一环：`panelCopy.ts` 被单元门逐条驱动，
但**组件那个 `switch` 是测不到的**——把 `case 'reject'` 里的 `setCapacityError(true)` 改成 `false`
等于删掉整个"拒绝态粘住"的行为，而全套门曾经全绿。现在静态门直接断言
`case 'reject'` 只置真、`case 'skip'` 不写、`case 'unset'` 发 `unset`、`case 'set'` 发 `set`，
以及"字段值是派生的、只有草稿是本地状态"。

**改坏验证**（每条都是"改坏 → 断言必须红 → 改回"）：`.dmp-settings-hint` 改回 `label-caption`；
`.dmp-provider-count` 改回 caption；新加一条**继承字号**的 caption 规则；新加一条**分组选择器**的
caption 规则；`.dmp-settings-hint { opacity: 0.55 }`；TSX 行内 `style={{ opacity: 0.5 }}`；
`role="img"` 掉的提示行；去掉 `capacityAction` 的两个守卫；让组件忽略 `reject` 判决；
让 `skip` 也发写入；把重复提示写回 `panelCopy` —— 十一条全部被门拦住。

### 5.15 第五次反馈：提供商 chip 没有继承会话

> ⚠️ **本节的 ② 被 §5.17 推翻，又在 2026-10-04 被 §5.22 请回**：`providerFilter ?? state.current?.provider ?? null`
> 这个改法当时让 chip 和它自己的菜单互相打脸（菜单勾「全部 ✓」而 chip 写 `commandcode`）。§5.21 把
> 「全部」那一行从菜单里删掉之后，这个矛盾的前提没了——菜单里没有任何一行在说「全部」，chip 也就不再
> 是在跟单选组抢同一句话。现在的形态与本节 ② 相同（`chipProviderId = filterProviderId ??
> state.current?.provider ?? null`），但**收窄生效时 chip 仍以范围为准**，而且两个状态用墨色 +
> `data-filtered` 分开。①（按会话分片记忆）和 ④（会话边界重读）一直在。

**反馈原文**：「在不同对话窗口，模型选择器展示的模型是当前任务使用的模型，但是模型提供商没有继承这个
功能。」

**根因是两个 chip 不同源。** 模型触发器每次渲染都读**会话自己的目录**
（`index.ts` 的 `models.directoryFor(sessionId)` → `Picker` 的 `useSyncExternalStore`），所以切窗口它
一定跟着变。提供商 chip 读的是 `providerFilter`，而那是 §5.13 定下的**全局偏好**
（`localStorage['dsh-model-picker.provider.v1']`，一个不带任何限定的键）。四个具体缺陷：

| # | 位置 | 缺陷 |
|---|---|---|
| 1 | `Picker.tsx` `useState(() => readProviderFilter())` | 只在挂载时读一次。座位在换会话时**不重挂载**（§5.10 的 `settingsSession` 就是为这个事实专门写的补丁），所以初值永不再跑 |
| 2 | `activeProviderLabel` | 只从 `providerFilter` 推导，从不读 `state.current.provider`——未收窄时永远显示「全部」，而旁边的触发器正显示着某个具体模型 |
| 3 | `groups` 的收窄 | 全局范围会把新会话**正在用的那一组整个挡掉**，列表里连它的行都没有 |
| 4 | `currentVisibleIndex` → `activeIndex` | 当前模型被挡掉时它是 `-1`，打开菜单高亮落到无关的第一行，勾选标记也消失 |

复现：窗口 A 跑 `opencode-go`、窗口 B 跑 `deepseek-account` → 两个触发器各自正确，但 B 的 chip 仍写着
`opencode-go`，菜单里 `deepseek-account` 那组被过滤掉了，B 当前的模型既看不见也选不回来。

这不是宿主座位缺了行为：官方 `ModelSelect` 的输入条只显示模型名、提供商只作为 `/model` 弹窗的分组
标题，**本来就没有 chip**，所以没有可继承的东西——会话级 provider 真值必须由本插件自己接上。

**改法：把"会话真值"和"用户覆盖"分成两层。**

```
有效提供商 = providerFilter ?? state.current?.provider ?? null
```

- **未收窄**：chip 写当前会话那个模型的提供商（与触发器同源），`data-filtered` 不亮，**列表不收窄**。
  收窄语义仍然只属于用户的显式选择——否则 chip 会藏掉用户从没要求藏的模型，「显示全部」也会变成假话。
- **已收窄**：chip 与列表都以用户的选择为准，会话自己跑在哪个提供商上不参与（用户有意把列表带到别处，
  不该被它恰好在跑的模型拽回去）。
- **会话还没选模型**时回到「全部」。

记忆随之改为**按会话分片**：键从 `…provider.v1` 变成 `…provider.v1:<会话 id>`。座位不重挂载这件事
单独也足以让全局键出错，所以 §5.10 那套"渲染期同步"的写法被复制了一份给窄化
（`filterSession !== sessionId` 时重读该会话的键）；写回时用 `filterSession` 而不是当下的 `sessionId`，
两者由同一段代码保持一致。旧版那个不带会话 id 的全局键在挂载时清掉（`retireLegacyProviderFilter`），
否则它会永远留在 store 里，不被读也没有解释。

**没有做的**：§5.9 原本还剩一条——"当前模型被范围挡掉时把它单开一个置顶分组"。改完按会话记忆后，跨会话
的错配已经不存在，剩下的唯一情形是**用户亲手把这个会话的列表收窄到了它正在跑的模型之外**——那是明确的
意图，卡内的 `仅显示 {name}` + 「显示全部」和触发器上那个诚实的 `provider/model` 已经把它说清楚了。
强行把被收窄掉的模型塞回列表，等于让"范围"这个词失去意义。

**机器门**（`selfcheck-static.mjs` 第 11 组，从 1 条扩到 5 条）：窄化按 `sessionId` 读、按 `filterSession`
写；键必须由会话 id **拼出来**且必须退役旧键；座位必须在会话边界重读；chip 标签必须从
`state.current?.provider` 派生；`groups` 里**不许**出现 `state.current?.provider`。
`test-params.mjs` 的 prefs 组补了 6 条：两个会话各记各的、键确实不同、旧全局键被清且不清掉本会话自己的、
被拒绝的 store 上清理也不抛。

**改坏验证**（两条都做过，`filter:` 组当场变红，改回后全绿）：

| 改坏 | 被谁拦住 |
|---|---|
| `activeProviderId` 退回 `providerFilter ?? null`（缺陷 2 原样） | `filter: the chip label inherits the session model's provider` |
| `if (filterSession !== sessionId)` 改成 `if (false)`（缺陷 1 原样） | `filter: the seat re-reads the narrowing when the session changes` |

### 5.16 第六次反馈：「最近使用」从列表分组变成提供商菜单里的一个选项

> **⚠ 本节是历史记录，描述的东西已不存在。** 这里定下的"菜单里多一个 `最近使用` 选项"在
> **§5.21 被整个删除**（连同 `recent.ts`、`RECENT_ID`、`empty.recent`）。本节保留下来是因为
> §5.21 的决策正是对着它做的——不读这一段，就不知道被删掉的到底是什么、为什么当初会那么设计。
> 下面所有机器门标签（`recent: …`）都已随之删除，只在 §5.21 的表格里作为历史留名。

**反馈原文**：「移除模型选择器中的『最近使用』。在模型提供商『全部』下面加上『最近使用』选项。
用户选择『最近使用』后，模型选择器里会显示最近显示的模型（带有模型提供商）。」

**决定形态的是一句话**：「带有模型提供商」不需要新造一行展示，因为**分组标题本来就在说这件事**。
于是「最近使用」被定义成**只换一组行，不换分组方式**——

```
未收窄：  DeepSeek 账号          （只有 provider 分组，最近使用不再置顶）
选中后：  ▍DeepSeek 账号         ← 现成的粘性分组头
           V4.1-Flash-Fast
           V4.1
         ▍opencode-go
           GLM-5
```

一个 provider 同时被最近选中过两次，它的两条就是**同一个分组里的两行**，而不是两个单行分组。
反过来，曾被考虑过又否掉的两种做法：「行内给每行加一个提供商徽章/灰字」——重复了标题已经在说的话，
还要给胶囊预算再加一个图标；「扁平无标题」——那就必须行内自带提供商，等于把刚删掉的重复又请回来。

**实现上它是伪 provider**，id `RECENT_ID = '__recent__'`，和其他选项一样存在 `providerOptions` 里、
紧跟在 `id: null`（全部）之后。它不是 provider，所以有三处必须显式处理：

| 位置 | 处理 | 为什么 |
|---|---|---|
| `groups` | 提前分支：`providerFilter === RECENT_ID` 走 `recentGroupsFor`，否则是原来的 provider 路径 | 目录路径里**完全不再出现 recent 分组** |
| `knownProviders`（陈旧 id 清理） | **什么都不用做**——它的菜单行是无条件存在的，所以 `RECENT_ID` 天然在集合里 | 否则每次目录 settle 都会把「最近使用」的选择丢掉 |
| 空状态 | 新句子 `empty.recent` | 到这里有**两种**原因：从来没用过，以及用过但都离开目录了。「该提供商没有可用模型」会把责任推错对象 |

菜单里那一行的计数是「**这个目录现在还能显示多少条**」，不是存储里一共记了几条——列表最多显示
`RECENT_VISIBLE` 条，一个和打开后看到的东西对不上的数字本身就是个小谎。

**排序刻意与目录模式不同**：provider 之间的顺序、provider 内部的行顺序，**都是 recency**
（`recentGroupsFor` 从不 `.sort()`，靠 `Map` 的插入顺序）。选了「最近使用」的人是在**倒着走**自己用过的东西，
所以搜索的作用是**收窄**这条回溯（不匹配的丢掉），而不是按相关度把它重排。

**卡内提示条**给了 `provider.filteredRecent`（「仅显示最近使用的模型」）而不是把
`仅显示 {name}` 里的 `{name}` 填成「最近使用」——后者是把一个主语当专有名词塞进句子。

**位置**：抽成 `recent.ts` 的纯函数 `recentGroupsFor`（不 import React，也不 import
`rankByName`——查询过滤留在 `Picker` 的 `recentRowsFor` 里先做完）。放在 `.tsx` 里就只能靠正则门盯着；
放出来就能被 `test-params.mjs` 真正驱动一次。

**机器门**：静态第 11 组新增 5 条（见下表）；单元门新增 10 条，覆盖分组、累计、顺序、标题来源、
伪 id、空输入、缺失 provider、以及存储的去重与上限。

**改坏验证**（七条，每条都实际打上并确认门变红，改回后全绿）：

| 改坏 | 被谁拦住 |
|---|---|
| 把 recent 分组重新塞回目录路径的顶部 | `recent: it is a provider-menu option, not a group in the list` |
| 把「最近使用」那一行挪到菜单末尾 | `recent: the provider menu lists it right below "all providers"`（外加文案"未被使用"门——那条文案只剩这一处） |
| `rows: existing === undefined ? [row] : [...existing.rows, row]` 改成 `rows: [row]`（每个 provider 只留最新一条） | `recent: its rows keep the provider headings and every remembered route` |
| 在 `recentGroupsFor` 末尾加一个按标题的 `.sort()` | 同上（门里那条 `!/\.sort\(/` 就是为它写的） |
| `RECENT_ID` 改成 `'recent'`（真 provider 可能叫这个） | `recent: the pseudo-provider id cannot collide with a catalog provider` |
| 空状态退回 `empty.provider` | `recent: an empty recent list says so, without blaming a provider` |

> 中途有过一次**假通过**：第一版门只检查"标签来自 provider"，而"每个 provider 只留最新一条"这个改坏
> 仍然满足它，于是放过去了。补上门里那条"必须累加"才咬住。**门被改坏时它不会自己变红**——
> 这次是靠逐条改坏实测发现的。

### 5.17 第七次反馈：chip 和菜单互相打脸

> **⚠ 本节是历史记录，且已被 §5.22 部分反转。** 本次结论里"chip 必须能说出 `全部` 和 `最近使用`"这一半
> 已被 §5.21 部分推翻：菜单不再有 `最近使用` 行，`全部` 也从菜单行变成了 chip 自己的未收窄文案。
> **2026-10-04 又进一步（§5.22）**：本节"chip 只回答列表范围、绝不读会话"这条也被反转——`全部` 那一行
> 从菜单里消失后，本节反对 chip 读会话的**论据**（"菜单勾 `全部 ✓` 而 chip 写 `commandcode`"）不存在了。
> 现在未收窄时 chip 写当前模型的 provider，**收窄生效时仍然只写范围**；本节留下的两条要求继续成立：
> 会话真值必须在菜单那一行上有「当前会话」（§5.22 里它正好给 chip 的说法做背书），以及"chip 必须说得清
> 自己处在哪个状态"——靠墨色 + `data-filtered` + 两套 aria 文案说清。

**反馈原文**：「模型提供商选择器，如果勾选了全部，但是页面上不会展示『全部』。你怎么看待这个问题。
全部和最近使用，需要显示吗？」截图里菜单写着 `全部 76 ✓`，而 composer 上的 chip 写着 `commandcode`。

**§5.15 的解法错了，而且错在"给一个控件塞两件事"上。** 那次把"这个会话实际在用哪个提供商"塞进了
chip，于是同一个控件开始说两件互斥的事：chip 说"你在这个 provider 上"，它自己打开的那个单选菜单说
"没有窄化"。这不是措辞问题——**这两句话没有任何一种读法能同时成立**，所以它必然被当成缺陷报回来。
当时那三个备选项里，"未筛选时显示会话真值"这一条本身就有这个代价，而我在选项说明里没写出来。

**结论：两个事实都需要，但它们不属于同一个控件。**

| | 是什么 | 什么时候变 | 在哪显示 |
|---|---|---|---|
| **列表范围** | 视图状态。未收窄 / 某个 provider（**当时还有 `全部`、`最近使用` 两项，§5.21 删除**） | 用户改范围 | **chip**（菜单勾什么它写什么；未收窄那一项§5.21 起由 chip 自己说，§5.22 起 chip 改说模型所在 provider、只有没选模型时才说 `全部`） |
| **会话实际在用的 provider** | Host 已接受的事实 | 换模型、换会话 | **提供商菜单里那一行的行尾**，标「当前会话」 |

于是：

- chip 回到单一职责 `providerFilter`。「全部」和「最近使用」**必须能显示**——它们是这个单选组的正式
  成员，chip 要能表示菜单的范围，就得能说出它的每一项；把它们从 chip 上拿掉，chip 在四个状态里有
  两个说不出来。（**§5.21 更新**：单选组缩到只剩 provider 一项，`全部` 以 chip 未收窄文案的形式活下来，
  `最近使用` 整个删掉——这句话的前提没了，但"chip 必须说得清自己处在哪个状态"这条要求还在。
  **§5.22 再更新**：未收窄的 chip 改说当前模型的 provider，`全部` 只在"还没选中模型"时出现。）
- 「当前会话」落在 `opencode-go` 那一行的行尾，紧挨计数，构成一列尾部信息。位置选在这里，是因为
  **问"这个会话在用哪个 provider"的人，此刻正看着这张菜单**。样式与 `.dmp-provider-count` 同墨同号
  （`label-secondary` 11px——caption 在这张卡上只有 2.08:1，§5.14 已经判过一次），放行内是因为
  `.dmp-row-copy` 里的名字那一半是弹性半，标注落在右边缘，**不会让这一行的名字比邻居更早省略号**。

§5.15 的另一半（按会话分片记忆、会话边界重读）原样保留——那条是对的，问题只出在 chip 上多读了一个源。

**顺带修掉截图里暴露的第二个缺陷**：菜单写着 `最近使用 8`，而列表最多显示 5 条。存储保留 12 条是**故意的**
（这样目录里少了模型，最近列表仍然能填满 5 个槽），但把这份富余算进菜单就成了**唯一一个数字和点进去的行数
对不上的选项**。改成 `recentRowsFor(..., RECENT_VISIBLE).length`——和菜单其它每一行一样，写什么就是几行。

**机器门**：§5.15 里那条断言"chip 继承会话"的门被**反过来重写**（它现在断言 chip 不许读会话），
另加一条"会话的 provider 必须在菜单那一行上有标注"（防止有人只删掉 chip 的第二件事、把答案也一起删掉），
再加一条"最近使用那一行的计数必须和列表同一个上限"（这条随 §5.21 删除）。

**改坏验证**（六条，每条都实际打上并确认门变红，改回后全绿）：

| 改坏 | 被谁拦住 |
|---|---|
| `activeProviderId` 退回 `providerFilter ?? state.current?.provider ?? null`（当时判为"矛盾原样回来"） | `filter: the chip names the list scope, never the session`——**这条门已在 §5.22 反过来重写**（菜单里没有 `全部` 行之后，那个矛盾不可能再出现）：现在改坏的方向是把 chip 钉回 `providerFilter` |
| 菜单行的 `session: group.id === state.current?.provider` 改成 `false`（答案被删掉） | `filter: the session's provider is marked on its own menu row` |
| 计数改回 `recentRowsFor(..., null)`（又变成"8 配 5 行"） | `recent: the menu counts what opens, not what is remembered` |
| 「最近使用」那一行挪到菜单末尾 | `recent: the provider menu lists it right below "all providers"` |
| recent 分组重新塞回列表顶部 | `recent: it is a provider-menu option, not a group in the list` |
| 每个 provider 只留最新一条 recent | `recent: its rows keep the provider headings and every remembered route` |

> 这次的门改对了：**§5.15 那条门当初断言的是错的结论**，所以它当时是绿的——门只能守住写下来时的
> 判断，判断本身错了它不会知道。同理，这六条也只证明"这些改坏会被拦住"，不证明 chip 的职责划分是对的。
> 那是截图和判断，不是门。

### 5.18 锚点没了就关掉

**反馈原文**：「当模型参数弹窗打开时，如果这时候跳出 dsh 的问答卡片，会导致对话输入框被隐藏，
从而导致模型参数弹窗位置漂移到错误的位置。这时候正确的表现应该是关闭模型参数弹窗。」

**先把机制说准：这不是"位置算错了一次"，是弹窗成功地算了一次。** 三个弹窗都 portal 在
`document.body` 上、`position: fixed`，位置来自锚点矩形。Host 把问答卡片选进
`conversation.composer` 这条 chain 时，渲染成 `overlay: true`——**默认输入条没被卸载，只是被
`display: none` 了**（`renderChainResult`）。于是锚点矩形全零，`useAnchoredPosition` 拿 `0 - gap - height`
算出负数，钳到 `margin`（12）：面板"正确地"落到了视口左上角。

实测（§8.7）：面板 `(265, 787)` → `(12, 12)`，之后滚动**也不会回来**——因为锚点已经不在滚动链路上了。

**结论：无锚点的弹窗是"该消失"，不是"该重新定位"。** 理由有三条，按重要性：

1. **没有锚点的面板无法回答"我为什么在这儿"**，而这个面板的全部内容都是"这个会话的当前模型的参数"——
   它必须有一个可见的归属。
2. **卡片本身是临时的**（可以最小化、可以关掉）。跟着一个自己活不过今天的控件重新定位，是给一个
   必然要再坏一次的状态打补丁。
3. **焦点归属已经不确定了**：真实卡片会 `autoFocus` 它的作答控件。

**触发条件从"问答卡片出现"改成"锚点离开版面"。** 前者是猜的，后者是可观测的，而且白送覆盖另外两个同样
会顶掉输入条的选择器——`dsh-client-ui-approval`（`PendingApproval`）和
`dsh-client-ui-subagent` 的只读 composer。**不引用任何 Host API**（`pendingInteraction` 那条路是另一
种写法，直接耦合在别人插件的内部状态上，不做）。

**三个弹窗一起关。** 它们本来就"一次只活一个"（`show()` / `toggleProviderMenu()` / `toggleSettings()`
各自清掉另外两个），"一次只开一个"延展出去就是"一次只活一个"。关的时候**不还焦点**——触发器在刚消失
的那个盒子里，`close()` 那种还焦点的做法在这里是错的。

**观察 seat 根，不观察单个锚点。** 两条都是实测的：`display: none` 一次性压掉所有后代的盒子，看单个锚点是
在看根状态的一个症状；而单个锚点本身不是可用信号——窄输入条会把 trigger 和 chip 挤到 12px（实测
`.dmp-root` 的 flex 地板把整体保在 56px）而它们仍然是用户正在点的控件，**按锚点设阈值要么漏报要么误报**，
对一条会静默丢弃用户面板的规则来说，两个都不能接受。

**唯一不显然的地方，也是这个 bug 真正吃掉我一次的地方：第二次确认不能用 `requestAnimationFrame`。**
`display: none` 的子树根本不会被浏览器 servicing 帧回调——**要等的帧永远不来**。第一版就是这么写的，
于是 observer 报出了丢失、复查排上了队、600ms 后复查**还没跑**，弹窗永远不关：原缺陷原样保留。
改用 `setTimeout`（任务队列，照常被 servicing）。这是量出来的，不是想出来的，而且极易被改回去。

**机器门**（第 13 节）：规则存在且以根为对象、第二次确认用计时器而非帧回调、**闩住的 flag 逐个松开**且不还焦点、
只在弹窗打开时挂观察、拆卸时 `disconnect` + `clearTimeout`。其中"闩住的 flag"是**从代码里推导**的
（见 §5.31）：凡是座位 `set…(true)` 闩上的布尔量，座位离场时都必须松开——写死的清单会和散文一起漂移。

**改坏验证**（十五条，`node scripts/mutate-anchor-loss.mjs`，每条实际打上并确认门变红，改回后全绿。
该脚本已进 `npm test`，见 §5.31）：

| 改坏 | 被谁拦住 |
|---|---|
| `setTimeout(confirm, …)` 换回 `requestAnimationFrame(confirm)`（原缺陷原样回来） | `§5.18: the second look waits on a timer, not on a frame callback` |
| 观察对象 `rootRef` → `triggerRef`（锚点级探测） | `§5.18: the seat root is the observed node` |
| 删掉 `setSettingsAt(false)`（三个不再一起关） | `§5.18: all three popovers are dismissed together, with no focus restore` |
| 删掉 `if (!open && …) return`（一直挂着观察） | `§5.18: the observer is armed only while a popover is open` |
| `getClientRects().length > 0` → 只看 `isConnected`（`display:none` 时仍是 true） | `§5.18: a popover is dismissed when the seat root stops occupying the page` |
| 删掉 `observer.disconnect()` | `§5.18: the observer is disconnected on teardown` |
| 删掉 `clearTimeout(timer)` | 同上 |
| 关闭时补一句 `lastActionRef.current?.focus()`（还焦点） | `§5.18: all three popovers are dismissed together, with no focus restore` |

> 第三次改坏第一次跑时**门是绿的**。原因不是判断错，是那条断言的正则从一个更早的
> `useEffect` 贪婪地一路吃到第一个依赖数组——外面点击那个 effect 有**完全相同**的守卫和依赖列表，
> 于是它 `closeOutside` 里的 `setSettingsAt(false)` 替被删掉的那一句打了掩护。改成在
> `observeSeatLoss` 处切断捕获、三个调用**逐个**断言之后才抓住。**门漏掉的东西，就是没被写下来的判断。**
> 最后一句也只证明"这八条改坏会被拦住"，不证明"该关而不是该重定位"是对的——那是判断，不是门。

### 5.19 第八次反馈（2026-10-04）：内置目录里的模型，能力也要陈述出来

用户看着"这个模型来自适配器内置目录，没有可编辑的声明，只能查看"这句话问：**那它的图文支持和
上下文窗口读得到吗？能就展示出来。** §2.2 已把通路逐条核实过，这里记的是定稿与取舍。

**缺陷先摆清楚。** 改动前，不可寻址的路由（本机就是默认模型 `dsh-opencode-go/deepseek-v4.1-flash`）：

| 面 | 改动前 | 问题 |
|---|---|---|
| 行内徽章 | 只有推理徽章（模态与窗口整条不出现） | 不算错，但把"读不到"和"不支持"混在一起——用户无法区分 |
| 面板输入分区 | **两个开关都画成关闭** | 这是**主动的错误陈述**：等于宣布该模型既不收文字也不收图片。`panelCopy` 的注释当时写着"禁用开关仍然显示模型接受什么"，而 `shownInputOf(null)` 返回 `[]`，两者互相打脸 |
| 面板上下文分区 | 整块不渲染 | 用户拿不到窗口大小 |

**定稿：加一层只读能力目录（`capabilities.ts`）。**

1. **读取顺序 = 适配器自己的顺序**：`声明 → 适配器发布的目录 → provider 级默认`。
   §2.2 已核对两个适配器就是这么解析的；换个顺序就会陈述一个适配器并不在用的窗口。
   `badges.ts`、`panelCopy.ts` 的每一处取值都按这个梯子写，单元门对每级都有断言。
2. **两条读取通路，显式的优先**：登记在 `ADAPTER_CATALOGS`（`index.ts`）里的适配器自有 Remote
   （`dsh-opencode-go` → `opencodeGoModels/read`）先答；没有登记的才走 `llm/discoverModels`。
   `dsh-opencode-go` 根本没注册 configurable provider，对它是**只有第一条路**。
3. **`declared === true` 一律不读**。适配器自述"只从配置知道这个路由"时，它的 discovery 会离开进程
   去打 endpoint（联网 + 用凭据）。开一次模型菜单就偷偷发这种请求，是选模型菜单无权付的代价，
   所以这类路由保持"什么都没公布"。
4. **一次一 provider，一页一次**：`CapabilityStore.ensure()` 合并重复请求、只读一次、不轮询、不订阅推送。
   行内徽章在**模型卡打开时**才触发读取（不开模型卡不花这次调用），面板在**它自己打开时**触发。
   provider 目录（`listConfigurableProviders`）也只在第一次需要时读一次。
5. **挂载顺序不参与**：Remote 命名空间是异步挂载的（§2.2 最后一行），所以 LLM 面用**取值函数**而不是
   激活时抓一次；适配器自有目录**每次读时**才 `ctx.get('remote.<ns>')`。晚注册的 reader 会把已经问过
   的 provider 重问一遍（`addSource` 里那段），所以"先问后到"也能答上（单元门有这条）。
6. **读不到就什么都不说**：适配器没公布的模型不进索引（`routeCapabilityOf` 返回 null；空数组也算
   "没公布"，不是"公布了一个空集"）。对应地：**面板不渲染该分区**（不是画成关闭），行内不出该徽章。

**文案规则（`panelCopy.ts`）也改了一条。** 原来"有状态行就不出分区提示"，理由是状态行是解释
"为什么不能用"的唯一位置。适配器公布的事实是**另一件事**——它回答"屏上这个值从哪来"，状态行从不回答
这个问题——所以现在只有 `settings.input.capability` / `settings.context.capability` 两条允许与状态行
同时出现，其余一切照旧。这条规则由单元门 Rule 1 逐状态扫过（含能力轴 × 地址轴 × status × writable ×
busy × capacityError = 320 个状态），Rule 6 另外保证"公布"那条提示列出的模态与开关状态一致。

**为此收窄的一处显示**：不可寻址 + 适配器什么都没公布时，输入分区整块不再渲染。以前它渲染两个关闭的
开关，那是一个没人验证过的断言；现在面板在该状态下只留状态行 + 等级分区。新增 `showsInputSection`
与既有的 `showsContextField` 对称，两者都由单元门覆盖。

**已知边界**：
- 模态词表按适配器的 5 个 token（`text/image/audio/video/pdf`）本地化，但**行内只有 图文 两枚徽章**
  （`facts.ts` 的词汇表就是这两项）；音频/视频/PDF 只在面板的提示句里出现。
- `maxTokens` 读到了但**没有面陈述它**（`RouteCapability.maxTokens`，与既有的 `RouteAddress.maxTokens`
  同样保留），因为行内四枚徽章与面板分区都还没有第三个数量的位置。
- 事实是**页面级缓存**：适配器刷新了目录也不会推给已经开着的页面，刷新页面才重读。
- 自有目录 Remote 的**具体命名空间是硬编码**的（`ADAPTER_CATALOGS`）：外部插件不能值导入适配器包，
  所以路由 id 与命名空间只能钉在代码里并注明出处（适配器的 `lib/provider-identity.ts` 与
  `models-contract.d.ts`）。

### 5.20 第九次反馈（2026-10-04）：传输层兜底与每次打开重读（体检修复）

项目体检发现的三类健壮性缺口，全部有单元门/静态门钉住：

1. **写入路径会 REJECT，不只是拒绝。** `settings/mutate` 在传输层死亡（断连、超时）时是
   promise reject，而不是 `{ ok: false }`。`ParamsStore.write` 原样把它抛出去，而面板用
   `void params.write(...).then(...)` 消费——没有 `catch`，`writing` 永远不清，面板所有控件
   永久禁用且无任何提示。现在 store 把 reject 转换成与「Host 拒绝」同一个出口
   （`{ ok: false, conflict: false, message }`），面板的失败显示路径不变。
   座位的选择路径同理：`directory.select()` reject 时走失败 toast，而不是无声无息。
   门：`test-params.mjs` 的三个 params store 断言 + selfcheck §13。

2. **快照只在「自己写」时更新。** 设置快照原来只在挂载时 `ensure()` 读一次，之后只有本插件
   自己写成功才会动——在「设置 → 模型」页改了声明，本插件的徽章、齿轮圆点、面板显示全部
   停在旧值，README 里写的「重开面板」其实也读不到（`ensure` 只在 `idle` 时读）。现在
   模型卡与参数面板**每次打开**都 `refresh()`；`read()` 在途时保留上一份好快照并合并并发
   读，所以代价是每次打开一次读、画面在答案落地前不变。**仍未订阅 host 的设置推送**：
   面板开着的时候去别处改，要等下次打开才看得到。门：selfcheck §13。

3. **能力目录的询问是「一次定终身」，且 racing 读会被吞。** Remote 命名空间异步挂载，
   一次没挂上（或目录读失败、传输失败）的询问原来永久消耗掉 `asked` 名额——整页生命周期
   内该 provider 的事实徽章缺席。现在「没读到答案」与「适配器答复没有」分家：前者释放询问
   下次打开重试，后者（含适配器拒绝 discovery）仍然一次定终身；`addSource` 在读取在途时
   登记的 reader 不再被 inflight 守卫吞掉，改为读毕重跑。门：`test-params.mjs` 的四个新块
   + selfcheck §7b 三条。

顺带的小修：参数面板的档位选中态按 **effort id** 比较（原来比 label，两个档位同名会同时
打勾）；provider 排序与 chip 本地化写死的 `deepseek-account` / `deepseek-official`、失败
toast 的 `[data-composer-card]` 锚点这三个宿主内部标识补进了 selfcheck 与 README 契约表。

### 5.21 第十次反馈（2026-10-04）：提供商菜单里删掉「全部」和「最近使用」

**反馈原文**：「移除模型提供商选择器中的『全部』和『最近使用』两个选项。」

**决策：菜单只剩真实 provider 行。** 这次不是把两行藏起来，而是**把非 provider 的东西从这张菜单里
清出去**：

| 被删的东西 | 去处 |
|---|---|
| 「全部」菜单行（`{ id: null, … }`） | **删除**。它说的"未筛选"是一个**列表状态**，不是一个提供商。`provider.all` 字典键**保留**，改由 chip 在未收窄时使用（见下）。**§5.22 又把它改成"只在还没选中模型时"用**——未收窄的 chip 现在说当前模型的 provider |
| 「最近使用」菜单行（`RECENT_ID = '__recent__'`） | **删除**。连同整条机制一起：`src/client/recent.ts` 删除、`recentGroupsFor` / `readRecent` / `remember` / `RECENT_VISIBLE` / `RECENT_ID` 全部删除，`localStorage['dsh-model-picker.recent.v1']` 不再有人读写，`groups` memo 里的 `RECENT_ID` 分支、`empty.recent` / `provider.filteredRecent` 文案键一并消失 |

`rowKey` 是 `recent.ts` 里唯一还被别处需要的导出（`Picker` / `SettingsMenu` / `capabilities` 都按它
索引行），所以它**搬到 `src/client/contract.ts`**——那个模块本来就是"跨模块的结构与身份"的住处，
不是新建一个 `rowKey.ts` 只为放一个两行的函数。

**「全部」的角色变化：从菜单行变成 chip 的未收窄文案。** 这是这次改动里唯一需要想一下的地方。
菜单删掉那一行之后，`activeProviderLabel` 的 `null` 分支成了"未收窄"**唯一的说法**：

- 删menu行之前：chip 说「全部」有菜单那一行兜着，chip 只是个复述。
- 删menu行之后：chip 说「全部」是**这个状态仅存的陈述**。改坏它（让 `null` 走 provider 查表）会让
  未收窄状态在界面上完全无名——所以它有一条自己的门。

> ⚠️ **上面这段已被 §5.22 改写（同日晚些时候）**：用户随后指出，菜单里既然不再有「全部」，chip 就
> 不该在未收窄时也说「全部」——它应该说**当前模型所属的 provider**。于是 `null` 分支现在只在
> **还没选中模型**时生效（`provider.all` 仍然保留，门也仍然保留，只是守的状态换了名字）。本节关于
> "菜单里不许有非 provider 行"与"「显示全部」是唯一退路"的两条结论**不受影响**。

**退出收窄的唯一出口**：模型卡内的 `.dmp-filter-hint`（`provider.filtered` + 「显示全部」按钮，
`provider.showAll`）。以前可以点菜单里的「全部」行退出，现在那行没了，所以这条提示条**不是装饰**：
它若停止渲染，用户会被一个按会话持久化的范围困住，刷新页面也还在。它同样有自己的门。

**历史演变线条（第三次，也是最后一次改这个方向）**：

| 阶段 | 「最近使用」的形态 | 章节 |
|---|---|---|
| 最初 | **列表顶部的分组**，`localStorage['dsh-model-picker.recent.v1']`，`RECENT_VISIBLE = 5` 条 | §8.1 第 4 行 |
| 2026-10-03（第六次反馈） | **提供商菜单里的一个选项**，伪 provider `RECENT_ID`，紧跟在 `id: null`（全部）之后 | §5.16 |
| 2026-10-04（本次） | **删除**。「最近使用」不再存在于这个插件里 | 本节 |

第二次（§5.16）与第三次（本节）**方向正好相反**：§5.16 认为用户要的是"换一组行、不换分组方式"，
于是把它做成菜单选项；本次反馈直接要求把那个选项删掉。**这条线到此结束**——如果哪天又要把
"最近使用"请回来，那是一次新的需求，不是回滚，因为**连存储和记录逻辑都已删除**，没有"只是重新显示"
这个选项。

**机器门**：

| 动作 | 门 |
|---|---|
| **删除**（守着一个已删除的功能，留着只会要求代码保持不存在的东西） | `recent: it is a provider-menu option, not a group in the list` |
| | `recent: the provider menu lists it right below "all providers"` |
| | `recent: the menu counts what opens, not what is remembered` |
| | `recent: its rows keep the provider headings and every remembered route` |
| | `recent: the pseudo-provider id cannot collide with a catalog provider` |
| | `recent: an empty recent list says so, without blaming a provider` |
| **新增** | `provider menu: every row is a real provider, with no "all"/"recent" row` |
| | `filter: the chip still names "all providers" while nothing is filtered`（**§5.22 改写**为 `…while no model is selected`） |
| | `filter: the in-card "show all" exit from a narrowing still renders` |
| **改写**（保留意图、去掉 recent 那一半） | `identity: the persisted localStorage key does NOT follow the package name`——现在只断言 `prefs.ts` 的 `dsh-model-picker.provider.v1:` 前缀；原来那条还读 `recent.ts` 的 `dsh-model-picker.recent.v1`，文件删掉后 `read()` 会让**整个体检**抛错崩掉，不是变红 |

单元门同步：`test-params.mjs` 删掉构建入口里的 `recent.ts`、解构里的四个 recent 导出、以及
「"recently used" as a provider-menu option」整段（10 条断言）与它专用的 `catalog` / `route` /
`labelOf` / `idsOf` / `labelsOf` / `walk` / `bucketed` 辅助。**`prefs` 那一组一条不动**——
provider 范围记忆还在，`readProviderFilter` / `rememberProviderFilter` / `providerKeyOf` /
`retireLegacyProviderFilter` 照旧被驱动。

**改坏验证**（每条都实际打上并确认门变红，用**副本备份法**还原后全绿；改坏是否真的落到盘上，
先用 `git diff --numstat` 回读确认，再跑门——上一轮吃过亏：脚本的注入正则其实没匹配成功，
那个 "ok" 是**假阴性**，不是门的假通过）：

| 改坏 | 被谁拦住 |
|---|---|
| `providerOptions` 的 memo 里把 `{ id: null, label: t('provider.all'), … }` 那一行加回最前面 | `provider menu: every row is a real provider, with no "all"/"recent" row` |
| 在 `...state.failures.map(...)` **之后追加**一行 `{ id: 'recent', … }` | 同上（这条是分水岭：它干掉了「只钉 null id」的那一代门） |
| 隔一个空行再插入同一行 `{ id: null, … }`（历史上骗过第一代门的形态） | 同上 |
| 插入**非 null** 的手写行 `{ id: 'deepseek-official', … }` | 同上（钉 id 的写法在这里失效，钉"没有字面行"才管用） |
| 整个删掉 `...state.failures.map(...)` 这个 spread | 同上（`spreadRows.length === 2` 那一半：菜单会静默丢掉加载失败的 provider） |
| **把两个真 spread 的顺序对调** | 同上（`spreadRows` 的**顺序**断言：两个都是合法 spread，靠"数量"是看不出来的） |
| **`.concat([{ id: null, … }])` 夹带在 `orderedGroups` spread 后面** | 同上（第四代在这里漏过，第五代的按深度判定把它拦住） |
| 把 `orderedGroups` spread 抽成 `const fromCatalog = …` 再 `...fromCatalog`（行为等价的重构） | 同上（**已知会红，属于可接受的误报**：门断言的是"行由这两个 spread 产生"，抽变量后这条命题不再可静态验证；改动者会看到红灯并需要显式更新门） |
| chip 的 `null` 分支改成不再显示 `provider.all`（例如 `? ''`） | `filter: the chip still names "all providers" while no model is selected`（§5.22 改过名；改坏方式见 §5.22 的第二种） |
| 删掉 `.dmp-filter-hint` 里的「显示全部」按钮 | `filter: the in-card "show all" exit from a narrowing still renders` |

> 这些门守的都不是"代码长什么样"，而是**这次删除依赖的后果**：菜单里不会溜回非 provider 行、
> 被删的那一行留下的语义空洞有人填、以及失去唯一出口这件事不会悄悄发生。最后一条尤其值得留着——
> 「显示全部」是一个一行按钮，在它失去退路作用之前，删掉它看起来只是一次无害的简化。

**独立对抗验证**：由另一位队友用**独立写的一套改坏脚本**（先有改坏方式、再撞门，而非读门反推）
打了 8 种，全部变红，其中 `.concat` 夹带那条**在他的实测里原本是绿的**（exit 0 / all good，
盘上确有注入文本），换用按深度判定后转红——即"门自己出错"这件事是被**独立复现**的，不是自述。

**还原规程（血泪教训）**：改坏验证**不许**用 `git checkout -- <file>` 还原。本仓库的改动全部
未提交，`git checkout` 会把文件退回 HEAD，也就是**退回这次改动之前**——本次实施中就真的发生了：
`src/client/Picker.tsx` 被这样清成了改动前的版本（还带着对已删除 `recent.ts` 的 import），只能靠
重放 diff 重建。正确做法是改坏前 `Copy-Item` 备份、还原时 `Copy-Item` 覆盖，并用
`git diff --numstat -- <file>`（本例应恒为 `40  90`）自证还原干净。

**这条门自己也错了三代**（值得记下来，因为它说明了"门只能守住写下来时的判断"）：

| 代 | 写法 | 错在哪 |
|---|---|---|
| 一 | `!/^\s*\{ id: null,/`（无 `m`） | `^` 锚在切片开头，插到第二行的「全部」行**保持绿色**——门被改坏时不响，正是 §5.16 记过的那个失效模式 |
| 二 | 放宽成"切片里没有任何 `{ id: …` 字面行" | 同时匹配到两个合法 spread 的**对象体**（`{ id: group.id, … }`），于是**对着正确代码变红** |
| 三 | 用 `map(` 之后的间隙里"只有空白和括号"来排除 spread 体 | 漏算了箭头函数那一层（间隙是 `group => ({`），仍然误伤合法行 |
| 四 | depth-0 逗号切分 + `/^\.\.\.([\w.]+)\.map\(/` 认元素 | **只断言元素"以 spread 开头"**，于是 `.concat()` 能夹带行：`...orderedGroups.map(g => ({…})).concat([{ id: null, … }])` 是**一个** top-level 元素、开头完全匹配，夹带的「全部」行在**绿灯**下过关（对抗性探针实测 exit 0 / all good，且已回读确认注入文本真的在盘上） |

**第五代（现役）**：不再对文本做形态匹配，而是把 memo body 按 **depth-0 逗号**切成 top-level 元素，
断言"每个元素都是 `...x.map(...)`，且顺序恰为 `orderedGroups` → `state.failures`，且没有非 spread 元素"；
并且"是 spread"由 `spreadCallOf` **按括号深度**判定——`map(` 在 depth 0 处闭合后**只允许空白**，
所以 `.concat` / `.flat` / 任何链式调用都会让该元素失去 spread 身份，而非被贪婪正则吞进参数里。
它断言的是**真正的命题**（这张菜单的行就是这两个 spread），因此既骗不过嵌套，也不挑 id 长什么样，
更不会误伤合法代码。前几代的教训合起来是：**门要断言命题，不要断言代码的样子**；
第四代还补了一条：**"开头匹配"不是"整体匹配"**——用表单前缀认身份，等于给夹带留门。

判定"是不是一个纯 spread"这件事，正则做不到：`^\.\.\.(\w+)\.map\(([\s\S]*)\)\s*$` 当初就是这么写的，
但它的 `([\s\S]*)` 是贪婪的，会回溯到**最后一个** `)` 并把 `.concat([…])` 整个吞进参数组，
于是同一个漏洞换了个写法继续存在。**凡是"括号要配平"的判断，都不能交给正则**，只能自己走深度。

**切分器自身的边界**：字符串/模板字面量（`'},'`、`` `${x},${y}` ``、转义引号）里的逗号不参与切分；
注释不需要处理——`picker` 在切分**之前**已被 `stripComments` 洗过，`// a, b` 到这时已是空文本
（我一度在切分器里写了注释跳过逻辑，实测发现那是**不可达代码**，已删）。这些边界都用
13 组用例对**真实源码 + 洗注释后的真实管线**跑过：6 组"必须绿"（含嵌套泛型、尾随逗号）、
5 组"必须红"（含上述 `.concat` 夹带与顺序对调）。

### 5.22 第十一次反馈（2026-10-04）：chip 未收窄时也要说出 provider

> **已被取代**：本节的整套"chip 两态 + `provider.chipAria*` 文案 + `data-filtered` 墨色分级"在
> §5.25（chip 退化为只读事实）与 §5.26（该事实并入触发器标签、chip 删除）里先后下线。
> 仍然成立的是它回答的那个问题——**"这个会话在用哪个 provider"必须能在座位上读到**——只是答案现在
> 由触发器标签 `provider/model` 给出。

**反馈原文**：「模型提供商选择器中，已经移除了全部和最近使用，那么每个模型都能显示对应的模型提供商
选择器，而非全部。」

**两处模糊点用问答卡片问过用户**（原话是「我的指令有任何模棱两可的地方，请用 dsh 问答卡片向我提问」）：

| 问题 | 用户选定 |
|---|---|
| 未收窄时 chip 写什么？ | **写当前模型所属的 provider**（不是把菜单那一行勾上、也不是只留图标） |
| 点提供商菜单里一行是什么语义？ | **继续只收窄视图**（不写 Host、不切会话、不改 `/model`） |

**为什么 §5.17 的反对这次不成立。** §5.17 禁止 chip 读会话，理由是同一个控件说了两句互斥的话：菜单
勾着 `全部 ✓`，chip 却写 `commandcode`。§5.21 把 `全部` 那一行从菜单里**删掉**之后，单选组里没有任何
成员在说"全部"，chip 的说法不再与勾选状态冲突；而把 `全部` 留在 chip 上，它反而成了这个座位上**唯一
一句从不提 provider 的话**——旁边的触发器正显示一个明确住在某个 provider 里的模型。

**决策：一个 chip、两个状态、两个主语，且状态不需要读文字就能分。**

| 状态 | chip 写什么 | 墨色 | `data-filtered` | `aria-label` |
|---|---|---|---|---|
| 收窄生效 | 那个 provider（= 菜单里打勾的那一行） | `label-primary` | 置位 | `provider.chipAria` |
| 未收窄、已选模型 | **当前模型所属的 provider** | `label-secondary` | 不亮 | `provider.chipAriaModel`（写明"模型列表未筛选"） |
| 未收窄、还没选模型 | `provider.all`（「全部」） | `label-secondary` | 不亮 | `provider.chipAria` |

- **派生**：`filterProviderId = providerFilter`；`chipProviderId = filterProviderId ?? state.current?.provider ?? null`。
  卡内提示条用的 `filterLabel` **只**从 `filterProviderId` 来——它说的是"列表被窄化成了什么"，与 chip
  的主语不是同一件事，两者共用一个是以后最容易重新并成一句话的地方。
- **背书**：菜单里 `session: group.id === state.current?.provider` 那一行的「当前会话」标，与 chip 用的是
  同一个真值。所以 chip 的未收窄说法在它自己打开的菜单里有**一行可核对**——这正是 §5.17 缺的那一半。
- **代价（明说）**：未收窄时界面上不再有"列表不限 provider"这句话。它由模型卡里的各个 provider 分组头、
  以及收窄时那一行 `仅显示 {name}` 承担；chip 的 tooltip 与 aria 都补了"（列表未筛选）"，免得把
  provider 名读成收窄状态。
- **样式**：`.dmp-provider`（次级）与 `.dmp-provider[data-filtered]`（primary）的墨色分级原样复用，
  它现在的职责从"强调"变成"区分两个主语"，注释已按这个含义重写。

**机器门**（`scripts/selfcheck-static.mjs` 第 11 组）：

| 动作 | 门 |
|---|---|
| **改写**（旧命题的前提被 §5.21 删掉了） | `filter: the chip names the list scope, never the session` → **`filter: the unfiltered chip names the selected model's provider`**（断言 chip 的 id 确实是 `filterProviderId ?? state.current?.provider ?? null`，且卡内提示条只吃 `filterLabel`） |
| **改写**（同一个分支，守的状态换了名字） | `filter: the chip still names "all providers" while nothing is filtered` → **`…while no model is selected`** |
| **新增文案键** | `provider.chipAriaModel` / `provider.chipTipModel`（zh/en 同步；`copy` 门要求两个都被 `t()` 用到） |
| **不动** | `filter: only an explicit narrowing scopes the model list`、`filter: the session's provider is marked on its own menu row`、`provider menu: every row is a real provider…`、`filter: the in-card "show all" exit…` |

**改坏验证**（2026-10-04；`Copy-Item` 副本备份法还原，还原后用 `Get-FileHash` 自证与改坏前一致——
**不用 `git checkout`**，本仓库的改动仍未提交，那条命令会退回 HEAD 即退回本次改动之前）：

| 改坏 | 被谁拦住 |
|---|---|
| `chipProviderId` 退回 `filterProviderId ?? null`（chip 又不看模型了） | `filter: the unfiltered chip names the selected model's provider` |
| `chipLabel` 的 `null` 分支取反（`chipProviderId !== null ? t('provider.all') : …`） | `filter: the chip still names "all providers" while no model is selected` |
| 卡内提示条改成吃 `chipLabel` | `filter: the unfiltered chip names the selected model's provider`（第三条断言）。这条**行为等价**（提示条只在 `providerFilter !== null` 时渲染，那时两个 label 相等），属于**已知的可接受误报**：它守的是"两个主语别并成一个"这条结构命题，和 §5.21 记过的 `fromCatalog` 重构是同一种 |

三条都实测：注入后 `injected=True`、`exit=1`、恰好一条门变红；还原后全绿。真机验收见 §8.10。

### 5.23 品质打磨（2026-10-05）：动效与反馈层

**标准**：用户把品质标准定为 awwwards / webby / FWA 获奖级，要求自我检查、反复提升直到达标。
对这个座位（宿主内的产品组件，不是落地页）来说，那套标准落地为 Linear/Raycast 级的**反馈完备**：
每个交互都有可感的回应、每个状态都有形、所有动效共用一条声线且全部可关。

**决策：一条动效声线 + 只动 transform/背景色 + 全部受 `prefers-reduced-motion` 收口。**

| 件 | 决策 | 为什么 |
|---|---|---|
| 缓动 | `--dmp-ease: cubic-bezier(0.2, 0, 0, 1)`，定义在 `.dmp-root` 与 `.dmp-menu` 各一份 | 门控卡片是 body 下的兄弟（portal），不继承座位；两处声明让座位与三张卡共用同一条减速曲线 |
| 卡片入场 | `@keyframes dmp-card-in`：`scale(0.97) → none`，150ms；类 `dmp-menu-in` 只在 **position 测得之后** 加（`menuPos/position === null` 时缺席） | ① 宿主 `MenuSurface` 自己不动画（实测 CSS 无 keyframes），卡片瞬间出现；② **透明度淡入被本仓库的对比度门全局禁止**（selfcheck 2b：任何规则不得 `opacity/filter`，keyframes 也在扫描范围里）——而这个禁令是对的：淡入就是让文字在飞行中变不可读，入场没有理由豁免。scale-settle 在 150ms 上比 fade 更干净；③ 从测量前的 `visibility:hidden` 原点起放会把动画浪费在屏幕角落，挂在落位类上才从真实矩形生长 |
| 入场方向 | `dmp-from-top`（origin 100% 100%）/ `dmp-from-bottom`（origin 100% 0），按锚定侧挂 | 三张卡全部 `align:'end'`，水平 origin 恒为右缘；垂直方向跟 side 走，卡片从**开着它的那只控件**里长出来 |
| 悬停 | 行/chip/齿轮/effort 行/清除·重试·恢复按钮：`background-color/color 90ms var(--dmp-ease)` | 之前全部瞬时切换；90ms 是"立刻但不生硬"的量级。transition 写在**基础规则**而非 `:hover` 上——写反了 hover-out 会瞬跳 |
| 按压 | chip/触发器/齿轮 `:active { transform: scale(0.97) }` | 一格物理下沉；transform 不引起 reflow。行不加缩放（列表行缩放是噪音） |
| 选中勾 | `dmp-check-in`：`scale(0.5) → 60% 1.12 → 1`，180ms | 勾只在行变为选中时挂载，入场即选中事件本身；过冲一次是"确认"的手感 |
| 清除钮 | `dmp-clear-in` 动**独立 `scale` 属性**，120ms | 该钮靠 `transform: translateY(-50%)` 居中，动 transform 会把居中一起动画掉；独立属性与它叠加 |
| 键盘滚动 | `@media (prefers-reduced-motion: no-preference) { .dmp-groups { scroll-behavior: smooth } }` | `scrollIntoView({block:'nearest'})` 的 `behavior:'auto'` 跟随 CSS；Media 门让两种偏好不可能打架，JS 一行不用改 |
| 触发器 open 态 | `.dmp-trigger-open { background: … }` | §5.22 的一致性欠账：chip 与齿轮各有 open 底色，唯独触发器没有（chevron 会转、铬却冷着）。补齐后三件套契约完整 |
| Home/End | 模型卡：跳首/末行（搜索框聚焦时只移高亮，否则连焦点一起移）；provider 菜单：链首/链尾 | listbox 模式点名这两个键；20+ 行的目录里 End 是 20 次 ArrowDown |
| 空状态 | `dmp-empty` 组合化：20px 静音字形 + 一句话，居中、留白、居中排 | 裸文案读起来像渲染事故；成形的空态读起来像一个**被设计过的状态**。provider 菜单的空搜索从 `.dmp-status` 改用同一 `dmp-empty`，两张卡一个语言 |
| 加载行 | `role="status"` 文案前加宿主 `StateDot state="ongoing"` | 慢目录读作"在工作"而不是一行死字 |

**改坏面（自我检查过的）**：keyframes 名不带 `.`（selfcheck 死类扫描以 `\.dmp-` 取类名，`@keyframes dmp-card-in` 不会被当成未使用类）；keyframes 块会被对比度门的规则解析器切成伪规则（selector `from`/`to`），但它们不画 `color`，门的 unsized 扫描直接跳过；新规则没有一个画文字墨色，门 2b（不得淡化自己画的文字）对 keyframes 同样成立——**这套禁令与动效层的边界是同一句话：颜色不许动，几何随便动**。

**实测**（`verify` 会话，缓存禁用后 reload）：入场采样 `matrix(0.977) → 0.993 → 0.998 → none`（150ms 减速落地）；触发器 open 态 `rgba(255,255,255,0.08)`；行过渡 `0.09s`；`scroll-behavior: smooth` 生效；End → 末行（GPT-6 Luna）、Home → 首行且焦点留在搜索框；空态截图 `shots/audit-empty-dark.png`。

### 5.24 整体 UI 迭代（2026-10-15）：把事实徽章条做成一张有表头的表

**标准**：用户要求"迭代整体UI设计"。这个座位不是落地页，是宿主内的产品组件，所以迭代的判据是
**产品级**：每一处信息是否可读、可扫、可解释，层级是否由字号与空间而不是由线条给出。
方向不引外部风格：全部沿用宿主令牌与 `MenuSurface` 材质（§5.6），改的是**这四件事的事实**
在卡上如何被陈述。

**这次迭代的核心命题**：一行右侧的四个事实，是**每行不同**的一组值——那就该按**表**来排，
而不是按"右对齐一撮徽章"来排。四列固定、列名说一次、缺的事实留空位。

| 件 | 决策 | 为什么 |
|---|---|---|
| 事实网格 | `.dmp-badges` 由 flex 改 **grid**：`--dmp-col-icon` ×3 + `--dmp-col-window`，间隔 `--dmp-col-gap`；每行按 `BADGE_FACTS` 顺序**恒定渲染四条轨道** | 改造前徽章右挤：三枚徽章的行与四枚徽章的行把同一个事实画在**不同的 x** 上，"哪一列是什么"逐行变化，眼睛无法上下比较。固定轨道后四列逐行对齐，而且**模型名那一列的宽度逐行相同**（实测 10 行全是 160px、`nameRight` 全是 888）——省略号落点也统一了 |
| 缺失的事实 | 该模型没有的事实在**它自己的轨道里留空**（`dmp-badge-slot`），不画图标、不把邻居左移 | 位置本身就是陈述："这一列是空的"= 这个模型不声明这个事实；行内 `title` 与 `aria-label` 仍把整句（含"不支持图片输入"）说出来。斜线图标（斜杠 + quiet）是当时能想到的最弱标记，固定列把这件事讲得更干净——**它随后就被从代码里删掉了**，因为改完固定轨道后已经没有渲染点 |
| 宽度预算 | 轨道 = 14 + 8 + 14 + 8 + 14 + 8 + 47 = **113px**（window 轨道 = 14 图标 + 3 间距 + 30 值） | 改造前常见三事实行约 107px、四事实行约 129px：**最坏情况反而变窄**，四事实行的名字多出 16px，三事实行基本不变；名字列从此是一个定值 |
| 列名（表头） | 搜索框下加一行 `.dmp-legend`：四枚同样的字形 + 各自一个词（文字/图片/推理/窗口），11px 次级墨色，**不滚动** | 四个 14px 字形是这席位的全部发明，而改造前它们的含义只存在于行的 `title` 里——不悬停就无从知道。表头说一次即可；它是**真文案**（不是 `aria-hidden` 装饰），所以 a11y 门"不许藏自己的文案"对它成立 |
| 值列 | 值仍**贴着自己的字形**（3px 间距），不设 `text-align: right` | 试过右对齐 47px 值列：`262K` 贴住图标而 `1M` 被甩开 16px，"一个事实 = 一枚徽章"的读法散掉。图标才是列的对齐基准，值跟着图标走（实测每行值左缘都是 976） |
| 分组头 | 12px/500，**`label-secondary`**（宿主原样式是 11px `label-tertiary`），保留 §5.8 的常驻底色带；组间距 8px | 分组头是这张卡**唯一的路标**，却是卡上最难读的一行：`label-tertiary` 在本仓对比度门里就有结论（浅色 2.08:1，正是其它说明文字全部改用 secondary 的原因）。改后实测 dark 头墨/带底 **8.66:1**。底色带**不换成不透明**是有意的：卡片材质实测 `backdrop-filter: blur(40px) saturate(1.5)`（宿主给的玻璃），行从带下穿过时 6% 影影绰绰，比一条与身后内容不同步的实心条纹更轻 |
| 行不被压住 | `.dmp-groups { scroll-padding-top: 26px }` | 搜索框里打字会把高亮行 `scrollIntoView({block:'nearest'})`，而浏览器不知道粘性头占 26px：实测改造前第一条命中**正好停在分组头底下**。scroll-padding 把滚动视口内缩，实测首行 `rowTop = headingBottom = 103` |
| 搜索框 | 用回宿主 `Input` 自己的材质（`bg-layer-1` + 0.5px `border-l4`），输入文字 13px（与行名同级） | 改造前它是一片透明底 + 12px 占位文字，读起来像标签不像输入框；而卡上第一条内容恰恰是"要打字的地方"。13px 是因为 12px 让第一个控件比它筛的行还小 |
| 参数面板 | 五处 `border-top: 1px` 全部删掉，改由 **12px 间距** 分节；节标签 11px→**12px**；写入位置 10px→**11px**；容量输入框改用宿主 Input 材质 | 五条细线是小面板里最多余的装饰（"no thin rules"），分组交给空间与字号；10px 那一行是全席位最小的字，偏偏是复核者唯一要读的路径 |
| 触发器层级 | 等级 `11px` + `tabular-nums`（名字仍 13px） | 改造前名字与等级同号同墨，"DeepSeek V4.1 Flash · Max"读成一整条标签 |

**没有做的**（想过、否掉）：给缺席的轨道画一个极淡的点（位置已经说了这件事，再画就是装饰）；
把分组头底色换成不透明（见上，卡片是玻璃）；把列名字直接换成行内文字（4 个 CJK 词比 4 枚 14px
字形宽一倍，320px 卡里会把名字挤没）。

**门**：`npm test` 五道门全绿，其中两条随本次改动新增/扩展——
selfcheck §10b 断言"四条轨道由一条规则给出、每行都渲染 `BADGE_FACTS`、保留轨道后总宽 ≤120px、
表头存在于样式与渲染两侧"；`check-contrast.mjs` 的 STYLES 增加 `.dmp-legend`、`.dmp-legend-word`、
搜索框 placeholder、以及 `[data-menu-group-heading]`（宿主画的元素，本仓从未量过它）。

**实测（真实 GUI，`127.0.0.1:3080`，两个主题）**：卡片 320×420，搜索框 312×32，表头 312×24，
滚动视口 312×351；四轨逐行 `893,915,937,959`（10 行全同）；头 `12px/18px 500` 墨
`rgb(207,211,214)`，带底合成 `rgb(48,49,54)`，头墨/带底 **8.66:1**；键盘链 `chip → 搜索框 → 行`
（Enter 开卡后焦点在搜索框，Tab 两次落在两行）；主题浅色由脚本剥掉 `data-ds-dark-theme` 后拍摄
（profile 把 `ui-theme.preference` 钉成 dark，走界面切换在无头会话里不成立）。
截图：`.taste-skill/shots/`（迭代前后），`shots/` 里 README 用的六张已按新样式重拍。

### 5.25 第十二次反馈（2026-10-15）：提供商与模型合成一张卡的两栏

**需求原文**：「把选择模型提供商和模型选择器合成一个整体页面，页面的左侧是模型提供商右侧是其对应模型」，
并先要一句评估。

**评估（先答，再动手）**：方向对，但"左右两栏"和本仓自己量出来的宽度预算正面冲突，而且**不是口味问题**：

1. **方向对的证据是代码本身**：provider 选择的交互早就是"主从两步"——在旧 popover 里选中一个 provider
   之后，`onPick` 立刻关掉它并 `show()` 打开模型卡（§5.21 时代的 `Picker.tsx`）。也就是说用户要的
   "先 provider 再模型"这条流程**已经存在**，只是被拆成两个弹窗、还要按顺序接力。
2. **旧 chip 是一个隐藏模式**：退出收窄的唯一出口是模型卡里那条提示 +「显示全部」（§5.21 的
   `dmp-filter-hint`，代码注释写着 "the ONLY way back out"）。用户必须先意识到"我在收窄态"才能退出——
   典型的 mode error，与好不好看无关。
3. **provider 这件事被画了三遍**：座位 chip、popover 里的单选组、模型卡里的提示条；chip 还背着
   §5.22 承认过的"两种状态两个主语"（README 当时写"不必去猜这个 provider 名是哪个意思"）。
4. **冲突在数字上**：模型列不能窄于 320px（一行要装 name + 113px 四轨 + 选中勾，§5.24）；旧 popover 宽
   241px 才放得下一行 `label + 计数 + 勾`；两栏因此要 ~500px 宽，而旧卡是 `min(320px, 100vw-32px)`、
   项目自己的窄屏验收跑到 560px。所以**必须同时改宽度预算、并写窄屏折叠**，否则会丢掉 §5.24 刚建立的
   四轨表。

**用户当轮定下的三件事**（问过才动手）：形状选 A（弹出卡片两栏、放宽到 ~480–520px、窄屏折叠回单栏）；
chip 退化成**只陈述"当前模型所属 provider"的事实**；参数面板**不并入**本次。

| 件 | 决策 | 为什么 |
|---|---|---|
| 卡片宽度 | `min(520px, 100vw - 32px)`，且只挂在**模型卡**的新类 `.dmp-card` 上 | 520 = 181（提供商栏盒子）+ 8（卡片内边距）+ 331（实测模型列），模型列因此 ≥320 且名字列从 ~160px 涨到**实测 175px**。**不能写在 `.dmp-menu` 上**：那是三个卡片共用的材质类，参数面板同时带 `.dmp-menu` + `.dmp-settings`，写在它上面会把面板的头部与正文并排（见下"踩到的坑"） |
| 提供商栏 | `role="listbox"`，`全部` + 各 provider（带计数）+ 加载失败行（disabled、排最后），`flex: 0 0 176px`、独立滚动、右侧 1px `border-l1` 分隔 | 176 是实测下限：最长真实 provider 名在 13px 下要 ~132px，加计数与选中勾后不能省略号——**说出 provider 名是这一栏唯一的活**。13 行实测不滚动（412px 高），15 个以上才滚 |
| 「全部」行 | **加回来**，作为提供商栏第一行（`id: null`，计数 = 全目录） | §5.21 把「全部」从 popover 里删掉，理由是"那一行看起来像 provider 却不是"——在 popover 里成立，在**范围列表**里不成立：列表成员本来就是范围。它同时就是收窄的出口，替掉了卡内那条 `dmp-filter-hint` 提示条 |
| 选中语义 | `aria-selected` + 复用行侧那个 `.dmp-check` 勾；**不换墨色、不加边框** | 两个窗格用同一个"选中"记号，读法一致；`dmp-check` 是图标，不欠对比度 |
| 「当前会话」 | **不写字**，改为 `aria-current="true"` + 名字 `font-weight: 500` | 一行里再塞 5 个 CJK 字（~55px）会把 provider 名挤成省略号，而这正是不能失败的那件事；这条事实由**卡外的 chip** 用字说出来（卡片打开时它就在屏幕上） |
| chip | 变成 `span`：无 hover/按下/焦点环、无 `aria-haspopup`/`aria-expanded`、无 `data-filtered`；只读 `state.current.provider`；**未选中模型时不渲染** | 它只剩一个主语，§5.22 的两态歧义随问题一起消失。`全部` 现在是**范围**、归提供商栏；没有模型时没有 provider 可陈述，此时不画比画「全部」更真。**（2026-10-15 当日晚些的 §5.26 把这一格删掉了**：同一个事实由触发器自己说） |
| 搜索越界 | 收窄时若查询在**别的 provider** 里有命中，卡里写「其他提供商还有 N 个匹配」+「显示全部」 | 范围只约束**列表**、不约束**搜索**：不然在收窄状态下打模型名会读成"没这个模型"，而出口在另一栏、用户没理由去看。`elsewhereCount = rankByName(全目录).length - rows.length` |
| 键盘 | 列表：`←`（搜索框为空时 / 焦点在行上）进提供商栏；提供商栏：`↑↓`/`Home`/`End` 移焦点、`Enter`/空格采纳并回搜索框、`→` 回搜索框、`Esc` 关卡片；`Tab` 链 = 提供商栏的**单一 tab stop** → 搜索 → 各行（DOM 顺序） | 提供商栏是 listbox：roving tabindex 让它只占一个 Tab 站，否则 12 个 provider 就是 12 次 Tab。`←` 在搜索框里带文字时**必须是光标键**，所以只在空查询时接管 |
| 窄屏 | `@media (max-width: 536px)`：`.dmp-card` 变列、提供商栏变**横向条**（`overflow-x: auto`）、名字 `max-width: 132px` | 536 是算出来的：两栏要 505px 卡片宽，而卡片在视口 <552px 时等于 `100vw-32px` → 视口 537px 是临界。**同一份 DOM、同一套 role、同一套键**，只有 flex 方向变，所以不需要两套测试 |
| 空状态 | 收窄 + 有查询时空态改用 `empty.providerSearch`（这个提供商里没有匹配的模型） | 旧文案 `empty.provider`（该提供商没有可用模型）在这个状态下是**假话**：它有模型，只是不匹配。两栏让这个状态更容易到达（点一行 + 打字两下） |
| 删除 | `ProviderMenu.tsx`；`data-filtered`；`provider.chipAria/chipAriaModel/chipTipModel/sessionHere/filtered/menuAria/search/searchEmpty` 九个键；`providerAt`/`providerSide`/`providerMenuRef`/`toggleProviderMenu`/`closeProviderMenu` | 三弹窗变两弹窗：外面点击、座位消失、`onBlur` 三处互斥判定同时少一条边 |

**没有做的**（想过、否掉）：把参数面板并进模型列表第三层（一次任务里同时出现导航/选择/编辑三种事，
测试面积翻倍，用户已明确本轮不做）；提供商栏加自己的搜索框（12 行不需要，而且卡里已经有一个搜索框，
两个搜索框正是旧设计要删的东西）；按 provider 分组头在收窄时隐藏（留着头更省逻辑，且"全部"时它仍是路标）；
给「当前会话」画一个点（点也得有解释，而名字重一档不需要）。

**踩到的坑（两道门因此新增）**：

1. **`.dmp-menu` 是共用材质类**：把 `flex-direction: row` 写在它上面，参数面板（`.dmp-menu .dmp-settings`）
   的头部与正文立刻并排——selfcheck 与截图都看不出来，因为静态门只读源码、截图只拍模型卡。
   修法是把两栏搬到 `.dmp-card`；并新增 `scripts/_verify-settings-layout.cjs` 这道浏览器守卫
   （实测面板 280×324，`body.top ≥ head.bottom`）。
2. **样式表是模板字面量**：在 CSS 注释里用反引号引用类名会**提前结束字面量**，后面的 CSS 被当 JS 解析，
   构建报 `card is not defined`——一个看起来像组件 bug 的 ReferenceError。selfcheck 新增 §2a：
   "CSS 模板内不得出现自己的反引号"。

**门**：`npm test` 五道门全绿，其中 selfcheck §11 被**重写**（不是删掉）：
`e`（chip 只读 `state.current.provider`、且不再有 `data-filtered`）、`e2`（会话 provider 标在自己那一行，
由 `aria-current` + 一条字重规则承载，且 `provider.sessionHere` 键必须已经不在）、
`g`（提供商栏行 = **字面量「全部」+ 目录 spread + 失败 spread**，恰好三个顶层元素，用深度 0 逗号切分逐个判）、
`h`（没有模型时 chip **不渲染**）、`h2`（出口是提供商栏第一行）、`h3`（越界命中被计数 + 「显示全部」真的调 `pickProvider(null)`）、
`h4`（选择只走 `pickProvider` 一条路：写范围 + 焦点交回搜索框，且 `closeProviderMenu`/`providerAt` 不得回潮）。
§14 从"三个弹窗一起关"改成两个。`check-contrast.mjs` 的 STYLES 把 `.dmp-provider[data-filtered]` 换成
`.dmp-provider` 并新增 `.dmp-rail-name`，CONTAINERS 补上提供商栏四级祖先链（否则它的规则会被扫描静默跳过）。
`_accept-provider-menu.cjs` 删除，代之以 `_accept-provider-rail.cjs`（26 条断言）。**`test-params.mjs`
一行未改**：本次没碰任何纯逻辑（寻址 / 徽章推导 / 文案决策），范围本来就是组件内的视图状态。

**实测（真实 GUI 1440×900，`rev=3484a7e55cdb`）**：卡片 520×420；提供商栏 181×412、行高 30、13 行且不滚动；
模型列 331、模型名列**每行 175**、徽章条 113（与 §5.24 的预算逐位相符）；chip `SPAN`、
`title=当前模型所在提供商：opencode-go`、无 `data-filtered`；点 `DeepSeek 账号`（2 个模型）后
模型行数 2、该行 `aria-selected`、卡片仍开、`activeElement` 是搜索框、chip 文本不变；
点「全部」回到 64 行；`←` 落到 `全部`、`↓` 到 `DeepSeek 账号`、`→` 回搜索框；
查询 `dots` 在 `DeepSeek 账号` 范围内 0 命中 → 条带「其他提供商还有 2 个匹配 / 显示全部」→
点它回到「全部」且 2 行。窄屏 500×820：卡片 468 宽、提供商栏 460×35 在列表**上方**、模型列 460。
截图 `shots/accept-rail-wide.png`、`accept-rail-scoped.png`、`accept-rail-narrow.png`、
`accept-rail-search-elsewhere.png`、`accept-settings-column.png`；README 用的
`row-badges-*` / `provider-*` / `rail-stacked-*` / `composer-with-gear.png` 已重拍。

### 5.26 第十三次反馈（2026-10-15 当日）：提供商名并进触发器，范围不再记忆

**需求原文**：「把模型提供商名字并入模型触发器中，展示为"模型提供商/模型名·思考强度"；模型提供商列表
选中项不再持久化保存，每次点击打开面板，都是显示当前会话使用的模型提供商和对应模型列表。」

两件事，各自都推翻上一版的一条决定：把 §5.25 那个只读 chip 并进触发器（座位行少一个元素），
以及把 §5.13 建立的"范围是记住的偏好"整个拿掉。

| 件 | 决策 | 为什么 |
|---|---|---|
| 触发器标签 | 一个字符串 `provider/model`（渲染为 `opencode-go/DeepSeek V4.1 Flash`），**不是两个 span** | 它是模型的身份，不是两个并列事实；合成一个标签让 §5.1 的宽度契约原样生效（整段跟着 composer 的 `--dsh-composer-model-text-display` 折叠、尾部省略号），也不必再决定"名字和提供商谁先让位"。提供商是**前缀**，所以被截断时仍然说得出是哪个 provider |
| 等级分段 | 仍是独立的 `.dmp-trigger-effort`（`·` 由 CSS `::before` 画） | 它是参数、不是身份：一行徽章陈述它、齿轮面板改它，触发器只顺带说出当前值。§5.1 的"名字弹性、等级固定一词"分工不变 |
| chip | **整个删除**：`.dmp-provider` / `.dmp-provider-label` / `.dmp-provider-icon` 三条规则、`provider.chipTip` 文案键、那段 JSX | 触发器已经把同一件事说得更全（连模型名一起）。两个元素说同一个 provider 是重复，而且 chip 占的 ~94px 正是模型名最缺的宽度 |
| 无模型时 | 标签退回 `trigger.fallback` / `trigger.loading`，**没有前缀** | 没有模型就没有 provider 可陈述；`全部` 是**范围**，只属于提供商栏 |
| 参数面板的 `aria` | 仍只说模型名（`settings.openAria`） | provider 不是模型参数，那一句的主语是"这个模型的参数" |
| 触发器 `aria-label` | `选择模型，当前 {provider}/{model}[，推理等级 {effort}]` | 屏幕阅读器拿到的两段身份与可见标签一致（`/` 也照读，这正是屏幕上写的东西） |
| 范围默认值 | 打开时 `setProviderFilter(currentProviderId)`（无模型则 `null` = `全部`） | "每次点击打开面板，都是显示当前会话使用的模型提供商" 就是这一行。顺带一个好处：`activeIndex` 的兜底是 `currentVisibleIndex`，于是**高亮直接落在当前模型上**，而不再是从 `全部` 列表的第一行开始 |
| 范围生命周期 | 只活在这一次打开；会话边界（`scopeSession !== sessionId`）重置为**新会话的** provider | 座位不随会话重挂载，跨会话残留的范围会指向一个跟当前对话无关的 provider |
| 持久化 | **全删**：`prefs.ts`（读/写/按会话键/旧键清理）删除，`pickerFilter` 不再读写 `localStorage` | 记住的范围与触发器说的身份**几乎必然在某次会话恢复后不一致**（范围是上次的，身份是这次的），而两者在屏幕上只差一栏；"每次打开重新回答"比"记住但要解释为什么不同"更便宜 |
| 旧数据 | 新增 `retiredScope.ts`：前缀 `dsh-model-picker.provider.` 的**一次性全扫**，在**插件激活**时执行 | 删掉读它的代码不会删掉键。前缀保留**改名前的拼写**（它描述的正是旧包名写下的数据），并同时覆盖两种历史形状（按会话的 `…v1:<id>` 与更早的单键 `…v1`）。放在激活而不是座位挂载：这是数据迁移、幂等、与对话无关，从不开卡的会话也不该留着死键 |
| 提供商栏 `全部` | **保留** | §5.26 之后"全部"不再是新开的默认值，它变成唯一的横向浏览入口（以及越界搜索的落点），更该留着 |
| 文案 | `provider.chipTip` 删除；`trigger.aria` / `trigger.ariaEffort` 的占位符从 `{model}` 改成 `{provider}/{model}` | 占位符的名字要说清它填的是什么；两处等级键同时改，zh/en 键集不变 |

**没有做的**（想过、否掉）：把 provider 做成会先于模型名省略的独立 span（需要 `flex-shrink` 权重，
而"整段是一个身份"本来就不需要谁先让位）；给 `全部` 行加一个"上次"标记（范围不再有历史）；
把旧键的清理塞进 `Picker` 的挂载（数据迁移不该跟着座位走）；在触发器里用 `·` 分隔 provider 与模型
（`·` 已经是等级分隔符，两个 `·` 会让"哪一段是身份"读不出来）。

**门**：`npm test` 五道门全绿。selfcheck §11 再次改写（不是删除）：
`c`（不再读写存储 + 打开时取会话 provider）、`c2`（会话边界重置，新增）、
`d`（旧记录一次性全扫、前缀保持旧拼写、挂在 `ctx.effect` 上而不是座位里）、
`e`（标签就是 `provider/model`，且无 provider 时不加前缀）、
`h`（座位行**没有** chip：类名与文案键都不得回潮）、
`e2`/`f`/`g`/`h2`–`h5` 的文字随新语义更新（提供商栏结构、出口、越界计数、`pickProvider` 单一写路径、
Tab 跳过 disabled 全部保留）。§15 的 identity 门从"持久化键不跟包名"改成"**被清理的键前缀**不跟包名"。
`check-contrast.mjs` 删除 `.dmp-provider` 条目（chip 没了），并把几处举例用的死类名换成仍在的类。
`test-params.mjs` 的 prefs 单元套件删除，换成 `retiredScope` 套件（两种历史形状都被清掉、
只清本插件前缀、邻键与无关键不动、一次遍历清空 8 个键、无 store / 被拒 store 都不抛）。
`_accept-provider-rail.cjs` 从 26 条扩到 **37 条**：新增触发器身份与无障碍名、chip 缺席、
**首次打开落在会话 provider**、**重开（选过别的 provider 之后、以及选过 `全部` 之后）都回到会话 provider**、
`localStorage` 里没有任何范围键。

**实测（真实 GUI，`rev=6b4bfe386156`）**：触发器 `opencode-go/DeepSeek V4.1 Flash` + 等级 `Default`；
`aria-label = 选择模型，当前 opencode-go/DeepSeek V4.1 Flash，推理等级 Default`；
首次打开提供商栏选中 `opencode-go`（`aria-current` 同一行）、模型列表 6 个模型（= 该行计数，全目录 64）；
点 `DeepSeek 账号` → 2 行、卡片不关、焦点在搜索框、触发器不变；关闭再打开 → 回到 `opencode-go`（6 行）；
点 `全部` → 64 行且该行选中；再关闭再打开 → 仍是 `opencode-go`（6 行）；
`Object.keys(localStorage).filter(k => k.startsWith('dsh-model-picker.provider'))` 前后都是 `[]`。
座位行宽度 324 → 311（chip 消失后 composer 的固有宽度变化），截图 `shots/composer-with-gear.png`。

### 5.27 架构健壮性迭代（2026-10-16）：三处"还没准备好"被当成了答案

**动因**：不来自新的界面反馈，而是对"哪些状态被当成答案消费掉"做一次体检。§5.20 修过一次
这个类别的缺陷（询问被永久消耗），但修的是**同一个 read 的失败分支**；这次把同一把尺子
量到另外三处，量出三个仍然存在的洞——它们的共同形状是：**"还没准备好"被读成了"答复是空的"
（或"这个部署没有"）**，而 Remote 命名空间由各自的所有者在激活时 `$mount`，所以"还没准备好"
是常态而不是异常。

| 洞 | 原来的行为 | 为什么是缺陷 | 现在 |
|---|---|---|---|
| A. racing reader 只在**成功路径**被重跑 | `read()` 的 catch 分支 `return` 得早，`requeue` 的重跑挂在成功分支尾部。reader 在"读在途"时登记，而那次读**失败**时，`requeue` 里的 provider 永远没人清 | ① 事实永远不来：`addSource` 承诺"挂载顺序无关"，而这一支正好让挂载顺序决定答案（未挂载的 LLM 面 / 传输失败正是它要吸收的那个竞态）；② `requeue` 里的陈旧条目还在，下一次 `ensure` 会把它当成"还在排队"，于是**对同一个已答复的 provider 再读一次**，破坏 §5.19 立下的"每 provider 每页一次"预算 | `try/catch` 之后**统一 settle**：`models` 挂在 `null` 上区分"答复了"与"没答复"，`catch` 只记录 `unanswered` 不返回；`requeueRacingReader()` 在两条路上都跑，并在重跑前同时清掉 `asked` / `unanswered`（否则 `ensure` 会以为自己问过了） |
| B. 适配器自有目录的"没挂载"被当成"什么都没发布" | `readCatalog` 在 `remote.<ns>` 不存在时 `return []`。而 store 把 `[]` 当**答案**：一次定终身 | 适配器的 Remote 是异步挂载的。开卡时它还没挂上 → 那**唯一一次**询问被消费 → 整页都没有该 provider 的事实徽章。这与 README、§5.19 和 store 自己的文档许诺的"吸收竞态"直接矛盾 | 未挂载时 **throw**（`the <ns> remote is not mounted`）：与 `fetch()` 里 LLM 面缺席同一形状，store 会把它释放给下次打开重试。适配器真正没安装也走这一支，代价是每次打开多一次属性查找——比"永久失去事实"便宜得多 |
| C. 设置面在**激活时抓一次**，之后永久是那一份 | `settingsFaceOf(scope)` 返回 `{ settings, llm }` **值**，`new ParamsStore(...)` 在 `ctx.inject` 回调里构造一次 | 同一个异步挂载事实（§2.2 最后一行**明写**"只能按需 `ctx.get`，不能激活时抓一次"）。命名空间在插件激活时还没挂上 → 抓到的 `null` 被当成"这个部署没有设置服务"，面板整页只读、每次写入回 `settings are unavailable`。**这是把一次竞态的结果说成了关于部署的事实**——面板文案 `settings.unavailable` 正是这么写的。而 `CapabilityStore` 从一开始就用取值函数躲开了同一个坑，只有 ParamsStore 漏了 | `settingsFaceOf` 改为**返回取值函数**；`ParamsStore` 的构造参数改成 `() => RemoteFace \| null`，两处读点（`read()` / `write()`）**每次调用**。真正不挂设置服务的部署仍然正确报 `unavailable`（负例已被单测钉住） |

**顺带的架构改动**：`readCatalog` 与 `ADAPTER_CATALOGS` 从 `index.ts` 抽到
`src/client/adapterCatalog.ts`。理由是这门里**有唯一一处机器可判定的决策**（"没挂载"长什么样），
留在座位注册旁边就只能靠读源码来断言；独立成模块后 `test-params.mjs` 能把它 bundle 起来、
拿一个假 client context 驱动它。`index.ts` 只剩 `registerAdapterCatalogs(ctx, capabilities)`
这个接线动作。

**没做的**（想过、否掉）：把 `readCatalog` 的"没装适配器"与"还在挂载"分开（需要 store 提供
一个"永久不重试"的答复通道，为一个探测不到的差别加一条接口不划算——重试只是属性查找）；
给 `CapabilityStore` 加"每 provider 只重试 N 次"的退避（同一个 provider 的事实缺席是良性的，
加计数的状态比它防的问题更复杂）；把 `requeue` 换成 `Map<provider, Set<source>>` 做精确重跑
（现在的粒度是 provider，重跑一次多读一次已经答复的 source，代价是一次缓存过的读）。

**边界（实测，不是推断）**：把重跑挪到两条 settle 路径之后，唯一值得警惕的是"循环"。
对一个**永远抛错**的 reader 实测：每次 `ensure` 恰好读一次（登记时一次、下次打开一次），
状态停在 `ready` 而不是卡在 `loading`，没有任何风暴。另一个方向也钉住了：
reader 落地事实后连开 10 次模型卡，读数仍是 **1**（"已答复的 provider 不再读"这条预算没有因为
重跑而失守）；同一 provider 三个座位同时 `ensure`，读数仍是 1（合并请求照旧）。

**门**：`npm test` 五道门全绿。

- `test-params.mjs` 新增 **16 条**：3 条钉 A（racing reader 在**失败**的 settle 后仍被重跑、
  它的事实落地、且**不留下**陈旧询问导致二次读——最后这条正是"重跑只挂成功路径"会同时
  踩中的第二半）；8 条钉 B（未挂载必须 throw、挂载后给出模型、挂载但为空是答案、
  适配器自己的拒绝是答案、有面但无 `read()` 仍算未挂载、路由表指向 `dsh-opencode-go`，
  以及端到端两条：挂载前的首次询问什么都不陈述、下一次打开的询问把事实落地）；
  5 条钉 C（未挂载时读成 `unavailable` 而非 error、挂上后 `refresh()` 恢复 `ready`、
  读到的命名空间就是新挂上的那个、通过这个迟到面写入成功、以及负例：**真的**不挂的部署
  仍报 `unavailable`）。
- `selfcheck-static.mjs` 新增 **6 条**：§7b 四条（catch 分支不得早 `return`、重跑必须是
  try/catch **之后**的单一 settle 且全文只有一处调用、未挂载必须 throw、reader 必须经由
  `registerAdapterCatalogs` 接线而不是内联回 `index.ts`）；§7 两条（`settingsFaceOf`
  必须返回闭包而不是面本身、`ParamsStore` 必须存取值函数且两处读点都调用它、全文不得有
  不调用的 `this.face`）。
- **变异测试**（三条都实测过）：把重跑改回成功路径尾部 → selfcheck 2 条 FAIL、`test-params`
  同时炸出 5 条（含 `addSource` 的两条既有断言）；把未挂载改回 `return []` → 新增的 3 条
  adapter-catalog 断言 FAIL；把 `settingsFaceOf` 改回抓取值 → 新增的 resolver 断言 FAIL。
  三次变异后源文件都按 hash 校验还原。

**没有回归的**：§5.20 的既有契约全部原样成立（`asked` 的释放、目录读失败不缓存成空答案、
适配器拒绝仍然一次定终身）；`lib/` 已重建，`test:fresh` 通过，git 安装拿到的是同一份。

### 5.28 优化（2026-10-16）：一次"什么都没变"的 publish 不该叫醒任何人

**动因**：上一节的体检是"哪些状态被当成了答案"；这一节是性能向的同一把尺子——
**哪些通知其实什么都没说**。两个 store 都用"建一个新快照对象 + 逐个叫醒订阅者"来发布，
而 `useSyncExternalStore` 判定重渲染的依据是 `Object.is`（上次读到的快照 vs 现在读到的）。
store 自己建对象，所以**引用比较永远不可能相等**：每一次 publish 都必然换掉身份 → 必然重渲染。
配上一个真实的目录（8 provider / 64 模型）实测，代价是这样：

| 场景 | 修复前 | 修复后 |
|---|---|---|
| 打开模型卡（`ensure` 全部 provider） | **16 次叫醒 / 8 次真有内容变化** —— 一半是空转 | **8 / 8**，空转 0 |
| 什么都没变时的 `getSnapshot()` | —— | 身份稳定（React 可跳过渲染） |
| 参数面板：已 settled 后再开 3 次（每次 `refresh()`） | **6 次叫醒 / 只有 1 次内容变化** | **0 次叫醒**（identity 不变） |

**改法**：新增 `src/client/snapshotEq.ts`（`sameSnapshot`，结构化相等），两个 store 的
`publish` 在换快照**之前**先比内容，相同就直接返回、连快照对象都不换。
store 比不了引用，只能比内容——这正是这个小模块存在的全部理由。

**同时删掉一个只写不读的字段**：`CapabilitySnapshot.status`（`'idle' | 'loading' | 'ready'`）。
把 `src/` 全文按"读 `.status`"扫过一遍：**没有任何消费方**（面板/行内读的都是
`DirectoryStore` 自己的 `status`，那是目录加载态，与本 store 无关）。也就是说这个字段唯一的作用
就是让快照"和上一份长得不一样"——它自己制造了上面那一半空转。删除后 `read()` 从**两次** publish
变成**一次**，且那一次若"适配器什么都没公布"也不会换身份。

**边界（实测）**：guard 不能把**真的**变化吞掉，这一点单独钉了断言——外部在「设置 → 模型」页
改了声明后 `refresh()` 必须照样发布（因为 revision/value 变了）；`ParamsStore` 那个真的会移动的
`status`（`idle/loading/ready/unavailable/error`）也仍然照发，因为那确实是订阅者看得见的变化。
`sameSnapshot` 的语义边界由单测逐条钉死：数组**顺序**算变化（provider 顺序就是提供商栏顺序）、
键**集合**增减算变化、键**顺序**不算（没有消费方读它）、`undefined → 值` 算变化
（`contextWindow`/`maxTokens`/`error` 都是可选字段，真的有"有/无"两态）、函数按引用比。

**门**：`npm test` 五道门全绿。

- `test-params.mjs` 新增 **26 条**：18 条 `sameSnapshot` 语义（基本类型、`NaN`、
  `undefined` vs `null`、重建但相等的 record / 嵌套数组、数组顺序与长度、键集合增减、
  键顺序不算、可选字段的有↔无、空 record、函数按引用、数组 vs record）；8 条行为
  （capability：什么都没变的 read 不叫醒订阅者、身份稳定、落地事实时**恰好**发布一次；
  params：不变的 refresh 不叫醒、身份稳定、**确实重读了 Host**（describe 调用数为证）、
  外部改动会发布、发布后身份确实换了）。
- `selfcheck-static.mjs` 新增 **4 条**：两个 store 都必须有内容 guard、`sameSnapshot` 必须
  是真的结构化比较（不是引用比较）、capability 快照不得再有只写字段、而卡片真正渲染的
  `DirectoryStatus` 必须保留。
- **变异测试**：把两个 store 的 guard 各删一行 → 新增断言 FAIL 5 条（`actual 2 ≠ 1`、
  `identity-stable false`、`4 ≠ 2` 等）。源文件按 hash 校验还原。

### 5.29 修（2026-10-16）：四个只在某个状态下出现的控件，键盘够不到

**这是 §5.10 那条坑的同一个形状，第二次踩。** §5.10 的坑 2 写得很清楚：面板初版**按 ref 表维护
Tab 链**，于是两个开关"静默地不在链里——键盘根本够不到它们"；当时的修复是**改查渲出的 DOM**。
模型卡这一侧没有跟着改，一直留在"手写清单"的形态上。

卡片开着时 `Tab` 是被**完全接管**的（`onKeyDown` 里 `event.preventDefault()` 之后自己走链），
所以浏览器不会兜底——**不在链里 = 键盘永远到不了**。而链是这样写死的：

```
chain = [ railRefs[railStop], searchRef, ...rowRefs ]   // 三种成员，手写
```

渲出的卡片里却有 **四个**只在特定状态下出现的控件不在其中：

| 控件 | 出现条件 | 原来的键盘出口 |
|---|---|---|
| `.dmp-search-clear` | 搜索框非空 | 有：`Esc` 清空 |
| `.dmp-filter-clear` | 别的 provider 也有匹配 | 有：提供商栏的「全部」行 |
| `.dmp-retry`（读取失败） | 目录读失败 | **没有** |
| `.dmp-retry`（分组失败） | 某个 provider 组失败 | **没有** |

前两个只是不方便，后两个是 **WCAG 2.1.1（键盘）失败**：`reload()` 全文只被调用两处，一处是
打开模型卡时（`openMenu`），一处就是这个按钮的 `onClick`。也就是说**某个 provider 组加载失败后，
想重试只有鼠标一条路**——而那正是最需要重试的时刻。这类缺陷连截图都看不出来：按钮画得好好的。

**改法**：把链从"手写清单"改成**从渲出的卡片里读**，并且把这套规则抽成 `src/client/focusChain.ts`
（纯函数，可被单测直接驱动，而不是只能在源码上做正则匹配——§5.27 抽 `adapterCatalog.ts` 的同一理由）。
两条规则各有来历，都不是顺手加的：

1. **`disabled` 排除，`aria-disabled` 不排除。** 这就是 §5.10 那条坑的正面：选中写入期间提供商栏整列
   `disabled`，而 `.focus()` 打在一个 disabled 按钮上**什么都不做**，链里留着它就会**吞掉**按键
   （搜索框上 Shift+Tab 看起来像坏了）。模型行反过来故意用 `aria-disabled`，正是为了写入期间**不**
   把键盘丢掉——所以判据必须是 `disabled` 而不是 `aria-disabled`。
2. **listbox 是一个 Tab 停靠点，不是每行一个。** 提供商栏靠自己的方向键在内部移动，`ProviderRail` 为此
   把选中的那行留在 `tabIndex=0`、其余 `-1`。麻烦在于**模型行也用 `-1` 表示"在链里"**——同一个值
   两种含义，所以只能靠 `role` 分辨（`role="option"` 且 `tabIndex===0` 才算）。

查询里带 `[tabindex]` 也是必需的：模型行是 `div` 而不是 `button`，只查平台原生的可 Tab 元素会
**漏掉整张列表**。

**端点行为原样保留**（它们是有意不对称的）：向前越过最后一员回绕到第一员（遍历永远不离开卡片），
向后越过第一员则**关闭座位**——这是键盘唯一的出路，交还焦点给触发器。焦点不在链上时（卡片本身，
或某个控件在脚下消失了），按前进方向从对应端进入。

**门**：`npm test` 五道门全绿。

- `test-params.mjs` 新增 **28 条**：selector 覆盖三种形态；`disabled` 进出链；提供商栏 `role=option`
  在 `tabIndex=0` 时是唯一停靠点、`-1` 的其余行**不是**、而模型行（`role=menuitemradio` at `-1`）
  **是**；三个只在某状态下出现的按钮都**在**链里；链顺序 = 渲染顺序；**"只按 Tab 能走遍渲出的每一个
  控件"**（这条才是那个缺陷的正面表述——指针独占的控件走不到）；端点回绕 / 首端后退关闭 / 焦点不在
  链上时从哪端进入 / 空链；以及失败态里重试按钮在链上。
- `selfcheck-static.mjs`：原来的 `filter: the Tab chain skips disabled controls` 断言的是**已被删掉的
  手写链形状**，改写为 **6 条**——座位必须走 `stepChain(cardChainOf(...))`、手写 ref 链不得回来、
  selector 必须含 `[tabindex]`、提供商栏必须靠 `role` 判、`disabled` 排除而 `aria-disabled` 不得出现、
  首端后退必须关闭座位。
- **变异测试**（五条，都实测炸）：① 把链改回"只收有 role 的 + input"（= 原缺陷：普通按钮全丢）→
  3 条 FAIL，其中恰好是"重试按钮在链上"那条；② 左栏不再是一个停靠点 → 3 条 FAIL；③ `disabled`
  检查删掉 → 1 条 FAIL；④ 首端后退不再关闭 → 1 条 FAIL；⑤ 取模回绕删掉 → 3 条 FAIL。
  五次变异后源文件都按 hash 校验还原。

**顺带核对的**：`railRefs` / `rowRefs` / `railStop` / `groupsRef` 都仍在用（方向键、滚动、
鼠标按下聚焦），没有因为这次改动变成孤儿——`noUnusedLocals` 也会拦下这种情况。

### 5.30 补门（2026-10-16）：宽度预算只守住了"不该膨胀"，没守住"被挤没"

§5.28 的尺子是"哪些通知其实什么都没说"，§5.29 是"哪些控件其实够不到"。这一节是同一个尺子
用在**门自己身上**：哪些门看起来在守着宽度预算，**其实守不住**。

**发现过程**：先读 §10b 那条既有断言——"事实条仍在紧凑预算内"，判据是
`stripPx <= 120`。这个 120 是**常量**，和产生它的布局没有任何联系。于是做变异测试，
把它周围的每一个宽度都动一遍：

| 变异 | 修复前门的结果 |
|---|---|
| A 提供商栏 176 → 260（挤掉名字 84px） | **0 条 FAIL** |
| B 卡片 520 → 380（挤掉名字 140px） | **0 条 FAIL** |
| C 名字 `min-width` 48 → 96 | **0 条 FAIL** |
| F 行内边距 7 → 30（挤掉名字 46px） | **0 条 FAIL** |
| D 窗口轨 47 → 70（条 136 > 120） | 1 条 FAIL ✅ |
| E 轨间距 8 → 14（条 131 > 120） | 1 条 FAIL ✅ |

也就是说：**这条门只在"三个列 token 之一被改大"时报警**，而对"列被挤窄"完全无感。
原因不是实现错误，而是**它守错了那一半**——名字是行里的**弹性半边**（`flex: 1 1 auto`），
事实条是**固定半边**（`flex: 0 0 auto`）。挤压列宽**永远不改变事实条自己的宽度**，只会
从名字那里拿走空间。所以"事实条不膨胀"和"名字还能读"是两件事，前者的实现里根本不含后者。

**补的法子**：不再对着常量，而是**把从卡片到名字列的盒模型真的走一遍**，每一个环节都从
样式表里读出来（不是在这里重抄一遍），再对结果下断言。`styles.ts` 自己的注释记着两个
**实测**数字——模型列 331px、名字列每行 175px——所以模型可以被**校准**：算出来必须
正好等于这两个数。这条校准断言是这套门里最重要的一条，它保证算术仍然描述真实布局，
而不是"在一套早就不成立的算术上安静地通过"。

实测：**任何**一个环节动 1px，校准断言就 FAIL（连 `gap: 6px → 7px` 都会被抓到，
输出 `{"pane":331,"name":174}`）——这正是它该有的灵敏度。

**7 条新断言**（`selfcheck-static.mjs`）：① 校准（算出的模型列/名字列 = 实测 331/175）；
② 名字列 ≥ 事实条（名字是会被省略号吃掉的那一方，一旦比事实条还窄，每行都不再能说明
自己是哪个模型）；③ 卡片够宽到能摆下两栏（提供商栏 + 模型列地板 320 + 内边距），否则**任何**
视口下都摆不成两栏；④ 名字地板必须**小于**它实际拿到的空间（地板抬到超过可用空间，
浏览器只能溢出）；⑤ 名字地板至少显示几个字符（按 13px 约每字符 7px 算，**故意写弱**——
地板的真实约束是下一条，这条只拦"地板塌成 0"）；⑥ **折叠断点正好是两栏装不下的那一点**
（536 − 32 = 504 = 提供商栏 + 320 + 8）：两个数字是同一个决定的两种写法，改一个不改另一个
就是自相矛盾；⑦ 最窄实测视口（320px，§5.24 记录的五档之一）下名字仍在地板之上。
每一条都从样式表读参数，**没有一个魔数**——包括我自己先写进去又删掉的 `48` 和 `2.6`
（前者正是本节要消灭的写法，后者是我编的比例）。

**变异测试（6 条全炸，修复前只有 2 条会炸）**：A 提供商栏 176→260 → 4 条 FAIL；
B 卡片 520→380 → 4 条 FAIL；E 行内边距 7→30 → 1 条；F 折叠断点 536→400 → 1 条；
G 选中标记 14→40 → 1 条；H 名字与事实条的间距 5→40 → 4 条 FAIL。源文件按 hash 校验还原。

**一条**变异**故意不报**：名字地板 48 → 96 不再 FAIL。这是正确的——96px 在每一个受支持
的视口下都还放得下，那不是缺陷。**门不该为"我不喜欢这个数字"报警**，只该为"一条行不
成立的不变式"报警；把这条说清楚，比让它凑数更值钱。

### 5.31 补门（2026-10-16）：改坏验证自己有八个月没跑对过

§5.30 那轮的尺子还是"门看起来在守、其实守不住"。这一轮换成**改坏验证脚本自己**，
结果发现它不是"守不住"，是**根本没跑对**。

**三处坏，一处比一处值钱**：

1. **模式打不上去。** `Picker.tsx` 是 **CRLF**，而三条改坏的模式里写的是 `\n`，
   于是它们长期**没有真正 apply 过**。脚本对这种情况的输出是 `SKIP` + 一行说明，
   **既不影响退出码、也没人天天跑它**——所以它一直"全绿"。模式现在按文件自己的
   换行重新排，并且**匹配数不是 1 也算失败**（匹配到别处 = 改的不是它名字里那条决定）。
2. **模式指向已删的代码。** 三条引用 `providerAt` / `setProviderAt`——那两个状态在
   §5.25 的提供商栏改造里就删掉了，模式还留在原地。
3. **它从来没进 `npm test`。** 一条只靠"记得手动跑"的验证，等于一条没有的验证。
   现在进 `test`，且把两种坏消息**分开报**：`MISSED` = 门太弱（要加门）；
   `STALE` = 这条改坏已经打不上去了（要改这个文件）。两者都算失败。以前它们都
   静默跳过——**这正是我自己在 §5.30 里批评的那种"看起来在守"**。

**更值钱的一半：这个模块根本没有行为门。** 它的六条门全是**源码形状**（正则里有没有
`setTimeout(confirm`、有没有 `getRootRects`）。于是我做了一组逻辑改坏，六条**全部逃过**
本仓库所有门：

| 逻辑改坏 | 后果 | 修复前 |
|---|---|---|
| `CONFIRM_LOOKS` 2 → 1 | 一次重排抖动就丢掉用户还在看的弹窗 | **0 条 FAIL** |
| `reported = true` 删除 | 离场被反复上报（调用方从这里关 React 状态） | **0 条 FAIL** |
| `stopped` 判断删除 | 已拆掉的观察者仍然上报 | **0 条 FAIL** |
| 恢复判断写反 | 每次读数都算丢失 | **0 条 FAIL** |
| 没 root 时才挂观察 | 观察者从不看根 | **0 条 FAIL** |
| 计时器不存起来 | 挂起的复查取消不掉 | **0 条 FAIL** |

原因不是哪条正则写错了，而是**这一类判断根本不能用正则验**：正则看得见
`setTimeout(confirm` 写在那里，看不见第二次确认**到底有没有发生**——而那正是这条规则
的全部。所以补了一份**驱动真实状态机**的单元门：假元素、假 `ResizeObserver`、
可控时钟；22 条断言覆盖"一次抖动不关 / 持续丢失才关 / 只上报一次 / 恢复会清零 /
拆卸取消挂起的复查并断开观察 / 根是每次读数现取的而非捕获"。

变异结果：六条现在分别炸 3/1/1/5/2/1 条。**原缺陷本身**（计时器换回
`requestAnimationFrame`）炸 6 条，其中一条正是 `anchor loss: a loss that survives
the second look does dismiss — {"lost":0}`——**弹窗永远不关**，一字不差。

**顺带逮到的一处真漏**：设计记录写的是"**三个**一起关"，而门断言的是写死的**两个**
`['setOpen(false)', 'setSettingsAt(false)']`。第三个 `setSelectionFocus(false)`
（松开那个把触发器焦点环闩掉的 flag）**没有任何门**——删掉它两个门全绿。这和第
§5.29 是同一类：**键盘用户看得见其缺失的那种状态，留在没人看的地方。** 修法不是补上
第三个名字（那只是把写死的清单从两个改成三个，照样会漂），而是**把规则从代码里推导**：
凡是被 `set…(true)` 闩上的布尔量，离场时必须 `set…(false)`。验证方式是把一个新闩上的
状态 `setPinned(true)` 加进去而不管它——门**自动**报出
`{"latched":["Open","Pinned","SelectionFocus","SettingsAt"],"missing":["Pinned"]}`，
没有改门一个字。

**现状**：15 条改坏全炸（8 条接线 → 静态门，7 条决策 → 单元门），进 `npm test`；
整个 `npm test` 16.6s。

### 5.32 整体 UI 重构（2026-10-16）：把「模型配置」页交给 quiet-instrument

§5.24–§5.26 那几轮做的是**模型卡**（座位上的弹层）。这一轮做的是**另一个表面**——
设置里的平行 tab「模型配置」（ADR 0003）。它此前只有一份视觉方向稿
（[docs/design-model-config-tab.md](docs/design-model-config-tab.md)）和一次真机审计，
审计自己给出了结论：**它的 idea 句与数据层不符**（§9.6），**那一栏的 4px 竖条在真机上 0 次出现**，
**`data-usable` 这个布尔既不表示「缺 key」、筛选后又恒为 true**（§10.3），
**所有断点都在测视口而可用宽度来自容器**（§9.2）。所以这一轮不是「打磨」，是重做。

**方向**：`design-taste-frontend` 的 `draw.mjs`，`--sector dev-tool --tone technical --keep palette,type`，
三选一里抽到 **`quiet-instrument`（seed 1258196331）**，另两个是 `dense-tiles`（贴边瓦片板）与
`one-motif`（单一形体母题）。选前者是因为**这页的核心事实就是「十行里没有一行需要我；若有一行需要，它是唯一一个」**，
而克制本身就是可读性——`dense-tiles` 字面要求贴边填满，正是要避开的东西；`one-motif` 需要一个形体，这里没有形体可借。

**idea 句**（skill 第 4 步要求填空）：

> 在这页上，**「这个提供商现在能不能服务我的请求」——数据层已经逐行回答的那个问题
> （`providerUsable` / `keyConfigured`）——成为页面唯一的大声处**：顶部一句只数「需要处理的提供商」的就绪陈述；
> 下面每一行保持同一个小组尺寸，**身份在左端、那一行的答案在右端**，于是列表读起来是一列陈述。

**live thing**：那句**就绪陈述**（`.dmc-readout`）。它读自己的十行真实状态印出需要处理的条数，
用户存 key / 清 key / 添加 / 删除后当场重算；零问题时说「全部可用」，一行都没有时说「尚未添加」；
没有脚本也照样读得懂（每行的答案词就是它的平铺版）。

**构图与状态（实现契约）**

| 项 | 决定 |
|---|---|
| 一列 | `.dmc-page` `max-width: 560px`（实测 clientWidth **560**），左对齐；`container-type: inline-size` |
| 唯一的大东西 | `.dmc-readout`，**20px/28px/600**、primary ink、`tabular-nums`、≤2 行。**可见的段标题已退役**（见下） |
| 行 | 两段：段 1 = `.dmc-name`（含 `.dmc-route`）＋ `.dmc-verdict`（右端、`tabular-nums`、逐行成列）；段 2 = `.dmc-edit`（**固定轨道网格**，缺格留空、不把邻居左移） |
| 状态 | `data-state` **互斥三值** `ready`/`missing-key`/`unreachable`；诊断另用 `data-error="true"` **可叠加**；`data-usable` 保留为别名（`false` ⇔ `unreachable`） |
| 颜色 | **行的 rest 态永远没有填充**（`unreachable` 也不铺）；状态只由**竖条 + 词**两个通道承载，竖条**只**表示「能不能服务」 |
| 词 | 每行一个词，取自既有词表 `config.verdict.*`；**会话行（账号）用宿主自己的话「已登录」**（`data-state` 仍是 `ready`）——它比「可用」多说一个「为什么这里没有密钥格」 |
| accent | 只在页尾那一个动作上，载体是 **4px 实心左竖条**（与行首的状态竖条同形、不同角色不同色：红＝事实、蓝＝行动） |
| 去铬 | 每行只剩 **1 个**带 1px 边的控件（协议 `<select>`，真表单控件豁免）。旧稿是每行最多 **5 个**描边框（实测 2–4 个/行） |
| 窄容器 | `@container (max-width: 520px)` / `(max-width: 360px)`；旧的 `@media (max-width: 900px)` 删掉 |
| 墨色阶梯 | 去铬动作 **rest = primary ink、`:disabled` = secondary ink、`:hover` = live 填充**（旧稿 rest 与 disabled 同色 → 禁用态看不出来） |

**真机前后对照（§8.13 是同一轮的完整实测）**

| 指标 | 重构前 | 重构后 |
|---|---|---|
| 「模型目录」按钮 | 52px 盒内**逐字竖排 4 行**（label 12×76，溢出盒底 4px） | 88px 盒内 **1 行**（48×16） |
| 凭据格 | 88×82 **三层堆叠** | **180×28** 一行 |
| route id 断词 | **2/10 行**（`openrout\|er`、`com\|mandcode`） | **0/11 行** |
| 名字列 | 140px / 高 44px | **493px** / 高 22px |
| 右端答案词 | **1/10 行**有 | **11/11 行**，右沿 spread **0** |
| 每行 1px 边控件 | 2–4 | **1** |
| 行 rest 底色 | 38/48 行（更早）→ 10 行里 `unreachable` 铺底 | **0 行** |
| 「模型目录」标签与计数 | `space-between` 顶到两端（裸数字） | 相邻（gap 6px） |
| 协议标签 | 156px 轨 → `OpenAI Chat Completio` 截断 | 176px 轨 → headroom **28.01px**；≤520 容器整行独占 |
| 106px 容器 | 溢出 242px（旧审计记为「未解决」） | 无溢出、**无单字孤行**（页尾动作末行 2 字）；≤~140px 下协议标签必然截断（宿主 800px 面板 + 390 视口的外部约束，见下） |

**四件有意不做的**（每条都写进交付报告，不是漏做）

1. **0 张照片**。方向书自己写明「此题材是软件，它的图片就是它自己的界面」，而房子规则同时禁装饰形状与假仪表盘。
   本页的「图片」是十行**真实渲出的界面片段**（真 provider 名、真 route id、真错误原话、真协议取值）。
2. **不做滚动入场编排**。这是**别人的设置面板里的一个分区**（skill 的 Special case），在里面做首屏动画是错的。
   skill 的「≥8 个移动元素」下限我们不接受，替代证据是**在真机里直接量**：控件反馈、答案词落定、就绪陈述重算、
   抽屉进出四条都在，且 `prefers-reduced-motion` 下内容齐全、位移为零（§8.13）。
3. **不做 `data-ui` 片段**。本页整块是宿主页面的真实界面，不是裁出来的片段；套上 `data-ui` 会把房子规则整片关掉。
4. **段标题保持退役**。可见的 `<h2>模型配置</h2>` 被删：① 设置侧栏那条被选中的 tab 已经写着同一个词；
   ② 两位视觉 juror 独立把它读成 **eyebrow**（房子规则禁、且是 skill 的硬 cap）；
   ③ 段的可访问名不丢——`<section>` 上的 `aria-label` 仍是 `config.title`。

**这一轮的三条方法论收获**

1. **视觉 juror 的读数要当线索、不当证据。** 同一批截图给三个 juror 看，得到的断言里
   有真缺陷（协议标签逐字截断、一行两个「删除」、编辑行 ragged），也有明确误读：
   「内容宽 1090/1224px，不是窄列」（**DPR=2**，1090/2≈545）、
   「表头错位 40px」（实测 **0px**，且表头本身已删）、
   「右边控件 x 逐行跳动」（抽屉遮住半个面板造成的观感，实测每类控件左沿 spread **0**）、
   「右下幽灵字符串」（是**宿主输入条**透过我们**有意半透明**的 scrim 显出来）、
   「106px 里名字断词」（拿拉丁词的标准判中文换行）。
   所以每一条都先过一遍真机测量再决定改不改——**改的是测量能证的，驳回的是测量能驳的。**
2. **门要连门自己一起验。** verifier 把 skill 的 `lint.mjs` 接进 `selfcheck` 之后，
   立刻暴露出「注释里出现 shadow 一词」这类假阳性；而**改坏验证**又逮到两条门自己的漏洞：
   ① 「窄分支只把 520 档改成 `@media`」原本全绿（360 档仍是 `@container`，旧语义「存在 @container」过松）；
   ② 「删掉 `.dmc-readout` 的规则」原本全绿（`effectiveInk` 会一路继承到 `.dmc-page`，13px primary 也合格）。
   两条都补了断言并各自留下改坏证明。**顺带**：对比度注册表在 `.dmc-title` 退役后仍登记着它，
   是本轮**真实变红**——被 verifier 自己那条「登记样式必须自己声明 ink 或 size」抓到，不是合成变异。
3. **门补上了本该早就在的地方。** `dmc-` 与 `drc-` 的文字**在此之前一个像素都没被量过**：
   `check-contrast.mjs` 只读 `src/client/styles.ts`。现在它读三张表、登记 36 条 `dmc-` 样式，
   并新增三条断言（登记样式必须自陈 ink/size；画字规则不许静默跳过；只有 primary/secondary 可作文字）。
   实测最紧 `.dmc-route` / `.dmc-verdict` / `.dmc-catalog-count` 浅色 **5.22:1**，两主题全过 AA。
   **§5.33 起**：那张从未被量过的第二张表（`drc-`）连同它的 `.drc-btn-primary` 缺陷一起退役——重试策略搬进本页，
   样式并入 `dmc-` 域，于是这里的登记覆盖了页内每一处文字（闭环见 §5.33）。

**残留与已知边界（如实记，不算已解决）**

- **106px 容器是降级而非构图。** 宿主设置面板 800px 宽、390 视口下导航占 188px，内容列只剩约 94–106px。
  这一轮把「溢出 242px」修成「不溢出、无单字孤行、可点目标 40px」，但**没有**在 106px 做出一个漂亮版式，
  也做不到：协议标签（`Anthropic Messages` 98.3px）在 106px 里必然截断。**根因在宿主的面板宽度，不在本页。**
- **rest 时最后一行在宿主窗格可视区之外**（宿主 scroller `scrollHeight 952 / clientHeight 746`，向下可滚 206px 可达）。
  重构前同样是 9/10 可达，**本页 `pageOverflow` 为 0**——这是宿主 800px 模态 + 746px 可视窗格造成的。
- **`data-usable` 过渡别名仍在**（row 与 rail 两处）。删它要同时改门与测试，本轮不做。
- **scrim 没有淡入**：`opacity` 会被本仓库的「不许淡化」样式门拦下，旧稿也没有。
- **`.dmc-catalog` / `.dmc-error-toggle` 当前组件不会进入禁用态**，所以 §15.3 的墨色阶梯只对真正会禁用的
  5 个类强制成对（其余靠同一条规则族继承）。
- **lint 的 2 条 WARN 保留并记录**：1×`outlined-box`（抽屉里真表单字段的边，房子规则明写豁免）、
  1×`em-dash`（20 处全在代码注释里，**零处进入用户可见文案**）。对照：本轮 4 个源文件重构前是
  **3 FAIL / 3 WARN**，现在是 **0 FAIL / 2 WARN**；页面表的 `outlined-box` WARN 由 **5 → 0**。

### 5.33 重试策略从官方页搬进「模型配置」页（2026-10-17）

**动因。** 用户要求把重试卡从官方「设置 → 模型」页搬进本插件的「模型配置」页，保留全部功能、重做成精简 UI（删柱状图）。
旧形态是 `RetryCard.tsx` + `retryStyles.ts`（`drc-` 域），注册进宿主座位 `settings.models.provider-card`（key `llm-pi-ai`）。
两件事同时成立：座位按 key 派发，**一个座位只能点名一个适配器家族**，所以它能覆盖的只有 pi-ai 一家；
而这个座位在**别人的页面**里——本插件的重试策略长在官方「模型」页的提供商卡片中间。
（旧卡本来没有自己的小节：**本轮之前** DESIGN 全文只有一处 `drc-`，就是 §5.32 方法论第 3 条；它的实测记录在
`docs/design-model-config-tab.md` §9.3。）

**决定**

| 项 | 决定 |
|---|---|
| 形态 | **行内展开**：`.dmc-edit` 控制行多一个去铬文本动作 `自动重试`（`.dmc-retry-action`），点击在**该行下方**展开 `.dmc-retry`——DOM 位置与展开的诊断行同级（`.dmc-edit` 之后），`grid-column: 2 / -1`，`aria-expanded` 与 `aria-controls="dmc-retry-<provider>"` 成对 |
| 覆盖范围 | 由 **schema** 决定，不按 provider id 点名：`retryCapable(namespace, settingsPath)` 从 `schema.uid` 沿该 provider 自己的 `settingsPath` 走查（容器节点 dict / array 消费一步为键／索引、继续走值形状；object 节点消费一步为字段名），落到它的 profile 节点后问该节点有没有 `retryPolicy`。官方 `llm-deepseek` 因此一并覆盖（它的 `retryPolicy` 在命名空间根、`settingsPath` 为 `[]`，一步都不走），pi-ai 家族是 `['providers', <route>]` |
| 写回 | 一律 `store.write(ns, ops, namespace.revision)`（它已含 conflict 重试与重读）：保存 = `set [...settingsPath, 'retryPolicy']`；**两个数字都没变则不写**（免得凭空 bump revision、造出这条栅栏本要拦的冲突）；恢复默认 = `unset`（仅 `declared` 时可用） |
| 草稿 | 两个草稿都是「字符串或 null」（null = 用 store 的值）。页面每次写入都会重渲染，草稿留在组件本地，输入不被无关更新覆盖；摘要行跟着**草稿**走，所以打字时就能回答"这样会怎样" |
| 样式域 | 并入 `dmc-`（`modelConfigStyles.ts`），`drc-` 前缀退役；复用 `.dmc-notice`（说明／状态行）与 `.dmc-key-action`（两个按钮），不新增重复规则 |
| 柱状图 | **删除**：`.drc-chart` / `.drc-bars` / `.drc-bar-slot` / `.drc-bar` / `.drc-cap-mark` / `.drc-axis` 全部消失 |
| 等待节奏 | 改由**一句话 + 两个数字**陈述：`每次等待翻倍，直到触达上限。` 加一行摘要（`tabular-nums`；数字全部由 `retryWaitCurve` / `waitRange` / `formatDuration` 算出。默认策略下算出来是 `5 次 · 首次等待 500ms · 最长合计 17.1s`：首个等待 = `min(initialDelayMs, 上限)`，最长合计 = 上界） |
| 摘要口径 | 「最长合计」= `waitRange(waits, jitterRatio).high`，即**带 jitter 的上界**。旧卡在同一个标签下印的是名义总和——每次等待有 ±`jitterRatio` 的抖动，那个和是执行器从来不会真的花掉的数，标签在撒谎；本轮换成上界 |

**为什么搬进 `dmc-` 域，而不是只把 `drc-` 改个前缀**

`drc-` 从未被 `check-contrast.mjs` 量过——那张门只读 `styles.ts`——所以整张表的文字**一个像素都没进过门**
（§5.32 方法论第 3 条记的就是这件事）。门一接上就量出已在案的缺陷：`.drc-btn-primary` 是 accent 实心填充 +
`#fff`，**4.2349:1（浅）/ 2.3278:1（深）**，12px 文字两主题都不达 4.5:1；同一张表里 `.drc-cap-mark`（11px）与
`.drc-state[data-declared='true']`（12px）还把 accent 当文字——而 §5.32 刚立下「accent 不得作文字」。
搬进 `dmc-` 域后这三条**随设计一起消失**（保存／恢复按钮改用 `.dmc-key-action` 的墨色阶梯，摘要行与来源词只用
primary / secondary），并且从此被门永久守住：`dmc-` 的每一处画字规则都要在 `STYLES` 里登记，登记项必须自陈
ink 与 size，且只有 primary / secondary 可作文字。
`docs/design-model-config-tab.md` §9.3 的表末行把这三条记为「本轮新增、不在任务 scope」的现存违反；按「不删别人的
记录」，那条记录原样保留，**本节就是它的结果**：`drc-` 规则在仓库源文件里已归零，只剩注释与门自己的历史说明里还
提到这个名字。

**门的有意修订（本轮决策，不是放宽）**

`selfcheck-static.mjs` 原本断言 page sheet **恰好一条** 1px 边，且必须是 `.dmc-protocol`。本轮改为
**恰好两条，且分别只能是 `.dmc-protocol` 与 `.dmc-retry-input`**。

理由：行内控件**仍然只有一条边**——没展开编辑器时，每行带边的控件还是协议 `<select>` 那一个；展开后的两个数字框是
**真实表单控件**，去掉边会让数字读成静态文本（旧卡自己的历史记录过这次回归）。所以重试数字框与协议选择框属于
**同一条豁免**（真表单字段必须有边才认得出是字段），不是新开一个口子。这条断言同时把"不许再长出第三个描边框"钉住，
比原来的"恰好一条"更强。

**有意不做的事**（写进报告，不是遗漏）

1. **不搬进抽屉或弹层。** 重试策略是 per-provider 的一件事，而这页已有的排布语言就是「行上一个词 + 行下一块」
   （模型目录也是这么开的）。多一层表面只是把一个字段藏得更深，还要多一套开合、焦点与 Esc 语义。
2. **不补迷你图。** 柱状图删掉之后**不换成 sparkline 或曲线**。它本来要防的那个误读（"10 次 / 上限 60s"读起来像
   十次一分钟）由那句话与两个数字承担：默认策略下算出的 `首次等待 500ms` 与 `最长合计 17.1s` 一起说出这条节奏的头和尾。
3. **不加第二套按钮文案。** 保存／保存中复用 `config.apply` / `config.applying`，恢复默认用新键；按钮复用行内
   去铬动作的类，不新造一个"保存"的视觉等级。

**已知边界（如实记，不算已解决）**

- **只读部署仍能展开查看，但不能写**：入口不因只读而消失（现值仍要读得到），编辑器内两个输入与两个按钮禁用，
  并显示 `此部署已只读，无法修改重试设置。`。
- **`retryCapable` 读不出 schema 就不显示入口**（失败关闭，与 `protocolChoices` 读不出返回 `[]` 同一纪律）。
  代价是"适配器真声明了、但设置服务给不出 schema"的部署看不到入口——这比显示一个写不进去的入口诚实。
- **`mode === 'always'` 时次数不影响它**：编辑器照常渲染该 provider 文档里的次数，另加一行说明
  `此提供商设为无限重试，次数不影响它。`——字段不隐藏，因为它仍然是当前文档里的值，只是此刻不生效。
- **等待节奏只剩文字陈述**：这是本轮主动接受的损失（柱状图是它唯一的图形载体）。若将来要恢复图形，必须同时恢复
  图形门的登记与 §5.32 的「accent 只做图形」约束。
- **320px 视口不是本轮能收的口**：该档宿主只给 `.dmc-page` **36px** 内容列，而页面**收起编辑器时自己就已经撑破 32px**
  （`.dmc-catalog` 右沿越过内容列右沿），字段还在宿主的滚动遮罩之下——这是宿主「800px 面板 + 极窄视口」这个既有外部
  约束的极端档（§5.32 已记录 390 档的 94–106px）。真机验收因此断言契约的两条（文档无横向滚动、编辑器不越出内容列，
  320/390/768/1920 四档全过），把「编辑器内容装进自己的盒子」只放在页面自身未撑破的三档上断言，**320 档的
  `pageContentOverflow=32` / `editorOverflow=12` 原样打进验收报告**，不隐藏也不假装解决。
- **状态竖条不覆盖展开的重试编辑器**：`.dmc-rail` 的 `grid-row: 1 / -1` 按规范只解析到**显式**网格的最后一条线，
  所以它跨的是「身份行 + 控件行」，不跨展开出来的隐式行。**这不是本轮引入的**：既有的展开诊断行（`.dmc-error-text`）
  一直是同一个行为，而竖条陈述的是「这个提供商能不能服务我的请求」，归行的陈述与控件，不归它的展开区。
  结论：保持现状（改动会同时改掉既有诊断行的观感）；若真机验收量到它读起来像断裂，再按显式跨行处理。

### 5.34 限流文案恢复（2026-10-17）：让一条被误分类的失败重新走进重试链

**动因。** 用户在真实会话里反复看到「本轮运行失败 + 请求过于频繁，请稍后重试」，而重试编辑器上的设置**一次都没生效**。
全量会话日志（1359 个会话 / 1.03 GB 压缩）把这条路径查实了：

- 该文案的 `turn/end` 失败共 **18 次、14 个会话**（2026-10-11 ~ 10-17），`reason.error.code` **全部是 `PI_AI_ERROR`**。
- 同一语料里真正带 `429:` 前缀的 `RATE_LIMIT` 失败有 **75 次**，它们**重试正常**（如 tokbook 会话里 23 条 `llm/retry`、
  单链跨度 304s、Σdelay 291.8s，已打满 `maxDelayMs=60000`）。
- 这 18 次的事件序列是 `assistant/attempt → step/end → turn/end`，**中间零 `llm/retry`**，从失败到终止 **2~6ms**。
- 全语料 16 组 provider+policy 的 `retryableCodes` 一律是
  `[EMPTY_RESPONSE, RATE_LIMIT, SERVER, TIMEOUT, TRANSPORT]`，**没有任何一组包含 `PI_AI_ERROR`**。

机制（可逐行核对）：`dsh-llm-pi-ai` 的 `classifyPiAiError()` 只认 `\b429\b|rate.?limit` 与**英文** quota 措辞，中文限流文案
落进它的兜底 `PI_AI_ERROR`；而 `dsh-llm-retry` 在 `!policy.retryableCodes.includes(failure.code)` 时**直接 `next()` 放弃**，
于是 `dsh-agent-loop` 抛出 `LlmError` 收尾。**等 5 分钟、等 5 秒都不会发生——它根本不进重试分支。**
另有两条已核对的事实：该 failure 只有 `{message, code}`（**没有 `status`**，所以只能靠文本判定）；pi-ai 内层重试被
`dsh-llm-pi-ai` 硬关（`maxRetries: 0`），`dsh-llm-retry` 是**唯一**退避层。

**决定**

| 项 | 决定 |
|---|---|
| 落点 | **本插件的 Host 侧**（`src/host/rateLimitRecovery.ts` + `src/index.ts`），挂在 `agent/request-error` 瀑布上。不改宿主安装目录（升级不丢），不改 `node_modules` |
| 手段 | **不自己等、不自己计数、不自己写事件**：按 `RATE_LIMIT` 重新提交这条失败，**等待节奏、重试次数、每会话计数、界面上「等待重试模型请求 (n/N) · Xs」行全部仍由 `dsh-llm-retry` 出**，因而全部仍由重试编辑器上的两个数字决定 |
| 注册序 | `ctx.on('agent/request-error', …, { prepend: true })`。瀑布是**最外层先跑、不调 `next()` 即否决其余链**；内建重试也在同一事件上，晚于它注册就会在决策之后才轮到，救不回来 |
| 判定 | 五个条件**全部**成立才提升：① 该请求有已解析的 `retryPolicy`（没有时内建重试自己也不工作）；② 该策略的 `retryableCodes` **仍含 `RATE_LIMIT`**；③ 本次 `code` **不**在其中（否则归内建，预算不得被重复花）；④ 没有「确定的非限流」状态码（非 429/408/5xx 的数字状态）；⑤ 文案命中文案表 |
| 文案表 | 收录**内建分类器认不出**的措辞（`请求过于频繁`、`当前并发已达上限`、`请求数限制`、`访问过于频繁`、`操作过于频繁`、`请求过于密集`、`速率限制`、`触发限流`、`too many requests`、`requests are too frequent`）。**内建已认的拼写（`rate limit` / `rate_limit` / `429` …）刻意不收**：它们不可能走到这里，收了只会读成覆盖面而实际断言不了任何东西 |
| 如实记录 | **不重写这条失败**：提升返回的是**副本**，`dsh-agent-loop` 收尾时读的仍是原始对象，终态照样记 `PI_AI_ERROR`。提升只授权重试，不替提供商改口 |
| 卡上开关 | 条件 ② 就是开关：在重试编辑器所在提供商的策略里去掉 `RATE_LIMIT`，这条路径整体关闭 |
| 文案 | 重试编辑器在「每次等待翻倍」下方加一行 `中文限流文案（如「请求过于频繁」）也按这里设置重试。`（`config.retryPolicy.recovery`，双语） |

**为什么是这个形状，而不是三个更简单的形状**

1. **不改 `node_modules` 里的分类器**（那是最干净的根因修复）：插件的交付物不能依赖改宿主安装目录——升级即丢，
   而这条错误的成因在别人的正则里，本插件无法通过自己的版本控制它。
2. **不把 `PI_AI_ERROR` 加进 `retryableCodes`**（零代码方案）：那是兜底桶，除限流外还装 `pending` / `deferred` 等**终态**
   失败，加了会把它们一起拖进 5 分钟×N 的重试。按**文案**判定只碰真正的限流措辞。
3. **不在插件里自己起定时器**：那会成为"等多久"的**第二个答案**，与编辑器上的两个数字并立，且要自建计数、自建
   会话事件（否则等待期界面上什么都没有）。交给内建执行器后，编辑器、计数、等待行三者天然一致。

**有意不做的事**（写进报告，不是遗漏）

1. **不做图形或开关**：文案表是代码里的常量，不进 UI。多一个开关就多一份"卡片说的和实际做的不一致"的机会，
   而条件 ②（`RATE_LIMIT` 在不在策略里）已经是一个真实生效的开关。
2. **不覆盖 `QUOTA` / `CONTEXT_WINDOW_EXCEEDED`**：额度耗尽与上下文超限是**确定性**失败，等 5 分钟不会变好，
   重试它们只是在拖延一个必然的终止。文案表里也没有它们的措辞。
3. **不动 `MAX_MAX_DELAY_MS`（60s 上限）**：用户明确要求沿用编辑器现有的等待方案，不要"固定等 5 分钟"。

**门**

- 新增 `scripts/test-rate-limit-recovery.mjs`（`npm run test:recovery`，进 `npm test` 链）：自包含、**不依赖宿主安装**
  （CI 上没有宿主），逐条钉住五个条件、两向文案、副本语义、畸形载荷不抛异常，并**把文案表本身也当规则**断言
  （每条必须能提升一次、每条都不许是内建已认的拼写）。**接线也在门里**：`src/index.ts` 被同一个 esbuild 打包后
  用替身 context 驱动，断言"只有一个监听器 / 挂在 `agent/request-error` / 带 `prepend` / 命中时替换 `payload.failure` /
  **永远调 `next()`** / 非本模块的失败按**同一引用**透传"。
- **改坏验证**：`scripts/mutate-anchor-loss.mjs` 新增 7 条针对该规则的改动（5 条打判定：去掉卡上开关 / 去掉"已可重试
  则不动" / 让文案压过状态码 / 命中一切 / 改写原对象而不是复制；2 条打接线：注册不带优先级 / 不替换载荷），
  并把新门登记为第三个 gate。
- **顺手修掉本文件自己的检测器缺陷**（§5.31 记的"改坏验证自己有八个月没跑对过"的同类）：`catch` 判据原本是
  `output.includes('FAIL')`，而 `selfcheck-static.mjs` 有一条**绿灯**行写作 `ok taste-skill lint: no FAIL on the four
  round surfaces`——于是**所有**动作都被报成"caught by selfcheck"，包括这 5 条（实测 selfcheck 对它 exit=0）。
  判据改为 **exit≠0 或行首 `FAIL`**。改后 20/20 仍是 20/20，但归属变真实：9 条布线类归 selfcheck、6 条逻辑类归
  `test:params`、5 条归新的 recovery 门。**这条修订是本节的一部分，不是顺带**：一个不会红的门不是门。

**已知边界（如实记）**

- **不改写终态码**：重试耗尽后界面与日志仍显示 `PI_AI_ERROR` + 原文案——这是刻意的（见上表"如实记录"）。
- **门覆盖到本仓库的边界为止**：接线（注册形状、命中即替换、永远委派、非本模块的失败按引用透传）已被门驱动断言；
  **宿主侧的两条属性**——`prepend` 的监听器真的先于 `@deepseek-ai/dsh-llm-retry` 跑、被替换的 `payload.failure` 真的到得了
  它——本门看不到（插件是外部 bundle，CI 上没有宿主）。这两条已由**独立验证者**用真实 `cordis` + 真实 `dsh-scope` +
  真实 `dsh-llm-retry` + 本仓库真实 `lib/index.js` 做了离线动态反证（10 组，含阴性对照：解除插件后 `action=undefined`
  且无 `llm/retry`），两种注册顺序都试过，结论成立。真机第一次跑起来时应确认界面出现「等待重试模型请求」行。
- **「提升成 `RATE_LIMIT`」不等于「一定重试」**：副本**原样保留** `providerRetryAfterMs`，而内建执行器在 `mode: normal`
  且该值 `> maxDelayMs` 时**照样放弃**（独立验证者实测：`=2` vs `maxDelayMs: 1` → 无重试）。这是我们**有意不覆盖**的
  执行器既有规则：提升改的是执行器**据以判断的码**，不是替它改判断。该字段在 pi-ai 路由上根本不出现（只有官方
  `llm-deepseek` 适配器会从 `Retry-After` 头填它），所以对本功能要治的那条路径没有影响。
- **生效需要重启**：运行中的 `dsh web` 进程若早于本次构建启动，它就还在跑旧的 `lib/index.js`；本插件目录不在 HMR
  的 `root` 面内（profile 只监视 `dsh-connect-zcode` 与 `dsh-tokbook`），所以不会自动热加载。**改完要重启 `dsh web`**。
- **等待期不跨进程重启**：定时器在 `dsh-llm-retry` 进程内；这是内建重试的既有性质，本插件不改变它。
- **只对 pi-ai 家族的文本型分类缺口有效**：官方 `llm-deepseek` 路由的 code 来自 HTTP 状态映射，不靠文案，通常本就不受影响。


### 5.35 整体 UI 语言迭代（2026-10-17）：「模型配置」页改成路由账本

**动因。** 用户对设置里这个平行 tab 的判断是「相关 UI 很糟糕」。§5.32 那一轮的方向（quiet-instrument）没有错，
错在**构图**：它把每行做成「陈述段 + 六轨控件段」，而真机上控件段的凭据格装不下自己的两个词。
可复核的测量（真机，560px 内容列）：

| 观察 | 数值 |
|---|---|
| 凭据格 | **108×60**：`替换 API 密钥` / `清除密钥` 竖成两行 |
| 行高 / 文字基线 | **108px**；同一条行里有四条不同基线（名称、选择框垂直居中、`模型目录`、`删除`） |
| 每行可点控件 | 5–6 个，其中 2–4 个各占一个固定轨道 |
| 页面高 | **1248px**（宿主窗格可视 746px） |
| 唯一的描边框 | 协议 `<select>`——6 行显示 `未选择` 却占最宽轨道 |
| 破坏性动作 | `删除` 与 `模型目录` 同为 12px、相距 20px |

**方向：沿用 quiet-instrument，把构图升级为「账本」。** 没有重跑 `draw.mjs`：这一轮的判断不是「换一种艺术方向」，
而是「同一个方向落到了一个读不下去的构图上」；`docs/design-model-config-tab.md` 那段方向书仍然成立。
语言写进了 `docs/ui-language.md`（诊断、令牌、组件语法、响应式、动效、扩展规则），本节只记实现契约与证据。

**idea 句**（skill 第 4 步）：

> 在这页上，**「一条路由现在能不能服务请求」——数据层逐行回答的那个问题——成为账本的一行**：
> 行上只有三件事实（身份 / 自有模型数 / 一个答案词）与一个门；改它的一切收进行下的设置井。

**live thing** 不变，仍是页顶那句就绪陈述（`.dmc-readout`）：它按同一份 `readingOf` 数行，改 key / 加 / 删后当场重算，
零问题时说「全部可用」，一行都没有时说「尚未添加」，并且缩进到与名称同一条左脊（16px）。

**构图（实现契约）**

| 项 | 决定 |
|---|---|
| 扫描行 | 一条路由一行，静止态 **48px**；轨道 `4px 竖条 / minmax(120px,1fr) 身份 / max-content 模型格 / max-content 答案词 / 44px 门` |
| 对齐 | 答案词与门 `justify-self: end`，右沿逐行重合（静态 fixture 实测 560 / 484 两档每行右沿 spread **0**） |
| 模型格 | **事实即门**：`N 个模型` / `默认`（`title` 是长句）；点击打开模型抽屉，是行上除门外唯一可点处 |
| 答案词 | 每行一个词；ready = secondary，`missing-key` / `unreachable` = primary；竖条仍是冗余通道 |
| 门 | `管理`，`aria-expanded` + `aria-controls="dmc-well-<provider>"`；展开不改变行高以外的任何东西 |
| 设置井 | `.dmc-well`：两列网格（**64px 标签列** + 值列），三行字段（凭据 / API 协议 / 自动重试）+ 末行生命周期；无填充/无边/无圆角 |
| 凭据 | 四种形态各自说真话：会话行「由账号提供」；已配置「已配置 替换 清除」；缺密钥「未配置 填写密钥」；不接受密钥则整个字段不渲染 |
| 诊断 | `data-error="true"` 仍在行上，但**不再有 `!` 入口**：句子是井的第一行（primary 12px），写失败发生在井里，就在井里读 |
| 动效 | 只保留两个落定（readout / verdict，160ms transform）+ 控件反馈；`data-well` 行用 hover 底色标出「这一行正展开」 |
| 窄分支 | `@container (max-width:520px)` 只收紧间隙（484 档行仍 48px）；`@container (max-width:360px)` 才是拇指档：四行堆叠、控件 40px、井单列 |

**门的有意修订（不是放宽）**

1. `DMC_NEW_CLASSES` 改为本轮冻结的契约名：`dmc-manage` / `dmc-well` / `dmc-field-label` / `dmc-field-value` / `dmc-catalog`；
   `dmc-edit` 退役，新增退役名单 `dmc-edit` / `dmc-enable` / `dmc-error-toggle` / `dmc-error-text` / `dmc-catalog-count`。
2. 原来那条「控制段是固定轨道网格」的断言（读 `.dmc-edit`）换成两条：**扫描行是 grid 且共享轨道**、
   **井是两列表单且标签列固定**；另加一条「答案词与门都是 `justify-self:end`」。
3. 「诊断入口是个词、无填充无边框」的断言（读 `.dmc-error-toggle`）换成「诊断句是**句子**、无填充无边框」（读 `.dmc-diagnostic`）。
4. 禁用墨色成对表：去掉 `.dmc-catalog`（模型格在只读部署里仍可打开抽屉，不再有 disabled 态）与 `.dmc-error-toggle`，
   加入 `.dmc-danger`；`.dmc-enable` 随之退役。
5. 「行静止态无底色」的豁免名单加入 `[data-well]`（与 `[data-open]` 同性质：位置态，不是提供商状态）。
   这是本轮**唯一**的语义扩充，写在断言旁边。
6. `check-contrast.mjs`：注册表删四条旧类、加入 `dmc-manage` / `dmc-field-label` / `dmc-field-value` / `dmc-quiet` /
   `dmc-diagnostic` / `dmc-danger`；父子链把 `.dmc-well` 挂到 `.dmc-row`、字段挂到 `.dmc-well`、`.dmc-retry` 挂到 `.dmc-well`。
   实测最紧 `.dmc-route` / `.dmc-verdict` / `.dmc-field-label` / `.dmc-quiet` 浅色 **5.22:1**，两主题全过 AA。

**证据（本轮可复现的部分）**

- `npm test` 全绿：typecheck / build / test:fresh / selfcheck / contrast / 参数 / 重试 / 限流恢复 / model-config /
  model-config-copy / mutations。
- 静态 fixture（真实 sheet + 宿主真实 token 值）：`shots/page-preview-{light,dark}.png`。几何实测：
  560 档 11 行页面 **778px**（含一个展开的井；旧版无井 1248px）；484 档含两个井 **960px**；
  两档行高 **48px**、答案词右沿 spread **0**、页面 `scrollWidth-clientWidth = 0`；
  106 档无横向溢出、井 94px 内 `scrollWidth == clientWidth`。
- 生产 bundle 已重建（`lib/client.js`），宿主 `client-hmr` 会推送或刷新后生效。

**本轮真机验收的缺口（如实记，不算已解决）**

- **没有对用户的实例跑 live 验证。** 18:03 我曾用同一个 `DSH_HOME` 起第二个 `dsh web`（3081）跑
  `verify-model-config-tab.cjs`，18:07 前后用户原本的 3080 实例退出；旧实例没有包装日志，exit code 不可得，
  所以**无法证明因果**，但那次操作风险最高、时间最吻合。用户随后决定「最终效果自己检查」。
  经过与规则已写进 **`docs/agent-safety.md`**（不要结束别人的进程；不要在同一 home 上起第二个实例；对真实 GUI 默认只读）。
- **`scripts/verify-model-config-tab.cjs` 仍是 §5.32 的 DOM 断言**（`.dmc-key` / `.dmc-edit` / `.dmc-enable` / `R3` 左沿表等），
  对本轮页面会整片失败；它的 R5 还会切主题（写路径）。**本轮不重写它**：在无法 live 执行的前提下改一份 2000 行脚本
  只会得到一份没跑过的门，比诚实标注更糟。下一次有人能按 `docs/agent-safety.md` 只读执行时，再按新契约重写，
  并把 §5.32 的 R 检查映射到「行 / 井 / 门 / 诊断」四个对象上。
- **抽屉已在 §5.36 改成花名册**（一行一个模型 + 井）；本轮之前它还是「每个模型一组四输入框」，
  与账本语言不一致。
- **没有列头。** 11 行的列表里，「N 个模型」与答案词都是自解释的词，加一行列头反而多一层 chrome；
  代价是「模型格可点」只能靠 hover 与 title 发现。
- **106px 档仍是降级而非构图**（宿主 800px 面板 + 390 视口的外部约束，§5.32 已记录）。本轮保证的是无溢出、无单字孤行、目标 40px。
- **`data-usable` 过渡别名仍在**（row 与 rail 两处），与 §5.32 的同一笔欠账；删它要同时改门与测试。

**有意不做**

1. 不加重试编辑器以外的第二层表面（井就是这一页的深度上限；再深一层只是把字段藏起来）；
2. 不做行内动画编排（这是别人的设置面板里的一个分区）；
3. 不按状态排序或分组——账本保持目录顺序，需要处理的由答案词与竖条标出；
4. 不给扫描行加列头、图标、分隔线、斑马纹；安静来自 secondary 墨色与 48px 行距。

### 5.36 抽屉改成花名册（2026-10-17，接 §5.35 的同一条语言）

**动因。** §5.35 把页面的行做成了账本，抽屉却还是另一套排版：**每个模型都是四个常开输入框**，
外加「模型选项 / 删除模型」两个按钮。实测一个 7 模型的自定义目录是 **28 个输入框 + 14 个按钮**，
在 460px 面板里排成一堵墙——读者还没决定要改哪个模型，就已经被要求读完所有字段。

**决定：模型是记录，不是表单。** 抽屉沿用页面同一条语法：**一行一个模型，编辑进井**。

| 项 | 决定 |
|---|---|
| 花名册行 | 两行文字、**68px**：第一行 = 模型 id（13/600，超长省略 + `title` 保全文）+ 右端门 `编辑`；第二行 = 显示名与容量事实（12px secondary） |
| 容量事实 | `上下文 {值}` / `输出 {值}`（新增短键）；两个都没填时写 `使用默认容量`——「没有覆盖」也是一条事实，不留空行 |
| 井 | 2×2 字段（模型 ID / 显示名称 / 上下文窗口 / 最大输出 token 数）→ 推理档位 → 末行 `删除模型`；井是行的子元素，行有 `[data-well]` 底色 |
| 推理档位 | **不再有「模型选项」按钮**：档位编辑直接进井；没有档位的模型只显示 `添加档位`，不画空表头与解释段 |
| 添加模型 | 花名册末尾的一条账本行（`+ 添加模型`），不是工具条里的按钮 |
| 草稿问题 | 走页面同一条通道：行左侧 4px 红竖条 + 井顶一句原话（`.dmc-model-error`） |
| 模型发现 | **结构不变**（获取 → 勾选 → 添加所选），只跟随字阶与按钮语法 |
| 页脚 | `保存` / `恢复默认模型` 不变（提交语义未动） |

**门的修订（不是放宽）**

1. `DMC_NEW_CLASSES` 增加 `dmc-model-ref` / `dmc-model-edit` / `dmc-model-well` / `dmc-model-danger`；
   退役名单增加 `dmc-model-actions` / `dmc-model-options` / `dmc-model-options-panel` / `dmc-model-remove`。
2. `check-contrast.mjs` 注册表增加五个画字类（ref / alias / fact / edit / danger），
   父子链把字段与推理编辑器挂到 `.dmc-model-well` 上（原来挂 `.dmc-model-row`）。
3. `.dmc-btn` 增加 `text-align: left`：原生按钮居中文字，把全宽的 `添加档位` 读成了一句居中的话；
   这一条同时修好了页脚与关闭词的对齐。

**证据（静态，可复现）**

- `shots/_drawer-preview.html`（真实 `drawerStyles` + 宿主真实 token 值）：
  面板 **460px**、花名册行 **68px**、展开的井 **298px**、面板 `scrollWidth-clientWidth = 0`；
  同一份数据下旧排版是 28 个常开输入框，新排版是 **6 行 + 1 个展开的井**。
- `shots/model-config-37-drawer-dark.png` / `-38-drawer-light.png` 是两套主题的面板图（README 引用）。

**已知边界（如实记）**

- **没有 live 验收**：与 §5.35 同一笔欠账（原因见 `docs/agent-safety.md`）。抽屉的滚动、
  焦点陷阱（`Tab` 在面板内走通）与 Esc 语义都由 `ModelDrawer` 原有逻辑承担，本轮只改了渲染与样式，
  但这两条只能在真机里确认。
- **长模型 id 用省略号**：460px 面板里 `dots-studio/dots-3-note-preview` 这类 id 再加显示名放不下，
  所以 id 单行省略、`title` 保全文；这是这一轮唯一的截断（旧版把四个字段塞进两列，id 输入框同样看不全）。
- **`模型选项` 按钮退役**：推理档位现在总在井里。代价是打开井的模型会多出一块档位区；
  收益是少一层开合、少一个只在某状态出现的控件。
- **`config.model.advanced`（模型选项）** 这个键保留在文案表里但不再渲染（契约键不删；若下一个真机验收者
  认为该词应退役，按 CONTEXT.md 的废弃叫法流程处理）。

**有意不做**

1. 不把发现清单也改成「行 + 井」：候选是一次性多选，checkbox 清单就是它该有的形状；
2. 不给花名册加列头（行内第二行已经自带标签，列头只是重复）；
3. 不在行上做推理档位的预览（档位是罕见配置，行只陈述容量）。

### 5.37 抽屉改回内容列：模型目录成为行内展开区（2026-10-17，接 §5.36）

**动因。** 用户看真机后的反馈：**设置是弹窗，设置→模型配置里又是右侧抽屉**——两个弹层语法打架。
量了一下，这不是观感问题，是结构问题：

| 观察 | 实测 / 代码 |
|---|---|
| 抽屉 `position: fixed` 贴视口右缘，设置弹窗居中 | 宽屏（1587）下抽屉整个落在设置弹窗**外面**，两者之间还有一条缝；窄屏下抽屉从弹窗右缘盖进来 |
| 宿主给这一页的内容列只有 560 / 484 / 106（1920 / 768 / 390） | 抽屉固定 **460**：覆盖内容列 **82% / 95% / 全屏**，剩 100px；「保留页面上下文」名存实亡 |
| 抽屉自带 scrim + `role=dialog` + `aria-modal` + Tab 陷阱 + document 捕获 Esc | 设置弹窗本身已是 modal：屏幕上两个 scrim、两个 `aria-modal`，`aria-modal` 套在 `aria-modal` 里；`ModelDrawer.tsx` 的注释自己写着「不 capture 就一次 Esc 连设置一起关」 |
| 抽屉只能问 `@media`（fixed → 视口宽度），整页其余部分问 `@container` | 同一页两套响应式语法 |
| 关闭抽屉后焦点没有归处 | `ModelConfigPage` 没有任何 focus 恢复路径；焦点落在 `<body>`，这是可复现的键盘缺陷 |

宿主自己的官方 **模型** 页把 API 密钥、模型 ID/显示名、添加模型、获取可用模型全部摊在同一个内容列里，
没有第二层弹层。**所以「一个内容列里把模型目录摊开」不是没试过，是宿主的既有做法。**

**决定：模型目录回到账本行内，设置弹窗保持唯一一层 modal。**

- 模型格（`N 个模型` / `默认`）从「开抽屉」改成**disclosure**：`aria-expanded` + `aria-controls`，
  无 `aria-haspopup`。展开区是 provider `<li>` 的最后一个孩子，`grid-column: 2 / -1`，
  与设置井同一条左侧脊、同一份内容列、同一份页面滚动。
- 展开区**无** `position: fixed` / scrim / 阴影 / 圆角 / 入场动画 / `role=dialog` / `aria-modal` / Tab 陷阱。
- 头部只陈述目录自己（`模型目录` + 自定义/默认），**不重复**提供商名与 route id——上面那一行账本已经说了。
- 花名册、井、发现三步、保存/恢复默认原样保留（§5.36 的排版不变，只换了外壳）。
- 两个展开区的关系：**开目录会收起设置井**（收起井本来就等于取消半打的 key），
  **开设置井不收起目录**（收起目录会丢模型草稿；这是有意的例外）。
- **草稿守卫**：目录收起 / 切到另一个提供商前，若有未保存修改，展开区里出现一行
  「有未保存的模型修改。继续编辑 / 放弃修改」（4px 红竖条 + 句子 + 两个词），页面不 silently 丢稿。
  这是抽屉时代欠的债：抽屉卸载即丢稿，只是没人问过。
- **Esc 分层**（document capture，一次只关一层）：
  1. 设置井的 key 字段自己消费 Esc（capture 直接 return）；
  2. 打开着的模型井 → 关井，焦点回该行的 `编辑`；
  3. 打开着的发现清单 → 关清单，焦点回 `获取可用模型`；
  4. 未保存问题 → 回到「继续编辑」；
  5. 否则请页面收起目录（脏稿则弹回第 4 条）；目录关掉后，再按 Esc 才轮到宿主关设置面板。
- **焦点**：收起目录后焦点回模型格（`dmc-catalog-btn-<provider>`）；开目录不抢焦点，
  Tab 从模型格自然走进展开区。上一个「关抽屉后焦点落 body」的缺陷在行内形态里一并修掉。
- 类名与文件：`ModelDrawer.tsx` → `ModelCatalog.tsx`、`drawerStyles.ts` → `catalogStyles.ts`、
  `injectDrawerStyles` → `injectCatalogStyles`；`dmc-drawer*` 14 个类名全部退役，新增
  `dmc-catalog-panel/head/heading/title/status/close/body/foot/guard` 九个；
  行的开合钩子 `data-open` → `data-catalog`。展开区窄分支改用页面的 `@container`。

**门的修订（不是放宽）**

1. `selfcheck-static.mjs`：三条路径改名；`MODEL_CONFIG_TSX/SHEETS` 换新文件；
   `DMC_NEW_CLASSES` 增加展开区九个类（各有顶层规则）；`DMC_RETIRED_CLASSES` 增加 14 个 `dmc-drawer*`；
   删除「抽屉的窄分支用 @media」那条，改成**目录区必须问 @container、必须 `grid-column: 2/-1`、
   不得 fixed、不得有 scrim**；transient fill 钩子改 `[data-catalog]`；`REMOVED_MODULES` 与
   退役名扫描加入旧文件/旧前缀。
2. `check-contrast.mjs`：目录区的父子链改挂 `.dmc-row`（现在文字确实压在行的 positional fill 上），
   注册新画字类（panel / title / status / btn / btn-commit / section / notice / error / note）。
3. `test-model-config-copy.mjs`：`config.close` 退役，新增
   `config.catalog.collapse|unsaved|keepEditing|discard` 四个键（zh/en/KEYS 同序）。
4. `verify-model-config-tab.cjs`：A7 改成「打开一行设置井读到凭据」；A8 改成「展开区在 row 内、
   无 fixed/scrim/aria-modal、起于名称脊、止于行右沿」；A9/A11 的根选择器换成 `.dmc-catalog-panel`；
   A10 从「Tab 不逃出抽屉」改成「Tab 走进并离开展开区」；A12 从「Esc 只关抽屉」改成「Esc 只收起展开区」。
   截图 `model-config-39-catalog-inline-dark.png`。

**证据**

- 真机（3080，932 视口）手测：点 `7 个模型` → 展开区在行内、占满内容列；`编辑` 开井；
  Esc 依次「关井（焦点回编辑）→ 收起目录（焦点回模型格）→ 关设置」；
  改模型 ID 后点 `收起` → 出现未保存问题，`放弃修改` 收起；改 ID 后点另一个提供商的 `模型格`
  → 同一问题阻止切换，`放弃修改` 后切到新提供商；空目录提供商（xiaomi）显示默认模型句。
- 静态门：`typecheck` / `build` / `test:fresh` / `selfcheck` / `contrast` / 六个单测 / 22 个 mutation 全绿。
- 静态预览：`shots/model-config-40-catalog-inline-dark.png` / `-41-catalog-inline-light.png`（560px 单栏，
  含展开的 openrouter 目录区）；真机截图：`shots/model-config-39-catalog-inline-dark.png`（3080，932 视口）。
- 旧的 `shots/model-config-37/38-drawer-*.png` 是**历史证据**（§5.36 的 460px 抽屉），不再是当前形态。

**已知边界（如实记）**

- **页面更长**：一个 7 模型的目录展开后约 +600px，页面滚动变长；换来的是零弹层与 100% 内容列宽。
  一次只开一个提供商的目录（页面只有一份 `catalog` 状态），换提供商时直接切。
- **A8–A12 是改写，不是本轮跑过的门**：真机手测覆盖了同样的断言，但
  `verify-model-config-tab.cjs` 需要单独起验证实例（见 `docs/agent-safety.md`），本轮没有跑。
- **设置井与目录可同时打开**（见上「有意的例外」），因此同一行可能很长；不强制互斥是为了不丢草稿。

**有意不做**

1. 不把设置外壳也改成抽屉/整页：外壳是宿主的，插件只拥有 section；就算能改，也只是把一种两层换成另一种两层。
2. 不做「抽屉贴回弹窗内」的过渡版本：420/560 仍盖 75%，仍是第二个 modal，返工不值得。
3. 不把发现清单搬进弹窗：那正是本轮要消灭的第二层。

> 决策记录：[ADR 0004](docs/adr/0004-inline-catalog-region.md)（取代 Q27 的右侧抽屉形态）。

## 8.7 §5.18 实测记录：锚点消失时到底发生了什么

环境：dsh 0.2.0-rc.2，profile `web`，`dmp-verify` 会话接在 http://127.0.0.1:3080。
所有探针脚本走 `playwright-cli -s=dmp-verify --raw run-code --filename=./scripts/xxx.cjs`。

**⚠ 一个必须写下来的坑：改完 `src/` 之后 `location.reload()` 是不够的。**
Loader 用自己算出来的 `rev` 键给 client 模块，浏览器可以在同一个 URL 下把旧 body 返回来。
症状是"服务出去的文本是新的、跑起来的模块是旧的"——**和一个没生效的修复长得一模一样**。
第一次验收就是死在这里：页面上 `hasFix: true`，但门外的行为仍是旧行为。正确的做法是先
`Network.setCacheDisabled`，再 reload，并在记录任何结论**之前**断言 `bundleIsNew`
（`_accept-anchor-loss.cjs` 开头就是这条断言）。

### 复现（改动前，`_anchor-loss-probe.cjs`）

| | 弹窗位置 | seat 盒子 |
|---|---|---|
| 打开参数面板 | `(265, 786.5)` `280×460` | 齿轮 `(733, 1038.5)` `28×28` |
| 卡片出现后 | **`(12, 12)`** `280×460` | `0×0`，`getClientRects().length = 0`，`isConnected = true` |
| 之后再滚动 | **不变**（`12, 12`） | 同上 |

`ResizeObserver` 在座位根上**触发了一次**，`contentRect` 报 `0×0`——信号是有的，只是没人接。
`isConnected` 全程为 `true`（隐藏不等于卸载），所以"是否连接"不能当判据。

### 为什么观察根而不是锚点（`_squeeze-probe.cjs`）

把输入条 `max-width` 从 1280 一路压到 0，逐个记录 `root / trigger / chip / gear`：

| | `clientRects` | 宽×高 | `isConnected` |
|---|---|---|---|
| `root` | 1 | `56×28`（到 0 宽仍如此） | true |
| `trigger` | 1 | `12×28` | true |
| `chip` | 1 | `12×28` | true |
| `gear` | 1 | `28×28` | true |

**窄布局永远不会把座位清零**，`.dmp-root` 的 flex 地板保住了它。零盒子这条判据因此不会在窄窗口上
误报——用户说的窄窗口那一条由同一条规则覆盖，这跟当时说的一致。

### 验收（改动后，`_accept-anchor-loss.cjs`）

三个弹窗各在自己的锚点上开一次，然后让 Host 自己把输入条隐藏：

| 打开的 | 打开时 | 卡片出现后 |
|---|---|---|
| 参数面板 | `(265, 787)` | 面板数 `0` |
| 模型列表 | `(305, 717)` | 面板数 `0` |
| 提供商菜单 | `(345, 646)` | 面板数 `0` |

反向的另一半同样重要——一条会在正常排版压力下误关的规则，比漂移本身更糟：

| `max-width` | 座位宽 | 面板 |
|---|---|---|
| 480 | 237 | 1（`265, 406`） |
| 320 | 210 | 1 |
| 160 | 107 | 1 |
| 40 | 56 | 1 |
| 恢复 + 滚动 300px | 237 | 1 |
| Escape 之后 | 237 | 0 |

## 8.8 §5.19 实测记录：内置目录的模型，能力真的读到了（2026-10-04）

环境：dsh 0.2.0-rc.2，profile `web`，真实浏览器（playwright-cli 会话 `verify`），
`dsh web` 的带 token 地址；脚本 `scripts/_accept-capabilities.cjs`（只读：开菜单、开面板、读、截图，
不选模型、不拨开关、不写设置）。

**先断言产物是新的**：脚本先 `Network.setCacheDisabled` 再 reload，然后从
`performance.getEntriesByType('resource')` 里找出插件自己的 client 模块并 `fetch` 它的正文，
要求正文含 `opencodeGoModels` 与 `dsh-opencode-go` 才继续（§8.7 的教训）。
本次 `rev=3042db879ec5`，正文 10,977,043 字节（整个 plugins 组合包）。

**行内（`.dmp-row[aria-checked="true"]`，即当前会话正在用的那条内置目录路由）**：

```
DeepSeek V4.1 Flash，文字输入、图片输入、思考强度 High、上下文窗口 1M
```

四枚徽章齐全——改造前这条路由只有推理徽章（模态与窗口整条不出现）。换成同族的
`GLM-5.3-Flash` 再跑一次：`文字输入、图片输入、思考强度 Max、上下文窗口 1M`。
两次都是**不可寻址**的路由（状态行原文见下），所以这两行的事实只可能来自适配器目录：
`models.dev` 对 `opencode-go` 的该模型写的是 `modalities.input = [text, image, video, pdf]`、
`limit.context = 1000000`（本机 `~/.dsh/cache/dsh-opencode-go/models.dev.api.json` 可直接核对）。

**面板（截图 `shots/accept-capabilities-panel.png`）**：

| 面 | 实测 |
|---|---|
| 状态行 | 这个模型来自适配器内置目录，没有可编辑的声明，只能查看。 |
| 输入类型 | 文字 / 图片**两个开关都亮**且都 `disabled` |
| 输入提示 | 适配器内置目录公布：文字、图片 |
| 上下文窗口 | 输入框**空**、placeholder `1M`、`disabled` |
| 容量提示 | 适配器内置目录公布：1M（不可编辑） |
| 思考强度 | Low / High / Max，当前档有勾 |

`placement` 读到 `{x:787, y:20, width:280, height:402, visibility:'visible'}`——卡片真的画在页面上
（不是测量态隐藏）。九条断言（`claims`）全部 true。

**这一轮被实测抓到的两件事**（都不是产品缺陷，是验收脚本自己的坑，写下来免得下一轮重踩）：

1. **按名字找行会找错。** 第一版 `rows.find(r => r.name.includes('DeepSeek V4.1 Flash'))` 命中的是
   `commandcode` 那条**已声明**的路由（它的 `contextWindow`/`input` 就写在 profile 里），断言全绿而
   真正要验的内置目录路由一根毛都没读到。改成只读 `aria-checked="true"` 的那一行后，
   `sameNameRows` 顺带报出"有三个同名模型"——这正是当初会踩坑的原因。
2. **弹窗会在两次读取之间关掉。** 面板 DOM 读完、截图之前，卡片已经不在 DOM 里了：§5.18 的判据是
   "座位根不再占版面就关掉三个弹窗"，而 composer 在这个会话里正好重渲染过一次。截图因此拍到了
   **没有面板的界面**（第一版 54KB，第二版 73KB）。改法是**先截图再细读**，并把 `placement`
   一起读出来当"确实画出来了"的证据。

**没有构造的分支**（本次仍然没有）：`settings/conflict` 自动重试、Host 拒绝写入、部署没挂设置服务/
读取失败；以及**适配器什么都没公布**时的那个"连开关都不渲染"的分支——本机所有内置目录路由都能被
`opencodeGoModels/read` 答上，所以它只有单元门覆盖。另外 `declared === true` 的守卫在真实 Host 上
表现为"这些路由不出徽章"（`commandcode` / `staryears` 等），**没有去观测它是否真的没发那次请求**
（观测手段得抓 host 侧出网，超出浏览器验收的范围）。

**第二条通路（`llm/discoverModels`）也在真实 Host 上验过**，用的是一个**配置里没有声明条目**的
provider：`xiaomi` 在 profile 里只有 `apiKeyEnv`，没有 `models` 列表，所以 pi-ai 按它**自带**的
xiaomi 目录解析模型，路由不可寻址——那些行上的事实只可能来自 `llm/discoverModels`。搜索 `MiMo`
拿到 13 行，全部带窗口徽章，其中：

```
MiMo V2.5       文字输入、图片输入、未声明思考档位、上下文窗口 1M
MiMo V2.5 Pro   文字输入、不支持图片输入、未声明思考档位、上下文窗口 1M
MiMo V2.6 Pro   文字输入、不支持图片输入、未声明思考档位、上下文窗口 1M
```

两条同族模型的**图片支持不同**（一个开一个关），这正是"读适配器目录"与"套一个默认"的区别：
默认会给出一样的结果，而这里是目录里每模型自己的取值。另外 `xiaomi` 是 pi-ai **自带**的 provider
（`catalogModels('xiaomi')` 非空），所以这次调用走的是安装目录、**没有出网**——与 §2.2 表格里那条
"命中安装目录就直接回答"一致。

**顺带验到的一条"不猜"**：同一批数据里有一行 `GLM-5.1` 只有**两枚**徽章
（`思考强度 Default、上下文窗口 203K`），没有文字/图片徽章。原因是适配器目录对这个模型公布了
窗口、**没有公布模态**（models.dev 的该条目没有可识别的 `modalities`）。徽章条照实只说窗口，
而不是把"没公布"画成"不支持"——这正是本插件一直声称的规则，这次是真实数据自己撞出来的样本。

### 那个吃掉我一次的实现错误

第一版第二次确认写的是 `requestAnimationFrame(confirm)`。挂上探针后看到的序列是：

```
{ frames: 0, gone: true }     ← observer 报了丢失
{ stage: 'scheduled', … }     ← 复查排上了队
（600ms 后）                     ← 复查还没跑
```

**`display: none` 的子树不会被浏览器 servicing 帧回调**，要等的帧永远不来，于是
"第二次确认"永远不发生，弹窗永远不关：原缺陷原样保留，而门是绿的（门断言的是"有确认"，
不是"确认会真的发生"）。改用 `setTimeout(16)`（任务队列，照常被 servicing）之后一次通过。
现在静态门直接断言 `confirm` 函数体里**不许出现** `requestAnimationFrame`——它就是那条缺陷本身。

### 一次事故：本目录没有版本控制

清理临时探针脚本时，我把 `scripts/` 下所有 `_` 开头的文件都删了，**连同五个既有的浏览器验收脚本
一起删掉**（`_verify-settings.cjs`、`_verify-fixes.cjs`、`_icons-probe.cjs`、`_badges-probe.cjs`、
`_width-sweep.cjs`）。它们不是本轮产物，是前几轮的资产。没有 `.git`、没有回收站、桌面上没有副本，
**不可恢复**。

代价：README 和本文里引用它们的那些行现在指向不存在的文件；`scripts/test-params.mjs` 头注释里
"browser acceptance 覆盖 live Host 那一半"也断了链。DESIGN §5.9、§5.11、§5.13 里记着它们各自要
验证的判据（面板写入位置与失败原话、筛选持久化、徽章线重与 1x/3x 复核、名字分到多少宽度），
**按那些判据重写是有据可依的**，但那是将来的活。

教训写在这里而不是只留在对话里：**这个目录没有版本控制，`scripts/` 里的东西也没有别处副本。**
清临时文件前先列出"哪些是本轮产物"，只删那一份。README 的结构清单里现在留着一行
"没有版本控制、被误删的五个脚本是待重写清单"，免得下一轮读到那些引用时以为文件还在。





## 8.9 §5.21 实测记录：菜单里真的没有那两行了（2026-10-04）

§5.21 删掉的两行，静态门只能证明**源码里**没有它们，单元测试只能证明**纯函数**算得对。
两者都看不到座位实际画出来的东西，也看不到"唯一出口"能不能真的点。所以补一次真机验收：
`scripts/_accept-provider-menu.cjs`，跑在 http://127.0.0.1:3080 的真实 GUI 上。

**15 条断言全绿**（**§5.22 把脚本扩到 20 条并复跑，见 §8.10**），四条关键证据：

| 断言 | 实测 |
|---|---|
| chip 未筛选时说出「全部」 | `label === "全部"`，`aria-label="模型提供商，当前 全部"` —— **⚠ 已被 §5.22 取代**：现在未筛选时 chip 写当前模型的 provider，`aria-label` 换成 `provider.chipAriaModel`；「全部」只在**还没选中模型**时出现。同一天晚些时候的复跑见 §8.10 |
| 菜单里没有「全部」行 | 15 行全是真 provider；首行是「DeepSeek 账号 2」 |
| 菜单里没有「最近使用」行 | 同上，`hasRecentRow: false` |
| 选一个 provider 能窄化 | chip → 「DeepSeek 账号」，`data-filtered` 置位，模型行 95 → 2 |
| **卡内「显示全部」能真的退出** | 点击后 chip 回「全部」、`data-filtered` 消失、提示条消失、**模型行恢复 95**（§5.22 之后：chip 回到**当前模型的 provider**，不是「全部」） |

最后一条是这次改动**唯一有风险的后果**：菜单里没有「全部」行之后，这条一行按钮成了唯一退路，
而筛选是**按会话持久化**的——它若失效，用户刷新页面也还在筛选里。所以验收是**点它**，
不是断言它在。`shots/provider-{dark,light}.png` 已重拍：两张都从「DeepSeek 账号」开始，
旧图里那两行不再出现（浅色图必须走应用自己的「设置 → 外观」，脚本里改 `data-theme` 无效，
因为页面带 `data-ds-theme-source`，应用会从 Host 偏好重新推导调色板并覆盖掉属性）。

### 三个"看起来像产品缺陷、其实是脚本自己"的坑

都值得写下来，因为**每一个的失败形态都和真缺陷一模一样**：

1. **首次运行报 `hintPresent: false, clearPresent: false`**——看着像"唯一出口没了"。真因是脚本
   在**提供商菜单**刚关闭时就去读提示条，而提示条住在**模型卡**里。选完 provider 会
   `closeProviderMenu(true)` 关掉整张菜单，得重新打开模型列表才看得到它。
2. **第二次运行 `page.click('.dmp-trigger')` 连续超时**——真因是 `closeProviderMenu(true)` 会把焦点
   还给 chip，同一帧里派发的点击被焦点恢复吞掉；而且 `.dmp-row` 这个选择器**同时**匹配提供商菜单
   和模型列表的行，"等一个 `.dmp-row` 出现"根本不能证明卡片开了。改成**等谓词**
   （`aria-expanded === 'true'` 且 `.dmp-menu` 存在）之后稳定通过——顺带让"卡片没开"变成一条
   **finding** 而不是一次 timeout。
3. **唯一一条 `false` 断言**：`picking a provider narrows the chip` 查的是 chip 文本里有「仅显示」，
   而 chip 显示的是 provider 名字；「仅显示」是**提示条和 aria-label** 的措辞。断言写错了地方，
   已改成与菜单行名比对。

教训与 §5.21 的门同源：**断言要落在真正的命题上**。脚本断言错了地方，报出来的东西就和产品坏了
无法区分——这正是它值得记一笔的原因。

## 8.10 §5.22 实测记录：chip 真的跟着模型走（2026-10-04）

同一台机器、同一个 `dsh web`（http://127.0.0.1:3080，profile `web`）、同一个会话
（`session-824d955b-…`，当前模型 `DeepSeek 账号 / DeepSeek-V41-Flash`）。
`scripts/_accept-provider-menu.cjs` 按 §5.22 扩到 **20 条断言，全绿**。

**先证产物是新的**（§8.7 的教训）：脚本先 `Network.setCacheDisabled` 再 reload，然后 fetch 那个
client 模块正文，要求它含 `provider.chipAriaModel`、含 `provider.all` / `provider.showAll`，且
**不含** `activeProviderLabel`（本次改掉的旧符号）与任何 `recent*` 符号。实测
`rev=94d9f06087a1`、正文 10,959,400 字节，四项都对——否则脚本第一步就 `return {ok:false, step:'bundle-freshness'}`。

| 断言（`claims` 里的原文） | 实测 |
|---|---|
| `the unfiltered chip names a provider, not 「全部」` | `label === "DeepSeek 账号"` |
| `the chip agrees with the row the menu marks 「当前会话」` | 菜单里带该标的**恰好一行**，正是 `DeepSeek 账号`——两者同源 `state.current.provider` |
| `the chip is unmarked while nothing is filtered` | `data-filtered` 缺席（`hasAttribute → false`） |
| `the chip says the list is not filtered` | `aria-label = "模型提供商，当前模型所在 DeepSeek 账号，模型列表未筛选"` |
| `no 「全部」 row` / `no 「最近使用」 row` / `the menu lists only named providers` | 15 行真 provider、0 行打勾、0 行失败、搜索框在 |
| `picking a provider narrows the chip` | 故意挑与 chip 不同的那一行（`DeepSeek`）→ chip 变 `DeepSeek`、`data-filtered` 置位、提示条 `仅显示 DeepSeek` |
| `the clear button returns the chip to the model's provider` | 点「显示全部」→ chip 回 `DeepSeek 账号`（**不是「全部」**）、`data-filtered` 消失、提示条消失、模型行恢复 95 |
| `the cleared chip is a provider, not 「全部」` | 同上（这一条专门钉住"未筛选 ≠ 全部"这个新语义） |

**截图重拍**：`shots/composer-with-gear.png`（座位行 `DeepSeek 账号 · DeepSeek-V41-Flash · ⚙`，380×60）
与 `shots/provider-dark.png`（提供商菜单 + 它下方那颗 chip，255×444）。

- dark 图这次**裁成"菜单卡 + 座位行"的局部**，不是构图偏好：菜单面是**半透明**的
  （`.material` 画 `rgba(67,69,74,0.45)`，实测），整页截图会把身后的对话文字**透过卡片**带进
  一张要进公开仓库的图里。拍之前把"与卡片重叠、又不属于菜单/座位两块"的非保留子树临时
  `visibility: hidden`（保留集合 = 菜单子树 + 座位祖先 + 座位后代），拍完立刻还原——只动这个
  一次性浏览器页面，不写 Host、不选模型。
- 浅意图（`provider-light.png`）本来就只是菜单卡的局部、**看不到 chip**，所以这次**没有去翻用户的
  主题偏好**（§8.9 记过：浅色必须走应用自己的「设置 → 外观」，改 `data-theme` 无效）。
- ⚠ **playwright-cli 的 daemon 有它自己的 cwd**：本机这个 `verify` daemon 的 cwd 是**改名前的**
  `C:\Users\28529\Desktop\dsh-model-picker`（目录只剩 `.playwright-cli` 和 `shots`），所以脚本里
  `./shots/accept-*.png` 这类相对路径**不会落进仓库**。这次给截图脚本传的是绝对路径；要让
  `_accept-*.cjs` 里的相对路径按注释那样生效，得让 daemon 从本包目录启动。这条纯属环境事实，
  与产品行为无关，但下一轮找不到图时会以为脚本坏了。

## 8.11 §5.25 实测记录：两栏真的成立吗（2026-10-15）

环境：`dsh web`（http://127.0.0.1:3080，profile `web`，PID 32320，2026-10-14 12:31 启动），
playwright-cli `verify` 会话，视口 1440×900（窄屏另测 500×820）。当前模型
`opencode-go / DeepSeek V4.1 Flash · Default`，目录 64 个模型 / 13 行左栏（`全部` + 12 provider）。

**先证产物是新的**：脚本第 0 步 `Network.setCacheDisabled` → reload → fetch client 模块正文，要求含
`dmp-rail` / `provider.elsewhere` / `provider.chipTip`，且**不含** `provider.menuAria` /
`provider.chipAriaModel` / `dmp-provider-menu` / `dmp-provider-session` / `provider.sessionHere`。
实测 `rev=3484a7e55cdb`、正文 2,556,855 字节，五项都对。**26 条断言全绿**，逐条证据见下表
（`scripts/_accept-provider-rail.cjs`）。

| 断言（`claims` 里的原文） | 实测 |
|---|---|
| `the rail is the LEFT pane` | 卡片 `x=628 w=520`、左栏 `x=632 w=181`、模型列 `x=813 w=331` |
| `the model pane keeps the 320px the fact grid needs` | 331 ≥ 320；模型名列逐行 **175**、徽章条 **113** |
| `the rail lists scopes, unfiltered first` / `every provider row states a count…` | 13 行 = `全部 64` + 12 provider；计数合计 = 64 = `全部` 的计数 |
| `the rail has exactly one tab stop` / `exactly one row reports the scope` | `tabindex="0"` 恰好 1 行；`aria-selected` 恰好 1 行 |
| `the chip is a span, not a control` | `tagName === 'SPAN'`、无 `aria-haspopup`/`aria-expanded`、无 `tabindex` |
| `the chip carries no filtered marker` | `hasAttribute('data-filtered') === false` |
| `the chip titles itself as the model's provider` | `title = 当前模型所在提供商：opencode-go` |
| `picking a provider scopes the list to exactly its count` | 点 `DeepSeek 账号`（计数 2）→ 模型行 **2** |
| `picking a provider keeps the card open` / `…hands focus to the search box` | `.dmp-menu` 仍在；`activeElement` 是 `INPUT`（搜索框） |
| `the scoped list is one provider's group` | 分组头只剩 `["DeepSeek 账号"]` |
| `the scope does NOT change the chip` | chip 仍 `opencode-go`、仍无 `data-filtered` |
| `the unfiltered row restores every provider` | 点第 0 行 → 64 行、该行 `aria-selected` |
| `ArrowLeft…` / `ArrowDown moves within the rail` / `ArrowRight returns to the search box` | 焦点依次 `全部` → `DeepSeek 账号` → 搜索框 |
| `a query hidden by the scope is counted` | 范围 `DeepSeek 账号` 内查 `dots` → 0 行，条带 `其他提供商还有 2 个匹配 显示全部` |
| `that way back restores every provider` | 点它 → `全部` 选中、2 行、条带消失 |
| `narrow: the rail lays out ABOVE the list` | 500px 视口：卡片 `w=468`，左栏 `y=56 h=35 w=460`，模型列 `y=91 w=460` |

**另测（分开跑，因为它是另一个表面的回归）**：`scripts/_verify-settings-layout.cjs` 断言参数面板仍是
"头在上、正文在下"的**列**——面板 280×324，`body.top ≥ head.bottom`。这道守卫正是 §5.25 把
`.dmp-menu`（共用材质）与 `.dmp-card`（两栏）分开的原因，而 `_accept-provider-rail.cjs` 看不到它
（它只拍模型卡）。

**§5.18 复跑**：`_accept-anchor-loss.cjs` 由三表面改为两表面后仍全绿——设置面板与模型卡分别在
`[data-composer-card]` 被 `display: none` 后关闭（`panel: 0`），而把座位宽度压到 480/320/160/40 再滚动
都不关（`survived: true`）。

**截图重拍**（daemon 的 cwd 这次就是本包目录，相对路径 `./shots/…` 落进了仓库，§8.10 那条环境告警
在本轮不成立）：`shots/accept-rail-wide.png`、`accept-rail-scoped.png`、`accept-rail-narrow.png`、
`accept-rail-search-elsewhere.png`、`accept-settings-column.png`，以及 README 用的
`row-badges-{dark,light}.png`、`provider-{dark,light}.png`、`rail-stacked-{dark,light}.png`、
`composer-with-gear.png`。浅色仍是脚本剥掉 `data-ds-dark-theme` 后拍（§8.10 的结论：走界面切换在
无头会话里不成立）；窄屏那张额外在 resize **之后**再剥一次——宿主会在 resize 时按持久化偏好把深色
属性加回来，不补这一下，浅色套里会混进一张深色图。§5.26 之后这三张 README 图的含义见 §8.12。

## 8.12 §5.26 实测记录：身份并进触发器、范围每次重来（2026-10-15）

同一台机器、同一个 `dsh web`（http://127.0.0.1:3080，profile `web`）、同一个 `verify` 会话，
视口 1440×900。`scripts/_accept-provider-rail.cjs` 按 §5.26 扩到 **37 条断言，全绿**
（`rev=6b4bfe386156`）。第 0 步仍是产物新鲜度断言，这次要求 bundle 里**有** `dmp-rail` /
`provider.elsewhere` / `dmp-trigger-label` 与旧键前缀，且**不含** `dmp-provider-label` /
`dmp-provider-icon` / `provider.chipTip` / `readProviderFilter` / `rememberProviderFilter`。

| 断言（`claims` 里的原文） | 实测 |
|---|---|
| `the trigger label is provider/model` | `opencode-go/DeepSeek V4.1 Flash` |
| `the label's provider half is a provider this catalog lists` | 前缀 `opencode-go` 正是左栏一行 |
| `the trigger carries the effort after the identity` | 独立分段 `.dmp-trigger-effort` = `Default` |
| `the trigger names the provider in its accessible name` | `选择模型，当前 opencode-go/DeepSeek V4.1 Flash，推理等级 Default` |
| `no separate provider chip sits beside the trigger` | `document.querySelector('.dmp-provider') === null` |
| `a fresh open is scoped to the conversation's provider` | 左栏选中行 = `opencode-go` |
| `a fresh open shows that provider's models, not the whole catalog` | 右栏 6 行 = 该行计数；分组头只有一个 |
| `the session's provider is marked as current on its own row` | `aria-current` 恰好一行，且就是 `opencode-go` |
| `picking a provider scopes the list to exactly its count` | 点 `DeepSeek 账号`（2）→ 2 行 |
| `picking a provider does not change the trigger` | 标签仍 `opencode-go/DeepSeek V4.1 Flash` |
| `the card closed and reopened` / `re-opening forgets the picked provider` | 关闭成功、重开成功；选中行回到 `opencode-go` |
| `re-opening shows the conversation's provider again` | 6 行（= 首次打开的 6 行） |
| `「全部」 shows every provider at once` / `「全部」 marks the unfiltered row` | 64 行、分组 > 1、选中行是 `全部` |
| `the scope returns to the conversation's provider after 「全部」 too` | 重开后选中行 `opencode-go`、6 行 |
| `nothing about the scope is stored` | `localStorage` 里 `dsh-model-picker.provider*` 键：打开后 `[]`、重开后 `[]` |
| `the rail is the LEFT pane` / `the model pane keeps the 320px…` | 同 §8.11（卡片 520、模型列 331、名列 175） |
| 键盘三条、越界命中条、窄屏三条 | 同 §8.11，全绿 |

**同时复跑**：`_accept-anchor-loss.cjs`（两表面仍随 `[data-composer-card]` 消失而关闭，
座位压到 480/320/160/40 都不误关）与 `_verify-settings-layout.cjs`（面板 280×460，仍是一列）。
`test-params.mjs` 的 `retired scope` 套件独立覆盖清理逻辑（含"8 个键一次清空"这条：边遍历边删会
跳一个，实现是先收集后删除）。

**截图重拍**：`shots/composer-with-gear.png`（312×28，`opencode-go/DeepSeek V4.1 Flash · Default ⌄ ⚙`）；
README 的 `row-badges-{dark,light}.png` 改为"打开时的默认范围（会话 provider）"、
`provider-{dark,light}.png` 改为"切到别的提供商"；接受验收的
`accept-rail-wide.png`（首次打开即 `opencode-go` 6 行）、`accept-rail-scoped.png`、
`accept-rail-narrow.png`、`accept-rail-search-elsewhere.png` 同步重拍。

## 8.13 §5.32 实测记录：重构后的「模型配置」页到底量出了什么（2026-10-16/17）

**方法**：`scripts/verify-model-config-tab.cjs` 驱动真实 GUI（`http://127.0.0.1:3080`，Headless Chromium，
1920×1080，**DPR = 1**），`lib/` 由 Lead 从冻结的 `src/` 重建。**27/27 PASS，exit 0**；
`DMC_VERIFY_MUTATE=1` 的真机改坏验证 **16/16 变红**；静态门的改坏验证 **23/23 变红**（在整树临时拷贝上做，
`src/` 一字未动）。参考部署有 **11 个已添加提供商**。

**几何与对齐（这一轮的核心主张）**

| 量 | 值 |
|---|---|
| `.dmc-page` clientWidth / DPR | **560** / **1** |
| `.dmc-name` 最小宽 / 最大高 | **493px** / **22px** |
| `.dmc-verdict` | **11/11 行**，右沿全 **1332.0**（spread **0**），全在视口内 |
| 每行 1px 边控件 | **[1] × 11**（重构前 2–4） |
| 行 rest 态底色 | **0 行** |
| 同类控件左沿（前两位） | `.dmc-key [788,788]` / `.dmc-protocol [976,976]` / `.dmc-catalog [1160,1160]` / `.dmc-enable [1284,1284]` —— **每类 spread 0** |
| 五档视口 1920/1440/1024/768/390 横向溢出 | **全 0** |
| `@container` 三档 | 106 → tracks `4px 94px`（确实换挡）；484/560 → `4px 493px 39px` |

**协议标签的文本适配（juror 报的截断，逐档收口）**

| 容器 | select clientWidth | 最小 headroom | 结论 |
|---|---|---|---|
| 560 | 174 | **+28.01px** | 不截断（11/11） |
| 484 | 470（**独占整行**） | **+324.01px** | 不截断（11/11） |
| 106 | 92 | `OpenAI Chat Completions` **−53.99px** | **6/11 截断（允许）**，但 `scrollWidth − clientWidth = 0`、`overflowers = []`、`pageOverflow = 0` |

判据写死为「560/484 必须不截断；106 允许截断但绝不允许溢出」，其中后一半由改坏 `M-R11b`
（只给窄档加 `min-width: 300px`）证明——它只让 106 档溢出，证明的正是这半条。

**证据图（`shots/model-config-31/32-redesign-*.png`）**
两张都是 **560×928** 的元素图（深/浅各一，67111 / 67169 B）。**在 1920×1500 视口下拍**——
1080 视口里宿主窗格只有 746px，页尾动作会落在画面之外（上一版正是如此，导致视觉 juror 报「页面的 accent 不可见」）。
现在 R5 把 **`addPainted === true`** 写成断言（截图前要求 `.dmc-add` 在自己的中心点命中自己），
**缺 accent 的证据图不可能再产出**。逐张读图确认：11 行全在画面内、页尾「添加模型提供商」可见、
**左缘 4px 蓝条在两主题都清晰可见**、20px 就绪陈述在顶、`清除密钥` 与右端 `删除` 不再同名、
protocol 完整显示 `OpenAI Chat Completions`、无竖条、无铺底。

**视觉复核（三 juror × 二轮，`opencode-go/glm-5.3-flash`）**
第一轮：页 7.07 / 抽屉 5.93 / 窄容器 6.64；第二轮：页 6.85 / 窄 6.45；
终局证据图单判：**design 7.5 · usability 7.5 · creativity 7 · content 7.5 → 7.4**，**未触发任何 cap**。
被读数推动的真修：协议标签截断、一行两个「删除」、编辑行 ragged（对照实测 x 集合）、
段标题被读成 eyebrow、页尾 accent 被读成 thin rule、acc 证据图缺页尾。
被真机数字**驳倒**因而没有照做的读数：内容宽「1090/1224px」（DPR=2 误读）、表头错位 40px（实测 0px）、
控件 x 逐行跳动（抽屉遮住半页的观感，实测 spread 0）、右下「幽灵字符串」（宿主输入条透过半透明 scrim）、
106px「断词」（以拉丁词标准判中文换行）。

**残留（不美化）**
- 宿主窗格裁剪：面板 800×800、滚动区 1080 视口下 `clientHeight 746 / scrollHeight 952`，页面高 928，
  最后一行 top **998** → rest 时点不到，下滚 **206px** 可达（滚到底后换成第一行被推出）。R13 的 `offPane = 13/75` 即这批被宿主裁掉的点位；**本页 `pageOverflow = 0`**。
- 本轮 11 行**全是 `ready`**：`missing-key` / `unreachable` 的真机实例为零，这两态的竖条与「无铺底」
  由静态门 + 改坏验证保证；R1 的真机只走过「0 问题」形态，另两种形态由 `judgeR1` 的分支按构造保证。
- R9 的禁用墨来自「隐藏克隆 + 过渡稳定后读色」，本轮无真机禁用实例。
- 106px 仍是**降级**而非构图（协议标签必然截断）；根因是宿主面板宽度，不是本页。
- 2 条 lint WARN 保留并每轮打印（真表单字段边 / 注释里的 em dash）。
