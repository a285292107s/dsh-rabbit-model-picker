# 「模型配置」tab 的视觉方向

> **历史设计稿（2026-10-17 加注）。** §5.5 的「右侧抽屉」与 §11.6.1 的 53 个 `dmc-drawer*` 类
> 已被 [DESIGN §5.37](../DESIGN.md) 取代：模型目录现在是账本行内的展开区，不是弹层。
> 当前类清单的唯一权威是 [docs/ui-language.md](ui-language.md) §4.7（`.taste-skill/audit-classes.mjs` 读它）。
> 本文保留为当时的设计证据，不再逐条同步；与 §5.37 冲突处，以 §5.37 为准。

> 本文是 `task-6` 的交付物：`settings.section` 里新增的「模型配置」页（与官方「模型」页**并存**，
> 见 [ADR 0003](adr/0003-parallel-tab-with-full-parity.md)）的视觉方向、行内信息层级、tone 阶梯方案，
> 以及实现者可直接使用的 `dmc-` 类名清单。
>
> **这不是落地页。** 它是宿主设置面板里的一个分区，按 `design-taste-frontend` 的
> Special case「**A component or a single section, not a page**」处理：跳过 hero / 落地页那套，
> 不找图片，不写文案层；**房子规则（house rules）与工艺法则仍然适用**。
> 方向取自 `scripts/draw.mjs`，见 §1。

> ### 审计状态（designer-2 = verifier，2026-10-16）
>
> 本文在 `task-13` 里被**逐条对真机复核**过。原文的方向与纪律成立，但**三处按视口/按算术下的断言在真机上不成立**，
> 已就地改在正文里（§2.3、§3.3.1、§5.5、§7），并全部记入 **§9 修订记录**（含证据与根因）。
> §9 同时给出三件判断：**行数从 48 降到约 10 之后「一眼看出谁缺 key」的新答案**、**8 列轨道是否该减**、
> 以及 **`data-state` 状态分级方案**。清单类名以 §5 为**唯一权威**，它现在与 `modelConfigStyles.ts` +
> `drawerStyles.ts` 的**实际导出逐一对齐（81 个）**，并由 `.taste-skill/audit-classes.mjs` 复算。
> （**本轮 UI 重构后**该数字已是 **82**，见 §5.7 / §11.6.1；上面这句是 21:41 时点的历史记录。）

---

## 0. 一句话方向

**让每一行自己就是产品在运行的样子：一行 = 一个提供商的一次真实对话（名字、能不能用、最后一条错误都在行里），
列表靠**对齐的列**而不是靠盒子成表；状态靠**一条 4px 实心竖条 + 一个词**，其余一律交给空白。**

贯穿全页的一句（skill 第 4 步要求填空）：

> 在这页上，**提供商行里那根「缺 key 就亮红」的竖条**成为**整个列表唯一的颜色事件**。

竞品检验：把「模型配置」换成任何一个「一列可编辑设置」的界面，这个句子依然成立——所以它不构成 idea 的全部；
真正属于本页的是**那根竖条 + 「能不能用」这个判据（`providerUsable`）**，它是本仓库数据层已经给出的、
官方页用「开通卡」表达的同一件事。方向据此定为「让行本身承担状态」，而不是给行套卡片。

---

## 1. `draw.mjs`：跑了，结论如下

**跑了。** 命令与结果：

```
node <skill>/scripts/draw.mjs \
  --sector dev-tool \
  --brief "The Model Configuration tab in DSH settings: a list of ten or more provider rows, each edited in place" \
  --sections intro,list --tone technical --keep palette,type \
  --direction product-performs
```

- **方向：`product-performs`（The product performs）**，seed `1913101651`，`--keep palette,type`（宿主已固定色与字）。
- 产物落在 [`.taste-skill/direction.json`](../.taste-skill/direction.json)（`node draw.mjs --show` 可重印）。
- 三选一里另两个是 `dense-tiles`（edge-to-edge 瓦片板）与 `one-motif`（单一母题）。
  `dense-tiles` 正是**本题要避开的东西**——它在字面上要求「贴边填满、无空格」，等于把 10+ 行做成瓦片网格；
  `one-motif` 需要一个形体母题，而设置分区里没有任何形体可借。**选 `product-performs` 的理由**：
  它唯一的构图要求是「把产品真实的小片段按真实尺寸放在页面上」，而这页的「片段」就是行本身——
  方向与题材天然重合，不需要发明任何装饰。

### 1.1 方向里被采纳的部分

| 方向原文 | 本页如何落地 |
|---|---|
| 主体是**真实尺寸的界面片段**，不是整窗截图 | 一行就是一段真实界面（真 provider 名、真 route id、真错误文案） |
| 片段之间**靠一栏序列**排布，不是 zigzag 等宽块 | 行按固定列轨道排列，行高一致；不是等宽卡片墙 |
| §5：「本题材是软件、没有截图，因此**它自己的界面就是它的图片**」 | 采纳：本页的「图像」是行本身。这也直接解释了 §6 的图片偏离 |
| §10：「用灰条和圆圈画的假界面是最坏的结果」 | 采纳为禁令：任何状态都不许画成灰条/圆点/假骨架 |

### 1.2 方向里被否掉的部分（及理由）

| 方向的slot | 决定 | 理由 |
|---|---|---|
| Hero **Column on one line**（80% 空白的落地首屏、logo mark、370px 文本列） | **否** | Special case：这不是页，是分区。宿主已经给了标题区与导航；再造一个首屏就是在一个别人的页面里开第二个设计系统 |
| Section `intro` **Statement with inline thumbnails**（18–28 词大句 + 行内图片帧） | **否** | 该 blueprint 依赖图片帧，而本页无图（§6）；且方向自己已给出「Adjusted for this page」的裁决： jurors 会把大句读成多行标题。**采纳该裁决，砍掉整个 section** |
| Section `list` **Day tabs, banded agenda** 的「tabs + 人像 + 时间列」家具 | **部分采纳** | 采纳它的**banded**（按色带划分行）——这就是 §3 的 tone 阶梯；丢掉 tabs/人像/时间列，因为它们对应的是日程页的数据 |
| Motion **Slow crossfade**（3–4 张同构图照片交叉淡入） | **否** | 没有照片，也不该有。本页的动效只剩两件：抽屉的进出、控件状态反馈。见 §6 第 5 条 |
| Imagery **"Sky and space" 图集**（picsum 星空/Aurora） | **明确否** | 在别人的设置面板里放极光照片，是把装饰当设计。方向自己也写明「可选、最多两张、页面并不需要它们」 |

---

## 2. 核心设计难题：10+ 行 × 5 控件，怎样一眼看出谁缺 key

### 2.1 决定

**一眼可辨靠三件东西，全部落在同一个 x 上；行不靠盒子成表，靠对齐的列成表。**

#### (a) 行的信息层级（从左到右，按重要度排序）

| 序 | 元素 | 作用 | 用什么表达 |
|---|---|---|---|
| 1 | **竖条**（4px，行高满，紧贴行首） | **状态。整个列表唯一的颜色事件** | 不可用行 → `--dsw-alias-state-error-primary` 实心；可用行 → **不画**（那 4px 是空的） |
| 2 | **提供商名** | 身份 | `--dsw-alias-label-primary`，行内最大字号 |
| 3 | **可用性词** | 状态的**文字孪生**（色盲、灰度打印、屏幕阅读器都靠它） | `--dsw-alias-label-primary`／不可用时 `--dsw-alias-label-primary`（**永远不是红色**，见 §3.3） |
| 4 | **route id** | 两个同名提供商的区分位 | `--dsw-alias-label-secondary`，紧贴名字右侧 |
| 5 | **凭据格**（状态词 + 替换入口） | **本页的任务**：改 key | 状态词同上；「替换」是一个按钮 |
| 6 | 协议选择 / 模型目录入口 / 错误展开 / 启用开关 | 该行其余家具 | 固定列轨道，**永远可见、永远 Tab 可达** |

**为什么 50 个控件不会读成 50 个物体**：它们被排进 5 条**固定列轨道**，跨行对齐。
眼睛学一次列位，之后每次滚动读的是列，不是控件。这就是表格的做法，
也是 skill `layout.md` §2 的「**永远不要画出网格线；网格靠对齐被感觉到**」——
本页正是用对齐代替描边。

#### (b) 为什么这仍然不是「卡网格」

skill 禁的是 **icon-topped feature cards** 与 **rows of identical cards**。本页避开的机制是**根本不给行盒子**：

- 行**没有** `background`（可用且静止时 = 页面底色）、没有 `border`、没有 `border-radius`、没有 `box-shadow`；
- 行之间**没有**分隔线（repo 的样式门本身就禁 `dashed/dotted`，且房子规则禁 1px 描边）；
- 行的边界感来自**列对齐 + 行高节奏**（56px），不来自描边。

一个卡片矩阵要求每行自带一个盒，读者每屏要重做 10 次「这是不是一件事」的判断；
一列行只要做一次。**代价**：行的存在感更弱，所以行高必须给足（56px，窄屏双行时 88px），
列轨道必须有 key（旧稿的 dmc-list-head；本轮已删，见 §11.3 / §11.5），否则 5 列控件会读成一排散件。

#### (c) 「缺 key」的三种读法（都能落到同一行）

1. **周边视觉**：滚动时，竖条列是页面上唯一有颜色的东西，红的行直接跳出来。
2. **中央视觉**：落在某行时，可用性词（`缺密钥` / `Needs key`）给出确认；它是**词，不是点**——
   房子规则明确禁「decorative status dot」，所以状态不许画成圆点。
3. **任务位**：凭据格自己的状态词（`未配置` / `No key`）说明**该做什么**，和「替换」按钮挨着。

### 2.2 用 tone 阶梯代替描边：具体做法

**阶梯定在 3 级，每级只有一个含义。** 所有值都取自宿主语义令牌，且**两个主题都实测过**（§3.4 是原始数字）。

| 级 | 令牌 | 何时用 | 含义数 |
|---|---|---|---|
| **Rung 0 · rest** | **无填充**（即 `--dsw-alias-bg-base`） | 可用、静止、抽屉没开 | 默认态 |
| **Rung 1 · attention** | `--dsw-alias-interactive-bg-hover-danger` | 该行**不能服务请求**（`providerUsable === false`） | **1 个：不可用** |
| **Rung 2 · live** | `--dsw-alias-interactive-bg-hover` | 指针悬停的行 / 焦点所在的行 / **抽屉打开着的行** | **1 个：位置性、瞬时** |

维持阶梯可读的四条规则（实现者必须一起做，缺一条阶梯就塌）：

1. **一级一义。** Rung 2 永远不承载「持久事实」——它只表示「你在这儿」/「这行的抽屉开着」。
   任何持久的差别都只能是 Rung 0 或 Rung 1。
2. **竖条不因 hover 被压掉。** 一行既不可用又被悬停时：**填充走 Rung 2，竖条保持红**。
   含义由竖条承载，所以指针移上去不会丢掉信息。
3. **Rung 1 与 Rung 2 不许被要求互相区分。** 实测二者只差 **1.0226:1（浅）/ 1.0245:1（深）**——
   它们的职责不同（一个是事实、一个是位置），永远不需要用户把「红行 vs 灰行」并排比较。
   任何需要并排比较的设计都必须回到 Rung 0 / Rung 1 两级。
4. **列表里没有第二种填充。** 不做 zebra 斑马纹、不做卡片、不做描边、不做阴影。
   （斑马纹在这里是**负收益**：attention 行会落在两种底色上，反而削弱第 1 条读法。）

**竖条只画一半的槽位。** 不可用行画红条，可用行**留空**——10 行里若有 3 行缺 key，
读者看到的是「3 个红标 + 7 个空槽」，而不是「10 个标记里挑出 3 个」。空槽是更干净的信号。

### 2.2.1 一处必须说清的令牌「角色挪用」

> ⚠️ **本节（§2.2 / §2.2.1）的 Rung 1 持久填充已被 brief §14 的 R1 废弃**：行的 rest 态**永远没有填充**，
> `unreachable` 也不铺底色；状态只由竖条 + 词承载（理由与 R2 见 §11.2）。下面这段保留为历史论证与实测数字。

Rung 1 用的 `--dsw-alias-interactive-bg-hover-danger`，**名字里带 `hover`，本页却拿它做持久填充**。
这是本方向唯一一处令牌名与用法不符，理由与代价都记在这里：

- **为什么还是它**：实测两个主题里，它是宿主唯一同时满足三点的令牌——
  是**平面填充**（不是描边、不是阴影）、**偏红**（能把「不可用」和「可用」分开）、
  且**两个主题都解析得出**（候选里 `--dsw-alias-state-error-*` 更红，但它们是**文字/图形**色，
  大面积铺开会与本页「唯一颜色事件是那根 4px 竖条」的纪律冲突）。
- **代价**：宿主未来若把它改成只在 hover 时才出现（例如改成纯透明），Rung 1 会静默消失。
  **因此 §7 的验收清单里必须有一条**：两个主题各截一次图，确认不可用行的填充**真的看得见**。
- 若宿主真的改了它，退路是 `--dsw-alias-state-error-secondary`（两个主题都存在，红系），
  但**不要**用 `--dsw-alias-state-error-primary` 铺大面：它是文字/图形色，且浅色下只有 4.4976:1。

### 2.3 行内网格（实现者照抄）

**宽 —— 单行，8 条轨道（实现在 `modelConfigStyles.ts` 的 `--dmc-row-tracks`）：**

```
[4px rail][ name + route  minmax(140px, 1fr) ][ verdict 56px ][ key 88px ][ protocol 72px ][ catalog 52px ][ error 26px ][ enable 72px ]
```

> ⚠️ **本节原文的三个数字已在真机上被证伪并就地更正，见 §9.1。**
> 原文写「**7 条轨道**」同时列出 **8 个**方括号——算术本身就自相矛盾；实现是 **8 条**。
> 原文的固定宽度 `84/120/136/104/36/44` 合计 **524px**，加 7×8px 间隙 = **596px**，
> 而设置面板的内容列只有 **564px**：名字列 `minmax(0, 1fr)` 于是塌成 **0px**，提供商名逐字符竖排（实测 `.dmc-name` 宽 0、高 572px，`.dmc-page` 高 22204px）。
> 现在固定部分收到 **370px** + 间隙 56px = **426px**，并给名字列一个**下界** `minmax(140px, 1fr)`。
> **教训（写给后面改这行的人）**：`minmax(0, 1fr)` 里的 `0` 是「允许塌成没有」，不是「让它在需要时撑开」；弹性列必须写下界。

**窄 —— 两行，竖条贯穿两行（`modelConfigStyles.ts` 的 `@media (max-width: 900px)` 分支）：**

```
[4px rail (rowspan)][ line 1: name + route (grid-column: 2 / span 3) | verdict | error | enable ]
                    [ line 2: name+route 的缩进位起 | key | protocol | catalog ]
```

**竖条必须纵向贯穿两行**——这是「一眼可辨」在手机上仍然成立的唯一原因：
扫描列不断开。手机上另有两条：`dmc-name` 允许换到第二行（`min-width: 0` + `overflow-wrap`），
但 `dmc-verdict` 不许被推到视口外（见 `critique.md` 第 13 条：横向溢出在截图里等同于被切掉）。

> ⚠️ **这条断言的适用条件也已在真机上更正，见 §9.2**：`@media (max-width: 900px)` 测的是**视口**，
> 而这页的可用宽度来自**宿主面板的容器**。宿主面板宽 800px 与视口无关，所以 **1920 视口下这条分支永不触发**——
> 上面 8 轨道那一行才是真机上唯一跑着的分支。**本页所有断点必须改成 `@container`（按 `.dmc-page` 的 inline-size）**，
> 详见 §9.2；在此之前，任何「窄屏会怎样」的断言都只在视口 <900px 时成立，而那时宿主只给内容列 106px。

---

## 3. 颜色：把 skill 的调色板换成「比例与层级」

skill 的调色板部分是「一个 ground、一个 ink、一个 accent、用 tone 阶梯分隔表面」。
**本页的 ground / ink / accent 全部取自宿主 `--dsw-*`**（`--keep palette,type` 的直接后果）。
以下每个值都是从本仓库已提交的宿主调色板（[`scripts/theme-tokens.json`](../scripts/theme-tokens.json)）**实测**出来的，
不是从令牌名推断的。

### 3.1 角色映射

| skill 角色 | 本页取值 | 出现范围 |
|---|---|---|
| **ground** | `--dsw-alias-bg-base`（浅 `#ffffff` / 深 `#151517`） | **≥ 90%** 的表面。整个列表在 rest 态就是这块 ground |
| **surface（一级 tone 阶梯）** | `--dsw-alias-interactive-bg-hover` / `…-danger` | **< 10%**，且**只在有状态的行上** |
| **ink** | `--dsw-alias-label-primary`（正文与所有强调） | 名字、可用性词、错误句 |
| **quiet ink** | `--dsw-alias-label-secondary` | route id、状态词、空状态句 |
| **accent** | `--dsw-alias-state-business-primary` | **只做焦点环 / 主按钮的填充**，绝不画文字（§3.3） |
| **状态色** | `--dsw-alias-state-error-primary` | **只做那个 4px 竖条**，绝不画文字（§3.3） |

### 3.2 accent 预算

accent 在一屏上出现 **≤ 1 处**（顶部的那个主动作）。列表里**没有** accent：
列表唯一的颜色是**状态色**，而它是「事实」，不是「行动」。
这条纪律正是让竖条起作用的全部原因——skill `colour.md` §3：「accent 一旦出现在五个地方，就不再意味着『这里』。」

### 3.3 ⚠️ 实测出来的硬约束：两个状态色令牌**不许画文字**

浅色主题下实测：

| 令牌 | 在 ground 上 | 在 attention 阶梯上 | 结论 |
|---|---|---|---|
| `--dsw-alias-state-error-primary` | **4.4976:1** | **4.1397:1** | **正文 AA 是 4.5:1 → 不达标。只能做图形（3:1）** |
| `--dsw-alias-state-business-primary` | **4.2349:1** | 3.90:1 | **不达标。只能做图形（焦点环）或填充** |

**因此（硬性，写进验收）：**

- **错误句一律用 `--dsw-alias-label-primary`**，不用红色。红色留给**那根竖条**——
  它是图形标记，3:1 门槛，实测 **4.1397:1（浅）/ 4.6447:1（深）**，通过。
- 这也让错误句在不可用行上达到 **17.39:1（浅）/ 14.62:1（深）**，远高于门槛。
- `--dsw-alias-state-business-primary` **不得**作为文字颜色（浅色 4.2349:1）。
  它只做**填充**（焦点环、以及顶部那个主动作的底）。
  填充上的字用 `--dsw-static-neutral-bluish-00`——**照 `.drc-btn-primary` 的既有做法**：
  `retryStyles.ts` 的注释已记明宿主**没有**「accent 上的 ink」这个角色，
  且 `--dsw-alias-bg-layer-2` 在该主题里未定义、拿它当底色会让标签没颜色。
  该配对的对比度**必须在 `check-contrast.mjs` 登记后实测**（§5.6），本文不替它下结论。

### 3.3.1 结论（已并入正文）：主操作**不是 accent 填充**，而是 **accent 描边 + label-primary 墨**

§3.3 把「accent 填充 + 白字」留给实测，现在实测完成，**结论不通过**。
数字由 `.taste-skill/audit-contrast.mjs` 从**已提交的** `scripts/theme-tokens.json` 独立复算
（`node .taste-skill/audit-contrast.mjs` 可重跑），不是转抄：

| 配对 | 浅色 | 深色 | 12px 正文门槛 | 结论 |
|---|---|---|---|---|
| `#fff` 于 accent 填充（`#4176e6` / `#7aaaff`） | **4.2349:1** | **2.3278:1** | 4.5:1 | **两主题均不达标** |
| 页主墨 `--dsw-alias-label-primary` 于同一填充 | 4.4621:1 | 2.2275:1 | 4.5:1 | **两主题均不达标**（深色尤其糟） |
| 近黑 `#0f1115` 于浅色填充 | 4.4621:1 | — | 4.5:1 | 不达标 |
| 纯黑 `#000` 于浅色填充 | 4.9588:1 | — | 4.5:1 | 勉强达标，但**等于给这个页面发明一套黑色墨** |

> **修订（§9.3）**：原文补记里浅色 **4.235:1 正确**，深色写的是 **2.14:1**，
> 复算是 **2.3278:1**（`#fff` 对 `#7aaaff`）。**方向不变、结论不变**，且深色比原文说的还要糟——
> 所以「不达标」这个判定**成立**，只是那个具体数字要更正。

因此实施时把页面的主操作 `.dmc-add` 定为 **「accent 描边 + label-primary 墨」**
（`src/client/modelConfigStyles.ts:157`）：

- **描边**走 accent vs ground，是**图形** 3:1 门槛，浅 **4.2349:1** / 深 **7.8343:1** → 达标；
- **文字**走 `--dsw-alias-label-primary`，于 ground 17–19:1 → 达标；
- 于是「accent 只做边缘，不做底」成为本页的一条硬纪律，`scripts/selfcheck-static.mjs` 的
  model-config 块新增断言**禁止任何规则把文字放在 accent 填充上**，注释里写明这次实测的数字。

**为什么这不是「换个墨就好」**：三段数字说明这个填充在浅色下**几乎容不下任何合规正文**
（白 4.23、页主墨 4.46、纯黑也才 4.96），也就是说问题出在**把 accent 当底**这个决定本身，
而不是出在选哪一种字色。这正是 §3.2「accent 预算 ≤1 处」和本节合起来的意思：
**accent 是边缘与焦点，不是场。**

**本轮审计新增的两条（§9.3）**：

1. ⚠️ **同一个失败配对仍活在 `drc-btn-primary`**：`src/client/retryStyles.ts:309` 是
   `background: var(--dsw-alias-state-business-primary)`、`:313` 是
   `color: var(--dsw-static-neutral-bluish-00)`，即 `#fff` 于 `#4176e6` = **4.2349:1（浅）/ 2.3278:1（深）**。
   重试卡的保存按钮**现在就不达标**，本页改了它没改。
2. ⚠️ **`drc-` 还有两处把 accent 当文字**：`retryStyles.ts:216` 的 `.drc-cap-mark`（11px）与
   `:331` 的 `.drc-state[data-declared='true']`（12px）都是 `color: var(--dsw-alias-state-business-primary)`，
   而本节刚立下的规矩是 accent **不得作文字**（浅 4.2349:1 < 4.5）。
   两处都在 `drc-`（不在本任务 scope），但属于**同一条纪律在仓库里的现存违反**，已记入 §9.3 交 lead。

**为什么门拦不住它们**：`check-contrast.mjs` 只读 `src/client/styles.ts`，`drc-` 与 `dmc-` 两张表
**都没有被逐规则量过**；`dmc-` 现在靠「墨水白名单 + 若干静态禁令」约束，
这比逐规则测量弱一档，是**已知的门的缺口**，不是「已经量过了」。


**可作文字的令牌只有两个**：`--dsw-alias-label-primary`、`--dsw-alias-label-secondary`。
`--dsw-alias-label-tertiary`（浅 **3.71:1**）、`--dsw-alias-label-caption`（浅 **2.13:1**）、
`--dsw-alias-label-dimmed`（浅 **1.26:1**）**一律不得画文字**——
`check-contrast.mjs` 的注释记录了本仓库正是踩过 `caption` 这个坑（2.08:1 也「看起来像刻意的安静灰」）。

### 3.4 阶梯的实测证据（两个主题）

| | 浅色 `#ffffff` ground | 深色 `#151517` ground |
|---|---|---|
| Rung 1 attention 合成色 | `#fef3f3`，step **1.0865:1** | `#361f21`，step **1.1939:1** |
| Rung 2 live 合成色 | `#f2f3f4`，step **1.1110:1** | `#272729`，step **1.2232:1** |
| Rung 1 ↔ Rung 2 之差 | **1.0226:1** | **1.0245:1** |
| 竖条 vs ground（图形，需 3:1） | **4.4976:1** | **5.5453:1** |
| 竖条 vs attention 阶梯 | **4.1397:1** | **4.6447:1** |
| 名字 vs 任一阶梯 | **17.01:1** | **14.27:1** |
| route id / 状态词 vs 任一阶梯 | 最低 **5.22:1** | 最低 **9.90:1** |

两个主题的方向一致（都从 ground **朝 ink 一侧**走一步），因此阶梯是**可跨主题移植**的。

### 3.5 ⚠️ 实测出来的另一个坑：宿主的三级 layer 令牌**不能**当阶梯

| 令牌 | 浅色 | 深色 |
|---|---|---|
| `--dsw-alias-bg-layer-1` | **`#fff` = ground（step 1.0000）** | `#232324`（step 1.1614） |
| `--dsw-alias-bg-layer-2` | **`#fff` = ground** | `#2c2c2e` |
| `--dsw-alias-bg-layer-3` | **`#fff` = ground** | `#353638` |

**浅色主题下 layer-1/2/3 全都解析成 `#fff`，与 `--dsw-alias-bg-base` 同值**——
用它们做行分隔，浅色下**完全没有台阶**，深色下却有很大台阶：
谁在浅色主题里看它「挺好」，谁就漏掉了一个只在另一个主题里存在的缺陷。
这正是 `retryStyles.ts` 顶部注释里那句警告的同型（「一个未定义的 `var()` 什么都不画，而且在 review 里是看不见的」）。
**所以：行分隔只许用 §2.2 的三级阶梯，layer-N 一个都不许用。**

另注：`--dsw-alias-bg-module-platform` 在浅色只有 **1.0820:1**、深色却有 **1.5077:1**。
跨度太不均衡，**不得**用它承载语义差别；若用，只能做页面级的整块底色带。

---

## 4. 字体：继承宿主，不引入新字体

- 全页**不设** `font-family`——继承宿主（宿主在 `body` 上把 `--dsw-font-family` 设成了
  用户选择的正文族，还带 `--dsh-font-family-text` 覆盖位）。`draw.mjs` 因此带 `--keep palette,type`。
- 尺寸只用 **3 档**（skill：两到三档可见档位，五档是上限）。代码注释里写死 px，与既有
  `retryStyles.ts` 的做法一致（该表全部用 px 字面量，13/15/17px）：

| 档 | 用途 | 字号 / 行高 |
|---|---|---|
| ~~页标题~~ | ~~dmc-title~~ | **本轮退役**（§14 D2 / §11.5）：可见段标题删掉，页头**只有就绪陈述**（20px/28px）；`config.title` 仍作 `<section>` 的 `aria-label` |
| 行主名 | `dmc-name` | **15px** / 22px，600 |
| 正文与家具 | 其余全部 | **13px** / 20px（`dmc-page` 上设一次，全线继承） |
| 辅助 | route id、状态词、空状态 | **12px** / 18px |

- **不用 monospace**（房子规则禁；route id 是 `deepseek-account` 这类普通标识符，属正文）。
- **数字用 `font-variant-numeric: tabular-nums`**（模型数量等要成列对齐）。
- **不做大写 + letter-spacing 的小标签**（房子规则禁，且数据上弱站占 57%）。
- **不用 `rem` 做缩放**：宿主在 `body` 上按用户设置改字号，`rem` 在本插件里会与宿主的
  「正文族/字号」设置不同步。用 px（与 `retryStyles.ts`/`styles.ts` 一致）。
- **不得用 opacity / filter / text-shadow / mix-blend-mode 弱化文字**（repo 样式门硬性检查）。
  「安静」只能靠 `--dsw-alias-label-secondary` 这一个更浅的 ink。

---

## 5. `dmc-` 类名清单（实现者直接用，不要另发明）

- 前缀 `dmc-`（`dmp-` 归座位、`drc-` 归重试卡，本页是新表面）。
- BEM 风格、**扁平**（无嵌套选择器，全部单类），每个类一句话用途。
- 全部小写、kebab；不出现 `__`/`--` 之外的分隔（与仓库既有两个前缀的拼写习惯一致）。
- **建议新建 `src/client/modelConfigStyles.ts`**，形状照抄 `retryStyles.ts`：
  `STYLE_ELEMENT_ID` + `export function injectModelConfigStyles(): () => void` + `export const MODEL_CONFIG_STYLESHEET`。
  **模板字符串内部不得出现反引号**（把新表加进 `selfcheck-static.mjs` 的检查后会 fail，且报错信息很迷惑）。

### 5.1 页面骨架

| 类名 | 用途 |
|---|---|
| `dmc-page` | 分区根节点；持有全页唯一直排节奏与 `max-width: 720px`（与官方 `.zGbnIq_section` 同宽，两个 tab 才对齐）；在此设一次 `font-size: 13px; line-height: 20px` |
| `dmc-head` | 页头容器：**只有就绪陈述**（本轮删掉了可见段标题，§14 D2） |
| `dmc-readout` | **就绪陈述**（§11.1 / §11.3 / §11.8）：页面唯一的大声处，20px/28px、600、primary ink、任何宽度 ≤2 行；读十行自己的 `data-state` 并印出需要处理的行数，三态对应 `config.summary.ready` / `.attention` / `.none`，数字 `tabular-nums`。**取代已退役的 dmc-intro**（§11.5），并且是**页头唯一的元素** |
| `dmc-empty` | 顶部空状态提示句（一个可用提供商都没有时）——**是句子，不是 banner、不是胶囊** |
| `dmc-notice` | 目录加载失败 / 只读态等分区级提示句 |
| `dmc-notice-action` | 提示句里的「重试」按钮 |
| `dmc-alert` | 写入被拒的持久告警（`settings.writable === false` 时） |
| `dmc-actions` | 分区尾部动作行（「添加提供商」等） |
| `dmc-add` | 「添加提供商 / Add provider」按钮；本轮 accent 载体改为 **4px 蓝色左竖条**（§11.8 D3），不再是下沿细线 |

> **本轮退役了可见段标题（dmc-title，§14 D2）**：设置侧栏被选中的 tab 已经写着「模型配置」，两位 juror 又把它读成
> eyebrow（skill 硬 cap），于是那个 `<h2>` 整个删掉——页头现在**只有就绪陈述**。段的可访问名不丢：
> `<section>` 上已有 `aria-label={t(KEYS['config.title'])}`，所以 **`config.title` 这个键继续在用，不要退役**。
> 连同前面的 dmc-intro / dmc-list-head / dmc-list-head-cell / dmc-key-state，退役记录见 §11.5。

### 5.2 列表

| 类名 | 用途 |
|---|---|
| `dmc-list` | 提供商列表 `<ul>`；**无填充、无描边、无圆角**，行只靠列对齐与节奏分开 |

> **本轮删除了列 key**：dmc-list-head 与 dmc-list-head-cell（连同 sheet 规则）已退役，理由见 §11.3 / §11.5——
> 控件不再是五列，行的两端自明（左身份、右答案），列 key 是给旧稿那 5 列控件用的。

> **有意的取舍**：不设 `dmc-group`。列表顺序是契约
> （[`modelConfigModel.ts`](../src/client/modelConfigModel.ts) 的 `joinProviderDirectory` 排序：account → official → 其余按输入序），
> 设计层**不得**按「可用/不可用」重排或分组。分组会把这条契约变成视觉主张。

### 5.3 行（本页的核心）

| 类名 | 用途 |
|---|---|
| `dmc-row` | 一行提供商；**列轨道的网格宿主 + tone 阶梯的目标 + hover/focus-within 的宿主** |
| `dmc-row[data-state]` | 状态钩子（**本轮权威**，取值与判据见 §5.8 / §11.2）：列表 `ready` / `missing-key` / `unreachable`，picker `dormant`；**互斥**；**行级规则不许出现 rest 态铺底**（§14 R1） |
| `dmc-row[data-error='true']` | **诊断钩子**：与 `data-state` 分开、可叠加，不改答案词；**不画竖条**（§14 R2），只有 `!` 入口 + 展开句（§11.2 / §5.8） |
| `dmc-row[data-usable='false']` | **过渡期别名**：⇔ `data-state === 'unreachable'`（§11.2；两处必须同时存在） |
| `dmc-row[data-open='true']` | 状态钩子：抽屉开着的那行，画 Rung 2（live 阶梯） |
| `dmc-rail` | **4px 竖条，行高满，紧贴行首**——行内唯一的颜色标记，也是整个列表的扫描列；**只画 `missing-key` / `unreachable`**（诊断不画，§14 R2），其余留空 |
| `dmc-name` | 提供商显示名；行内最大 ink（15px/22px、600）；**仍包住 `.dmc-route`**，宽度 ≥140px 是验收项 A3，不许缩成纯文本节点 |
| `dmc-route` | route id，紧贴名字；区分同名提供商（12px secondary ink） |
| `dmc-verdict` | 该行状态**作为一个词**（`可用` / `缺密钥` / `不可用`，取值复用 `config.verdict.*`，§11.2）；右对齐、`tabular-nums`、逐行对齐成一列；竖条的文字孪生 |
| `dmc-edit` | **行的控件段（段 2，本轮新增）**：承载去铬后的 `dmc-key` / `dmc-protocol` / `dmc-catalog` / `dmc-enable` / `dmc-error-toggle`；与段 1 之间**不画任何线**（§11.3） |
| `dmc-pending` | 该行有写入在途时的进行中标记（是词，不是只有转圈） |

### 5.4 行内控件（5 个）

| 类名 | 用途 |
|---|---|
| `dmc-key` | 凭据格：**只留动作**（状态词已删，见下） |
| `dmc-key-action` | 「替换密钥 / 设置密钥」——**该行的主操作**；本轮**去铬**成文字动作（无边框/无底色/无圆角/无阴影，12px secondary ink，hover/focus 升到 primary ink） |
| `dmc-key-clear` | 「清除密钥 / Clear key」（`config.key.clear`，本轮新增，§14 D1）：清掉本行存着的凭据——与生命周期的「删除提供商」不是同一件事；两个按钮都写「删除」会被读成重复入口 |
| `dmc-protocol` | 协议选择（原生 `<select>`），保留 1px `--dsw-alias-border-l3` 边 |
| `dmc-catalog` | 打开该行模型抽屉的按钮 |
| `dmc-catalog-count` | 抽屉里模型数量，开抽屉之前就知道里面有什么 |
| `dmc-error-toggle` | 展开「最近一次错误」的按钮 |
| `dmc-error-text` | 最近一次错误句（**`--dsw-alias-label-primary`，不是红**，见 §3.3） |
| `dmc-enable` | 该行启用态开关的包装 |

> **本轮删除了 dmc-key-state**（§11.5）：它（「API 密钥已配置 / 未配置」）与右端 `.dmc-verdict` 说的是同一件事
> （旧审计 §10.2 已指出），凭据格因此只留动作。同时 `.dmc-key-action` / `.dmc-key-clear` / `.dmc-catalog` /
> `.dmc-enable` / `.dmc-error-toggle` 全部**去铬**成文字动作；**每行最多只有一个 1px 边的控件**——
> `dmc-protocol` 这个真表单控件（房子规则豁免）。可见性判据一条都没改（§11.3）。

### 5.4.1 添加提供商的披露面板（picker，`task-13` 期间新增）

列表从 48 行收到 **已添加的 10 行**（§9.6）之后，未添加的 38 个目录条目收进**一个**页面级入口。
实现把它做成**行内披露**（disclosure）而不是浮层——理由记在 `modelConfigStyles.ts:184` 的注释里：
它是**本分区自己任务里的一步**（添加提供商），不是另一个表面；而且行语法已经存在（名字 + 旁边安静的 route id + hover 时一处 live 填充）。

| 类名 | 用途 |
|---|---|
| `dmc-picker` | 披露面板容器（`display: flex` 的竖列，`gap: 8px`） |
| `dmc-picker-list` | 未添加条目的清单 `<ul>`；**`max-height: 320px` + `overflow-y: auto`**——实测 38 条、滚动高 1520px，不设上限会把分区自己的动作行推下一屏半 |
| `dmc-picker-item` | 一条未添加的提供商（`<button>`，整行可点，`min-height: 40px`）；`:hover:not(:disabled)` 用 `--dsw-alias-interactive-bg-hover`，`:disabled` 退到 secondary ink。**选中即写入**（走与行内「添加」同一条路径），`added` 由 store 的下一次快照给出，选择器自身不保留状态 |

> 这三个类名是**本轮审计期间实现者新增**的（`modelConfigStyles.ts` 于 21:41 被改），
> 原文 §5 自然没有；`.taste-skill/audit-classes.mjs` 现在把它们报为「DEFINED but NOT documented」，
> 补入本节后该差集归零（类数以 §5.7 的复算为准）。

### 5.5 右侧抽屉（模型目录 + 模型发现）

抽屉**必须**有类名，否则实现者只能自己发明并与本表冲突。
**本节已在 `task-13` 里与实现对齐，并在本轮 UI 重构后复算：以下 53 个类是 `src/client/drawerStyles.ts` 的完整导出**，
原文只列了 18 个，缺的 34 个（实现者被迫自行发明的那批）现已全部补入并逐一给用途（§9.4）。

**外壳（11）**

| 类名 | 用途 |
|---|---|
| `dmc-drawer` | 右侧抽屉面板根；`position: fixed` 贴右缘、`width: min(460px, 100vw)`；**这是全页唯一允许浮起来的东西**（唯一允许阴影与圆角） |
| `dmc-drawer-scrim` | 抽屉后面点击关掉的遮罩层；用 `--dsw-menu-surface-fill`，**半透明**——遮罩若把页面盖死就毁掉「保留页面上下文」这个前提 |
| `dmc-drawer-head` | 抽屉固定表头（不滚）：标题组 + 关闭 |
| `dmc-drawer-heading` | 表头里的标题组（标题 + 副标题两行的 flex 列，`min-width: 0` 让长 route id 能换行） |
| `dmc-drawer-title` | 表头里的提供商显示名（15px/600） |
| `dmc-drawer-sub` | 标题下的 route id（12px，secondary ink） |
| `dmc-drawer-close` | 关闭按钮（`.dmc-btn` 上的 `flex: none`） |
| `dmc-drawer-body` | 抽屉**唯一**滚动区（`overflow-y: auto`；面板自身 `overflow: hidden`） |
| `dmc-drawer-foot` | 抽屉底部动作条（保存 / 恢复默认模型），`flex-wrap` |
| `dmc-drawer-section` | 抽屉内的分区小标题（模型目录 / 推理档位 / 模型发现三段的段标题） |
| `dmc-drawer-status` | 段标题旁的计数状态句（如「已自定义模型目录」）；`tabular-nums` |

**抽屉内的句子（3）** —— 三者都是**词，不是色**，全部用可读墨：

| 类名 | 用途 |
|---|---|
| `dmc-drawer-notice` | 一般说明句（12px，secondary ink） |
| `dmc-drawer-error` | **Host 的原始诊断，逐字打印**（如 `no model discovery is registered for "llm-deepseek"`）；靠**字重 600 + primary ink** 强调，**不用错误色**——那个色在本设计里是「标记」，不是「墨」 |
| `dmc-drawer-note` | 需要用户注意的短句（字重 600 + primary ink） |

**控件基元（2）**

| 类名 | 用途 |
|---|---|
| `dmc-btn` | 抽屉里所有按钮的底（32px 高、直角、`--dsw-alias-interactive-bg-hover` 填充 + primary ink）；`:disabled` 时退成透明 + secondary ink |
| `dmc-btn-commit` | 主提交（「保存」/「添加所选」）；**只靠字重 600 与 `dmc-btn` 区分，不靠 accent 填充**——理由见 §3.3.1 |

**模型目录（15）**

| 类名 | 用途 |
|---|---|
| `dmc-model-list` | 模型列表 `<ul>`（无 marker、`gap: 12px`） |
| `dmc-model-row` | 一个模型；`position: relative`，是 `[data-invalid='true']` 那根 4px 错误竖条的宿主 |
| `dmc-model-row[data-invalid='true']` | 状态钩子：该模型草稿写不进去 → `::before` 画 4px `state-error-primary` 竖条（**图形标记，3:1 门槛**；旁边的句子仍是 primary ink） |
| `dmc-model-fields` | 一个模型的四字段网格（`minmax(0,1fr)` ×2；≤560px 收成一列） |
| `dmc-model-label` | 字段名（「模型 ID」「显示名称」…）；12px secondary ink——**表单标签，不是 eyebrow** |
| `dmc-model-id` | 「模型 ID」字段格 |
| `dmc-model-name` | 「显示名称」字段格 |
| `dmc-model-window` | 「上下文窗口」字段格 |
| `dmc-model-tokens` | 「最大输出 token 数」字段格 |
| `dmc-model-input` | 上述四格的输入框；**保留 1px 边**（`--dsw-alias-border-l3`）——真实表单控件被房子规则豁免；`[data-invalid='true']` 时边改错误色 |
| `dmc-model-error` | 该模型的行内校验句（如「模型 ID 不能为空。」）；**primary ink，不是红** |
| `dmc-model-actions` | 一个模型下的按钮行（模型选项 / 删除模型） |
| `dmc-model-options` | 「模型选项」展开按钮（推理档位等）；`flex: none` |
| `dmc-model-options-panel` | 「模型选项」展开后的面板容器 |
| `dmc-model-remove` | 「删除模型」 |
| `dmc-model-add` | 「添加模型」（新增一条草稿行） |

**推理档位（8）**

| 类名 | 用途 |
|---|---|
| `dmc-reasoning` | 推理档位整段容器 |
| `dmc-reasoning-head` | 档位列表的表头行（档位名 / API 参数值 / 操作三列） |
| `dmc-reasoning-row` | 一个档位（同三列网格；≤560px 收成一列） |
| `dmc-reasoning-level` | 档位名控件（`<select>` 或输入，走 `dmc-model-input` 同款边与填充） |
| `dmc-reasoning-value` | 该档位的 API 参数值输入 |
| `dmc-reasoning-add` | 「添加档位」 |
| `dmc-reasoning-remove` | 「删除档位」 |
| `dmc-reasoning-help` | 档位段的说明句（12px secondary ink） |

**模型发现（14）** —— 三步：获取 → 勾选 → 落盘（`dmc-discover-adopt` 是第三步）

| 类名 | 用途 |
|---|---|
| `dmc-discover` | 「获取可用模型」入口（**纯读**，不写任何东西） |
| `dmc-discover-actions` | 发现流程的动作行（获取 / 全选 / 取消全选 / 添加所选 共处一行） |
| `dmc-discover-tools` | 勾选清单上的工具行（全选 / 取消全选） |
| `dmc-discover-panel` | 发现结果面板容器（勾选清单整体） |
| `dmc-discover-search` | 候选过滤输入框（复选框+id 是 label，搜索框另起） |
| `dmc-discover-list` | 候选清单 `<ul>`（`gap: 4px`） |
| `dmc-discover-group` | **分组标题行**（本轮新增；`<li>`，与候选行同级交替出现在 `dmc-discover-list` 里）：左侧印模型 id 的首段（vendor，如 `openai/gpt-4o` 的 `openai`——端点自己陈述的事实，**不按首字母、不按是否已存在**），右侧印该组条数（`tabular-nums`）；12px secondary ink，无分隔线，层级靠节奏（上方多 8px）。只在可见候选落在**多个具名分组**时才渲染；单一分组或 id 里没有 `/` 的清单不画标题（但类名始终在 TSX 里出现，死类门双向都过）。**不复用**：`dmc-discover-list` 是那个 `<ul>`（改它会动候选行间距）、`dmc-discover-candidate` 是「一条候选」（有复选框、可勾选）、`dmc-drawer-section` 是抽屉段标题（清单里约 15–25 组，用它等于堆段标题） |
| `dmc-discover-candidate` | 一条候选（`min-height: 32px`） |
| `dmc-discover-candidate[data-present='true']` | 状态钩子：该 id **已在目录里** → 整行退到 secondary ink，复选框 inert（**已有条目优先**这条契约的视觉表达） |
| `dmc-discover-check` | 候选的复选框（16×16） |
| `dmc-discover-label` | 复选框 + id 的 `<label>`——让 id 成为控件的可访问名，**不用端点文本拼 id** |
| `dmc-discover-id` | 候选的模型 id |
| `dmc-discover-name` | 候选的显示名（12px secondary ink） |
| `dmc-discover-adopt` | 「添加所选」——**三步里唯一会落盘的那一步** |
| `dmc-discover-tool` | 工具行里单个工具按钮（`flex: none`） |

### 5.7 清单完备性（`task-13` 审计结论 + 本轮复算）

`dmc-` 类名的**唯一权威就是本节**（逐类用途）与 §11.6（本轮清单与数字）。与实现逐一对齐后的数字：

| 来源 | `task-13` | **本轮（2026-10-16 §11 重构）** |
|---|---|---|
| `src/client/modelConfigStyles.ts`（页面，§5.1–5.4.1） | 32 | **29** |
| `src/client/drawerStyles.ts`（抽屉，§5.5） | 52 | **53** |
| **合计（去重后唯一）** | **84** | **82** |

- **本轮变化**：删 5（dmc-intro / dmc-key-state / dmc-list-head / dmc-list-head-cell / dmc-title，见 §11.5）、
  增 3（`dmc-readout`、`dmc-edit`、`dmc-discover-group`）→ 页面 32→29、抽屉 52→53。
- **无孤儿类**：82 个类**全部**在 `ModelConfigPage.tsx` / `ModelDrawer.tsx` 里被用上（`defined-but-not-used = 0`）。
- **无未登记类**：`audit-classes.mjs` 的 `DEFINED but NOT documented` 已归零。
- 脚本的「文档里有意提到但不设」排除表现在含 **6** 个名字：`dmc-group`（§5.2 明说不设）＋本轮退役的 5 个
  （§11.5）——这样 §11.5 的退役记录不会被脚本读成漂移。
- 复算脚本：`.taste-skill/audit-classes.mjs`（抽 `\.dmc-…` 与 TSX 里的 `dmc-…` 取差集，并排除 DOM id 前缀与
  文档里**有意不设**的类）。
  **改样式后请重跑它**，否则本节会再次落后于实现——这正是原文只列 18/52 时发生的事。
- 该脚本报出文档里**有意提到但不设**的类时不算漂移；本轮之后排除表里有 **6** 个名字：
  `dmc-group`（§5.2 明说不设）＋本轮退役的 5 个（§11.5）。

> **快照时点**：本节数字取 **2026-10-16 21:41**（`modelConfigStyles.ts` 21:41:02 / `ModelConfigPage.tsx` 21:41:38 /
> `drawerStyles.ts` 20:35:19 / `ModelDrawer.tsx` 21:02:46）。本任务进行期间实现者仍在改这两个文件，
> 所以「清单是否仍完备」应当**以重跑脚本为准**，不要以本文的静态数字为准。
>
> **本轮快照**（2026-10-16 23:0x 建，2026-10-17 00:1x 随 §14 D2 更新）：页面 32→**29**、抽屉 52→**53**、合计 84→**82**；
> 逐类清单在 §11.6.1，判据与四个差集的定义在 §11.6。

### 5.8 数据属性钩子（不是类，但属于同一份契约）

选择器里的状态钩子与类名同等重要，实现与测试都依赖它们：

| 钩子 | 取值 | 含义 |
|---|---|---|
| `dmc-row[data-state]` | 列表：`ready` / `missing-key` / `unreachable`；picker：`dormant` | **本轮的状态权威**（§11.2）：**互斥**，一次一个答案；判据一律复用 `providerUsable` / `keyConfigured` 等纯函数；**行级规则不许 rest 态铺底**（§14 R1） |
| `dmc-row[data-error]` | `true`（缺席=无诊断） | **诊断不是答案**：可叠加，不改 `data-state`、不改答案词；**不画竖条**（§14 R2），只有 `!` 入口 + 展开句 |
| `dmc-rail[data-state]` | `missing-key` / `unreachable` | 竖条画不画（4px，`state-error-primary`）；`ready` 留空，**诊断也不画**（§14 R2） |
| `dmc-verdict[data-state]` | 与 `dmc-row[data-state]` 同词 | 墨色分级**只跟 `data-state`**：`ready` secondary ink；`missing-key` / `unreachable` primary ink（§11.2）；**右对齐到行右缘**（§14 R4） |
| `dmc-row[data-usable]` | `true` / `false` | **过渡期别名**：`data-usable="false"` ⇔ `data-state === 'unreachable'`（§11.2；既有门与既有测试引用它，别名删不删由 verifier 定，删之前两处必须同时存在） |
| `dmc-row[data-open]` | `true`（缺席=不开） | 该行的抽屉开着 → Rung 2 live 阶梯 |
| `dmc-rail[data-usable]` | `true` / `false` | 别名，同上（与 `dmc-rail[data-state]` / `[data-error]` 并存） |
| `dmc-model-row[data-invalid]` | `true` | 该模型草稿写不进去 → `::before` 画 4px 错误竖条 |
| `dmc-model-input[data-invalid]` | `true` | 该输入框的边改错误色 |
| `dmc-discover-candidate[data-present]` | `true` | 该候选 id 已在目录里 → 退到 secondary ink、复选框 inert |

### 5.6 实现注意（会踩到的门）

1. **`border-radius` 只能是 `0` / `50%` / `var(...)`。** 本页的行与控件**一律 `0`**；
   只有 `dmc-drawer` 与 `dmc-drawer-scrim` 可用 `var(--dsw-radius-md)`——房子规则允许「真正浮起来的东西」
   （菜单、对话框）有圆角与阴影，宿主自己的 `.dmp-card`（`styles.ts`）用的也是 `--dsw-elevation-prominent`。
2. **不得出现 `#hex` / `rgb()` / `hsl()`**，也不得出现 `dashed`/`dotted`。
3. **控制边是例外**：`dmc-protocol` 的 `<select>`、`dmc-drawer` 里的输入框**保留 1px 边**——
   房子规则明确豁免「real tables and form fields」，且 `retryStyles.ts` 已就同一点写过实测教训
   （去掉字段边之后数字读成了静态文本）。边用 `--dsw-alias-border-l3`。
4. **焦点可见**：`dmc-*` 每个可聚焦控件都要有 `:focus-visible`，用
   `outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px`
   （与 `.drc-btn:focus-visible` 一致）。
   **不要**改用 `--dsw-focus-ring-color`：实测它在宿主主题表里就是 `transparent`，
   在提交的 fixture 里浅色是 `transparent`、深色**根本不存在**——用它等于**任何主题里都不画焦点环**。
   （`styles.ts` 里那两处 `box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary))`
   之所以还有效，全靠那个 `var()` 的**兜底值**；本页直接写 business 色，不要再叠一层依赖兜底的写法。）
5. **`prefers-reduced-motion` 分支必须有**，且本页只有两处动效：抽屉进出、控件状态反馈。
   全部只动 `transform`/`opacity`。
6. **必须把新表接进两道既有门。** 它们目前**都只看既有文件**，新表不会被自动覆盖：

   - `scripts/selfcheck-static.mjs`：`CLASS_NAME` 写死 `dmp-`，且只 `read` `src/client/styles.ts`
     与 `src/client/retryStyles.ts` 两个文件——`drc-` 在它的注释里被明确说明为**不在 scope 内**。
     所以 `dmc-` 的死类/裸反引号/硬编码色检查**不会跑**，除非显式加进去。
     请按 `drc-` 的先例加一条 `dmc-` 分支（前缀 + 文件清单 + 「模板字符串内无裸反引号」）。
   - `scripts/check-contrast.mjs`：`stylesSheet` 只读 `src/client/styles.ts`，`STYLES`/`CONTAINERS`
     两张表也是手工维护的。`dmc-` 的每一处文字样式都要**登记进 `STYLES`**（并补 `CONTAINERS` 链），
     否则 `dmc-` 的文字对比度**一个像素都没被量过**——而 §3.3 那三个不达标的令牌正是靠这道门才拦得住。

   **这两条不是可选项**：本页的整个主张（「一眼看出谁缺 key」）就建立在
   「竖条是图形、文字全部达标」之上；门没接上，主张就没有证据。

---

## 6. 有意偏离 skill 默认建议的地方（逐条记明）

| # | skill 的默认要求 | 本页的做法 | 理由 |
|---|---|---|---|
| 1 | 走完 hero / 落地页全流程，写文案层、找图片 | **跳过** | 命中 skill 自己的 Special case「A component or a single section, not a page」：skip the draw unless there is no direction to follow，match the surrounding design。**注意我仍然跑了 `draw.mjs`**，因为任务明确要求，且它确实提供了构图（§1） |
| 2 | **至少 4 张真实图片**（`critique.md` cap：少于 4 张 design ≤ 6.5） | **0 张，且不接受这条 cap 的扣分** | (a) 这是宿主设置面板里的一个分区，不是页面；(b) 房子规则同时禁「decorative shapes」「fake dashboards of grey bars」，任何图片在此都只能是装饰；(c) 揭示的方向 §5 自己写明「此类题材是软件，没有截图，**它自己的界面就是它的图片**」；(d) `assets.mjs` 的开放图库在此没有诚实的题材可查。**这是最清楚的一条偏离，故单列** |
| 3 | 动效层：≥ 8 个真正移动的元素（`still-page` 会让 design ≤ 7） | **不接受该下限** | 在别人的设置面板里做滚动入场动画是错的。本页只有状态反馈 + 抽屉进出，且都有 reduced-motion 分支。**接受**设计分因此被 cap 的后果，不辩解 |
| 4 | 「相邻分区的构图不许相同」 | **不适用** | `layout.md` §5 自己豁免：「A repeated module is for archives only (a work index, a menu, a schedule)」。本页就是那张表 |
| 5 | 标题两行以内、≤ 32 字符 | **遵守，但用更严的自定值** | 页标题限 **一行**；说明句在 720px 内 ≤ 2 行、≥ 390px 内 ≤ 3 行 |
| 6 | 一个 ground / 一个 ink / 一个 accent；accent 上「行动 + 至多一处」 | **遵守，但 accent 只出现在顶部那个主动作** | 列表里一个 accent 都不给：列表唯一的颜色是**状态色**（它是事实，不是行动）。§3.2 |
| 7 | 圆角「选一次：正方形或全圆」 | **正方形（`0`）；只有抽屉用 `var(--dsw-radius-md)`** | 调色板是宿主的，所以几何也该是宿主的：宿主自己的弹层用 `--dsw-radius-md`。行与控件一律 `0`（`retryStyles.ts` 已记明「6–16px 软圆角是弱站默认」） |
| 8 | 深色/浅色都要成立 | **遵守，并且本页是实测过的** | §3.4 / §3.5。浅色下 layer 令牌全等于 ground 这个坑，只有实测才发现 |
| 9 | 「六个以内的尺寸档位」 | **3 档** | §4 |
| 10 | 不需要 `data-ui` 属性 | **不用 `data-ui`** | 揭示的方向 §10 说 `data-ui` 是给**裁剪出来的界面片段**用的。本页整块都是宿主页面的真实界面，不是片段，套上 `data-ui` 只会把房子规则整片关掉 |

---

## 7. 交给实现者的验收清单

`task-7`（页面主体）与 `task-8`（抽屉）在合入前逐条自检：

- [ ] 不可用行：整行 attention 阶梯 + 4px 竖条；**错误句是 `--dsw-alias-label-primary`，不是红**。
- [ ] 可用行：**无填充、无描边、无圆角、无阴影**；竖条位置留空。
- [ ] hover / focus-within / 抽屉打开 → live 阶梯；**悬停不可用行时竖条不变**。
- [ ] 列表里没有第二种填充（无 zebra、无卡片）。
- [ ] 全部颜色是 `--dsw-*`；**没有** `--dsw-alias-label-tertiary`/`caption`/`dimmed` 画文字；
      **没有** `--dsw-alias-state-*` 画文字。
- [ ] 没有用 `--dsw-alias-bg-layer-1/2/3` 做任何行分隔。
- [ ] 每个可聚焦控件有 `:focus-visible`（2px business 色 outline）。
- [ ] `prefers-reduced-motion` 分支存在。
- [ ] CSS 模板字符串内无裸反引号；`border-radius` 只有 `0` / `var(...)`；无 `dashed/dotted`。
- [ ] **弹性列必须有下界**：名字列是 `minmax(>=140px, 1fr)`，不是 `minmax(0, 1fr)`（§9.1）。
- [ ] **窄屏验收改为按容器**：断点用 `@container`（`.dmc-page { container-type: inline-size }`），
      不用 `@media`；验收要在**容器**约 106px / 484px 两档各看一次，而不是在视口 390/768 下看（§9.2）。
      已知限制：390 视口下溢出 242px，靠宿主 `overflow-x: auto` 兜住，**不算已解决**。
- [ ] 两个主题各看一遍截图——**浅色主题单独看一次**（layer 令牌的坑只在浅色下存在）。
- [ ] **状态只有两个通道：竖条 + 词**（§14 R1/R2，**取代 §10.3 的铺底做法**）：行的 rest 态**永远没有填充**，
      **`unreachable` 也不铺底色**；竖条只画 `missing-key` / `unreachable`（**诊断不画竖条**，它只有 `!` 入口 + 展开句）；
      `dormant` 在 picker 里**零标记**。
- [ ] **页头有一句就绪陈述**（`.dmc-readout`，§11.1 / §11.3）：**三种状态都渲染**——
      「全部可用」/「N 个需要处理」/「尚未添加任何提供商」。§10.1 与 §10.4 的旧要求
      （dmc-summary，且 N=0 时不渲染）**已被 brief §1.1 作废**，见 §11。
- [ ] **类名已回归 §5 / §11.6**：跑 `node .taste-skill/audit-classes.mjs`，**四个差集全为 0**
      （defined-but-not-used / used-but-not-defined / defined-but-not-documented / documented-but-not-defined）。

---

## 8. 参考

- 方向原始数据：[`.taste-skill/direction.json`](../.taste-skill/direction.json)（`node draw.mjs --show` 重印）
- 实测脚本（本次工作文件，非交付物）：`.taste-skill/tokens.mjs`、`ladder.mjs`、`census.mjs`、`verify-pairs.mjs`
- 宿主令牌实测快照：[`scripts/theme-tokens.json`](../scripts/theme-tokens.json)
- 同类「宿主内客人组件」既有范例：[`src/client/retryStyles.ts`](../src/client/retryStyles.ts)（前缀 `drc-`）
- 样式门：[`scripts/selfcheck-static.mjs`](../scripts/selfcheck-static.mjs) · [`scripts/check-contrast.mjs`](../scripts/check-contrast.mjs)
- 数据层契约：[`src/client/modelConfigModel.ts`](../src/client/modelConfigModel.ts)（`providerUsable`、`joinProviderDirectory`）
- 范围与偏差清单：[`docs/models-page-parity-checklist.md`](models-page-parity-checklist.md) · [ADR 0003](adr/0003-parallel-tab-with-full-parity.md)

---

## 9. 修订记录（designer-2 = verifier，2026-10-16 真机审计）

### 9.0 方法与证据

- **真机**：playwright-cli + headless Chrome 驱动 `http://127.0.0.1:3080` 的设置面板，测量 `getBoundingClientRect` / `getComputedStyle` / `document.scrollingElement`。
- **截图**：`shots/model-config-01…17-*.png`（本任务期间新拍的包括 `02-page-dark`、`03-page-light`、`08-drawer-open`、`15-esc-drawer-only`、`16-inline-key-entry`、`17-added-only-list`）。
- **复算脚本**（本任务工作文件）：`.taste-skill/audit-contrast.mjs`（对比度）、`.taste-skill/audit-classes.mjs`（类名契约）。
- **共 8 条修订**。凡「原文说什么 / 真机是什么 / 根因 / 现在怎么改」四段齐全者，即为一条。

### 9.1 修订 1：名字列塌成 0px，提供商名逐字符竖排（对应 §2.3）

| | 内容 |
|---|---|
| **原文说什么** | §2.3：宽屏「单行，**7 条轨道**」，固定轨 `84/120/136/104/36/44`，名字列 `minmax(0, 1fr)` 弹性 |
| **真机是什么** | `.dmc-name` 宽 **0px**、高 **572px**（一字一行）；`.dmc-page` 高 **22204px**；实测 `gridTemplateColumns` = `4px 0px 76px 132px 112px 80px 32px 104px`。**1920/1440/1024/2560 全部复现**，只有 768 正常 |
| **根因** | 两条一起：① 原文的轨道算术本身就错——文字说「7 条」却列了 8 个方括号；② 固定轨合计 524px（实现里是 540px）+ 7×8px 间隙 = **596px**，而设置面板内容列只有 **564px**，`minmax(0, 1fr)` 里的 `0` 下界**允许它塌成没有**，于是名字列拿到 0px |
| **现在怎么改** | 已在 §2.3 就地更正为 **8 条轨道** + `minmax(140px, 1fr)` 下界，并把固定部分收到 **426px**。实测结果：48 行名字列**全部 140px**、`.dmc-name` 高 22–66px（1–3 行）、`.dmc-page` 高 **2854–3190px**、`rowsOverflowingPane = 0`。**纪律**：弹性列必须写下界，`0` 不是「需要时撑开」 |

### 9.2 修订 2：所有断点都在测视口，而可用宽度来自容器（对应 §2.3 窄屏分支、§7 窄屏验收）

| | 内容 |
|---|---|
| **原文说什么** | §2.3 窄屏分支写在 `@media (max-width: 900px)`；§7 验收「窄屏（<900px）：竖条贯穿两行；`dmc-verdict` 不被推出视口；**无横向滚动**」 |
| **真机是什么** | `@media (max-width: 900px)` 在 **1920 视口下永不触发**，所以宽轨道那一行是唯一跑着的分支。真正窄下来（390 视口）时：`.dmc-page` clientWidth **106** / scrollWidth **348**（**溢出 242px**），**48/48 行**溢出内容列，`.dmc-verdict` 列塌成 **0px**；768 视口则是干净的（484/484，0 行溢出）。document 级横向滚动在五档宽度下都是 **0** |
| **根因** | 设置面板宽 **800px，与视口无关**；390 视口下宿主只把 **106px** 给内容列（导航占了 188px）。断点问的是「视口多宽」，而布局承受的是「容器多宽」——这是同一类错误的两次发作（9.1 是算术版，本条是断点版） |
| **现在怎么改** | 已在 §2.3 标注适用条件。**正解**：把 `@media (max-width: 900px)` 换成 **`@container` 查询**，以 `.dmc-page` 的 `inline-size` 判定（`.dmc-page` 需 `container-type: inline-size`）；或在容器 < 约 420px 处改为**单列堆叠**（现在窄屏分支仍是 3 列 + 固定轨）。**已知限制（本轮不修）**：390px 下溢出 242px 依然存在，溢出部分靠宿主 `VOzbGW_options` 的 `overflow-x: auto` 兜住（可达但视觉被裁）——这条**不算已解决** |

### 9.3 修订 3：§3.3.1 的对比度补记——浅色数字对、**深色数字错**（对应 §3.3.1）

| | 内容 |
|---|---|
| **原文说什么** | §3.3.1（lead 补记）：accent 填充 + 白字 **4.235:1（浅）/ 2.14:1（深）**，12px 正文需 4.5:1，两主题均不达标；近黑 `#0f1115` 4.46:1、纯黑 4.96:1；因此主操作改为 accent 描边 + label-primary 墨 |
| **真机/复算是什么** | 由 `.taste-skill/audit-contrast.mjs` 从**已提交的** `scripts/theme-tokens.json` 独立复算：白字于 accent = **4.2349:1（浅）/ 2.3278:1（深）**；label-primary 于 accent = 4.4621:1 / 2.2275:1；`#0f1115` 于浅填充 = **4.4621:1**；纯黑 = **4.9588:1** |
| **根因** | 浅色 4.235、近黑 4.46、纯黑 4.96 三个数**都对**；**深色 2.14:1 是算错的**（正确 2.3278:1）。accent = `--dsw-static-deepseek-500 #4176e6`（浅）/ `--dsw-static-deepseek-400 #7aaaff`（深），与补记一致 |
| **现在怎么改** | §3.3.1 已从「blockquote 附录」**并入 §3.3 正文结论**，并更正为 2.3278:1。**判定方向不变且更强**：深色比原文说的还糟，所以「这个填充几乎容不下任何合规正文，问题出在把 accent 当底」这个结论成立 |
| **本轮新增（两处现存违反，均不在本任务 scope）** | ① `src/client/retryStyles.ts:309-313` 的 `.drc-btn-primary` **至今仍是** accent 填充 + `#fff` = **4.2349:1（浅）/ 2.3278:1（深）**——重试卡的保存按钮现在就不达标；② `retryStyles.ts:216`（`.drc-cap-mark`，11px）与 `:331`（`.drc-state[data-declared='true']`，12px）把 **accent 当文字**，而 §3.3 刚立下「accent 不得作文字」。`check-contrast.mjs` 只读 `styles.ts`，所以两张表都没被逐规则量过——**这是门的缺口，不是「已经量过了」** |
| **这三条违反的结局（2026-10-17 补记）** | 已由 DESIGN §5.33 处理：重试策略搬进「模型配置」页、样式并入 `dmc-` 域，`src/client/retryStyles.ts` 整个删除，`.drc-btn-primary` / `.drc-cap-mark` / `.drc-state` 随之消失（保存/恢复改用 `.dmc-key-action` 的墨色阶梯，来源词与摘要行只用 primary/secondary）。`drc-` 在仓库源文件里已归零；`check-contrast.mjs` 现在读三张表并登记 36+ 条 `dmc-` 样式，其中包含本轮的 6 条重试画字规则。本行按「不删别人的记录」原样保留，**它就是被 §5.33 反向处理掉的那条记录** |

### 9.4 修订 4：类名契约落后于实现（对应 §5、§5.7）

| | 内容 |
|---|---|
| **原文说什么** | §5.5 列出 18 个抽屉类，并说「`task-8` 可在此基础上增补」 |
| **真机是什么** | `drawerStyles.ts` 实际声明 **52** 个抽屉类，即原文缺 **34** 个：`dmc-btn`、`dmc-btn-commit`、`dmc-drawer-heading`、`dmc-drawer-sub`、`dmc-drawer-section`、`dmc-drawer-status`、`dmc-drawer-notice`、`dmc-drawer-error`、`dmc-drawer-note`、`dmc-model-fields`、`dmc-model-label`、`dmc-model-input`、`dmc-model-error`、`dmc-model-actions`、`dmc-model-options`、`dmc-model-options-panel`、`dmc-reasoning{,-head,-row,-level,-value,-add,-remove,-help}`、`dmc-discover{,-actions,-tools,-panel,-search,-list,-id,-name,-label,-adopt,-tool}`。另有 **3** 个页面侧新增（`dmc-picker`、`dmc-picker-list`、`dmc-picker-item`，见 9.5）。README 级的后果：**文档不再是唯一权威，实现者被迫自行发明** |
| **根因** | 抽屉的实现细节（推理档位 8 个类、发现流程 13 个类）在原文写作时**还没被设计到**——原文只给了「最小外壳」，而实现长出了两整段功能 |
| **现在怎么改** | §5.5 已扩到**全部 52 个**抽屉类并逐一给用途；§5.4.1 补入 picker 的 3 个；§5.7 的数字更新为 **32 + 52 = 84**。判据交给脚本：`.taste-skill/audit-classes.mjs` 现在报 `DEFINED but not used = 0`、`USED but not defined = 0`、`DEFINED but NOT documented = 0`，即 **§5 重新成为唯一权威**。脚本同时排除 6 个 **DOM id 前缀**（`dmc-model-id-` 等，用于 `aria-labelledby` 拼接，不是类）与文档里**有意不设**的 `dmc-group` |

### 9.5 修订 5：列表语义改为「只列已添加」，原文的规模假设作废（对应 §0、§2 标题与全部论证）

| | 内容 |
|---|---|
| **原文说什么** | §0 与 §2 的标题是「**10+ 行** × 5 控件，怎样一眼看出谁缺 key」，§1 的 `draw.mjs --brief` 也写着 "a list of ten or more provider rows" |
| **真机是什么** | 筛选落地后列表 = **10 行**（实测：`deepseek-account` + 9 个已配置），未添加的 **38** 条进 `dmc-picker`（`clientHeight 320` / `scrollHeight 1520`，内部滚动）。原文的「48 行」与「10+ 行」是同一个假设的两种说法，**现在都不成立** |
| **根因** | 需求新增：「未添加的提供商不要显示在页面上」。行数少了一个数量级，而原文的核心设计问题（周边视觉扫描红行）**是规模问题的解** |
| **现在怎么改** | §2 的标题与论证保留（它记录了方向），但**结论已由 §10.1 重新给出**；§1 的 brief 保留原样（它是历史命令），并在 §10.1 注明规模已变 |

### 9.6 修订 6：注意力色语义混装，且**在列表里恒不出现**（对应 §0 的 idea 句、§2.2 的 Rung 1）

| | 内容 |
|---|---|
| **原文说什么** | idea 句：「提供商行里那根『**缺 key 就亮红**』的竖条成为整个列表唯一的颜色事件」；§2.2 Rung 1 = 该行 `providerUsable === false` 时铺 `--dsw-alias-interactive-bg-hover-danger` |
| **真机是什么** | ① 修 bug 前 48 行里 **38 行**被铺红；② 那 38 行**正是 dormant（未添加）**，现在已被 9.5 的筛选移出列表；③ 筛选后的 10 行**全部** `data-usable="true"` → **竖条在真机上 0 次出现**，`dmc-verdict` 也只剩 ≤1 行有词；④ 反过来，**已添加但缺 key** 的行走的是 `providerUsable` 的第 3 支（`apiKeyEnv === undefined` → **true**），实测 `ant-ling` 加过后显示「API 密钥缺失」而 `data-usable` 仍是 **"true"**——**缺 key 并不亮** |
| **根因** | `providerUsable`（`modelConfigModel.ts:157-162`）判的是「这条路由能不能服务」，false 只有三种来源：**路由未注册**、**账号掉线**、**profile 指定的 key 缺失**。而「未添加」落进第一支（未注册），于是与「缺密钥」共用同一个红底；同时「profile 没指定 key 引用」被定义为**不欠 key**（合理，gateway 不需要 key），所以缺 key 的行反而不亮。**一句话：这个属性既不表示「缺 key」，又在筛选后恒为 true。** idea 句因此**与数据层不符** |
| **现在怎么改** | §10.3 给出 `data-state` 分级（`ready` / `missing-key` / `unreachable` / `dormant` / `error`），并把「整行危险底色」收窄到只给 `unreachable`；§10.1 重新给 idea 句的落点。**过渡期**保留 `data-usable` 作为别名的建议也写在 §10.3。**最终形态见 §13.6 / §11.2**：`data-state` 互斥（`error` 不再是取值），诊断改走 `data-error="true"` |

### 9.7 修订 7：§2.1 的「5 条列轨道」与 §2.3 的「7 条轨道」自相矛盾

| | 内容 |
|---|---|
| **原文说什么** | §2.1「它们被排进 **5 条**固定列轨道」；§2.3「单行，**7 条**轨道」；§5.4 标题「行内控件（**5 个**）」 |
| **真机是什么** | 实现是 **8 条**（`4px rail / name / verdict / key / protocol / catalog / error 26px / enable 72px`）；dmc-list-head 只渲染 **4** 个 dmc-list-head-cell（提供商 / API 密钥 / API 协议 / 模型目录） |
| **根因** | 三个数字（5 / 7 / 8）在同一份文档里指同一件事；§5.4 的「5 个控件」又把 `dmc-error-toggle` 与 `dmc-enable` 排除在外 |
| **现在怎么改** | §2.3 已改为 **8 条**并给出实现的精确宽度。§2.1 的「5 条」保留（它描述的是**控件族**的 5 类，不是轨道数），但 §10.2 建议把轨道减到 6 条——**数字以 §2.3 与 `--dmc-row-tracks` 为准** |

### 9.8 修订 8：`dmc-picker*` 是审计期间才出现的第三批类名

| | 内容 |
|---|---|
| **原文说什么** | 无——原文写作时「一个页面级添加入口」这个需求还不存在 |
| **真机是什么** | `modelConfigStyles.ts` 于 **21:41:02**、`ModelConfigPage.tsx` 于 **21:41:38** 被改（本任务进行中），新增 `dmc-picker`（披露面板）、`dmc-picker-list`（`max-height: 320px` 的内部滚动清单）、`dmc-picker-item`（一条未添加的提供商，整行可点 `<button>`）；`ModelConfigPage.tsx:524-525` 用 `rows.filter(row => row.added)` / `!row.added` 分流 |
| **根因** | 需求 9.5 落地；实现者选择**行内披露**而不是浮层 |
| **现在怎么改** | §5.4.1 已补入这 3 个类并说明为什么「披露而非浮层」是对的：它是本分区自己任务里的一步（添加提供商），不是另一个表面；行语法也已存在（名字 + 旁边安静的 route id + hover 一处 live 填充）。**注意本任务期间 `src/` 在动**，所以 §5.7 的数字以**重跑 `.taste-skill/audit-classes.mjs`** 为准 |

---

## 10. 三件判断（结论 + 理由）

### 10.1 「一眼看出谁缺 key」在 10 行规模下的重新回答

**先从实测确认规模**：列表 **10 行**，其中 **9 行「API 密钥已配置」**、**1 行「已登录」**（账号路由，无 key 格）→
**当前没有任何一行需要用户处理**；38 条 dormant 已进 picker。

**结论：问题变了，答案也要换。**

- **旧答案**：「在 10+ 行里，靠周边视觉让红竖条跳出来」。它成立的前提是**行多到不能逐行读**。
- **新答案**：10 行时人**会逐行读**（一屏就能看完 10 个名字）。所以这页的任务从
  「**在噪声里捞出需要处理的那一行**」变成
  「**一眼确认没有一行需要我；若有一行需要，它是唯一一个**」。

据此三件事按优先级重排：

1. **主要通道是「词」，竖条降为冗余的第二通道。** 缺 key 的行直接写 `缺密钥`（`dmc-verdict` 或凭据格的状态词），
   名字与状态词都在同一行、都可读；竖条保留给色盲/灰度/周边视觉，但**不再是主要机制**。
2. **加一条「只在需要时出现」的汇总句。** 页顶一句 `1 个提供商缺 API 密钥`（旧稿名 dmc-summary，**待实现**；
   本轮以 `.dmc-readout` 落地，且**三态都渲染**——见 §11.1，本条「N=0 时不渲染」的限定已被 brief §1.1 作废）。
   理由：**条数少的时候，计数比扫描便宜**；而且它是唯一能在「用户没往下看」时也把状态说出来的东西。
   条数为 **0 时不渲染**——「一切正常」是最常见的状态，不该多占一行字（也避免变成 eyebrow 式的常驻小标签，§6 第 6 条）。
3. **弃用整行危险底色。** 它在 48 行时铺了 38 行（占 79%，等于没有区分度）；在 10 行时铺任何一行都过重，
   而且整行红底在这套宿主令牌里读作「**这一行坏了**」，而缺一个 key 只是「**还没配完**」。
   红色留给「真的不能服务」（§10.3 的 `unreachable`）。

**诚实边界**：本部署**无法**观测到「10 行里有 1 行缺 key」的真机状态（实测 10/10 都能服务）。
上面的结论由两件实测事实推出——**列表规模 10**、以及**缺 key 不会让路由不可用**
（`ant-ling` 加过后显示「API 密钥缺失」而 `data-usable` 仍为 `"true"`）——**不是**从一张缺 key 的截图推出。
需要一张那样的截图，就得真去加一个不带 key 的提供商；那会改真实部署，**本轮没有做**。

### 10.2 8 列的行内网格还该不该保留

**结论：减到 6 列，省下的宽度全部给名字列。但这条建议与 10.3 绑定，不要单独实施。**

理由（按实测）：

- **`error`（26px）现在几乎不产出信息**：`dmc-error-toggle` 只在 `entry.error !== undefined` 时出现，本部署 **0 行**。
- **`verdict`（56px）的语义与凭据格重叠**：实测筛选前 `.dmc-verdict` 只有 **1/48** 行有词（账号路由的「已登录」），
  筛选后 ≤1/10。它的内容完全可以落进凭据格左侧或名字行内——这恰好也是 10.3 要解决的重叠。
- **名字列现在 140px 偏窄**：这条本来不敢减，是因为最长的 route id 是 `qwen-token-plan-individual` / `cloudflare-ai-gateway`；
  但**那 38 条恰恰全是 dormant**，已经进 picker。剩下的 10 行里最长的是 `deepseek-account` / `commandcode` /
  `starryears` 级别，**名字列可以安全加到约 180px**。
- **不能再减到 4 列以下**：`凭据`（状态词 + 替换入口）是本页的**任务列**，`模型目录` 是第二任务列。
  这两列必须保持固定轨道，否则每行控件左右漂移，「靠对齐成表」这个机制就没了（§2.1b）。

具体建议（把 426px 的固定+间隙压到 332px，差额 94px 全给名字）：

```
[4px rail][ name  minmax(180px, 1fr) ][ key 96px ][ protocol 72px ][ catalog 52px ][ enable 72px ]
```

- `dmc-verdict` 的词并入凭据格（或名字行内），**不占独立轨道**；
- `dmc-error-toggle` 改为**错误出现时才占位**（`grid-column: -1`）或并入 enable 格上方；
- **前置条件**：这条只在「列表只列已添加」这条语义成立时对。一旦列表要重新显示 dormant，
  `verdict`/`error` 两轨必须回来。**所以 10.2 与 10.3 一起实施，不要只做其中一个。**

### 10.3 `data-state` 分级方案

**问题（实测）**：今天的 `data-usable` 把两件不相干的事压成一个布尔。

- `providerUsable`（`modelConfigModel.ts:157-162`）为 false 只有三种来源：**路由未注册**、**账号掉线**、**profile 指定的 key 缺失**；
- 「未添加 / 休眠」是**第四种**，它落进「未注册」那一支 → 38 条 dormant 全部 `data-usable="false"`，与「缺密钥」**共用同一个红底**；
- 反过来，**已添加但没有 key** 的行（实测 `ant-ling`）`data-usable="true"` → **不亮**。

即：这个属性**既不表示「缺 key」，又在筛选后恒为 true**。必须拆。

| `data-state` | 判据 | 出现在哪 | 视觉强度 |
|---|---|---|---|
| `ready` | `added && providerUsable` | 列表 | **0 个标记**：无填充、竖条留空 |
| `missing-key` | `added && keyRefOf(row)` 有值 `&& !keyConfigured(row)` | 列表 | **1 个标记**：4px 竖条（`state-error-primary`）+ 词 `缺密钥`；**不铺整行底色**（理由见 10.1） |
| `unreachable` | `added && !providerUsable`（路由未注册 / 账号掉线） | 列表 | 4px 竖条 + 词，**保留整行 Rung 1 底色**——这才是真的「不能服务」 |
| `dormant` | `!added` | **只在 picker** | **0 个标记**：普通可点条目，hover 一处 live 填充。休眠是「可添加」，不是出错 |
| `error` | `added && entry.error !== undefined` | 列表 | 竖条 + 展开句（primary ink）；可与上面叠加 |

**强度阶梯的一条纪律**：列表里**同时最多两种标记**，且**只有 `unreachable` 允许铺整行底色**。
`missing-key` 只给竖条 + 词——缺 key 是「还没配完」，不是「坏了」。

**落地与兼容**：

- `dmc-row[data-state='ready' | 'missing-key' | 'unreachable' | 'error']`（**待实现**，取代 `data-usable` 的判定职责）
- `dmc-rail[data-state='missing-key' | 'unreachable']`（**待实现**）
- **过渡期保留 `data-usable` 作为别名**（`data-usable="false"` ⇔ `data-state === 'unreachable'`），
  否则 `scripts/selfcheck-static.mjs` 的 `dmc-` 分支与既有测试会一起变红；别名删掉之前，两处必须同时存在。

> ⚠️ **本节（10.3）是上一轮的提案，已被 brief §13.6 与本文 §11.2 取代**：`data-state` 最终是**互斥**的
> （列表 `ready` / `missing-key` / `unreachable`，picker `dormant`），**诊断不再是一种 `data-state`**——
> 它走可叠加的 `data-error="true"`，竖条画在 `data-state !== 'ready' || data-error === 'true'`。
> 取值、判据与强度一律以 **§11.2 / §5.8** 为准。

### 10.4 需要实现者新增的类名（**待实现**）

| 类名 | 用途 | 状态 |
|---|---|---|
| dmc-summary | 页顶汇总句，只在「有行需要处理」时渲染（如 `1 个提供商缺 API 密钥`）；与 `dmc-notice`（目录加载失败 / 只读态）不是同一件事，故单列 | **作废**：本轮以 `.dmc-readout` 落地且三态都渲染（§11.1） |
| dmc-summary-count | 汇总句里的数字（`font-variant-numeric: tabular-nums`），让数字不与文字一起跳动 | **作废**：数字样式并入 `.dmc-readout`（§11.3） |
| `dmc-row[data-state]` / `dmc-rail[data-state]` | §10.3 的状态钩子（属性，不是类） | **待实现** |

> 除这三个之外，**不需要新类名**：10.2 的减列只是改 `--dmc-row-tracks` 与把 `dmc-verdict` 挪进已有格，
> 10.1 的「词」复用 `dmc-verdict` / 旧稿的 dmc-key-state（**本轮已删**，见 §11.5）。**新增类名前请先跑 `.taste-skill/audit-classes.mjs`**，
> 并把它们登记进 §5——本次审计的全部摩擦都来自「实现加了类而文档没跟上」。

---

## 11. 本轮 UI 重构：`quiet-instrument`（`task-1` 收口，2026-10-16）

> **本节与 §0–§2 的关系。** §0/§1/§2 记录的是 **48 行规模**下的旧方向 `product-performs`，它的规模假设
> 与「红竖条是主要通道」的结论已被 §9.5 / §9.6 / §10.1 的真机数据作废。本轮按**冻结契约**
> [`docs/model-config-redesign-brief.md`](model-config-redesign-brief.md) 重跑方向并全面重构：
> **§11 是当前实现的方向记录**，§0–§2 只作为历史论证保留。类名以 §11.6（复算结果）与 §5（逐类用途）为准。
>
> 本节所有决定都来自 brief，不是本节新发明的；**能力一条不减**（`docs/models-page-parity-checklist.md` §1 的 A–E），
> 既有 13 项真机验收一条不弱化。

### 11.1 方向：`quiet-instrument`（The quiet instrument）

- **命令与结果**：`draw.mjs --keep palette,type`（色与字来自宿主，不引入新字体、新色值），
  **seed `1258196331`**；direction sheet 落在 [`.taste-skill/direction.json`](../.taste-skill/direction.json)
  （`node <skill>/scripts/draw.mjs --show` 可重印）。**已跑，不要重跑、不要换。**
- **另两个候选被否**：`dense-tiles`（贴边瓦片板）字面要求「贴边填满、无空格」，正是本页要避开的卡片/瓦片矩阵；
  `one-motif`（单一形体母题）需要一个形体母题，而设置分区里没有形体可借。
- **选它的理由**：本页的核心事实是「**十行里没有一行需要我；若有一行需要，它是唯一一个**」（§10.1 的结论）。
  **克制本身就是主张**——这正是 `quiet-instrument` 的论点，且与「设置分区不能大喊」这条宿主约束天然一致。

**idea 句**（skill 第 4 步要求写下）：

> 在这页上，**「这个提供商现在能不能服务我的请求」——数据层已经逐行回答的那个问题
> （`providerUsable` / `keyConfigured`）——成为页面唯一的大声处：一句只数「需要处理的提供商」的就绪陈述；
> 下面十行保持同一个小组尺寸，身份在左端、那一行的答案在右端，于是列表读起来是一列陈述，不是一格控件表。**

竞品检验：把官方「设置 → 模型」页放进去——它用开通卡 + 卡片网格表达同一件事，**没有一句计数陈述**，
右端也不是答案列；把任何一个「一列可编辑设置」的界面放进去——**它没有那个可数的二元事实**。
所以这句话只属于本页。

**live thing（页面上唯一会变的东西）**：页面顶部的**就绪陈述**，实现名 `.dmc-readout`。
它读自己十行的真实状态，印出需要处理的行数；用户存 key / 清 key / 添加 / 删除提供商后**当场重算**；
零问题时说「全部可用」，一行都没有时说「尚未添加」；没有脚本也照样读得懂（十行的答案词本身就是它的平铺版）。

**为什么这不是「加一个统计块」**：它是 `modelConfigModel.ts` 里**已有的纯函数** `providerUsable` 的**直读**，
不是新事实；且它是页面**唯一**的大尺寸元素（§11.3）。旧审计 §10.1 已提出过它，本轮把它**升为页面唯一的大声处**。
**旧稿的两个名字 dmc-summary / dmc-summary-count 作废**（brief §7 只批准 `.dmc-readout` 与 `.dmc-edit` 两个新类），
不要按 §10.4 实现它们。

### 11.2 状态模型：`data-usable` 拆成互斥的 `data-state` + 可叠加的 `data-error`

旧审计 §9.6 的实测是这条决定的全部理由：`data-usable` 把两件不相干的事压成一个布尔（38 个休眠提供商与缺密钥
共用红底），且筛选后**恒为 true → 那根 4px 竖条在真机上 0 次出现**。本轮按下表落地（判据**一律复用纯函数，不另写判断**）：

| `data-state` | 判据 | 出现在 | 视觉强度 |
|---|---|---|---|
| `ready` | 已添加 **且** `providerUsable(row)` | 列表 | **0 个标记**：无填充、竖条留空 |
| `missing-key` | 已添加 **且** 该行有凭据引用 **且** `!keyConfigured(row)` | 列表 | **竖条**（`--dsw-alias-state-error-primary`）+ 词 `缺密钥`；**不铺底色** |
| `unreachable` | 已添加 **且** `!providerUsable(row)` | 列表 | 竖条 + 词 `不可用`；**同样不铺底色**（R1） |
| `dormant` | `!added` | **只在 picker** | **0 个标记**。休眠是「可添加」，不是出错——`data-state="dormant"` 只做可访问性钩子，不画任何东西 |

**`data-state` 是互斥的**（brief §13.6，取代 §2 里「error 可叠加」那段含糊写法）：列表只会是
`ready` / `missing-key` / `unreachable` 三者之一，picker 只会是 `dormant`。它**永远是「这一行能不能服务我的请求」，
一次一个答案**。**诊断不是答案**：诊断走另一个属性 `data-error="true"`，**可叠加**，且**不改 `data-state`、
也不改答案词**——一个既不能服务、又有诊断的行，状态仍是 `unreachable`，另外多一个可展开的诊断句（primary ink）。

**强度纪律（brief §14 的 R1 / R2）**：
- **R1 · 废弃整行底色。** 行的 rest 态**永远没有填充**，`unreachable` 也不铺。唯一的行级填充是**位置性、瞬时**的
  live 填充（`:hover` / `:focus-within` / `[data-open='true']`）。状态只由**竖条 + 词**两个通道承载——
  第三通道（铺底）只会把页面喊响，而 §10.1 早已判定十行规模下**词是主通道、竖条是冗余第二通道**。
- **R2 · 竖条只表示「能不能服务」**：只有 `missing-key` / `unreachable` 画竖条；**诊断（`data-error`）不画竖条**，
  它只有 `!` 入口 + 可展开的诊断句。（旧稿曾让诊断也画竖条，真机读成「右端说可用、左边一根红条」的矛盾。）
- 于是十行里若有 2 行亮，读者看到的是「2 个标记 + 8 个空槽」；picker 里连竖条都不存在。

**过渡期兼容**：`data-usable` **保留为别名**（`data-usable="false"` ⇔ `data-state === 'unreachable'`），
因为 `scripts/selfcheck-static.mjs` 的 dmc- 分支与既有测试引用它。**两处必须同时存在**；别名删不删由 verifier 定。

**答案词**：**每一行都渲染** `.dmc-verdict`，**永远只有一个词**，**只跟 `data-state`**：`ready` → `config.verdict.ready`
（`可用`）、`missing-key` → `config.verdict.missingKey`（`缺密钥`）、`unreachable` → `config.verdict.unavailable`（`不可用`）。
一律复用 `modelConfigCopy.ts` 里**已存在**的这三个键——**不发明第三套词汇**
（`config.verdict.dormant` 在列表里不用；picker 里也不要拿它给休眠行贴标签；`data-error` **不进词**）。
`ready` 行用 secondary ink；`missing-key` / `unreachable` 行用 primary ink。醒目度靠**竖条 + 墨色**，不靠底色。

**自检据此断言**（verifier，brief §13.6 / §14）：sheet 里出现的每个 `data-state` 取值都必须被 TSX 产出；
**行级规则里不得出现 rest 态 `background` 铺底**（只允许 `:hover` / `:focus-within` / `[data-open='true']` 的 live 填充）。

### 11.3 构图

**一个窄列，一个大东西。** `.dmc-page` 收窄到 `max-width: 560px` 且**左对齐**（它住在宿主设置面板里，不居中），
在 `.dmc-page` 上设一次 `container-type: inline-size`。页头**只有就绪陈述**：没有段标题（dmc-title 已由 §14 D2 退役）、
没有 eyebrow、没有胶囊、没有分隔线。`.dmc-readout` 是页面上唯一比正文大的东西（20px / 28px，600，primary ink，
任何宽度下 ≤2 行），也是**页面唯一的大尺寸元素**。就绪陈述**取代**原先那句通用说明（那是「填入密钥即可使用」
式的零信息句，本轮随 `config.intro` 一起退役，见 §11.7）。

**列表没有列 key。** 旧稿的 dmc-list-head / dmc-list-head-cell（4 格列 key）随本轮**删除**：
它们是给 5 列控件用的，而控件已经不再是五列（见下），且行两端自明（左身份、右答案）。
这是一处**有意的删减**，理由记在 brief §3.1。

**行 = 一列陈述 + 一行控件**（本页的核心）。一行两段，**两段之间不画任何线**（房子规则禁 1px 分隔线），
靠行内节奏与列对齐分开：

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

- **段 1 两端**：左端 = 身份 `.dmc-name`（15px/22px，600，primary ink，**仍然包含** `.dmc-route` 子元素；
  真机验收 A3 量 `.dmc-name` 宽度 **≥140px**，所以不许把它缩成纯文本节点、也不许套新 wrapper 把宽度拿走），
  `.dmc-route` 12px secondary ink 紧贴名字；右端 = 答案 `.dmc-verdict`（13px，`justify-self: end`，
  `font-variant-numeric: tabular-nums`，逐行对齐成一列，A4 量它在五个视口里都在视口内）。
  两端在**同一行**上；名字可以换行，答案与名字第一行对齐。
- **段 2 控件的去铬**：底线是**每行最多只有一个 1px 边的控件**——`<select class="dmc-protocol">`（真表单控件，
  房子规则明确豁免）。其余全部改成**文字动作**：无 border、无 background（rest）、无 radius、无 shadow，12px，
  secondary ink，`:hover` / `:focus-visible` 时升到 primary ink 或 `--dsw-alias-interactive-bg-hover`。
  适用：`.dmc-key-action`、`.dmc-key-clear`、`.dmc-catalog`、`.dmc-enable`、`.dmc-error-toggle`。
  **这是本轮最大的一处减负**：旧稿每行最多 5 个 1px 描边框 × 10 行 = 50 个框，重构后 = 10 个（只有 select）。
- **dmc-key-state 删除**：它（"API 密钥已配置 / 未配置"）与右端的答案词说的是同一件事（旧审计 §10.2 已指出）。
  凭据格只留动作：`替换密钥` / `设置密钥`（沿用现有 `config.key.*`）+ `清除`。
- **每个控件的可见性判据一律不改**：什么行有凭据格、什么行有清除、什么时候出现诊断按钮、什么时候禁用——
  **照抄现有条件表达式**。本轮只改构图、不改条件（也不改数据层，见 brief §9）。

**一个 accent，一处。** 唯一 accent 用在唯一主操作「添加模型提供商」`.dmc-add` 上，且只做**边缘或实心块**：
本页取它的 **2px 实心 accent 下沿**（图形，3:1 门槛；实测浅 4.2349:1 / 深 7.8343:1 达标），文字仍用 primary ink。
**不许把 accent 当底色写文字**：实测该填充上的白字是 **4.2349:1（浅）/ 2.3278:1（深）**，两主题都不达 4.5:1
（本页 §3.3.1 的实测结论），`selfcheck-static.mjs` 有硬断言拦这条。列表里**没有** accent——列表唯一的颜色是
状态色，它是事实，不是行动。

**窄容器分支用 `@container`，不用 `@media`。** 旧审计 §9.2 实测：宿主面板宽 800px **与视口无关**，
所以 `@media (max-width: 900px)` 在 1920 视口下永不触发；390 视口下宿主只给内容列 106px。
正解是查容器：分支写成 `@container (max-width: 520px)`（必要时再加一档 `360px`）。
窄容器下两段竖直堆叠、竖条**贯穿全部段**（扫描列不断开）、控件允许换行、`.dmc-verdict` 不许被推出容器、
触屏目标 ≥40px。`selfcheck-static.mjs` 那条 `max-width branch` 断言随之改成
「存在窄容器分支」并**同时**要求 `@container` 与 `container-type: inline-size`——这不是放宽。

### 11.4 动效与图片：两条有意偏离（报告里必须原文出现）

动效**只有 transform / opacity / 背景色**，一条曲线，全部有 `prefers-reduced-motion` 分支。四条：

1. **控件反馈**：每个可聚焦控件都有 hover / focus-visible / active（按压 1px 沉降或背景步进）。
2. **抽屉进出**：`.dmc-drawer` 从右侧滑出（transform），scrim 同步——已有，保持。
3. **答案词落定**（本轮的签名动作）：某行 `data-state` 变化时，`.dmc-verdict` 用 160ms 的 transform + 颜色
   落定一次——状态变化是**可见的事件**，但它只动那一个词。
4. **就绪陈述重算**：`.dmc-readout` 的数字用 `tabular-nums`，数值变化时同样只做一次落定，不跳动整行。

**明确不做**：滚动入场 stagger、逐段淡入、首屏 masked headline reveal。理由：这是**别人的设置面板里的一个分区**
（skill 的 Special case「A component or a single section, not a page」），在里面做首屏编排动画是错的。

**图片：0 张 raster。** 依据不是偏好，而是方向自己的第 5 节：「This subject is software and there are no
screenshots, so its pictures are its own interface.」——本页的「图片」就是**十行真实渲出的提供商行**
（真 provider 名、真 route id、真错误原话、真协议取值）。**不用 `data-ui` 属性**（§6 第 10 条）：
本页整块是宿主页面的真实界面，不是裁出来的片段，套上 `data-ui` 会把房子规则整片关掉。

**两条有意偏离（原文照录，接受设计分影响）**：

1. **图片下限（≥4 张真实图片）**：本页 0 张 raster，理由是方向第 5 节自己的裁决与房子规则（禁装饰形状 / 假仪表盘）；
   替代物是十行真实界面片段。**接受**该项在设计分上的影响。
2. **动效元素下限（≥8 个移动元素）**：**有意不接受**。替代证据是真机量的 transition 与 reduced-motion 行为。

（第三条「相邻分区构图不许相同」不适用：`layout.md` §5 自己豁免「a repeated module is for archives only」，
本页就是那张表；行与行**必须**同构，否则列不再对齐。）

### 11.5 本轮删掉的类、新增的类

**删除（sheet 里的规则一起删；死类门两个方向都查）**

| 类名 | 理由 |
|---|---|
| dmc-list-head | 列 key 是给 5 列控件用的，控件已不是五列；行两端自明（§11.3、brief §3.1） |
| dmc-list-head-cell | 同上，它是列 key 的一格 |
| dmc-key-state | 与右端答案词语义重叠（旧审计 §10.2）：同一件事说两遍，凭据格只留动作 |
| dmc-intro | 页头的通用说明被 `.dmc-readout` 取代（`config.intro` 随之退役，§11.7）；brief §3.1 的后果，已与 lead 对齐 |
| dmc-title | **可见段标题整个退役**（§14 D2）：设置侧栏被选中的 tab 已写着「模型配置」（第三份重复），两位 juror 独立把它读成 eyebrow（skill 硬 cap）。段的可访问名不丢——`<section>` 上已有 `aria-label={t(KEYS['config.title'])}`，所以 **`config.title` 键继续在用、不退役** |

> 上表的名字**故意不写成反引号**：`.taste-skill/audit-classes.mjs` 把文档里所有反引号 `dmc-…` 当作
> 「已文档化的类」，删掉的类若带反引号会被报成 `DOCUMENTED but not defined`（漂移）。

**新增（brief §7 只批准这两个）**

| 类名 | 用途 |
|---|---|
| `.dmc-readout` | **就绪陈述**：页面唯一的大声处，20px/28px/600/primary ink，≤2 行；三态（`config.summary.ready` / `.attention` / `.none`），计数与十行 `data-state` 逐行对账；数字 `tabular-nums` |
| `.dmc-edit` | **行的控件段**：段 2 的容器，承载去铬后的 `.dmc-key` / `.dmc-protocol` / `.dmc-catalog` / `.dmc-enable` / `.dmc-error-toggle` |

**其他类名照旧**，只改规则内容（含 `.dmc-rail` 的 `data-state` 钩子、`.dmc-verdict` 的右对齐与墨色分级）。

### 11.6 `dmc-` 类名权威清单（以实现为准）

**收口方式**：等 `task-2`（`ModelConfigPage.tsx` + `modelConfigStyles.ts`）与 `task-3`（`ModelDrawer.tsx` +
`drawerStyles.ts`）落地后，跑

```
node .taste-skill/audit-classes.mjs
```

它从**两个已实现的样式表**抽 `\.dmc-…`、从**两个已实现的组件**抽 `dmc-…`、从**本文**抽反引号 `dmc-…`，
报四个差集。**四个都必须为 0**（脚本的 exit code 依赖第四个，任务书说的「三个差集」是前三个）：

- `DEFINED but not used` = 0（无死规则）
- `USED but not defined` = 0（无未登记类）
- `DEFINED but NOT documented` = 0（§5 未落后于实现）
- `DOCUMENTED but not defined` = 0（文档不许登记不存在的类；有意不设的 `dmc-group` 由脚本豁免）

**基线（重构前，2026-10-16 22:5x）**：defined **84**（页面 32 + 抽屉 52）、used **84**、documented **87**，
差集全 0；另有 2 个待实现项 dmc-summary / dmc-summary-count（**本轮作废**，见 §11.1）。

#### 11.6.1 收口清单（**82** 个，2026-10-17 随 §14 D2 复算，以实现为准）

**页面 `src/client/modelConfigStyles.ts`（30 个）**

| §5 小节 | 类名 |
|---|---|
| §5.1 页面骨架（9） | `dmc-page` `dmc-head` `dmc-readout` `dmc-empty` `dmc-notice` `dmc-notice-action` `dmc-alert` `dmc-actions` `dmc-add` |
| §5.2 列表（1） | `dmc-list` |
| §5.3 行（7） | `dmc-row` `dmc-rail` `dmc-name` `dmc-route` `dmc-verdict` `dmc-edit` `dmc-pending` |
| §5.4 行内控件（9） | `dmc-key` `dmc-key-action` `dmc-key-clear` `dmc-protocol` `dmc-catalog` `dmc-catalog-count` `dmc-error-toggle` `dmc-error-text` `dmc-enable` |
| §5.4.1 picker（3） | `dmc-picker` `dmc-picker-list` `dmc-picker-item` |

**抽屉 `src/client/drawerStyles.ts`（53 个）**

| §5.5 小节 | 类名 |
|---|---|
| 外壳（11） | `dmc-drawer` `dmc-drawer-scrim` `dmc-drawer-head` `dmc-drawer-heading` `dmc-drawer-title` `dmc-drawer-sub` `dmc-drawer-close` `dmc-drawer-body` `dmc-drawer-foot` `dmc-drawer-section` `dmc-drawer-status` |
| 句子（3） | `dmc-drawer-notice` `dmc-drawer-error` `dmc-drawer-note` |
| 控件基元（2） | `dmc-btn` `dmc-btn-commit` |
| 模型目录（15） | `dmc-model-list` `dmc-model-row` `dmc-model-fields` `dmc-model-label` `dmc-model-id` `dmc-model-name` `dmc-model-window` `dmc-model-tokens` `dmc-model-input` `dmc-model-error` `dmc-model-actions` `dmc-model-options` `dmc-model-options-panel` `dmc-model-remove` `dmc-model-add` |
| 推理档位（8） | `dmc-reasoning` `dmc-reasoning-head` `dmc-reasoning-row` `dmc-reasoning-level` `dmc-reasoning-value` `dmc-reasoning-add` `dmc-reasoning-remove` `dmc-reasoning-help` |
| 模型发现（14） | `dmc-discover` `dmc-discover-actions` `dmc-discover-tools` `dmc-discover-panel` `dmc-discover-search` `dmc-discover-list` `dmc-discover-group` `dmc-discover-candidate` `dmc-discover-check` `dmc-discover-label` `dmc-discover-id` `dmc-discover-name` `dmc-discover-adopt` `dmc-discover-tool` |

**合计 29 + 53 = 82**（两名表无交集，去重后仍是 82）。

**门槛与纪律**：上面四个差集全 0 是收口的定义；**清单以实现为准**——改样式表或组件后重跑
`node .taste-skill/audit-classes.mjs`，并同步 §5.7 的数字。§5 给逐类用途，本节给收口名单与数字，
两者都必须与这两个实现文件一致。

### 11.7 文案：四个新键 + 一次退役（`modelConfigCopy.ts`）

- **新增（键名冻结，措辞可微调）**，三块（`KEYS` / `zh` / `en`）**同键同序**，`{count}` / `{issues}` / `{inCatalog}`
  沿用既有的 `{name}` 插值习惯。本轮共 **5** 个新键：§8 的三个（页面就绪陈述）+ §13.2 的一个（抽屉发现计数句）
  + §14 D1 的一个（凭据格的清除动词）：

| 键 | zh | en |
|---|---|---|
| `config.summary.ready` | `{count} 个提供商，全部可用` | `{count} providers, all usable` |
| `config.summary.attention` | `{count} 个提供商可用，{issues} 个需要处理` | `{count} usable, {issues} need attention` |
| `config.summary.none` | `尚未添加任何提供商` | `No providers added yet` |
| `config.fetch.count` | `共 {count} 个候选，其中 {inCatalog} 个已在目录里` | `{count} candidates, {inCatalog} already in the catalog` |
| `config.key.clear` | `清除密钥` | `Clear key` |

> `config.key.clear`（§14 D1）无插值：一行上原来有**两个都写「删除」**的按钮——凭据格的清除（`.dmc-key-clear`，
> 清掉存着的 key）与生命周期的删除（`.dmc-enable`，删掉提供商 profile），juror 读成「重复的删除入口」，它是对的。

> `config.fetch.count` 的占位词是 **`{inCatalog}`**，**不是** `{present}`：`data-present` 是同一张候选清单
> 的行级状态钩子（§5.8），两个名字共用一个词会让文案与属性互相污染。它印在候选清单上方，是一个计数句，
> 不重复每个分组标题右侧的分组条数（那是数据本身）。

- **退役 `config.intro`**：三块一起删（否则 copy 门红）。它被 `.dmc-readout` 取代，文案本身零信息量。
- **复用，不新造词汇**：行内控件沿用 `config.key.*` / `config.api.*` / `config.models.*` / `config.add*` /
  `config.remove*`；答案词沿用已存在的 `config.verdict.{ready,missingKey,unavailable}`（§11.2）。
- `src/client/dictionary.ts` **无需改动**（brief §13.1）：它是座位与参数面板（`provider.*` / `settings.*`）的词表，
  没有 `config.*` 命名空间；把这四个键放进去会造出第二份 config 词表。
- **门**（brief §13.3 / §13.9）：`scripts/test-model-config-copy.mjs` 归 **verifier**——插值词汇表白名单扩到
  **7 个词**（`{provider}` `{hint}` `{env}` `{url}` `{count}` `{issues}` `{inCatalog}`），`required` 概念表里把退役的
  `config.intro` 换成三个 `config.summary.*` + `config.fetch.count`。verifier 已扩表，该门现在 **全绿**
  （`model config copy unit: all good`）；同轮 `npm run selfcheck`、`npm run typecheck`、
  `node .taste-skill/audit-classes.mjs`（四个差集全 0）也全绿。

### 11.8 已裁决与有意为之（juror 误读的回应）+ 构图纪律与 accent 载体

**页头（D2 · 本轮补裁）。** 本轮**退役了可见段标题**：页头现在**只有就绪陈述**，`.dmc-readout` 是页面唯一的
大尺寸元素。理由：设置侧栏被选中的 tab 已经写着「模型配置」（第三份重复），而两位 juror 独立把那个 16px 的
`<h2>` 读成 eyebrow——eyebrow 在 skill 里是**硬 cap**。段的可访问名**不丢**：`<section>` 上已有
`aria-label={t(KEYS['config.title'])}`，所以 `config.title` 这个键**继续在用、不退役**；`dmc-title` 类与规则一起删
（§5.1 / §11.5）。

brief §14 把下面几条**记录为有意或已裁决**，不是待修缺陷；写在这里省得每轮重吵：

| # | 会被读成的问题 | 事实 / 裁决 | 处理 |
|---|---|---|---|
| R7 | 「16px 的『模型配置』像 eyebrow」 | **juror 读对了**：它被读成段标题上方的小标签，触发硬 cap。裁决 = 删掉可见段标题（D2），页头只留就绪陈述；可访问名由 `aria-label` 承担 | **已裁决并执行**：`.dmc-title` 退役（§11.5） |
| R8 | 「错误诊断是未翻译的英文」 | 那是**宿主的原始诊断、逐字打印、不翻译**（如 `no model discovery is registered for "llm-openrouter"`）；翻译会丢掉可检索的原话 | **记录，不改** |
| R9 | 「Blue 是第二个 accent」 | 蓝色是**行动 / 焦点**色（`.dmc-add` 的竖条、focus ring），红色是**状态**色（行内竖条）；两种角色，不是一个页面里的两个 accent | **记录，不改** |

**accent 的载体（D3 · 本轮补裁）。** 一个页面只有一个 accent，而它要有**一个**载体：主操作「添加模型提供商」
`.dmc-add` 的载体从「**2px 蓝色下沿**」改成「**4px accent 左竖条**」。理由：juror 把那条 2px 下沿读成房子规则
**被禁的细线（thin rule）**并据此触发 cap；而 4px 实心竖条是本页**自己的条形语言**——行内状态竖条是红的、
主动作竖条是蓝的，**同一条形、两种角色两种色**。文字仍是 primary ink（17–19:1），accent 只做图形（3:1 门槛），
仍然 `selfcheck-static.mjs` 硬断言禁止 accent 当底色写文字。

- **R3 · 编辑行是固定轨道的网格**：控件**逐行按列对齐**，缺的那格**留空**（不把邻居左移）——这是本页
  「靠对齐成表」机制的全部依据；ragged 的编辑行等于把这个机制丢掉（旧稿的教训继续适用：弹性列必须写下界，
  固定轨必须给足）。
- **R4 · 答案词对齐在行的右缘**：`.dmc-verdict` 右对齐 + `tabular-nums`，逐行成一列（A4 量它在五个视口里都在视口内）。
- **R5 · 就绪陈述与行严格对账**：`ready` = 可用行数，`issues` = 缺密钥 + 不可用行数；verifier 的 R1 必须
  **逐行数**再比对，任何不等即 FAIL。
- **R6 · `!` 入口是纯文字 affordance**：`.dmc-error-toggle`（诊断存在时才出现）rest 态**无填充、无边框**，
  与其余文字动作同款；hover / focus 才升到 live 填充或 primary ink——它不许再渲染成实心方块。
