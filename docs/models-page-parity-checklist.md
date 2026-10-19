# 功能对等清单：本页本次交付的能力范围

> 本文由 ADR [0003](adr/0003-parallel-tab-with-full-parity.md) 定义：本插件新增一个与官方模型页**并存**的 tab，
> **功能与官方页对等**、**中英双语**。因此本文 = **本次交付范围**，不是「以后再说」的清单。
>
> 取材：官方语义见 `docs/settings-models-tab-feasibility.md` §4；
> 官方中英词典 `dsh-client-ui-settings-models/lib/client.js:3228-3454`（en `:3228-3363`、zh `:3364-3454`）；
> 契约核查见同文 §7.4–§7.8。
>
> 2026-10-19 按安装版 `dsh-client-ui-settings-models@0.2.1-rc.2` 重新复核并补齐：§1 的 A–E 是交付范围；
> §5 记录这轮缺口的落点与仍未覆盖项（N7 逐模型创建编辑器、N8 首启 / 登录引导）。
> 形态上的有意差异记进 §2。

## 1. 能力清单（全部在本次交付内）

### A. 提供商与凭据

| # | 能力 | 官方依据 |
|---|---|---|
| A1 | 读提供商目录：`llm/listProviders` ⨝ `llm/listConfigurableProviders`，与设置命名空间、被引用凭据 join 成一份快照 | §4 `ModelsSettingsStore` |
| A2 | 每行凭据状态：`configured`（ref 能否解析出值）与 `keyConfigured`（命名了 `apiKeyEnv` 就用它，否则用派生 `<ROUTE>_API_KEY`） | `lib/client.js:1369`、`:2293-2295` |
| A3 | 凭据写入与清除：`credentials/set` · `credentials/unset` | `dsh-api-settings-controller/lib/typert.remote-client.d.ts:13-17` |
| A4 | 环境变量后备与原生鉴权：key 留空即用环境认证；目录的 `nativeAuth.env` 参与凭据检测，按 detected / detected-hidden / missing / unchecked 显示；keyless（env 空 + oauth）隐藏密钥输入 | 词典 `keyPlaceholderFallback`、`keyFallbackMissing`、`keyFallbackDetected`、`keyHelp`（`:3404`、`:3406`、`:3407`、`:3410`）；官方 `credentialChecks`（`:1379`、`:1404-1407`）、原生鉴权提示（`:2004-2031`） |
| A5 | 只读态：设置文档只读时明确告知并禁用写入 | 词典 `readOnly`（`:3396`）；store 的 `writable` |
| A6 | 凭据不可回显：只显示状态 + 「替换」入口 | `dsh-credentials/lib/types/types.d.ts:55-67`（结构里没有承载密钥值的字段） |
| A7 | 提供商 API 地址：输入框展示用户层 `baseURL`；占位符依次为生效值 / 提供方环境变量 / 「没有默认地址」，DeepSeek 路由另有默认地址提示；写入即改即存，清空即 unset 回退；写前校验 http(s)（官方把非法值留给宿主 / 适配器） | 官方 `ProviderEditor` 的 `baseURL` 字段：`:2000-2002`、`:2111-2118` |
| A8 | 提供商显示名称：输入框展示用户层 `displayName`，清空即 unset 回退（不写空串——`pi-ai` 拒收空 `displayName`）；占位符为下层 `displayName` 或 route id；字段仅在 profile schema 声明 `displayName` 时出现（官方只对 `pi-ai` 手写路由开放） | 官方 `ProviderEditor` 显示名字段：`:2084-2099`；`setField`（`:1892-1895`）；开放条件 `ownsIdentity`（`:1993`） |

### B. 提供商生命周期

| # | 能力 | 官方依据 |
|---|---|---|
| B1 | 添加：从目录把一个**休眠提供商**写进设置。目录添加卡可一次填密钥 / API 地址（都可空），profile 只写用户实际填的字段、不写 `api`；自定义创建卡可在提交前发现模型，并把候选的名称 / 窗口 / 输出 / 输入类型写进 profile | `lib/client.js:2675-2730`、`:1936-1941`、`:1558-1781`；ADR [0010](adr/0010-catalog-add-profile-shape.md) |
| B2 | 手写自定义模型 API（API 地址 + 协议 + 模型） | 词典 `addCustom`（`:3382`）、`addCustomHint`（`:3384`） |
| B3 | 删除：先删凭据再删 profile；只有 profile 命名的派生引用才连带删 key；删除前有行内两步确认；第二步失败要保证行还在、可整体重试 | `:2260-2271`、`:2296-2309`、词典 `deleteDescriptionWithCredential`（`:3376`） |
| B4 | 协议取值从适配器 schema 读（`protocolChoices`），不硬编码 | §4 |

### C. 模型目录（原 Q6 排除，现纳入）

| # | 能力 | 官方依据 |
|---|---|---|
| C1 | 每个提供商的 `models` 字典：增删模型 | 词典 `models`（`:3420`）、`addModel`（`:3446`）、`removeModel`（`:3447`） |
| C2 | 模型字段：模型 ID、显示名称、上下文窗口、最大输出 token、输入类型（文本 / 图片；取消图片时连带清 `imagePixelBudget` / `imageMaxBytes`） | `:3425`、`:3426`、`:3428`、`:3430`；输入类型 `:230-260`、`:547-555`、`:770-795` |
| C3 | 推理档位：档位 + API 参数值、Off 语义、至少一个非 Off 档位 | 词典 `modelReasoning*`（`:3436-3445`） |
| C4 | 恢复默认模型（`resetModels`） | `:3423` |
| C5 | 模型发现：**发现 → 勾选确认 → 落盘（三步）**，目录区与自定义创建卡都可用；probe 携带输入中的密钥；目录区的采纳只进草稿、保存才写，创建卡把候选元数据并入 profile | `dsh-llm/lib/types/index.d.ts:307-311`、`client.js:946-992`、`:1113-1128`、`:1943`；词典 `fetchModels` en `:3323` / zh `:3460` |

### D. 状态与一致性

| # | 能力 | 官方依据 |
|---|---|---|
| D1 | 即时写入 + 乐观并发：`settings/mutate(ns, ops, expectedRevision)`；`settings/conflict` → 重读重试一次，仍失败挂在该行 | Q11 / Q12 |
| D2 | 推送失效重取：`settings/document-updated`、`credentials/record-updated`、`credentials/reference-updated`、`llm/adapters-updated`、`connection/reset`；且未打开的页面不后台拉取 | `lib/client.js:4472-4478`、`refreshIfLoaded`（`:4522`） |
| D3 | 代际控制：后发请求胜出，避免旧响应覆盖新状态 | store 的 generation 语义 |
| D4 | 失败分流：整体目录加载失败（含 `listProviders` / `listConfigurableProviders`）vs 单个凭据补全失败，分别呈现 | 词典 `loadFailed`（`:3397`）、`retry`（`:3399`）；官方 `:1346-1359`、`:2424-2451` |
| D5 | 落盘粒度：`pathOps` 只产出变了的字段；但 `models` 是**整数组覆盖**（合并只发生在草稿层） | `lib/client.js:1822-1838` |

### E. 文案与可达性

| # | 能力 | 官方依据 |
|---|---|---|
| E1 | 中英双语（同 key 同序两套字典） | 词典 `:3228-3363`（en）、`:3364-3454`（zh） |
| E2 | 全键盘：每行每个控件 Tab 可达；关键任务都有键盘路径 | Q15 |
| E3 | 行内「最近一次错误」——**两类都常显在行下**：本次会话的发现失败（不持久、重载即丢，与官方同）+ 适配器给的**持久**配置诊断 `entry.error` | Q9 + Q29；`client.js:883`、`:2520-2523` |

## 2. 明确保留的偏差（有意不跟官方一致）

| 偏差 | 与官方的差别 | 依据 |
|---|---|---|
| **只列已添加的提供商** | 列表只渲染 `row.added === true` 的行；**未添加的目录条目不再逐行出现**，改由一个页面级「添加模型提供商」入口承载。这条**取代**了早先「全表照常列」的写法 | 用户 2026-10-16 指令；`ModelConfigRow.added` + `isAdded()` |
| 不复刻首启开通卡 | 官方在「无任何可用提供商」时把行换成开通卡；本页顶部给空状态提示，且**添加入口保持可见**。**能力不丢**，只是引导更弱 | Q13（在新语义下的对应物） |
| 提供商级就地编辑 + 模型目录行内展开 | 官方整页是卡片展开 + 两个添加面板；本页把提供商级摊在行里，把模型目录摊在同一行的展开区（取代 Q27 的右侧抽屉） | Q5 / Q26 |
| 新 tab 的导航图标 | shell 的 id→图标 switch 不认识新 id，回落齿轮图标 | 契约 F1 |
| 全部能力摊在一个页面 | 官方也只有一个页面；本页把「模型目录」也摊在同一页的行内展开区，因此页面明显更长（展开一个提供商时约 +600px） | Q5 + C 组 |
| 冲突自动重试一次 | 官方撞上 conflict 直接报错、不自动重试；本页沿用本仓库 `RetryCard` 的范式 | Q12；`client.js:1944` vs `src/client/RetryCard.tsx:337-349` |
| 显示名称的开放范围 | 官方只在 `pi-ai` 的 `declared` 路由（手写自定义 API）显示该字段；本页只要 profile schema 声明 `displayName` 就开放，因此内置目录提供商（如 `opencode-go`）也能改名 | 与设置井「随 schema 出现」的既有形态一致；写的是同一个 profile 字段 |
| 删除确认用行内两步 | 官方用 modal 确认；本页在设置井底做「删除 → 取消 / 确认删除」两步，不叠加第二层 modal | 设置页唯一 modal 的既有契约；文案复用 `config.delete.*` |
| 目录添加卡只收密钥 / 地址 | 官方目录添加 = 提供商下拉 + 完整 `ProviderEditor`；本页只收可空密钥与 API 地址，其余字段在添加后的设置井里配 | ADR [0010](adr/0010-catalog-add-profile-shape.md)；避免把两种编辑形态混在一张卡里 |
| 自定义创建不做逐模型编辑 | 官方创建卡自带完整模型列表编辑器（逐模型名称 / 窗口 / 输入类型 / 推理）；本页只做模型发现 + 模型 ID 文本，发现到的名称 / 窗口 / 输出 / 输入类型会写进 profile，逐模型字段在创建后编辑 | 创建流程与模型目录区共用一套保存语义；逐模型编辑留在模型目录区 |
| 同时只开一个提供商编辑器 | 官方只有一个 `editing` 目标，打开添加卡会替换它、行编辑器草稿随之卸载；本页每个设置井独立开合，可同时展开多个 | `client.js:2355`、`:2548`、`:2762-2771` |
| 不承载官方扩展槽 | 官方模型页渲染 `settings.models.provider-card`、`settings.models.footer`、`settings.models.sign-in`；本页是平行 tab，不承载第三方扩展内容 | `client.js:2541-2545`、`:2616-2620`、`:2776`、`:2968-2973`；重试编辑器因此住在模型配置页 |

> **「只列已添加的提供商」其实更贴近官方页**：官方页也只列已配置的提供商，并在页尾用**一个**「添加模型提供商」按钮承载新增。所以这条不是新增偏差，而是把早先那条「全表照常列」的偏差**收掉**了——代价是本页必须自己实现那个添加入口（官方已有），否则「添加」这项能力会从本页消失。
>
> 注意：Q26 把「模型目录」移出行的结果——行内只剩提供商级字段，行高可控；
> 后来它又被请回行内、做成展开区：本页因此只有一种编辑形态（行 + 井），Q5 的「不弹层」对整页成立。

## 3. 派生项已全部结案

| 派生项 | 结论 | 依据 |
|---|---|---|
| 点击预算 | **分区**（Q25）：四项主干仍 ≤2 次；B2 与 C 组的任务各自定上限，写进验收门 | Q25 |
| 弹层形态 | **行内展开区**（取代 Q27 的右侧抽屉）：在账本行内、占满设置内容列，浏览器不出现第二层 modal | Q26 / Q27 |
| 模型发现 | 目录区与创建卡都走「发现 → 勾选确认 → 落盘」；目录区的采纳进草稿、保存才写，创建卡把候选元数据并入 profile | C5 |
| 「最近一次错误」 | 发现失败在模型目录区；持久 `entry.error` 现在常显在行下 | E3 |

## 4. 判定方式

交付时按 §1 的 A–E 五组逐条验收；§2 的偏差必须**显式记录**，不能默认「和官方一样」。
因为官方页始终共存，任何未覆盖项都不会让用户失去能力——这降低了风险，但不改变「本次交付要对等」的目标。

§5 记录这轮对照的缺口与落点：已覆盖项同时写进 §1，仍未覆盖项留在 §5。

## 5. 缺口与完成记录（2026-10-19 对照，rc.2）

> 本节记录这轮对照发现的官方能力缺口和落点；已覆盖项同时写进 §1，未覆盖项留在这里。
> 行号口径：`dsh-client-ui-settings-models/lib/client.js`（`0.2.1-rc.2`）；源码级对照，未做 GUI 点验。

| # | 缺口 | 官方行为 | 本轮落点 | 状态 |
|---|---|---|---|---|
| N1 | 模型输入类型（文本 / 图片） | `ModelInputTypes` 勾选框同时出现在 DeepSeek 与 pi-ai 编辑器（`:230-260`、`:547-555`、`:770-795`）；最后一个模态不能取消（`:244`），取消图片时连带删 `imagePixelBudget` / `imageMaxBytes`（`:251-254`）；输入类型的继承回退来自内置目录条目或 route `defaultInput`（`:905`、`:1059`）；发现采纳把 `inputModalities` 映射成 `input`（`:862-869`） | `ModelCatalog.tsx` 的模型井新增输入类型组；`input` / `inputModalities` 按 family 落字段；发现采纳带模态；内置目录回退在打开目录时读取 | 已覆盖 |
| N2 | 原生鉴权 / 免密钥 + 多引用凭据提示 | 目录 join 携带 `nativeAuth`；凭据按 `apiKeyEnv` 或「派生 ref + `nativeAuth.env`」批量 describe（`:1379`）；每行 `credentialChecks` 覆盖这些 ref（`:1404-1407`）；`keylessNativeAuth` 时隐藏密钥输入（`:2030`、`:2045`）；环境提示分 detected / detected-hidden / missing / unchecked 四态（`:2004-2014`） | `contract.ts` 增 `nativeAuth` / `credentialChecks`；store 按多 ref describe；设置井四态提示、keyless 隐藏密钥；pi-ai 首次存 key 时绑定派生引用 | 已覆盖 |
| N3 | 从内置目录添加的 profile 形状与一步编辑 | 目录添加 = 提供商 select + 完整 `ProviderEditor`（`:2675-2730`）；密钥可空，什么都没填时写空 profile `{}`（`:1936-1941`）；协议 / 显示名只对 `declared` 路由开放（`:1993`） | `CatalogAddCard`：可填可空密钥 / 地址，profile 只写用户填的字段、**不写 `api`**；协议编辑只留给 declared；见 ADR [0010](adr/0010-catalog-add-profile-shape.md) | 已覆盖 |
| N4 | 删除确认 | 确认 modal（`:2777-2801`），说明随「是否连带删 key」变化，进行中不可关闭、失败留在 modal（`:2403-2422`） | 设置井底部行内两步确认（删除 → 取消 / 确认删除），不叠加第二层 modal；只连带删 profile 命名的派生引用 | 已覆盖（形态见 §2） |
| N5 | 目录加载失败面 | `llm/listProviders` / `llm/listConfigurableProviders` 任一失败 → 整页 `loadFailed` + 重试（`:1346-1359`、`:2424-2451`） | `modelConfigStore.ts` 两条 RPC 失败都发布 error；页面既有 `loadFailed` + 重试生效 | 已覆盖 |
| N6 | 提供商错误常显 | 每行始终渲染 `entry.error`（`:2520-2524`、`:2615`） | 行头下方常显 `dmc-diagnostic`（`role="alert"`），井内不再重复 | 已覆盖 |
| N7 | 自定义创建时的模型编辑与发现 | 自定义卡自带完整模型列表编辑器与发现（`CustomProviderCard` `:1558-1781`；`ModelListEditor` `:1742-1757`） | `AddProviderCard` 增加发现（搜索 / 勾选 / 全选）并把候选的名称 / 窗口 / 输出 / 输入类型写进 profile；**没有逐模型编辑 UI**，逐模型字段仍创建后编辑 | 部分覆盖（见 §2） |
| N8 | 首启开通卡 / DeepSeek 登录引导 / 欢迎公告 | 开通卡（`:2281-2285`、`:2525-2547`）、登录引导（`:2894-2974`）、公告（`:3000-3047`） | 仍只有空状态说明；本页没有登录或开通动作 | 未覆盖（既定偏差 Q13；登录 / 公告未单列） |
| N9 | 其余官方细节 | API key 格式校验（ENV 行 / 引号 / 可打印 ASCII，`:32-55`）；保存成功 `savedNotice`（`:2507-2512`）；模型 id 失焦 trim（`:504`、`:782-785`）；容量只要求正整数（`:628-659`）；只读态禁用发现（`:1040`）；自定义创建用卡片打开时的 revision 做栅栏（`:1560`、`:1611`） | `apiKeyProblem` 接入三处密钥输入；页面加 `savedProvider` aria-live；id 失焦 trim；`parseTokenCount` 改为正整数；只读态禁用发现；创建卡挂载时捕获 revision | 已覆盖 |
| N10 | 未知 namespace 不应渲染泛化字段 | `layoutOf` 只认 `llm-deepseek` / `llm-pi-ai`，其他 namespace 只显示「其余字段在 `cordis.patch.yml`」并禁用保存（`:1840-1844`、`:2180-2183`、`:2195`） | `providerFamilyOf` 为 unknown 时不渲染凭据 / 地址 / 协议 / 显示名与模型门；目录添加卡也拒绝提交 | 已覆盖 |

### 5.2 实现差异（已修 / 保留）

| # | 差异 | 官方 | 我们 | 状态 |
|---|---|---|---|---|
| R1 | 模型目录状态标签 | 用**用户层**是否有 `models` 判断「已自定义」（`:1994-1996`） | 改为 `hasPath(namespace.user, modelsPath)` | 已修 |
| R2 | 协议「覆盖」按钮 | 官方对目录路由不渲染协议编辑（`:1993`） | 目录路由不再渲染协议；declared 路由显示继承值，重置走 unset | 已修 |
| R3 | 发现结果落盘时机 | 先并入卡片草稿，Apply 才写（`:982-992`） | `adopt` 只并入草稿并提示保存 | 已修 |
| R4 | 账号行动作 | 账号行不显示编辑 / 删除（`:2588`） | session 行不再渲染两个门 | 已修 |
| R5 | 「获取模型」入口范围 | DeepSeek 行没有发现 UI（`:2149-2152`） | DeepSeek 行也提供发现；宿主 `dsh-llm-deepseek-api-key` 实现了 `discoverModels`（`lib/index.js:62-71`） | 保留（超集，不是缺口） |

> 附注：官方行不显示模型数量，也没有 logo / 文档外链；本页目录头有计数，属超集，不列入缺口。
> 仍未覆盖的只有 N7 的逐模型创建编辑器与 N8 的首启 / 登录引导。
