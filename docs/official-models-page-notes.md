# 官方「模型」页的实现级语义（核查笔记 · 完整版）

> **沿革（谁写的哪一部分）**
> - 原任务 `task-5` 的 owner 是子代理 `official-reader`：它在**写出任何文件之前就失败**，零产出。
> - `lead` 随后以**缩减版**接管本文件（§0–§6，主要记录已编码进 `src/client/modelConfigModel.ts` 的部分）。
> - **本完整版由 `official-reader-2` 在 `task-12` 中改写/扩写**：新增 §1–§4（对 lead 已编码算法的**独立复核**，含 `reasoningLevelChoices` 的真 bug）、补齐 §5–§11（原任务要求的逐行提取），并新增 §12 未确认清单、§13 与 lead 实现的差异清单。lead 缩减版中的事实全部保留（并在复核后逐条标注确认/修正）。
>
> **来源与口径**
> - `MODELS` = `C:\Users\28529\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-client-ui-settings-models\lib\client.js`，包版本 `0.2.1-alpha.4`，共 4527 行（读于 2026-10-16）。
> - `PIAI` = `…\@deepseek-ai\dsh-llm-pi-ai\lib\index.js`（2968 行）；`UISET` = `…\dsh-client-ui-settings\lib\client.js`（1511 行）。
> - 我们的实现以 `src/client/modelConfigModel.ts`（469 行，核查时未变动）为准；`scripts/test-model-config.mjs`（335 行）是门。
> - 标注约定：**【事实】**= 在当前版本源码里直接读到；**【推断】**= 由多个事实推出，未运行验证；**【未确认】**= 需要一次运行时读数或另一份证据。
> - ⚠️ `src/client/ModelConfigPage.tsx` 在核查期间正被 `page-builder` 修改，其行号会漂移；引用该文件时同时给出符号名。

---

## 0. 本次交付范围与已编码对应关系

【事实】已直接编码进 `src/client/modelConfigModel.ts` 并由 `scripts/test-model-config.mjs` 钉死的部分：

| 我们的函数 | 我们的位置 | 官方位置 |
|---|---|---|
| `joinProviderDirectory` | `modelConfigModel.ts:69-104` | MODELS:1196-1222 |
| `deriveKeyRef` | `:116-118` | MODELS:1230-1232 |
| `pathOps` | `:305-321` | MODELS:1822-1838 |
| `providerUsable` | `:157-162` | MODELS:1438-1443 |
| `keyConfigured` | `:173-177` | MODELS:2293-2295（`keyConfiguredOf`） |
| `protocolChoices` | `:333-343` + `:371-377` | MODELS:1242-1251 |
| `reasoningLevelChoices` | `:354-364` + `:388-396` | MODELS:1261-1271 |
| `modelsOf` / `validateModels` | `:408-429` / `:441-451` | 官方读取为 `modelDrafts`（MODELS:619-622）；校验为 `validateDeepSeekModels`（:628-660）与 `validateReasoningEfforts`（:318-331），由 `:1903` 组合调用。**注意两者的规则集并不相同**，见 §13-D11 |

【事实】官方**没有**导出的可复用产物：`dsh-client-ui-settings-models` 的 `exports` 只有 `.`、`./client`、`./src/*`；本仓库不 import `./lib/*`，所以上表全部是独立再推导，门的价值就在于把再推导钉在样例上。

---

## 1. 复核结论 · `joinProviderDirectory`（MODELS:1196-1222）

【事实】逐行对照结果：**排序与去重语义完全一致，但官方多展开一个 `nativeAuth` 字段，我们丢了**。

【事实】官方 :1199-1210 构造行时展开五个可选字段：`declared`、`defaultBaseURL`、`baseURLEnv`、**`nativeAuth`**、`error`（:1205-1209）；我们 `modelConfigModel.ts:82-85` 只展开前三个中的 `declared`/`defaultBaseURL`/`baseURLEnv` 和 `error`——**没有 `nativeAuth`**，`contract.ts:145-155` 的 `ProviderDirectoryEntry` 也未声明该字段（全仓 `grep nativeAuth` = 0 命中）。

【事实】`nativeAuth` 不是可有可无的装饰：`PIAI:2841-2857` 的 configurable directory 会给**内置 catalog 路由**带上 `providerDefaultsOf(installed)`（其中含原生鉴权），官方下游确实消费它——MODELS:1379（把 `nativeAuth.env` 一并交给 `credentials/describe`）、:2004-2005（原生鉴权时不再要求密钥、提示 `authRefs`）、:2243/:2308/:2716（`targetOf` → `renderProviderEditor` → 目录添加卡一路传递）。

【事实】排序：官方 `return rows.toSorted((l, r) => rank(l) - rank(r))`（:1221，rank 内联为 account=0 / official=1 / 其余=2）；我们 `return [...rows].sort((left, right) => rank(left.provider) - rank(right.provider))`（:103，rank 见 :100-101，`ACCOUNT_ROUTE='deepseek-account'`、`OFFICIAL_ROUTE='deepseek-official'`）。

【事实/推断】两者**输出逐项相同**：`Array.prototype.sort` 自 ES2019 起被规范要求稳定，`toSorted` 是同一套稳定排序（差别只是「复制后排序」vs「原地排序」），而我们都传了等价的比较器；我们的写法额外避免了依赖 ES2023 的 `toSorted`。→ **不是差异**。

【事实】其余一致：`active` 由注册表集合决定（:1197 ↔ :73）、追加「已注册但未声明」的路由且 `settingsNs:''`/`settingsPath:[]`/`active:true`（:1211-1219 ↔ :88-97）、`declared` 集合按 provider 去重（:1198 ↔ :74）。

---

## 2. 复核结论 · `deriveKeyRef`（MODELS:1230-1232）

【事实】**逐字符等价**：官方 `return \`${provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY\``（:1231）；我们 `modelConfigModel.ts:117` 同一个正则、同一个顺序（先 `toUpperCase` 再替换）。

【事实】「连续分隔符塌成一个下划线」成立：`+` 量词使整段非字母数字成为一个匹配。

【事实（由同一正则唯一决定，未运行）】边界样例（左右两侧行为相同）：

| 输入 route | 结果 | 说明 |
|---|---|---|
| `a--b` | `A_B_API_KEY` | 连续分隔符塌成一个（门的 `test-model-config.mjs:85` 已钉） |
| `-lead-` | `_LEAD__API_KEY` | **首尾各产出一个下划线**；我们从没测过这条 |
| `a.b` | `A_B_API_KEY` | 点与连字符同类 |
| `gpt-5.6` | `GPT_5_6_API_KEY` | 数字存活（`:86` 已钉） |
| `模型` | `__API_KEY` | 整段中文在 `toUpperCase` 后仍非 `A-Z0-9`，整段塌成 1 个下划线，再与后缀的下划线拼成 `__` |
| `---` | `__API_KEY` | 全非字母数字 |
| `''` | `_API_KEY` | 空 route 也给出一个合法（但为空前缀）的引用 |
| `MINIMAX` | `MINIMAX_API_KEY` | 已大写不受影响（`:83` 已钉） |

【推断】上表说明「派生引用名可能以下划线开头」是**可达状态**（`-lead-`、`模型`、`''`）。今天它只是一串键，不会出错；但任何将来对引用名做校验/展示/拼 env 名的地方都必须容忍首尾下划线。

【事实】官方同一规则被用于三处，口径必须一致：`refFor`（:1846-1850，编辑器写入 `apiKeyEnv`）、`targetOf`（:2297，判断「连带删密钥」）、store 的 refs 收集（:1379）。

---

## 3. 复核结论 · `pathOps`（MODELS:1822-1838）

【事实】**逐行等价**，包括三个容易写错的点：

1. previous 回退：官方 `typeof before === "object" && before !== null && !Array.isArray(before) ? before : {}`（:1823）↔ 我们 `isRecord(before) ? before : {}`（:310，`isRecord` 见 :46-48）——同义。
2. 相等判定 `JSON.stringify(previous[key]) === JSON.stringify(value)`（:1826 ↔ :314）——**按 JSON 形状**而非引用比较，所以「重建的草稿内容相同」不产生写入。
3. 「草稿里消失的键」用 `if (!(key in after))`（:1833 ↔ :318）——**是 `in`（含键）而不是读值**。

【事实】复核 task-12 描述里的两个判断，**均成立**：
- 显式设为 `undefined` 的键**仍在** `after` 里（`in` 为真）→ **不会**出 `unset`。
- 更细的一条：它也**不会**出 `set`——`JSON.stringify(undefined)` 求值为 `undefined`，两侧同为 `undefined`，`undefined === undefined` 为真 → `continue`。所以「把某键设成 undefined」在官方和我们这里都是**静默无操作**。

【推断】这正是官方 `setField` 在输入被清空时走 `schema.deletePath`（MODELS:1892-1894）而**不是**赋 `undefined` 的原因；任何镜像实现若用「赋 undefined」表达「清掉这个字段」，会写出零个 op，UI 看起来像保存失败。

【事实】空 `base` 的语义：`pathOps([], undefined, {providers:{}})` → `[{op:'set', path:['providers'], value:{}}]`（门 `test-model-config.mjs:198-200` 钉住），即「空路径」寻址的是 section 根，官方在 `applyOnce` 里用 `[...settingsPath]` 做同样的事（:1939）。

---

## 4. 复核结论 · `protocolChoices` / `reasoningLevelChoices`（MODELS:1242-1251、:1261-1271）

### 4.1 `protocolChoices`：**镜像忠实，无差异**【事实】

官方 :1242-1251：`namespace === undefined → []`；`nodeAtPath(rehydrate(namespace.schema), ['providers', PROBE_ROUTE, 'api'])`；`list?.type !== 'union' || list.list === undefined → []`；否则 `list.list.map(e => e.value).filter(v => typeof v === 'string')`。
我们 `modelConfigModel.ts:337-343` + `unionValues`（:371-377）：同样的守卫、同样的路径、`type === 'union'` + 数组检查、`entry.value`、字符串过滤。
**唯一差别**：官方在 `list` 存在但非数组时会抛（`.map` 未定义），我们返回 `[]`；真实 schemastery 节点下不可达，属更安全的一侧。→ **不是 bug**。

### 4.2 `reasoningLevelChoices`：**镜像错了 —— 官方读的是 union，我们当成 dict**【事实·BUG】

- 官方 :1270：`(((nodeAtPath(rehydrate(namespace.schema), path)?.list ?? []).find((branch) => branch.type === "dict")?.sKey)?.list ?? [])`。→ 路径上的节点**是 union**，dict 只是它的一个分支，档位名在该分支的 `sKey` 上。
- 我们的 `dictValues`（`modelConfigModel.ts:388-396`）第一行就是 `if (node.type !== 'dict') return []`，所以对真实 schema **恒返回 []**。
- 为什么真实节点是 union：`PIAI:1040` `reasoningEfforts: z.union([z.const(false), reasoningEfforts])`，其中 `PIAI:1033` `reasoningEfforts = z.dict(z.union([z.string(), z.const(null)]), z.union(THINKING_LEVELS))`。路径 `['providers', PROBE_ROUTE, 'models', '0', 'reasoningEfforts']` 由 `PIAI:1054` `models: z.array(modelProfile)` + `PIAI:1043-1046` 的 `modelProfile` 决定。
- 门为什么没抓住：`test-model-config.mjs:311-322` 的 fixture 把 **dict 直接**放在 `reasoningEfforts`（没有外层 union），并在 `:289-296` 用一个「直接按属性走」的伪 `nodeAtPath`——**fixture 形状不是真实形状**，所以门是绿的而部署是空的。
- 影响面：`ModelDrawer.tsx:477`（符号 `reasoningLevelChoices` 调用点）拿到的档位列表恒空。
- THINKING_LEVELS 的实际值（`PIAI:299-307`，即「升级顺序」）：`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`。

### 4.3 关于「本部署取不到任何协议选项、整页 0 个 `<select>`」的判定

**结论：【推断，证据较强】不是 schema 形状问题，也不是我们读错；`0 个 <select>` 是观测方法的产物，它对刚打开的官方模型页是预期现象。**

【事实】schema 形状：
- `providers.<route>.api` 的节点 = **union，且没有 default 包装**：`PIAI:1049-1081` 的 `profile = z.object({ …, api: z.union(supportedProtocols()), … })`（`api` 在 :1052）；`PIAI:1083` `Config = z.object({ providers: z.dict(profile).default({}).volatile() })`（`.default()`/`.volatile()` 只写 `meta`，不改 `type`——见 MODELS:3993-3995、:4353）。
- `supportedProtocols()` = `Object.keys(PROTOCOLS)`（`PIAI:847-849`），而 `PROTOCOLS` **恰好 3 项**：`openai-completions`、`openai-responses`、`anthropic-messages`（`PIAI:834-838`，顺序即表格顺序）。→ 读通了必然是 3 项。
- `z.dict()` **不需要特殊处理**：宿主 `nodeAtPath` 已经按「object → `.dict[key]`；dict|array → `.inner`」下降（`UISET:956-965`），探针 route 只需要是 dict 的合法 key（读的是 schema 节点，值不参与）。路径实际走法：`providers`（object `.dict`）→ `\0probe`（dict `.inner`）→ `api`（object `.dict`）。
- 序列化与还原：`namespace.schema` 是 `schema.toJSON()` 的 `{uid, refs}` 信封（MODELS:3828-3841），`rehydrate` = `new Schema(json)`，其 refs 分支会把 `sKey`/`inner`/`list`/`dict` 上的 uid 字符串回链成真节点（MODELS:3786-3796）；`z.union(['a','b'])` 的 list 元素经 `Schema.from` 变成 `{type:'const', value:'a'}`（MODELS:4328、:4059-4063、:4365），所以双方读 `entry.value` 都是对的。
- 我们的绑定没有缺口：`SchemaFace` 就是宿主 `settingsSchema` 的 `rehydrate`/`nodeAtPath`（`src/client/index.ts:123-142`），namespace 视图整对象带 `schema` 存进 store（`modelConfigStore.ts:219-220`，字段声明见 `contract.ts:114-115`）。

【事实】官方页在**静止态本来就没有 `<select>`**：
- 行列表不渲染任何 select（MODELS:2513-2635：只有编辑/删除按钮、凭据圆点、错误文本）。
- 协议 select 在编辑器卡里，且要求 `ownsIdentity = family === 'pi-ai' && props.declared === true`（:1993、:2127-2148），并位于**默认折叠**的 `<details>`「customized」内（:2076-2080）。
- 「目录添加」的 provider select 只在添加卡展开后存在（:2684-2704）；自定义卡的协议 select 只在该面板挂载后存在（:2732-2754 → :1705-1717）。
- 第 4 个 select 在抓取对话框（:419-427）。

【事实·本仓库已有旁证】`shots/model-config-06-official-models-tab-dark.png`（1920×1080；本次核查只读查看）拍的正是官方「模型」页的静止态：只有 `DeepSeek 账号 / DeepSeek / opencode-go / openrouter` 四行与「编辑·删除」按钮，外加 opencode-go 行内展开的「自动重试」——那是官方留给别家插件的槽位 `settings.models.provider-card`（:2616-2620）里的内容，不是官方编辑器本身；**画面里没有任何 `<select>`**。该页标题与说明「填入各提供商的 API 密钥即可使用其模型。」是官方 zh 词典的 `intro`（:3369），可确认它确实是官方页而非本插件页。→ 与上面的代码门控完全一致，进一步支持「静止态 0 个 `<select>` 是预期现象」。

【事实】部署侧也排除了「namespace 缺失」这条路径：`C:\Users\28529\.dsh\profiles\desktop\cordis.patch.yml:34-44` 启用 `dsh-rabbit-model-picker` 与 `llm-pi-ai`，并手写了一条路由 `magpie`（`api: openai-completions`、`baseURL: http://127.0.0.1:3425/v1`）；因此 `state.namespaces.get('llm-pi-ai')` 存在 → `customOffered` 为真（MODELS:2467-2472）。又：`magpie` 不是内置 catalog 路由 → `declared: true`（`PIAI:2850`），所以官方页里 magpie 的编辑卡**会**出现协议 select。

【未确认·5 秒可判】真实运行时值。判法（任一）：打开官方「设置 → 模型」，展开 magpie 行的「编辑」，再展开「自定义 / customized」`<details>`，`document.querySelectorAll('select').length` 应为 1，其 option 恰为上面 3 个协议，`value` 为 `openai-completions`。

【事实·顺带一条正面结论】我们的取值点比官方更稳：官方把 namespace 写死为 `state.namespaces.get("llm-pi-ai")`（:2467），而 pi-ai 的 settingsNs 是 `ctx.fiber.entry?.options.id ?? NS`（`PIAI:2864`）——profile 条目一旦改名，官方探针就空；我们 `ModelConfigPage.tsx`（符号 `ProviderRow`，`protocolChoices(namespace, schema)`；以及 `protocolsOf`）按**行自己的 `settingsNs`** 取，不受改名影响；对非 `llm-pi-ai` 命名空间该路径不存在 → `[]`，与官方的 `layout === 'pi-ai'` 门等价。

---

## 5. `providerUsable` 与凭据语义（MODELS:1438-1443）

【事实】官方 `providerUsable(row)`：
```
if (!row.entry.active) return false;                                    // :1439
if (row.entry.provider === "deepseek-account") return row.accountAvailable === true;  // :1440
if (row.apiKeyEnv === void 0) return true;                               // :1441
return row.credential?.configured === true;                              // :1442
```
我们 `modelConfigModel.ts:157-162` 逐行同构（含 `ACCOUNT_ROUTE` 常量）。门覆盖了三条「不欠密钥」的路径与 account 的登录/登出（`test-model-config.mjs:130-152`）。→ **无差异**。

【事实】三个调用方（决定「本行的语义边界」）：
- `onboardingReadiness`（:1454-1479）：`state.rows.some(providerUsable)` → `provider-ready`；否则找 `deepseek-official + llm-deepseek + settingsPath 为空` 的行，再按 `adapter-absent` / `provider-inactive` / `credentials-unavailable` / `settings-read-only` / `credential-read-only` / `credential-missing` 依次判定——**这是开通引导的状态机，不是本页**。
- `anyUsable`（:2457）→ 传给 `needsSetup`（见 §6）。
- `keyConfiguredOf`（:2293-2295）= 「本行要被描述的那**一个**引用」是否已配置：有 `apiKeyEnv` 就看 `credential`，否则看 `derivedCredential`。我们 `keyConfigured`（:173-177）同构。→ **无差异**。

【事实】凭据是怎么被读进来的（决定 `credential` / `derivedCredential` 何时为 undefined）：官方按 provider 收集 refs——有 `apiKeyEnv` 用它的；没有则用**派生的** `<ROUTE>_API_KEY` **加上** `nativeAuth.env`（:1379）；以 64 个一批调 `credentials/describe`（:1382-1389）；然后 `named` 只在 `apiKeyEnv !== undefined` 时取，`derived` 只在 `apiKeyEnv === undefined` 时取（:1398-1399）——**两个引用互斥**，所以「命名的引用读不到时回退到派生引用」在官方是**不可能发生**的。这正是我们 `credentialRefFor`（:465-469）与门 `test-model-config.mjs:159-163` 钉住的语义。→ **无差异**（但注意我们**没有**镜像 `nativeAuth.env` 那一半，见 §1 与 §13-D2）。

【事实】`credentialChecks`（:1404-1407）只在描述没有失败时出现，用「所有待查引用 → 各自状态」的字典服务编辑器的原生鉴权提示（:2008 消费）；出错时整行不带该字段（:1385-1387 记 `credentialError` 并 break）。

---

## 6. `needsSetup`（MODELS:2281-2285）

【事实】
```
if (anyUsable || row.entry.provider === "deepseek-account") return false;   // :2282
if (row.entry.settingsPath.length > 0) return false;                      // :2283
return row.credential?.configured !== true;                               // :2284
```
只有「整段被 section 拥有的 provider」才会有 `settingsPath.length === 0`（如 `deepseek-official`），所以这个卡片的适用面很窄。

【事实】渲染处 :2525-2547：`needsSetup(row, anyUsable) && !dismissedSetup.has(provider)` → 该行渲染**开通卡片**（内含一个完整的 `ProviderEditor`，`readOnly: !state.writable`）而不是普通行；用户关掉后进入 `dismissedSetup` 集合，不再出现。

【事实·我们的刻意偏差】lead 缩减版 §6.3 已记：本页按 Q13 **不复刻**开通卡。它被记入对等清单 §2 的「显式偏差」。本笔记确认官方行为如上，偏差描述准确。

---

## 7. `applyOnce`（MODELS:1923-1954）

【事实】逐行（lead 缩减版 §1 的转述经复核**准确**，此处补三处它没写的细节，标 ★）：

```
next = (layout === "pi-ai" && stringAt(draft,"apiKeyEnv") === undefined
        && stringAt(fallback,"apiKeyEnv") === undefined && keyValue.length > 0)
       ? schema.setPath(draft, ["apiKeyEnv"], keyRef) : draft          // :1925
if (props.credentialOnly !== true) { 校验 models；失败即返回文案 }        // :1926-1930
if (!credentialOnly && node !== undefined && settingsPath.length === 0)
    { schema.validate(node, next)；失败即返回 }                        // :1932-1935
materializesNativeProfile = layout === "pi-ai" && fallback === undefined
    && committedOriginal === undefined && Object.keys(next).length === 0  // :1936
ops = credentialOnly ? []                                              // :1937
    : materializesNativeProfile ? [{op:'set', path:[...settingsPath], value:{}}]  // :1937-1941
    : pathOps(settingsPath, committedOriginal, next)                    // :1941
if (ops.length > 0) {
    written = await operations.writeSettings(ns, ops, expectedRevision) // :1943
    if (written.kind !== "written") return written.kind === "conflict" ? t("conflict") : written.message  // :1944
    setCommittedOriginal(getPath(written.view.user, settingsPath))      // :1945
    setExpectedRevision(written.view.revision)                          // :1946
    setDraft(next)                                                      // :1947 ★
}
if (keyValue.length > 0) {
    stored = await operations.storeCredential(keyRef, keyValue)         // :1950
    if (stored !== undefined) return stored                             // :1951 ★
}
setKeyDraft("")                                                        // :1953 ★
```

【事实】外套 `apply`（:1955-1967）：`setBusy(true)` → `applyOnce()` → 有失败就 `setFailure` 并**不关卡片**；成功才 `props.onClose(true)`；`finally setBusy(false)`。

【事实】lead 缩减版 §1 的三条要点复核结论：
1. 「先写 profile 再存凭据」成立（:1943 → :1950）；profile 写失败即 return，**不会**去存 key ★并且：凭据写入失败（`stored !== undefined`）**也会**作为失败返回，此时 profile 已经写下去了——即「写一半」是可达状态，卡片保持打开可重试（重试时 `ops` 已为空，只剩凭据那一步）。
2. 「官方撞 conflict 不自动重试」成立（:1944）。本仓库沿用 `RetryCard.tsx` 的「重读 revision 后重试一次」范式（Q12 已定）——**这是刻意偏差，不是漏抄**。
3. 「`materializesNativeProfile` 显式写空对象 `{}`」成立：原因链条经复核为——`PIAI:2946` `const routes = [...profiles().keys()]` → `:2952-2953` 用 routes 注册/替换适配器，所以 **dict 里有没有这个 key 才是「在不在」的杠杆**。

【推断·边界】`materializesNativeProfile` 只可能在「草稿为空」时触发，而草稿为空意味着用户什么都没填。对**内置 catalog 路由**（`declared:false`）来说 `{}` 可由 catalog 补齐 api/baseURL，因此可服务；对**手写路由**（`declared:true`）`{}` 不成立，但那种情况下草稿不可能为空（route/api/baseURL/models 都得填）。另有写入期校验兜底：`PIAI:2885-2891` 在每次配置变更时对**新增/变更**的 profile 调 `assertServiceable`，不可服务的 profile 会抛错。

【事实】`stringAt`（:1888-1891）要求**非空且 trim 后非空**的字符串，所以「字段是空串」与「字段缺失」在 `applyOnce` 的第一个条件里等价。

---

## 8. `removeProviderProfile` + `targetOf`（MODELS:2260-2271、:2296-2309）

【事实】`targetOf(row)`（:2296-2309）返回 `{provider, displayName, settingsNs, settingsPath}`，并按需带上 `credentialRef`、`declared:true`、`defaultBaseURL`、`baseURLEnv`、`nativeAuth`。**注意它不带 `error`**（错误文本由行本身渲染）。
```
managedRef = deriveKeyRef(row.entry.provider)                          // :2297
credentialRef = (row.apiKeyEnv === managedRef && row.credential?.configured === true
                 && row.credential.writable) ? managedRef : undefined  // :2298
```

【事实】`removeProviderProfile`（:2260-2271）：
```
if (target.credentialRef !== undefined) { f = await removeCredential(ref); if (f !== undefined) return f }  // :2261-2264
written = await writeSettings(target.settingsNs, [{op:'unset', path:[...target.settingsPath]}], undefined)   // :2265-2268
if (written.kind !== "written") return written.message                                                      // :2269
await controller.load()                                                                                     // :2270
```
lead 缩减版 §2 的三条要点复核结论：**全部成立**。
1. 先删凭据、失败即整体中止（profile 不动），因此「行还在、可整体重试」。
2. 连带删 key 的条件很窄（`apiKeyEnv === 派生引用 && configured && writable`）→ 用户手填的自定义引用名不会被连带删除，官方只删配置（词典 `deleteDescription` vs `deleteDescriptionWithCredential` 的差别即此，:2782）。
3. 删除用**无栅栏写**（`expectedRevision` 传 `undefined`，:2268）。官方注释未解释原因；【推断】删除是幂等的目标态（「让这个 key 消失」），设栅栏只会让并发的无关编辑令删除失败，而失败对用户没有意义。

【事实】调用侧：删除需先确认（:2777-2801 的 `Modal`，`deleteTarget` 非空才开），`confirmDelete` 走 :2413 的 `removeProviderProfile(operations, controller, deleteTarget).then(...)`；失败文本就地渲染（:2797-2800），成功由 `controller.load()` 刷新。删除弹窗的两个按钮只按 `deleting` 禁用（:2787、:2793），**不受只读态影响**——因为能打开弹窗的「删除」按钮在只读态已被禁用（见 §10）。

### 8.1 附：「启停」为什么无处可落（lead 缩减版 §3 保留）

【事实】宿主没有 enable/disable。唯一真实的可用性杠杆是 **profile 的存在性** 与 **凭据的 set/unset**（§7、§8）。逐包穷举见 `docs/settings-models-tab-feasibility.md` §7.5。
【事实】补充的实现层证据：**空 profile `{}` 仍会注册路由**（`PIAI:2946-2953` + §7 第 3 点），因此「把字段清空」**不能**当停用。

---

## 9. `catalogEnabled` / `customOffered` / `protocols` 与「添加」流程（MODELS:2457-2477、:2637-2774）

【事实】四个输入：
```
anyUsable   = state.rows.some(providerUsable)                                  // :2457
configured  = state.rows.filter(row => row.configured)                         // :2458
configurable= state.rows.filter(row => state.namespaces.has(row.entry.settingsNs))  // :2459
addable     = 行中存在 namespace 且该行 !configured 的 {row, namespace}         // :2460-2466
piAi        = state.namespaces.get("llm-pi-ai")                                // :2467
protocols   = protocolChoices(piAi, schema)                                    // :2468
reasoningLevels = reasoningLevelChoices(piAi, schema)                          // :2469
catalogOffered = configurable.length > 0                                       // :2470
catalogEnabled = addable.length > 0                                            // :2471
customOffered  = piAi !== undefined                                            // :2472
customEnabled  = protocols.length > 0                                          // :2473
bothOffered    = catalogOffered && customOffered                               // :2474
mode           = bothOffered ? addMode : customOffered ? "custom" : "catalog"   // :2475
```

【事实】「添加」是一个按钮后的一张卡（:2756-2774）：按钮 `disabled: !state.writable || state.status !== "ready" || (!catalogEnabled && !customEnabled)`（:2761）；点击后 `initial = catalogEnabled ? "catalog" : "custom"`（:2765）——即**没有可添加的目录项时直接落到自定义**。
【事实】卡片内部（:2639-2755）：`bothOffered` 时才渲染 `SegmentedControl`，两个 tab 的禁用分别由 `catalogEnabled`（:2652-2653）与 `customEnabled`（:2657-2658）决定（禁用时带 `title` 文案 `addCatalogExhausted` / `addCustomUnavailable`）；只有一个模式可选时改为静态标题（:2664-2669）。
【事实】面板「挂载一次后保持挂载但隐藏」（`mounted`/`visited`，:2476、:2662、:2675-2681、:2732-2738），切换模式不丢草稿；切换开关在任一写或抓取在飞时锁定（`switchLocked = catalogBusy || customBusy`，:2477）。
【事实】目录面板：一个 provider `<select>`（:2689-2704，`disabled: catalogBusy`）+ 一个 `ProviderEditor`（:2706-2724，带上 `defaultBaseURL`/`baseURLEnv`/`nativeAuth`/`credentialChecks`）。自定义面板：`CustomProviderCard`（:2740-2753，传入 `taken`、`protocols`、`reasoningLevels`、`revision`、`readOnly`）。
【事实】`CustomProviderCard.createOnce`（:1596-1619）：一次写 `set path ['providers', route]`，值含 `displayName?`、`apiKeyEnv?`（仅当用户输了 key，取 `deriveKeyRef(route)`，:1597、:1602）、`api: protocol`、`baseURL`、`models`；写成功才 `storeCredential`；`openedAt` 是打开卡片时抓的 revision，用作栅栏（:1560、:1611）。必填判定 `ready` 见 :1593。

---

## 10. 只读态逐控件清单（`state.writable === false`）

【事实】只读来源：`mirrored.view.writable`（:1362、:1395），语义是「部署的设置文档不接受写入」。

【事实】逐控件：

| 控件 | 位置 | 只读态行为 |
|---|---|---|
| 顶部说明 `t("readOnly")` | :2503-2506 | `!state.writable && status === "ready"` 时渲染 |
| 行「编辑」按钮 | :2588-2599 | `disabled: !open && state.status !== "ready"`——**不因只读禁用**（仍可展开） |
| 展开后的编辑器 | :2621-2632（`readOnly: !state.writable`）→ :1880 `disabled = props.readOnly \|\| busy` | 内部**全部字段禁用**：显示名 :2095、baseURL :2115、api `<select>` :2136、密钥输入 :2061、模型目录编辑器（`catalogProps.disabled` :2037 → :2153-2161）、提交按钮（`submitDisabled: disabled \|\| …` :2195） |
| 行「删除」按钮 | :2600-2612 | `disabled: !state.writable \|\| state.status !== "ready"` → **只读禁用** |
| 「添加」按钮 | :2756-2773 | `disabled: !state.writable \|\| status !== "ready" \|\| …`（:2761） → **只读禁用** |
| 目录面板 provider `<select>` | :2689-2704 | `disabled: catalogBusy`（只读时该面板本不可达） |
| 自定义卡片字段 | :1642-1740 | `disabled = readOnly \|\| busy`（:1583）；`profileDisabled = disabled \|\| committed`（:1585）用于 route/显示名/baseURL/协议 `<select>`（:1648、:1672、:1690、:1709）；密钥输入用 `disabled`（:1731） |
| 删除确认弹窗 | :2777-2801 | 按钮只按 `deleting` 禁用 |

【事实】取消（`props.onClose(false)`，:2199-2201）不因只读禁用——只读态仍可退出编辑器。
【推断】只读态的设计意图是「**读与导航仍可用，写入全禁用**」：编辑按钮不禁用，是为了让用户仍能看清某个提供商配了什么（与 lead 缩减版 §4 的结论一致）。

---

## 11. `refreshIfLoaded` 与五个事件（MODELS:4408-4411、:4467-4484）

【事实】
```
function refreshIfLoaded(controller) {                       // :4408
    if (controller.store.getSnapshot().status === "idle") return;   // :4409
    controller.load();                                              // :4410
}
```
【事实】订阅（`ctx.effect`，:4467-4484）：`ctx.remote.$on("settings/document-updated")`、`credentials/record-updated`、`credentials/reference-updated`、`llm/adapters-updated`（四个 Remote 事件），加 `ctx.on("connection/reset")`；五个监听器都指向同一个 `refreshModels = () => refreshIfLoaded(controller)`。卸载时 `dispose()` 全部退订（:4480-4483）。
【事实】`refreshIfLoaded` 被导出（:4522），供其他插件在失效后唤醒模型页。

【事实·我们的等价做法】本插件用 `src/client/modelConfigStore.ts` 的 `start()`：订阅只存在于组件挂载期间，卸载即退订，因此关闭的设置面板不持有监听器，不可能被事件唤醒去拉取——不需要 `refreshIfLoaded` 那样的显式 `idle` 标志，因为 store 生命周期不长于组件。订阅的事件集合与官方一致。

---

## 12. 未确认清单

1. 【未确认】§4.3 的运行时读数：官方页 magpie 编辑卡展开后协议 select 是否为 1 个、option 是否为 `openai-completions`/`openai-responses`/`anthropic-messages`。这是把 §4.3 从「推断」升级为「事实」的唯一缺口；也是判断「本部署 0 `<select>`」到底是观测伪影还是另有原因的最后一环。**两个等价判法**：① 展开后数字 select 的 option；② 打开「添加」卡片，看「自定义」tab 是否禁用——若禁用，其 `title` 会是 `addCustomUnavailable` = 「没有可用的 API 协议。」（MODELS:2657-2658、:3386），那就是协议列表真的为空（`customEnabled = protocols.length > 0`，:2473）。
2. 【未确认】§2 边界样例表是按同一正则**推导**的，未实际执行（本任务约束不跑脚本）。结论不受影响（两侧正则逐字符相同），但如果要在文档里引用为「实测」，需要有人跑一次。
3. 【未确认】§7「凭据写入失败会留下已写好的 profile」是从 :1950-1951 的控制流推出，未见官方注释确认这是有意设计（**推断**，不是事实）。
4. 【未确认】§8.1 第 3 条「删除为何不设栅栏」：代码只有事实（传 `undefined`），原因注释缺失（**推断**）。
5. 【未确认】`nativeAuth` 在**本部署**的实际取值：`PIAI:2841-2857` 会给内置 catalog 路由带上 `providerDefaultsOf(installed)`，但哪些路由带 `nativeAuth`、`env` 有几个，未读 `providerDefaultsOf` 与各 provider 声明，未确认。
6. 【未确认】官方 `EditorFooter`（MODELS:204）内部是否还有别的只读相关禁用（本笔记只核到调用点 :2192-2206 的 `submitDisabled`）。

---

## 13. 与 lead 实现的差异清单

只列 `src/client/modelConfigModel.ts` 里镜像官方决策的函数（task-12 A 部分要求复核的 4 组见 D1/D3/D4/D5/D6；D2/D7–D12 是复核过程中在同一模块内顺带发现或确认的）。**有差异 = 可能有 bug**。

| # | 项 | 官方 | 我们 | 判定 |
|---|---|---|---|---|
| **D1** | `reasoningLevelChoices` 节点形状 | MODELS:1270 取 `nodeAtPath(...).list` 再 `find(branch => branch.type === 'dict')` → 读该分支 `sKey.list`；路径上是 **union** | `modelConfigModel.ts:388-396` 要求 `node.type === 'dict'` → 真实 schema 下**恒 `[]`** | **BUG·功能影响**：抽屉里的推理档位选择器恒空（`ModelDrawer.tsx` 的 `reasoningLevelChoices` 调用点）。门 `test-model-config.mjs:311-322` 的 fixture 形状是错的，**必须同步改**，否则修完仍是假绿 |
| **D2** | `joinProviderDirectory` 可选字段 | MODELS:1208 额外展开 `nativeAuth`；下游 :1379/:2004/:2243/:2308/:2716 消费 | `modelConfigModel.ts:82-85` 不展开；`contract.ts:145-155` 无该字段（全仓 grep=0） | **偏差·当前无用户可见影响**（`src/` 无消费者），但 join 已非忠实镜像；若要做原生鉴权提示会静默拿不到 |
| D3 | 排序 | `rows.toSorted(cmp)`（:1221） | `[...rows].sort(cmp)`（:103） | **无差异**（比较器等价；`sort` 自 ES2019 规范稳定，`toSorted` 同套稳定排序） |
| D4 | `deriveKeyRef` | `:1231` 正则 `/[^A-Z0-9]+/g` | `:117` 同 | **无差异**（边界样例见 §2；`-lead-`/`模型`/`''` 未进门但有价值） |
| D5 | `pathOps` | :1822-1838 | `:305-321` | **无差异**（含 `key in after`、`JSON.stringify` 判定、previous 回退） |
| D6 | `protocolChoices` | :1242-1251 | `:333-343` + `:371-377` | **无差异**（唯一差别：官方在 `list` 非数组时会抛，我们返回 `[]`，更安全） |
| D7 | `providerUsable` | :1438-1443 | `:157-162` | **无差异** |
| D8 | `keyConfigured` / `credentialRefFor` | :2293-2295 / :1379（named 与 derived 互斥） | `:173-177` / `:465-469` | **无差异**（未镜像 `nativeAuth.env` 那一半，与 D2 同源） |
| D9 | `needsSetup` | :2281-2285 | 刻意不复刻（Q13，见对等清单 §2「显式偏差」） | **刻意偏差**，非 bug |
| D10 | conflict 处理 | 官方不重试（:1944） | 本仓库按 Q12 走 `RetryCard.tsx` 的「重读+重试一次」 | **刻意偏差**，非 bug |
| **D11** | `validateModels` 的「id 必须存在且唯一」 | MODELS:633-643：先 `id.trim()`，**空白 id 被拒**（`modelIdRequired`），**重复按 trim 后判定** | `modelConfigModel.ts:445-449`：用原始 `model.id`——`'   '`（纯空白）被**接受**，`' a'` 与 `'a'` **不算重复** | **BUG（低危）·不在 A1–A4 四组内但在同一镜像模块**：手写/粘贴带空白的 id 会通过门，而适配器会在后续校验/写入时拒绝或两条 id 折叠成一条 |
| D12 | `modelsOf` 的读取口径 | `modelDrafts`（:619-622）只把非对象项换成 `{}`，**不丢行**；id 的存在性由校验器负责 | `modelsOf`（:408-429）**丢弃**没有非空字符串 id 的行 | **偏差（极低危）**：只有手改配置造出 `{}` 行时才可见（schema 要求 `id` 必填，正常写入不可达）。列此备查，不建议改 |

**建议处置**：**D1 立即修**（连带把 fixture 改成 union 包 dict，否则门仍是假绿）；**D11 建议顺手修**（trim 后再判空/判重，与官方一致，成本一行）；**D2 由 lead 决定**（是否保留「忠实镜像」的地位：今日无 UI 影响，但 `nativeAuth` 是官方 join 的一部分）；D3–D8 无需动作；D12 不建议改；D4 建议补 `-lead-` / `模型` / `''` 三条边界样例进门。
