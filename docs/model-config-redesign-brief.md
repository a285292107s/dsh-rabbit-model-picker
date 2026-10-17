# 「模型配置」页 UI 重构 · 冻结契约（Lead 下发，2026-10-16）

> 本文是本次重构的**唯一权威决策书**。实施者按本文做，不要另发明方向；发现本文自相矛盾或有漏，
> **先问 Lead**，不要自己拍。文档（`docs/design-model-config-tab.md`）与 README 由 designer / Lead 收口。
>
> 目标：设置 → 模型配置 页的**全面 UI 重构**。**能力一条都不减**（`docs/models-page-parity-checklist.md`
> §1 的 A–E），已实现的行为一条都不退（`scripts/verify-model-config-tab.cjs` 现有 13 项必须继续全绿）。

---

## 1. 方向（已跑 `draw.mjs`，不要重跑、不要换）

- **方向：`quiet-instrument`（The quiet instrument）**，seed **1258196331**，`--keep palette,type`
  （色与字来自宿主，不引入新字体、新色值）。
- 命令与完整 direction sheet：`.taste-skill/direction.json`（`node <skill>/scripts/draw.mjs --show` 重印）。
- 三选一里另两个是 `dense-tiles`（贴边瓦片板）与 `one-motif`（单一形体母题）。
  - `dense-tiles` **否**：它字面要求「贴边填满、无空格」，正是本页要避开的卡片/瓦片矩阵。
  - `one-motif` **否**：需要一个形体母题，设置分区里没有形体可借。
  - **选 `quiet-instrument` 的理由**：本页的核心事实是「十行里没有一行需要我；若有一行需要，它是唯一一个」
    （旧审计 §10.1 的结论）。**克制本身就是主张**——这正是 quiet-instrument 的论点，
    而且它与「设置分区不能大喊」这条宿主约束天然一致。

### 1.1 我必须写下的两句（skill 第 4 步要求）

**idea 句**：

> 在这页上，**「这个提供商现在能不能服务我的请求」——数据层已经逐行回答的那个问题
> （`providerUsable` / `keyConfigured`）——成为页面唯一的大声处：一句只数「需要处理的提供商」的就绪陈述；
> 下面十行保持同一个小组尺寸，身份在左端、那一行的答案在右端，于是列表读起来是一列陈述，不是一格控件表。**

竞品检验：把官方「设置 → 模型」页放进去——它用开通卡 + 卡片网格表达同一件事，**没有一句计数陈述**，
右端也不是答案列；把任何一个「一列可编辑设置」的界面放进去——**它没有那个可数的二元事实**。
所以这句话只属于本页。

**live thing（唯一那个会变的东西）**：

> 页面顶部的**就绪陈述**（`.dmc-readout`）：它读自己的十行真实状态，印出需要处理的行数；
> 用户存 key / 清 key / 添加 / 删除提供商后它当场重算；零问题时说「全部可用」，
> 一行都没有时说「尚未添加」；没有脚本也照样读得懂（十行的答案词本身就是它的平铺版）。

**为什么这不是「加一个统计块」**：它是我在 `modelConfigModel.ts` 里已有的纯函数（`providerUsable`）的**直读**，
不是新事实；且它是页面唯一的大尺寸元素（见 §3.1）。旧审计 §10.1 已提出过它（`dmc-summary`，待实现），
本次把它**升为页面唯一的大声处**，这是本次相对旧稿的唯一一处主动修订，理由记在这里。

---

## 2. 状态模型：`data-usable` 拆成 `data-state`（必须做）

旧审计 §9.6 实测：`data-usable` 把两件不相干的事压成一个布尔（38 个休眠提供商与缺密钥共用红底），
且筛选后**恒为 true → 那根 4px 竖条在真机上 0 次出现**。本次按下表落地：

| `data-state` | 判据（**纯函数，不要另写判断**） | 出现在 | 视觉强度 |
|---|---|---|---|
| `ready` | 已添加 **且** `providerUsable(row)` | 列表 | **0 个标记**：无填充、竖条留空 |
| `missing-key` | 已添加 **且** 该行有凭据引用 **且** `!keyConfigured(row)` | 列表 | **竖条**（`--dsw-alias-state-error-primary`）+ 词 `缺密钥`；**不铺整行底色** |
| `unreachable` | 已添加 **且** `!providerUsable(row)` | 列表 | 竖条 + 词 `不可用` + **整行 Rung 1 底色**（唯一允许铺底色的状态） |
| `error` | 已添加 **且** 该行有诊断（会话失败或 `entry.error`） | 列表 | 竖条 + 可展开的诊断句（primary ink）；与上面可叠加 |
| `dormant` | `!added` | **只在 picker** | **0 个标记**。休眠是「可添加」，不是出错——`data-state="dormant"` 只做可访问性钩子，不画任何东西 |

**强度纪律**：列表里**只有 `unreachable` 允许铺整行底色**；`missing-key` 只给竖条 + 词（缺 key 是「还没配完」）。
竖条只画 `missing-key` / `unreachable` / `error`，其余留空——十行里若有 2 行亮，读者看到的是「2 个标记 + 8 个空槽」。

**过渡期兼容**：`data-usable` **保留为别名**（`data-usable="false"` ⇔ `data-state === 'unreachable'`），
因为 `scripts/selfcheck-static.mjs` 的 dmc- 分支与既有测试引用它。别名删不删由 verifier 定，但**两处必须同时存在**。

**答案词（`.dmc-verdict`）**：**每一行都渲染，永远只有一个词**，取值就是上表的词：
`可用` / `缺密钥` / `不可用`。**复用 `modelConfigCopy.ts` 里已存在的 `config.verdict.{ready,missingKey,unavailable}`，
不要发明第三套词汇**（`config.verdict.dormant` 在列表里不用；picker 里也不要拿它给休眠行贴标签）。
`ready` 行用 secondary ink；`missing-key` / `unreachable` 行用 primary ink。醒目度靠**竖条 + 墨色**，不靠底色。

---

## 3. 构图（quiet-instrument 落到这个分区）

### 3.1 一个窄列，一个大东西

- **一个窄列**：`.dmc-page` `max-width: 560px`，**左对齐**（它住在宿主设置面板里，不居中）；
  在 `.dmc-page` 上设一次 `container-type: inline-size`。
- **页面唯一的大声处**：`.dmc-readout` —— 就绪陈述，**20px / 28px，600，primary ink，≤2 行**（任何宽度）。
  它在 `.dmc-title`（16px，与官方页 `.zGbnIq_title` 同值）下面，是页头里唯一比正文大的东西。
  它**取代** `config.intro` 那句话（那句是「填入密钥即可使用」式的通用说明，信息量为零）。
- **页头 = 标题 + 就绪陈述**，没有 eyebrow、没有胶囊、没有分隔线（房子规则）。
- 列表**没有列 key**（`.dmc-list-head` 与 `.dmc-list-head-cell` **删除**）：行的两端自明（左身份、右答案），
  旧稿的 4 格列 key 是给 5 列控件用的，控件已经不再是五列（§3.2）。这是一处**有意删减**，要记进文档。

### 3.2 行 = 一列陈述 + 一行控件（本页的核心）

一行两段，**两段之间不画任何线**（房子规则禁 1px 分隔线），靠行内节奏与列对齐分开：

```
<li class="dmc-row" data-state="…">
  <span class="dmc-rail" data-state="…" aria-hidden="true" />      4px，贯穿两段
  <span class="dmc-name">{显示名}<span class="dmc-route">{provider}</span></span>   段1 左端；.dmc-name 仍包住 .dmc-route
  <span class="dmc-verdict" data-state="…">可用</span>                            段1 右端，右对齐
  <div class="dmc-edit">                                                          段2：控件，全部去铬
    … .dmc-key / .dmc-protocol / .dmc-catalog / .dmc-enable / .dmc-error-toggle
  </div>
  <p class="dmc-error-text">…</p>                                                仅展开时
</li>
```

**段 1（陈述行的两端）**
- 左端 = 身份：`.dmc-name`（15px/22px，600，primary ink，**仍然包含 `.dmc-route` 子元素**——
  `scripts/verify-model-config-tab.cjs` 的 A3 量 `.dmc-name` 宽度 **≥140px**，所以**不要把 `.dmc-name` 缩成纯文本节点**，
  也不要给它套一层新 wrapper 把宽度拿走）。`.dmc-route` 12px secondary ink，紧贴名字。
- 右端 = 答案：`.dmc-verdict`，13px，`justify-self: end`，`font-variant-numeric: tabular-nums`，
  逐行对齐成一列。A4 量它在五个视口里都在视口内，**不要让它被推出**。
- 两端在**同一行**上；名字可以换行，答案与名字第一行对齐。

**段 2（控件的去铬）**
- 底线：**每行最多只有一个 1px 边的控件**——`<select class="dmc-protocol">`。它是真表单控件，
  房子规则明确豁免（`docs/design-model-config-tab.md` §5.6 第 3 条）。
- 其余全部改成**文字动作**：无 border、无 background（rest）、无 radius、无 shadow，
  12px，secondary ink，`:hover`/`:focus-visible` 时升到 primary ink 或 `--dsw-alias-interactive-bg-hover`。
  适用：`.dmc-key-action`、`.dmc-key-clear`、`.dmc-catalog`、`.dmc-enable`、`.dmc-error-toggle`。
  **这是本次最大的一处减负**：旧稿每行最多 5 个 1px 描边框 × 10 行 = 50 个框；重构后 = 10 个（只有 select）。
  房子规则「No thin rules / no 1px outlined boxes」本来就要求这一步。
- `.dmc-key-state`（"API 密钥已配置 / 未配置"那个词）**删除**：它与右端的答案词说的是同一件事
  （旧审计 §10.2 已指出这处语义重叠）。凭据格只留动作：`替换密钥` / `设置密钥`（沿用现有 `config.key.*`）+ `清除`。
- **每个控件的可见性判据一律不改**：什么行有凭据格、什么行有清除、什么时候出现诊断按钮、
  什么时候禁用——**照抄现有 `ModelConfigPage.tsx` 的条件表达式**。本次只改构图、不改条件。

### 3.3 一个 accent，一处

- 页面唯一的 accent 用在**唯一的主操作**上（「添加模型提供商」`.dmc-add`）。
- **不许**把 accent 当底色写文字：实测 `--dsw-alias-state-business-primary` 上的白字是
  **4.2349:1（浅）/ 2.3278:1（深）**，两主题都不达 4.5:1。`selfcheck-static.mjs` 有硬断言拦这条。
- accent 只做**边缘或实心块**：本页取「`.dmc-add` 的 2px 实心 accent 下沿」（图形，3:1 门槛，浅 4.2349 / 深 7.8343 → 达标），
  文字仍用 primary ink（17–19:1）。**2px 是实心形状，不是 1px 描边框**；除此之外页面上不许再出现 accent。
- 列表里**没有** accent：列表唯一的颜色是状态色（它是事实，不是行动）。

### 3.4 窄容器分支：`@container`，不是 `@media`

旧审计 §9.2 实测：宿主面板宽 800px **与视口无关**，所以 `@media (max-width: 900px)` 在 1920 视口下永不触发；
390 视口下宿主只给内容列 106px，旧稿在那里溢出 242px。**正解就是查容器**：

- `.dmc-page { container-type: inline-size }`，分支写成 `@container (max-width: 520px) { … }`
  （必要时再加一档 `@container (max-width: 360px)`）。
- 窄容器下：两段竖直堆叠，竖条**贯穿全部段**（扫描列不断开）；控件允许换行；
  `.dmc-verdict` **不许**被推出容器；触屏目标 ≥40px。
- `scripts/selfcheck-static.mjs` 里有一条 `check('model config: a max-width branch exists', /@media[^{]*max-width\s*:/)`
  ——改成 `@container` 后这条会红。**这不是放宽**：verifier 把断言改成「存在窄容器分支」并同时保留
  「存在 `@container`」这一条（见 §6）。

---

## 4. 动效（要有一条声线，且要诚实）

保留并统一：**只有 transform / opacity / 背景色**，一条曲线，全部有 `prefers-reduced-motion` 分支。

1. **控件反馈**：每个可聚焦控件都有 hover / focus-visible / active 反馈（按压 1px 沉降或背景步进）。
2. **抽屉进出**：`.dmc-drawer` 从右侧滑出（transform），scrim 同步；这条已有，保持。
3. **答案词落定**（新的签名动作，quiet 的一条）：某行的 `data-state` 变化时，`.dmc-verdict` 用
   160ms 的 transform + 颜色落定一次——状态变化是**可见的事件**，但它只动那一个词。
4. **就绪陈述重算**：`.dmc-readout` 的数字用 `tabular-nums`，数值变化时同样只做一次落定，不跳动整行。

**明确不做的**（写进文档与报告，不要偷做）：滚动入场stagger、逐段淡入、首屏 masked headline reveal。
理由：这是**别人的设置面板里的一个分区**（skill 的 Special case「A component or a single section, not a page」），
在里面做首屏编排动画是错的。skill 的「≥8 个移动元素」下限**我们有意不接受**并记录后果——
替代证据是**在真机里直接量**：transition 存在、`prefers-reduced-motion` 下内容仍在且不再位移（verifier 出数）。

---

## 5. 图片：0 张 raster，理由与替代

- 本页**不放任何照片**。依据不是我们的偏好，而是**方向自己的第 5 节**：
  「This subject is software and there are no screenshots, so its pictures are its own interface.」
  而房子规则同时禁装饰形状与假仪表盘。`assets.mjs` 的开放图库在本题材下没有诚实可查的东西。
- 替代（也是方向的原文要求）：**真实的界面片段**。本页的「图片」就是**十行真实渲出的提供商行**——
  真 provider 名、真 route id、真错误原话、真协议取值。按 skill 对 software 的口径，真实界面片段计入图片下限。
- 我们**不用** `data-ui` 属性（旧稿 §6 第 10 条已定）：本页整块是宿主页面的真实界面，不是裁出来的片段，
  套上 `data-ui` 会把房子规则整片关掉。这条保持。

---

## 6. 门（谁改、改成什么、不许弱化）

**现状（实测）**：`dmc-` 只被 `selfcheck-static.mjs` 的 9 行覆盖（死类、硬编码色、radius、dashed、淡化、
`--dsw-` 计数、`:focus-visible`、`prefers-reduced-motion`、`max-width` 分支、状态色不画文字、accent 不写字）。
`check-contrast.mjs` **只读 `src/client/styles.ts`**——`dmc-` 与 `drc-` 的文字**一个像素都没被量过**。这是已知缺口。

1. `scripts/selfcheck-static.mjs`（verifier）
   - 保留全部现有 dmc- 断言。
   - `max-width branch` 那条改为**同时**接受 `@container`：断言语义变成「存在窄容器分支」，
     并新增一条「`@container` 分支与 `container-type: inline-size` 都在」。
   - 新增：新类名（§7）在 sheet 与 TSX 双向对齐；`data-state` 的**全部取值**都被 TSX 用到、且 sheet 只对
     §2 允许的状态画标记（例如静态断言「只有 `unreachable` 的规则里出现整行 `background`」）。
2. `scripts/check-contrast.mjs`（verifier）——**本轮的门的正题**
   - 让它**也读** `src/client/modelConfigStyles.ts` 与 `src/client/drawerStyles.ts`。
   - 把 `dmc-` 的**每一处画文字的规则**登记进 `STYLES`，补齐 `CONTAINERS` 链（含 `.dmc-row`、`.dmc-edit`、
     `.dmc-drawer` 等祖先）。
   - 结果必须是「每个画文字的样式都被量到，且都过 AA」，两主题；没量到的规则要**报红**而不是静默跳过。
   - 状态色/三级 label 令牌**不得**被登记成文字色——它们本来就只做图形（§2）。
3. `scripts/verify-model-config-tab.cjs`（verifier）
   - **A1–A13 一条都不许弱化**（它们的语义：tab 位置、行数、名字列 ≥140、五档无横向滚动、官方页仍在、
     座位仍是 dmp-、凭据入口、抽屉形态、保存门、Tab 走通、发现三步、Esc 只关抽屉、console 无噪）。
   - 新增重构专属检查（建议编号 R1…）：
     - R1 `.dmc-readout` 存在、≤2 行、字号 > 正文、且**与行状态一致**（把十行的 `data-state` 数一遍，
       与陈述里的计数对账）。
     - R2 每行 `.dmc-verdict` 的词与 `data-state` 对得上；`ready` 行无竖条、`missing-key`/`unreachable` 有竖条。
     - R3 只有 `unreachable` 行有整行底色（`ready`/`missing-key` 行背景 = 页面底色）。
     - R4 带 1px 边框的控件每行 ≤1 个（数 `getComputedStyle(el).borderTopWidth !== '0px'`）。
     - R5 深/浅两主题各一张截图（浅色走「设置 → 外观」，`scripts/_audit-shots.cjs` 已有做法）。
     - R6 `prefers-reduced-motion` 下：内容齐全、无位移（`emulateMedia`）。
     - R7 转子：`.dmc-page` 的 `container-type` 生效，且在**容器**约 106px / 484px 两档各测一次
       （而不是只测视口），无横向溢出。
4. **默认门**：`npm run typecheck` / `selfcheck` / `contrast` / `test:params` / `test:retry` /
   `test:model-config` / `test:model-config-copy` 全部继续绿。`npm test` 由 **Lead** 跑（它会写 `lib/`）。

---

## 7. 类名契约

**必须保留（`verify-model-config-tab.cjs` 在用，名字不许改）**：
`.dmc-page` `.dmc-row` `.dmc-name` `.dmc-route` `.dmc-verdict` `.dmc-key` `.dmc-catalog`
`.dmc-drawer` `.dmc-model-row` `.dmc-model-id` `.dmc-btn-commit` `.dmc-drawer-status`
（另：`role=dialog` / `aria-modal` / `position: fixed` 贴右缘、页面仍在渲染）。

**新增（本次冻结，供 verifier 写检查）**：`.dmc-readout`（就绪陈述）、`.dmc-edit`（行的控件段）。

**删除（连同 sheet 里的规则一起删，死类门两个方向都查）**：
`.dmc-list-head` `.dmc-list-head-cell` `.dmc-key-state`（理由分别在 §3.1 / §3.2）。

**其余类名照旧**，只改规则内容。加任何新类名前先想清楚「它是不是一个已有的段」——
本次只批准 `.dmc-readout` 与 `.dmc-edit` 两个新类。

---

## 8. 文案（谁落、落到哪）

- **复用**：`config.verdict.{ready,missingKey,unavailable}`（已存在于 `modelConfigCopy.ts` 三块：KEYS / zh / en）。
  行内控件文案沿用现有 `config.key.*` / `config.api.*` / `config.models.*` / `config.add*` / `config.remove*`。
- **新增（只有三个键，措辞可由 designer 微调，键名冻结）**：
  | 键 | zh | en |
  |---|---|---|
  | `config.summary.ready` | `{count} 个提供商，全部可用` | `{count} providers, all usable` |
  | `config.summary.attention` | `{count} 个提供商可用，{issues} 个需要处理` | `{count} usable, {issues} need attention` |
  | `config.summary.none` | `尚未添加任何提供商` | `No providers added yet` |
- **退役**：`config.intro`（被 `.dmc-readout` 取代）。退役要**三块一起删**，否则 copy 门会红。
  删之前先跑 `npm run selfcheck` 确认没有别处引用它。
- 中英**同键同序**；`{count}` / `{issues}` 用既有的插值习惯，不要新造插值语法。

---

## 9. 明确不动的（越界即返工）

- `src/client/index.ts` 的注册（`rabbit-model-config`，无 priority）——selfcheck 钉住了，不许碰。
- `src/client/modelConfigModel.ts`、`modelConfigStore.ts`、`params.ts` 的**任何行为**。
  本次是 UI 重构：**不改数据层、不改 Host 写入路径、不改事件订阅**。
- 座位（`dmp-`）与重试卡（`drc-`）两张表：不在 scope。**不要顺手改 `drc-btn-primary` 的对比度缺陷**
  （旧审计 §9.3 记了它，那是另一个任务，改了会让本轮 diff 说不清）。
- 抽屉的**形态**（右侧、fixed、aria-modal、保留页面上下文）与**三步发现**（发现 → 勾选 → 落盘）：
  形状不许变，只做视觉重构。
- `.dmc-menu` / 参数面板（`SettingsMenu`）不在 scope。

---

## 10. 分工与写范围（不要越界写别人的文件）

| 谁 | 独占写范围 |
|---|---|
| **designer** | `src/client/modelConfigCopy.ts`、`src/client/dictionary.ts`、`docs/design-model-config-tab.md`（§11 重构记录与类名权威清单） |
| **page-impl** | `src/client/ModelConfigPage.tsx`、`src/client/modelConfigStyles.ts` |
| **drawer-impl** | `src/client/ModelDrawer.tsx`、`src/client/drawerStyles.ts` |
| **verifier** | `scripts/check-contrast.mjs`、`scripts/selfcheck-static.mjs`、`scripts/verify-model-config-tab.cjs` |
| **Lead** | `docs/model-config-redesign-brief.md`（本文）、`lib/`、`package.json`、README、最终验收与 `npm test` |

**并行纪律**：
- **只有 Lead 跑 `npm run build` / `npm test`**（它们写 `lib/`）。
- **只有 verifier 跑真机驱动**（`scripts/verify-model-config-tab.cjs`、playwright）：两个 headless 浏览器
  同时驱动同一个 GUI 会互相抢设置面板。
- `npm run typecheck` / `selfcheck` / `contrast` / `test:*` 都是只读的，任何人可随时跑。
- 改完自己的文件，**在共享任务上写清「改了什么、跑了哪条门、结果是什么」**，不要只说「做完了」。

---

## 11. 验收清单（Lead 与 verifier 共用）

- [ ] A–E 能力一条不减；`verify-model-config-tab.cjs` A1–A13 全绿 + R1–R7 全绿。
- [ ] `.dmc-readout` 与十行 `data-state` 逐行对账一致；0 问题 / N 问题 / 0 行 三种状态各看一次。
- [ ] 只有 `unreachable` 行有底色；`missing-key` 只有竖条 + 词。
- [ ] 每行带 1px 边的控件 ≤1；页面 accent 只在 `.dmc-add` 一处；无 `#hex`/`rgb()`/`dashed`/`shadow`/`opacity` 淡化文字。
- [ ] `@container` 分支在**容器** 106 / 484 / 560 三档都成立；五档视口无横向滚动。
- [ ] 深/浅两主题各一轮截图 + 逐张看图（juror）。
- [ ] `npm test` 全绿（含 `test:fresh`：`lib/` 是 `src/` 的忠实产物）。
- [ ] `.taste-skill/audit-classes.mjs` 三个差集为 0（designer 收口 `docs/design-model-config-tab.md` §11）。

---

## 13. 裁决与增补（Lead，2026-10-16 23:05）——**与上文冲突处以本节为准**

**13.1 `dictionary.ts` 不改。** `config.*` 词表只活在 `modelConfigCopy.ts`；`dictionary.ts` 只有
`provider.*` / `settings.*`。designer 的判断正确，不要造第二份 `config` 词表。

**13.2 文案键最终是 4 个新增（不是 3 个）**：§8 的三个 + 抽屉发现清单的计数句：
| 键 | zh | en |
|---|---|---|
| `config.fetch.count` | `共 {count} 个候选，其中 {inCatalog} 个已在目录里` | `{count} candidates, {inCatalog} already in the catalog` |
归 designer（`task-1`）。用途：396 条候选的清单必须有真实计数，这是抽屉「不做 396 个等重复选框堆叠」的一环。

**13.3 插值词汇表白名单扩到 7 个词**：`{provider} {hint} {env} {url} {count} {issues} {inCatalog}`。
`scripts/test-model-config-copy.mjs` 的 `required` 概念表里把退役的 `config.intro` 换成
三个 `config.summary.*` + `config.fetch.count`。**这是随实现同步的扩表，不是放宽**：只加本次冻结文案真正引入的词。
该脚本归 **verifier**（gate 文件保持一致归属），写范围见 §13.9。

**13.4 退役类名清单补第 4 个：`.dmc-intro`**（`.dmc-readout` 取代它）。
- page-impl：TSX 里的 `<p className="dmc-intro">` 与 sheet 里的规则**一起删**（死类门双向都查）。
- designer：`docs/design-model-config-tab.md` §5.1 删该行，§11 记入退役；
  并把 `dmc-intro`（连同 `dmc-list-head` / `dmc-list-head-cell` / `dmc-key-state`）加进
  `.taste-skill/audit-classes.mjs` 的「文档里有意提到但不设」排除表（该脚本现有排除表里只有 `dmc-group`）。
  **`.taste-skill/audit-classes.mjs` 归 designer 写范围。**

**13.5 新增类名一共 3 个**：`.dmc-readout`、`.dmc-edit`、`.dmc-discover-group`。
- `.dmc-discover-group` = 抽屉发现清单的**分组标题行**（模型 id 的首段 + 该组条数）。
  理由（drawer-impl 提出，采纳）：396 条候选需要真实层级；复用 `.dmc-drawer-section` 会在清单里堆
  ~20 个 13px/600 primary ink 的段标题，把安静面板变成标题堆；复用 `.dmc-drawer-notice` 语义不符
  （它是说明句，不是列表分组头）。designer 收口进 §5.5 与 §11。

**13.6 状态钩子的最终形态（取代 §2 里「error 可叠加」那段含糊写法）**：
- `data-state` **互斥**：列表 `ready | missing-key | unreachable`；picker `dormant`。
- 诊断**另用** `data-error="true"`（可叠加，不影响 `data-state`）。
- **竖条**画在 `data-state !== 'ready' || data-error === 'true'`。
- `.dmc-verdict` 的词**只跟 `data-state`**（`ready` → `config.verdict.ready` 等）。
- 兼容别名：`data-usable="false"` ⇔ `data-state === 'unreachable'`。
- 自检据此断言：sheet 里出现的每个 `data-state` 取值都必须被 TSX 产出；`ready` 的规则里不得出现 `background` 铺底。

**13.7 `.dmc-empty` 保留**（零提供商/无可用提供商时的引导句，走现有的 `config.empty.*`）。
就绪陈述的 `config.summary.none` 只**陈述事实**（「尚未添加任何提供商」），与引导句分工不同、不重复。

**13.8 对比度门要把行内 tone 阶梯填充算作有效底色**（drawer-impl 之外由 verifier 落实）：
行内文字的有效底色 = `--dsw-alias-interactive-bg-hover` / `-hover-danger` 合成到底色上，两者取较差的一种。
实测：这两个填充下 light secondary **5.22 / 5.34:1**、dark **9.9 / 10.1:1**，两主题仍过 AA——
所以它不会把合法墨色判红，但能抓到「把文字放进铺底行」这类错。采纳。

**13.9 gate 文件归属（补齐 §10 的表）**：`scripts/test-model-config-copy.mjs` 归 **verifier**。
理由：门文件由同一个角色维护，"这条门为什么改" 只有一处解释。

**13.10 基线批评已存档**：`.taste-skill/critique-baseline.md`。里面是重构前的视觉 juror 读数
（`opencode-go/glm-5.3-flash`，本机实测可读图），**逐条标注了「已核 / 待证伪」**。
verifier 负责在**重构前**把标「待证伪」的条目用真机数字钉下来（作为对照），
重构后由 Lead 用**同一模型同一提示词**再读一次，逐条对照。

---

## 14. 早期目视裁决（Lead，2026-10-16 23:15）——基于中途截图的第一轮「看一眼」

证据：`.taste-skill/shots/page-impl-{dark,light}.png`，juror = `opencode-go/glm-5.3-flash`
（与基线同一模型同一提示词）。原始读数要点：
- ✅ 做对了：行之间**没有分隔线**（只靠空白）；每行**右端确实有一个对齐的答案词**；顶部**确实只有一句大陈述**。
- ❌ 做错了 1：**编辑行的控件没有共享列**——select 的左沿逐行跳动（x≈80 / 296 / 215 / 465）。
  页面的机制本来就是「**靠对齐成表**」，编辑行一旦ragged，这个机制就没了。
- ❌ 做错了 2：`unreachable` 那行**整行铺色**成了整页最响的元素，与 quiet-instrument 正面冲突。
- ❌ 做错了 3：陈述说「6 个可用，1 个需要处理」，而行里是 5 个 可用 + 1 个 缺密钥 + 1 个 不可用
  → **计数与行不一致**（可疑为真，必须由 verifier 的 R1 严格对账）。
- ❌ 做错了 4：带诊断的行（答案词 可用）却画了红竖条 → 右端说「可用」，左边一根红条，读者读成矛盾。
- ❌ 做错了 5：`.dmc-error-toggle` 渲染成一个**实心灰方块**。
- ⚠ juror 的可能误读（**不要照做**）：它说内容宽约 1090 / 1224 px「不是窄列」——**几乎肯定是 DPR=2 的读数**
  （1090/2 ≈ 545 ≈ 560 CSS px）。它说「16px 的 模型配置 像 eyebrow」——那是有意的宿主对齐（官方页同尺寸）。
  它说「Blue 是第二 accent」——蓝色是**行动**色、红色是**事实**（状态）色，两种角色，不是两个 accent。
  它说错误诊断是未翻译的英文——那是**有意逐字打印宿主原话**。

### 裁决（与 §2 / §13 冲突处，以本节为准）

**R1 · 废弃整行底色。** 行的 rest 态**永远没有填充**，包括 `unreachable`。
状态只由**竖条 + 词**承载（两个通道，够）。理由：quiet-instrument 的方向就是「纸 + 两个墨 + 一处 accent」；
而 §10.1 早已判定十行规模下**词是主通道、竖条是冗余第二通道**——第三通道（铺底）只会把页面喊响。
→ 静态门断言改为：**行级规则里不得出现 rest 态 `background` 铺底**（只允许 `:hover` / `:focus-within` /
`[data-open='true']` 的 live 填充）。

**R2 · 竖条只表示「能不能服务」。** `missing-key` | `unreachable` 画竖条；**诊断（`data-error`）不画竖条**，
它只有 `!` 入口 + 可展开的诊断句。理由：一级一义——**一个通道只承载一个含义**。
（取代 §13.6 的「竖条 = `data-state !== 'ready' || data-error === 'true'`」。）

**R3 · 编辑行必须是固定轨道的网格。** 控件**逐行按列对齐**，缺的那格**留空**（不把邻居左移）。
这是本页「靠对齐成表」机制的全部依据；ragged 的编辑行等于把这个机制丢掉。
（旧稿「弹性列必须写下界、固定轨必须给足」的教训继续适用。）

**R4 · 答案词必须对齐在行的右缘**，逐行成列（右对齐 + `tabular-nums`）。

**R5 · 就绪陈述的数字必须与行严格对账**（`ready` = 可用行数，`issues` = 缺密钥 + 不可用行数）。
verifier 的 R1 必须**逐行数**再比对，任何不等即 FAIL。

**R6 · `!` 入口不许是实心方块。** 它是一个文字affordance（诊断存在时才出现），无填充、无边框。

**R7 · 段标题保持 16px（与官方页同尺寸）**——juror 会把它读成 eyebrow，这是已知张力：
它是真的 `<h2>` 段标题，不是 heading 上方的小标签。**记录，不改。**

**R8 · 宿主的原始诊断逐字打印、不翻译。** 有意（旧稿已定）。**记录，不改。**

**R9 · 蓝色（行动）与红色（状态）是两种角色，不是两个 accent。** 保持。

---

## 15. 收口裁决（Lead，2026-10-16 23:35）——三处补丁 + 一处「不必做」

### 15.1 「未测定」第四态**不需要**（已用代码证伪，不要再提）

我一度担心会话路由的 `accountAvailable === undefined` 会被印成「不可用」（假事实）。
**读了 `modelConfigStore.ts:262` 后证伪**：快照在成行之前就把它过滤掉了——
`.filter(row => row.entry.provider !== ACCOUNT_ROUTE || row.accountAvailable === true)`。
即**账号路由只有在已登录时才会成为一行**；`undefined` / `false` 的账号行根本不进列表。
所以 `RowAnswer` **保持三值**，不新增 `unknown`；`isSessionRoute` 的 fallback 分支只对**非账号**路由成立，
那时 `不可用` 是**真话**（那条路由确实不能服务）。

### 15.2 会话行的词要用宿主自己的话：`已登录`

账号行既然只会在已登录时出现，它的答案是 `ready`，但**「可用」丢掉了「它为什么没有密钥格」这个原因**。
旧版页面印的是 `config.account.signedIn`（`已登录` / `Signed in`）。**恢复它**：

- `readingOf` 的词映射加一个分支：`isSessionRoute(row) && answer === 'ready'` → `config.account.signedIn`。
- `data-state` **仍是 `ready`**（状态不变，只是这个词比通用词更具体）。
- `config.account.signedOut`（`会话未登录`）**页面用不到**（那行会被过滤掉）——它由 copy 门的概念表要求存在，
  所以它不是死键，**不要删**。
- 判据层级不变：词仍然只由 `readingOf` 一个地方产出。

### 15.3 去铬的文字动作：**rest 用 primary ink，disabled 用 secondary ink**

drawer-impl 自己报的代价，我判为**真缺陷**：去铬之后 rest 与 disabled **同为 secondary ink**，
于是「禁用」在视觉上没有区别（真机里 `settings.writable === false` 的部署会让整行动作看起来可点）。
修法（**两个表面一起改**，这是同一条纪律）：

- 去铬的文字动作（`.dmc-key-action` / `.dmc-key-clear` / `.dmc-catalog` / `.dmc-enable` / `.dmc-error-toggle`
  / 抽屉的 `.dmc-btn` 及其变体）**rest = primary ink**；**`:disabled` = secondary ink**；`:hover` = live 填充。
- **不许**再引入第三种墨：可作文字的仍然只有 primary / secondary 两个令牌。
- 答案词（`.dmc-verdict`）的墨**不在此列**——它继续按状态走（`ready` secondary、其余 primary）。
- 顺带修正一条房子规则：skill 的「Running text in the full ink；soft grey 的页面读起来像没做完」——
  把控件放在 full ink 上比放在 soft grey 上更符合这条，禁用态退回 secondary 正好成为唯一的一档降级。

### 15.4 抽屉的两条口径：**采纳**

1. **R4「每行 ≤1 个 1px 边控件」只约束页面的 `.dmc-row`。** 抽屉的 `.dmc-model-row` 是四字段表单，
   按 `docs/design-model-config-tab.md` §5.5/§5.6 第 3 条豁免（一行可以有多个真表单控件）。
2. **抽屉的窄分支保持 `@media`，不改成 `@container`**，理由成立：抽屉是 `position: fixed`、
   宽度 `min(460px, 100vw)` 来自**视口**而不是某个容器，所以 `@media` 才是对的。
   → 窄容器断言只对**页面表**（`modelConfigStyles.ts`）要求 `@container` + `container-type: inline-size`；
   抽屉表要求「存在一条窄分支」即可。**这条要写进断言注释**，否则下一个人会照页面改抽屉。

### 15.5 另有两处状态要清账（当前 `selfcheck` 有 1 条 FAIL）

- verifier 已把 skill 的 `lint.mjs` 接进 `selfcheck`，现在报 **1 FAIL `[shadow] (3×)`**。必须归零：
  真 dialog（抽屉）的 `box-shadow` 保留并加 `taste-skill-ignore` + 理由；注释里出现 "shadow" 一词造成的
  假阳性改措辞（或同样加 ignore）。
- `lib/` 仍是旧的（只有 Lead 会重建），所以**真机验收必须等我 rebuild 之后**才反映本轮改动。

---

## 12. 与 skill 的三条有意偏离（报告里必须原文出现）

1. **图片下限（≥4 张真实图片）**：本页 0 张 raster，理由是方向第 5 节自己的裁决（software 的图就是它的界面）
   与房子规则（禁装饰形状 / 假仪表盘）；替代物是十行真实界面片段。**接受**该项在设计分上的影响。
2. **动效元素下限（≥8 个移动元素）**：**有意不接受**。替代证据是真机量的 transition 与 reduced-motion 行为（§4）。
3. **「相邻分区构图不许相同」**：不适用——`layout.md` §5 自己豁免「a repeated module is for archives only」，
   本页就是那张表；行与行**必须**同构，否则列不再对齐。
