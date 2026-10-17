# 可行性报告：改造 / 替换 DSH 设置里的「模型」tab

- 目标界面：设置面板 → **模型** tab（`Settings → 模型`）
- 约束（你已确认）：**只做插件 / 主题覆盖，绝不改 DSH 安装目录**
- 状态：**待你确认后执行**（本文件只是分析，没有改任何代码）

---

## 1. 结论先行

| 路线 | 可行性 | 工作量 | 风险 | 建议 |
|---|---|---|---|---|
| **A. 用官方扩展位换皮**（`settings.models.*` 三个 seat） | ✅ 完全可行，官方钦定 | 小（1～3 天） | 极低 | **推荐先做** |
| **A+. 用 CSS 令牌做全局视觉微调** | ✅ 可行，但受限于令牌覆盖度 | 小～中 | 低 | 与 A 并行 |
| **B. 整体替换这个 tab**（`settings.section` / id=`models` 遮蔽） | ✅ 机制上可行 | 大（1～3 周） | 中高 | 想清楚再上 |

**关键发现：你的诉求有两种强度，而 DSH 对这两种强度都留了口子。**
「改样式」不必整体替换；「整体替换」也确实是官方支持的机制，不是 hack。

---

## 2. 事实依据（都来自本机实际安装的代码，非推测）

### 2.1 谁在渲染这个 tab

设置面板里的「模型」页由独立包渲染：

- 包：`@deepseek-ai/dsh-client-ui-settings-models@0.2.1-alpha.4`
- 位置：`C:\Users\28529\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-client-ui-settings-models\`
- 它在 `apply()` 里注册设置页（`lib/client.js:4103`）：

```js
ctx.slots.inject("settings.section", () => ctx.slots.register({
  name: "settings.section",
  id: "models",          // ← 这一页的稳定 cell id
  order: 10,
  label: () => t("nav"),
  inject: injected,
  children: { "settings.models.provider-card": {...}, "settings.models.footer": {...} }
}, ModelsSection));
```

**这个包同时发布了 `lib/types/**/*.d.ts` 和 `./src/*` 导出**，所以契约是公开可读的，不用猜。

### 2.2 页面自己声明了三个「官方扩展位」

来自 `lib/types/client/slot-contract.d.ts`，原文明确写着这是给**本仓库之外的插件**用的：

> "Models-page extension slots — the two seats through which a plugin distributed
> outside this repository adds UI to the Models settings section **without editing it**."

| Seat | kind | 粒度 | 你能拿到什么 |
|---|---|---|---|
| `settings.models.provider-card` | `keyed`（key = `settingsNs`） | **每个 provider 卡片一个** | `provider`（route id / 显示名 / settings 地址 / 活跃状态）、`configured`、`keyConfigured` |
| `settings.models.sign-in` | `single` | 凭据编辑器前 | `complete()`、`useApiKey()` |
| `settings.models.footer` | `list` | provider 行与添加控件**之后** | 无（纯占位区） |

你在当前这个仓库里**已经在用第一个了**：`src/client/RetryCard.tsx` 就是挂在
`settings.models.provider-card` 上的（`RetryCard.tsx:480`）。也就是说，
「往设置 → 模型 页里加东西」这条路你既走过、也跑通了。

### 2.3 「整体替换」的机制：list slot 按 id 遮蔽

来自 `@deepseek-ai/dsh-client-ui-slots/lib/index.js`：

```js
// register(): 同一个 id + 同一个 priority 才算冲突
case "list": {
  const occupant = rec.entries.find(e =>
    e.options.id === options.id && (e.options.priority ?? 0) === priority);
  if (occupant) throw new Error(`... already has an entry with id "..." ...`);
}

// entriesOfSlot(): 每个 id 一个 cell，最低 priority 胜出
// "list: one cell per `id` (winners keep ledger sequence)"
```

**这才是决定性的一条**：`kind: 'list'` 的 slot 是**按 `id` 分格**遮蔽的，
不是整个 slot 只能有一个。所以：

> 用 `priority: -10` 注册 `settings.section` + `id: 'models'`，
> 就能**遮蔽**官方那一页，而官方注册依然存活、只是不再渲染。

这和你在 composer 上做的事是**同一个机制**（`src/client/index.ts:137-140`，
`conversation.input.model` @ `priority: -10` 遮蔽 shipped seat @ `0`）。删掉插件行即可完全还原。

---

## 3. 路线 A：换皮（推荐）

### 能改什么

1. **加内容**（最稳）：往 `settings.models.provider-card` 里加你自己的区块；
   往 `settings.models.footer` 里加页脚级内容。
2. **改局部样式**：你的组件继承宿主页面的字体与配色令牌，只贡献构图
   —— `RetryCard.tsx` 的注释里已经确立了这条原则：
   *"TYPE AND COLOUR ARE THE HOST'S"*，用 `--dsw-*` 语义令牌 + 继承字体栈。

### 改不了的（必须说清楚的边界）

- 你**碰不到**官方那行 provider 行、按钮、图表本身的 DOM —— 那是 `ModelsSection`
  的内部结构，扩展位只给你**卡片内的附加区**。
- 所以「把设置 → 模型 页整页排版重排一遍」**做不到**，除非走路线 B。
- 想让官方区块变色，只能靠覆盖 `--dsw-*` 令牌（如果该处确实读令牌）。

### 为什么推荐

- 契约是官方的、有类型的、被文档承诺的，`dsh` 升级时最不容易碎。
- 零风险：不注册就没有任何影响；卸载即还原。
- 你已有全部脚手架：构建（`scripts/build-client.mjs`）、静态自查
  （`selfcheck-static.mjs`）、对比度门（`check-contrast.mjs`）、
  产物漂移门（`check-build-fresh.mjs`）。加一个卡片的边际成本很低。

---

## 4. 路线 B：整体替换这个 tab

### 机制

```js
ctx.slots.inject('settings.section', () => ctx.slots.register({
  name: 'settings.section',
  id: 'models',        // 同一个 cell
  order: 10,
  priority: -10,       // 更低 = 胜出
  label: () => '模型',
  children: { /* 你自己声明的子 seat */ },
}, YourModelsPage))
```

### 但你必须自己重建这一页的全部功能

官方页面不是静态的，它背后有一整套契约。替换 = 全部重写：

- **`ModelsSettingsStore`**（`store.d.ts:86`）：把可配置 provider 目录
  （`llm/listProviders` ⨝ `llm/listConfigurableProviders`）、settings 命名空间
  （共享 settings 镜像）、被引用的凭据（`credentials/describe`）三者 join 成
  一个快照；含「后发请求胜出」的代际控制（generation）、凭据补全失败与
  整体加载失败的区别处理、`writable` 只读态。
- **`ModelsOperations`**（`operations.d.ts:42`）：5 个 Host 调用
  —— `describeCredential` / `storeCredential` / `removeCredential` /
  `writeSettings`（带 `expectedRevision` 乐观并发，可能回 `conflict`）/
  `discoverModels`（询问端点它提供哪些模型，可能回 `refused`）。
- **首启姿态**：`needsSetup(row, anyUsable)` —— 全页无可用 provider 时，
  没有 key 的 provider 渲染成「开通卡片」而不是行。
- **添加流程的两个模式**：从目录收养休眠 provider（catalog select + 编辑器）
  ／手写自定义模型 API（创建表单）；两个面板各自保有草稿、切换不丢、
  有写入或端点询问在飞时切换按钮锁住。
- **删除确认**：先删凭据再删 provider —— 第二步失败要保证行还在、整体可重试
  （`removeProviderProfile`，`ModelsSection.d.ts:72`）。
- **推送失效重取**：`settings/document-updated`、`credentials/record-updated`、
  `credentials/reference-updated`、`llm/adapters-updated`、`connection/reset`
  五个事件 + `refreshIfLoaded`（未打开的页面不许后台拉取）。
- **凭据引用推导**：`deriveKeyRef(provider)` → `<ROUTE>_API_KEY`。
- **协议选项从 schema 读**：`protocolChoices(ns, schema)`，保证选项不会和
  adapter 实际接受的值漂移。
- **i18n**：整个 `settings.models` 命名空间的文案（中/英）。
- **依赖注入面**：`inject` 要 `remote.llm`、`remote.settings`、`remote.session`、
  `configForms`、`settingsSchema`、`locale`、`slots`。

### 路线 B 的真实风险

1. **行为退化**：上面任一项漏掉，就是可感知的功能缺失（丢草稿、并发写覆盖、
   只读态仍可点、删除后行残留）。这些是官方页面花了大量注释去论证的细节。
2. **版本漂移**：契约随 alpha 版本演进（当前 `0.2.1-alpha.4`）。你复制的是
   **这一版的行为**，`dsh` 升级后不会自动跟上。
3. **遮蔽是全局的**：`id: 'models'` 的 cell 只有一个胜者。你的页面一旦
   注册成功，官方页就在所有会话里都不再显示 —— 想「只改某些情况」做不到，
   必须自己在页面内做开关。
4. **升级时会静默错**：如果未来 `list` 遮蔽语义或 `settings.section` 契约变了，
   失败模式是「你的页面还在但功能不对」，不是干净的报错。

### 什么时候 B 才值得

只有当你要的是**官方页面结构本身做不到的**东西，例如：
模型列表的主视图重排、每个 provider 卡片换成完全不同的信息架构、
加入官方没有的整页级交互。**若只是「更好看 / 更清楚」，A 就够了。**

---

## 5. 我的建议：分三步走，每步都可停

1. **第一步（低风险，先见效）**：路线 A + CSS 令牌微调。
   在现有插件里新增一个卡片挂到 `settings.models.footer` 或
   `provider-card`，先把「你想让设置 → 模型 页变成什么样」在一个受控区域里做出来。
   → 你立刻能在真实页面上看到效果，且随时可退。

2. **第二步（评估）**：拿第一步的实物对照官方页面，
   逐条列出「A 改不到的」清单。此时再决定这些点值不值得走 B。

3. **第三步（仅在确实需要时）**：整体遮蔽替换，并把 1 中验证过的组件复用进来，
   同时补上 §4 那份功能清单的测试门。

**理由**：你的真实诉求是「样式」；而 DSH 把「加东西」和「换整页」都做成了
一等公民，但两者成本差一个数量级。先用便宜的方式逼近目标，
避免为了排版而重写一整套并发 + 凭据 + 首启语义。

---

## 6. 执行前需要你定的三件事

1. **目标强度**：只要「更好看/更清楚」→ A；要「结构本身换掉」→ B。
2. **具体想改哪里**：能否给一两条例子（例如「provider 行太挤」、
   「想在这里加一个模型对比区」）。这决定第一步落在哪个 seat。
3. **是否接受只做中文**：现有 `RetryCard` 的文案注释明确选择「只出中文」
   （*"双语回退只会让每种语言都写得不够准"*）。新页面是否延续这条？

---

## 附：本次分析的环境事实

- 本机 DSH：`@deepseek-ai/dsh@0.2.1-alpha.4`（npm 已发布版，`lib/` 为产物）
- 运行时包在 `.../dsh/node_modules/@deepseek-ai/` 下（共 298 个），
  顶层只暴露 `dsh` 一个
- 现有插件 `dsh-rabbit-model-picker` 的 `npm run test:fresh` **通过**
  （`lib/index.js`、`lib/client.js` 与 `src/` 一致）
- 工作区**有未提交改动**：`RetryCard.tsx` / `retryPolicy.ts` / `retryStyles.ts` /
  `test-retry-policy.mjs` 为新增未跟踪，另有 5 个文件已修改。
  **执行第一步前需要先确认这批改动的归属**，避免踩到另一个会话的在飞工作。

---

## 7. 追问会话的决策记录（2026-10-16，`/grill-with-docs`）

**本节取代 §1 的路线建议与 §6 的三个待定项。** 诉求已明确为「新增一个平行 tab」，而不是改造或替换原有的「模型」tab。

### 7.1 新查清的事实（决定了路线选择）

- `settings.section` 的 slot `kind` 是 **`list`**，契约原文「One settings page per list entry」；
  registrant options 只有三个：`id`（section key，驱动 `only` 过滤）、`order`（nav 位置）、
  `label`（registrant 自己本地化的显示文本）。
  — `@deepseek-ai/dsh-client-ui-settings/lib/types/client/contract/slots.d.ts:62-77`
- 设置侧栏的导航行类型就是 `{ id, order, label }`，**没有 icon 字段**。
  — `@deepseek-ai/dsh-client-ui-settings-general/lib/types/client/shell-contract.d.ts:15-20`
  — 同文件 `:43-44` 写明 `sections: HostObservable<readonly SettingsSectionRow[]>`
  「settings.section ledger projected into ordered nav rows」。

**推论（本诉求的关键）**：用**新 id** 注册 `settings.section` = **多一个设置 tab**，
与官方 `id: 'models'` 并存，**不触发 §2.3 的按 id 遮蔽**。
所以 §4 的整体替换（路线 B）在本诉求下**不需要**，也不需要 §5 的分三步走。

### 7.2 已定决策

| 编号 | 决策点 | 结论 |
|---|---|---|
| Q1 | 新 tab 的第一目标 | **配置提供商**：key / 协议 / 启停 / 模型发现集中在**一屏**内直接改 |
| Q2 | 能力边界 | **可写入**，并与官方模型页**共用同一套写入通道**（不另造通道） |
| Q3 | 与官方「模型」页的关系 | **并存**：官方页保留为全功能兜底，新 tab 只做**简化主干**，不复刻官方语义 |
| Q4 | 文案语言 | **只出中文**，延续本仓库 `RetryCard` 的既有选择 |

→ 本诉求 = **路线 C：新增平行 tab（纯加法）**。可写入但只覆盖主干，是这个决定的核心代价取舍。

### 7.3 仍未定

见 `CONTEXT.md` 的「待澄清」。下一轮前沿：主视图形态、是否纳入模型级内容、tab 命名、验收形式。

### 7.4 契约核查的补充事实与更正（task-1 回执）

**环境更正**：本机装的是 `0.2.1-alpha.4`（`dsh/package.json:4`、`dsh-client-ui-settings-models/package.json:4`）；
本文件正文原先写作 `alpha.2` 处已全部更正。另：`@deepseek-ai/dsh-client-ui-slots` 在本机安装树里是**零文件目录**，
所以「list 按 id 分格」的原文取自**同版本已发布件**（外部来源，非本地事实）；
但本地 `dsh-client-ui-renderer/lib/types/client/registry.d.ts:164-174`，加上出厂组合自身
（`general` order 0 与 `models` order 10 两行并存）已能独立支持同一个结论。

**新增事实**

| # | 事实 | 证据 |
|---|---|---|
| F1 | nav 行的图标**不是**注册字段：shell 用硬编码 id→图标 switch，只认 `account` / `models` / `agent-presets` / `plugins` / `archived-sessions`，其它 id 一律回落齿轮图标 | `dsh-client-ui-settings-general/lib/client.js:243-269` |
| F2 | nav 排序 = `order` 升序，只投影 `id` / `order` / `label`；`label` 可为 thunk，随 locale revision 刷新 | 同上 `:1145-1150`、`:1141`、`:1156` |
| F3 | 官方实现**不可复用**：`exports` 无 `./lib/*`；入口只转发类型与 `refreshIfLoaded` / `inject` / `apply`；运行时仅 3 个 exports ⇒ 必须**自建** store / operations | `dsh-client-ui-settings-models/package.json:16-28`、`lib/client.js:4520-4522` |
| F4 | 宿主**没有** provider enable/disable：profile schema 与词典都没有该字段 / 文案；真实杠杆只有「profile 在不在」与「凭据 set / unset」 | `dsh-llm-pi-ai/lib/types/config.d.ts:54-145`、`dsh-client-ui-settings-models/lib/client.js:3228-3363` |
| F5 | 目录里**每一笔**都会生成一行（`joinProviderDirectory` 全量建行）⇒「休眠」= 有行但 `configured === false` | 同上 `:1199-1220` |
| F6 | `configured` 读的是**生效值**（多层合并 + schema 默认之后）在该 path 上是否有东西；`removable` 才是「仅用户层有」 | 同上 `:1369`、`:1370` |
| F7 | `keyConfigured` = 命名了 `apiKeyEnv` 就用那个 ref，否则用派生 ref `<ROUTE>_API_KEY` 的凭据状态 | 同上 `:2293-2295` |
| F8 | 官方首启姿态是**有例外**的：`needsSetup` 只在「整段即 profile + 当前无任何可用 provider + 该凭据未配置」时才把行换成开通卡，用户关掉即恢复成行 | 同上 `:2281-2285` |

**术语更正**（已同步进 `CONTEXT.md`）：「休眠提供商」收紧为「有行但无 profile」；
「收养」原先写的「使它成为一行」**与代码不符**——行本来就有，收养改的是 `configured: false → true`。

**对 Q1 / Q6 的影响**：用户点名的「启停」在宿主里**没有对应物**，必须由我们自己定义它到底做什么。
这一点不能靠猜测补齐，已作为独立决策单列。

### 7.5 「启停」的穷举核查（task-2 回执）

**结论：本安装的适配器全集内，「启停」无处可落。**

先把全集钉死（不靠猜）：调用 `registerAdapter(` 的只有 **2 个包**
（`dsh-llm-pi-ai/lib/index.js:2952`、`dsh-llm-deepseek/lib/index.js:2311`）；
调用 `registerConfigurableProviders(` 的只有 **3 个包**
（`dsh-llm-deepseek-api-key:52`、`dsh-llm-deepseek-account:512`、`dsh-llm-pi-ai:2922`）。

| 包 | profile 概念 | 有无启停字段 |
|---|---|---|
| `dsh-llm-pi-ai` | 有（`Config.providers` dict，`lib/types/config.d.ts:181-188`；`PiAiProviderProfile` 全字段 `:54-145`） | **没有**。唯一「不在」= dict 没有该 key（`lib/index.js:2946`）；空 profile `{}` **仍会建路由**（官方页专门写 `{}` 来 materialize，`dsh-client-ui-settings-models/lib/client.js:1936-1941`） |
| `dsh-llm-deepseek` | 无（单个扁平 `Config`，`config.d.ts:8-45`） | **没有**。`thinking: 'enabled' \| 'disabled'`（`:12`）是思考策略，与可用性无关 |
| `dsh-llm-deepseek-api-key` | 无 | **没有**。provider 硬编码 `lib/index.js:36`，无条件注册 `:52` |
| `dsh-llm-deepseek-account` | 无 | **没有**。`replace` 只带诊断错误 `:520-523`，而诊断不是停用 |
| `dsh-llm-retry` / `dsh-deepseek-llm-api-extensions` | 无 | **没有** |
| `dsh-llm`（注册表本体） | — | **有**程序化通道 `replace([])` / disposer（`lib/types/index.d.ts:219`、`:239`、`:262`、`:290`），但**不由任何设置字段驱动**，外部插件无法靠写设置触发它 |

⇒ 真实可用的杠杆只有两条：(a) **profile 的存在性**（= 收养 / 移除，官方已有）；
(b) 适配器插件自己调 `replace([])`（不在我们的控制面）。
`dsh-opencode-go` 本机未安装，无法本地复核；本仓库 `src/client/adapterCatalog.ts:11-18`
已有记录称它根本不注册 configurable provider。

**另两条事实**（`dsh-credentials/lib/types/types.d.ts:60-67`）：`configured` = 「解析该引用当前能否取到值」，
**不是**「值可用」；伴随字段 `source?` 与 `writable`（官方删除流程用 `writable` 决定是否连带删凭据）；
该结构里**没有任何承载密钥值的字段**（`:55-58`）——这决定了凭据在本页只能「替换」，不能回显。

**`require('@deepseek-ai/dsh-client-ui-slots')` 被允许**（结案 task-1「未确认 #4」）：
壳把静态模块表交给加载器（`dsh-web-frontend/dist/assets/index-CN7NIWNw.js:190`）
→ `dsh-client-modules/lib/client.js:681` `this.seed = new Map(...)`
→ `:835` 命中 seed 即返回。`dsh.client.external` 才是官方声明处（`dsh-client-modules/lib/index.js:412-416`），
`dsh.client.inject` 只是加载顺序边（`:789-792`）。注意：本仓库 `scripts/build-client.mjs:27-32`
的 4 项白名单是**本地策略**而非平台限制；风险是 seed 表随壳版本变化而 fail-loud。

### 7.6 决策续（Q5–Q20）与两次更正

**已定**

| 编号 | 决策点 | 结论 |
|---|---|---|
| Q5 | 主视图形态 | 提供商为行 + 行内就地编辑（不弹层、不跳页） |
| Q6 | 范围边界 | 严格只做提供商级，不含模型列表与参数（**只约束第一阶段**，见下） |
| Q7 | tab 命名 | 「模型配置」 |
| Q8 | 验收形式 | 四项关键任务各写一条最短路径 + 步骤数上限，做成回归门 |
| Q9 | 行内附加控件 | 只加「最近一次错误 / 失败原因」；**不做**每行的「在官方页打开」出口 |
| Q10 | 点击预算 | 进入本页之后，每项 ≤ 2 次点击（输入本身不计） |
| Q11 | 写入时机 | 即时写入（失焦或回车即提交） |
| Q12 | 冲突处理 | 就地重读并自动重试一次，仍失败才把错误挂在该行（与 `RetryCard` 既有做法一致） |
| Q13 | 首启空状态 | 不复刻官方开通卡；全表照常列 + 顶部一条空状态提示 |
| Q14 | 自定义创建 | ⚠️ 未按选项作答——用户借这题澄清了终局目标，故该点仍开放，已重问 |
| Q15 | 键盘可达性 | 全键盘：每行每个控件 Tab 可达，四项主干都有键盘路径 |
| Q16 | 凭据形态 | 只显示状态 + 一个「替换」入口（凭据读不回） |
| Q17 | 「启停」语义 | 落成「添加 / 删除」（写或 `unset` profile） |
| Q18 | 术语命名 | 「收养」被用户否决 → 见 Q20 |
| Q19 | 终局与路径 | **分阶段**：当前新 id 并存用于对照；功能对等后再遮蔽 `models` |
| Q20 | 术语定名 | 「添加 / 删除」，逐字采用宿主官方中文 |

**两次更正**

1. **Q3 被 Q19 取代**。Q3 定的是「官方页永久作全功能兜底、不复刻官方语义」；Q19 澄清终局是**取代**。
   → `docs/adr/0001-parallel-provider-config-tab.md` 已标 `superseded by 0002`，
   新建 `docs/adr/0002-phased-parity-then-shadow-models.md` 记录分阶段路线。
2. **「收养」改名为「添加」**。宿主自己的中文是「添加模型提供商」「目录中的提供商都已添加」
   （`dsh-client-ui-settings-models/lib/client.js:3379`、`:3385`），反动作是「删除」（`:3372`）。
   `CONTEXT.md` 已改名，旧名进「废弃叫法」。

**由 Q19 派生出的新矛盾**：Q6 把「模型目录编辑」排除在本页之外，
但遮蔽官方页之后，设置里将不再有任何模型目录的编辑入口——
所以 Q6 的排除**只能约束第一阶段**，终局对等绕不过它。该点已作为独立决策重问。
（另一个同类缺口是 Q14 的「手写自定义模型 API」，同样只在第一阶段可省。）

### 7.7 最终形态（Q21–Q24）

| 编号 | 决策点 | 结论 |
|---|---|---|
| Q21 | 自定义模型 API 创建 | **纳入本次交付**（原答「第一阶段不覆盖」随「不拆阶段」失效） |
| Q22 | 模型目录编辑 | **纳入本次交付**（原答「排在第一阶段之后」失效） |
| Q23 | 落地形态 | **仍以新 id 并存，不遮蔽官方页**；但功能做全 |
| Q24 | 语言 | **中英双语**，与官方页对等 |

**Q19 的「分阶段」被推翻**：用户 2026-10-16 明确「一次性做完，不拆阶段」。
最终形态 = **界面并存 + 能力对等**：新 id 注册、官方页永不遮蔽，但本页把官方模型页的全部能力实现一遍。

**ADR 链**：0001（并存 + 只做主干）→ 0002（分阶段 + 终局遮蔽）→ **0003（并存 + 功能对等）**。
0001 与 0002 均已标记 `superseded by 0003`；改口过程保留，不回溯修改。

**受此影响而失效的旧决策**：Q4（只出中文）与 Q6（只做提供商级）——两者的前提都是「只做主干」。
Q13（不复刻开通卡）**保留**，但改记为**显式偏差**写进对等清单，不再当作「第一阶段的简化」。
（Q7 的 tab 命名「模型配置」继续成立，因为 Q23 选了新 id 并存。）

**交付范围**：逐条清单见 `docs/models-page-parity-checklist.md`（A 提供商与凭据 / B 生命周期 /
C 模型目录 / D 状态与一致性 / E 文案与可达性）。

### 7.8 「模型发现」的核查（task-3 回执）

**它是纯读**。契约明文：`llm/discoverModels`「describes a draft, not a stored route,
so **nothing here reads or writes settings or credentials**」（`dsh-llm/lib/types/index.d.ts:307-311`）。
请求形状 `{ provider?, baseURL?, api?, apiKey? }`（`dsh-llm/lib/types/types.d.ts:271-288`），
其中 `apiKey` 是**一次性字面值**、harness 永不存储（`:286-287`）；`provider` 命中适配器内置目录时**直接本地作答、不联网**。

**官方流程是三步，不是一次点击**：

1. 点「获取可用模型」（en `dsh-client-ui-settings-models/lib/client.js:3323` / zh `:3460`）
   → 结果进 React state 并弹**勾选弹窗**（`:1113-1128`）；
2. 点「添加所选」（zh `:3470`）→ **只改卡片草稿**，按 id 求并集且**草稿里已有的同 id 条目优先**（`:982-992`）；
3. 点 Apply → `settings/mutate` 才落盘（`:1943`、`:3179-3193`）。

**不存在「发现即写入」的路径。**

**官方自己就有「只探测不写入」的用例**：`ModelListEditor` 挂载时做一次继承目录探测，
结果只用于展示与输入类型的 fallback（`:885-905`），从不落盘。

**落盘粒度**：`pathOps` 只产出「变了的字段」的 op（`:1822-1838`），所以整个 profile 是**增量写**；
但 `models` 这一个字段是**整数组覆盖**。「合并」只发生在草稿层。
pi-ai 的模型目录地址 = `llm-pi-ai` 命名空间下 `["providers", <route>, "models"]`（`dsh-llm-pi-ai/lib/index.js:2849`）；
两条 DeepSeek route 的 `settingsPath` 为 `[]`（`dsh-llm-deepseek-api-key/lib/index.js:56`、
`dsh-llm-deepseek-account/lib/index.js:510`），因此是 `["models"]`。

**空结果**不开弹窗、不动草稿、不写任何东西，只显示本地化文案 `fetchEmpty`（`:965-968`、zh `:3463`）。

**`refused` 的条件**：Host 侧 `NO_DISCOVERY` / `INVALID_DISCOVERY`（`dsh-llm/lib/index.js:1998-2001`）；
pi-ai 侧——无内置目录且无 baseURL、协议不在 `LISTABLE_PROTOCOLS`、探测 key 含非法字符、连不上、
非 2xx（401/403 追加 “check the API key”）、非 JSON、响应超 4 MiB，
以及 **profile 命名的凭据引用取不到值**（`dsh-llm-pi-ai/lib/index.js:2385-2435`、`:2898`）。
官方把 Host 的**英文诊断原样内联**、不本地化（`client.js:1109-1112`）。

**发现失败不持久化**：官方放在 React state（`client.js:883`、`:894`、`:957`、`:966`），重载即丢。
另外两个「错误」都不等同于发现失败：`LlmConfigurableProvider.error` 是**适配器给的配置诊断**
（持久，官方渲染成持久错误行 `client.js:2520-2523`；本安装里只有 account 适配器写过），
store 的 `credentialError` 是凭据补全失败（内存态）。
⇒ **「最近一次错误」没有现成的持久通道可抄**。

**发现与落盘是两次独立调用**：`discoverModels` 不携带也不推进 `expectedRevision`；
官方 `applyOnce` 撞上 conflict 直接报错、**不自动重试**（`client.js:1944`），
而本仓库既有范式是「重读 revision 后重试一次」（`src/client/RetryCard.tsx:337-349`）。
⇒ 本页「先发现、后落盘」必须在**落盘那一步**用最新 `expectedRevision`。

**另一个不能用发现补的字段**：`readListing` 只产出 id / name / contextWindow / maxTokens，
**永远不产出 `inputModalities`**（`dsh-llm-pi-ai/lib/index.js:2353-2358`）——
这正是官方要另做一次「继承目录探测」去拿输入类型默认值的原因。
