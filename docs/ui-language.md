# 「模型配置」页与输入条三表面的 UI 语言：墨色实现约定

> **规范不在这里。** 单一事实源是 [`docs/ink-design-language.md`](ink-design-language.md)：
> 令牌取值与对比度、字体档位、几何、逐表面构图、强调色语法、动效、响应式、质量门映射全在那一份
> 文件里。本文只回答实现侧的问题：**每一处规范落在哪个文件的哪一组类名上、状态走哪些钩子、
> 材质怎么叠、窄档与动效如何兑现、质量门量的是哪些断言、文档与截图怎么复核。**
>
> 2026-10-17 这一轮先做过一版「终末地 HUD」，因「我们不是游戏 HUD、软黄色背景与 DSH 默认色差异
> 过大」被用户否决；现行方向是**单色墨色 + 宿主蓝、去掉 HUD 语汇、局部墨晕 + 细微噪点**。
> 本文只写这一版。更早的「路由账本」语言完整保留在文末的**附录 A**。

## 1. 三个表面与实现位置

| 表面 | 组件 | 样式表 | 规范章节 |
|---|---|---|---|
| 座位行（触发器 + 齿轮） | `src/client/Picker.tsx` | `src/client/styles.ts`（`dmp-`） | §6.1 |
| 模型卡（提供商栏 + 模型列表） | `Picker.tsx` + `ProviderRail.tsx` | `styles.ts`（`dmp-`） | §6.2 |
| 参数面板（齿轮） | `SettingsMenu.tsx` | `styles.ts`（`dmp-`） | §6.3 |
| 「模型配置」页（页首 + 账本 + 设置井） | `ModelConfigPage.tsx` | `modelConfigStyles.ts`（`dmc-`） | §6.4 |
| 模型目录区（行内展开） | `ModelCatalog.tsx` | `catalogStyles.ts`（`dmc-`） | §6.4 |
| 重试编辑器（井内展开） | `RetryEditor.tsx` | `modelConfigStyles.ts`（`dmc-`） | §6.4 |
| 共享令牌 / 材质 / 字体 | `designSystem.ts` | 本模块导出的 `DESIGN_SYSTEM_STYLESHEET` | §2、§3、§4 |

三张表面样式表**不各自发明颜色**：字体、`--zmd-*` 令牌与 `.zmd-*` 原语只由 `designSystem.ts`
注入一次，其余样式表只写 `var(--zmd-*)` 与宿主 `var(--dsw-*)`。主题切换是宿主的：
`<body data-ds-dark-theme>` 布尔属性，样式表里没有 JS 侦测、也没有 `prefers-color-scheme`。

## 2. 实现约定（规范里不重复给的东西）

### 2.1 令牌与画字白名单

| 组 | 令牌 |
|---|---|
| 纸 / 墨 / 线 | `--zmd-panel`、`--zmd-panel-deep`、`--zmd-hover`、`--zmd-line`、`--zmd-line-strong`、`--zmd-line-control`、`--zmd-ink`、`--zmd-ink-secondary`、`--zmd-ink-mute` |
| 墨晕 / 纸纹 | `--zmd-wash-top`、`--zmd-wash-bottom`（纸纹本身是 `.zmd-grain::after` 的 SVG，不带令牌） |
| 强调 / 状态 | `--zmd-accent`、`--zmd-on-accent`、`--zmd-focus`、`--zmd-danger`、`--zmd-online` |
| 字体 / 曲线 | `--zmd-font-latin`、`--zmd-ease` |

- 强调、焦点、错误**直接指向宿主令牌**：`--zmd-accent` / `--zmd-focus` 取
  `--dsw-alias-state-business-primary`，`--zmd-danger` 取 `--dsw-alias-state-error-primary`。
  它们声明在 `body` 上而不是 `:root`：自定义属性的 `var()` 在**声明它的元素**上求值，写在
  `:root` 会对着空的宿主变量求值而失效（`designSystem.ts` 的注释记录了这条）。
- 可画字的令牌：`--zmd-ink` / `--zmd-ink-secondary` / `--zmd-ink-mute` / `--zmd-online` /
  `--zmd-on-accent`（只压强调蓝底）。**`--zmd-accent` 永不作文字**（亮色约 3.91:1）：
  它只画 2px 左条、焦点环、选中勾的底、hover 下划线。`--zmd-danger` 只画 4px 竖条与诊断左条。
- 字面量只许出现在 `designSystem.ts` 的令牌块；其余样式表出现 `#hex` / `rgb()` 由静态门拦下。

### 2.2 字体

**内嵌 ZMD Archivo**（Archivo Variable, SIL OFL 1.1，wght 100–900 / wdth 62–125，子集化为
46,728 B woff2，base64 data-URI，零网络请求），中文回落宿主字体栈：

```text
font-family: "ZMD Archivo", var(--dsh-font-family-text, var(--dsh-font-family-text-default, …));
```

| 档 | 用途 | 规格 |
|---|---|---|
| 页首陈述 | 就绪句（live thing） | 20px / 28px / 500 |
| 行题 | 名称、模型名、面板标题 | 14px / 20px / 600 |
| 正文 | 值、动作词、答案词 | 13px / 20px / 400 |
| 微字 | route id、标签、诊断、序号 | 12px / 18px / 400；序号 10px / 12px / 500、弱墨、`tabular-nums` |

**不使用**大写字段码、`wdth` 125 显示字、`font-stretch` 变体、大号显示数字。数字一律
`tabular-nums`（`.zmd-num`）。字体资产由 `scripts/build-font-asset.mjs` 生成，OFL 正本在
`docs/fonts/Archivo-OFL.txt`，两者与 `fontAsset.ts` 的三方一致由静态门守护。

### 2.3 材质：墨晕（wash）与纸纹（grain）

两个原语都写在 `designSystem.ts`，只在**有明确边界的表面**上成对出现（模型卡、参数面板、
配置页页首带、目录区面板）：

- `.zmd-wash`：一条低对比径向渐变，把表面从左上亮端（`--zmd-wash-top`）过渡到右下暗端
  （`--zmd-wash-bottom`），中点回到 `--zmd-panel`。渐变不承载文字，但文字必须对两端都达标；
  `check-contrast.mjs` 按 wash 两端各量一次。
- `.zmd-grain::after`：120px 平铺分形噪点（SVG 自带 alpha ≈5%，中灰），
  `position:absolute; inset:0; z-index:0; pointer-events:none`。它只做材质，不承载信息，不铺全屏、
  不铺在文字上。
- 层叠顺序是硬约定：表面元素 `position: relative`；噪点层 `z-index: 0`；文字内容必须被抬到
  `z-index: 1`（`.dmp-menu.zmd-grain > :not([class*='material'])`、`.dmc-head > *`、
  `.dmc-catalog-panel > *` 各自声明）。`MenuSurface` 自带的半透明内层被改成透明（材质由 wash 画）。
- 只有 `.dmc-head` / `.dmc-catalog-panel` / `.dmp-menu` 三类表面同时带 wash 与 grain；
  井、行、控件铺 `--zmd-panel-deep` / `--zmd-hover` 实色，不再叠纹理。

### 2.4 强调色语法（宿主蓝）

1. 蓝只出现在「你在这里 / 点这里」：当前会话的 2px 左条（`.dmp-rail-row[aria-current]`）、
   选中行/选中档位的 2px 左条与勾的底（`.dmp-row[aria-checked]`、`.dmp-effort-item[aria-checked]`、
   `.dmp-check[data-on]`、`.dmp-effort-check[data-on]`、`.dmc-discover-check:checked`）、焦点环、
   展开态动作词的 hover 下划线。
2. 蓝底上的勾/块只许 `--zmd-on-accent`；蓝永不作文字。
3. 其余一切用墨：选中填充 = `--zmd-panel-deep`，悬停 = `--zmd-hover`，当前/次要靠字重与线区分。
4. 错误红只画 4px 竖条与诊断左条；「缺密钥 / 不可用」的答案词仍是墨色（事实不靠染色喊叫）。

### 2.5 装饰纪律

- 唯一新增的装饰是**两位数序号**（rail 行、账本行、目录行）：10px 弱墨、`tabular-nums`、
  `aria-hidden`，值来自渲染位置 `String(index + 1).padStart(2, '0')`，不是存储值。
- **没有**字段码、大号显示数字、方括号计数、切角、扫光、扫描线、装饰条。静态门与
  fixture 断言这些构件不存在（`.taste-skill/audit-classes.mjs` 之外，预览脚本也做 DOM 断言）。
- 退避刻度条是数据可视化而非装饰：每格 `data-level` 来自 `retryWaitCurve` 的真实等待，
  空槽是基线；整条 `aria-hidden`，摘要句已用文字说了同一件事。

## 3. 几何骨架（量过的数字）

| 量 | 值 | 出处 |
|---|---|---|
| 模型卡宽 | `min(520px, calc(100vw - 32px))` | `.dmp-card` |
| 模型窗格 | **331px**（520 − 8 卡内边距 − 181 提供商栏盒） | `.dmp-models` |
| 名字列 | **175px**（331 − 4 列表左内边距 − 14 行内边距 − 6 gap − 14 勾格 − 5 copy gap − 113 徽章条） | `.dmp-row-name` |
| 徽章条 | **113px** = 14 + 8 + 14 + 8 + 14 + 8 + 47 | `.dmp-badges` 的 `--dmp-col-*` |
| 模型行高 | **38px** | `.dmp-row` |
| 提供商栏盒 | **181px**（176 basis + 4 右内边距 + 1 分隔线） | `.dmp-rail` |
| 账本行高 | **48px**（收起态；展开态的行是同一个 grid，允许向下生长） | `.dmc-row` |
| 内容列 | **560 / 484 / 106px** | `.dmc-page` 的 `@container` |
| 参数面板宽 | **280px** | `.dmp-settings` |
| 座位触发器高 / 齿轮 | **28px** / **28×28** | `.dmp-trigger` / `.dmp-settings-button` |

宽度预算由 `scripts/selfcheck-static.mjs` 用同一套盒模型从卡宽一路算到名字列并校准到
331 / 175。上面这些数字由 `scripts/_shoot-row.cjs` 与 `scripts/_shot-page.cjs` 在静态
fixture 里**实测打印**；规格不符时脚本退出码为 1，并列出差异而不是悄悄放过。

## 4. 组件语法（实现摘要；规则全文在规范 §6.1–§6.5）

### 4.1 座位行

```text
provider/model · effort  ⌄     ⚙
```

- 触发器 `.dmp-trigger`：无左侧信号条（`::before` 不存在）；13px/400 技术字形；
  `max-width: min(360px, 45cqw)`；hover = `--zmd-hover` 底；打开 = `--zmd-panel-deep` 底 +
  `.dmp-chevron-open` 旋转；焦点环 2px `--zmd-focus`。
- 齿轮 `.dmp-settings-button`：28×28 直角图标按钮，1px `--zmd-line` 边；有声明时
  `data-edited` 把边换成 `--zmd-accent`（图形）；打开时 `.dmp-settings-open`。
- 窄输入条仍由宿主的 `--dsh-composer-model-text-display` / `-icon-display` 整段折叠；格子不添加
  新长度。

### 4.2 模型卡

- **无顶部状态条**：卡面 = `.dmp-menu.dmp-card.zmd-wash.zmd-grain` + 1px `--zmd-line-strong`
  内框（`.dmp-menu::before`），内容被抬到纹理之上。
- 两栏直接是 surface 的 flex 子项：`.dmp-rail`（176px）+ `.dmp-models`；≤536px 视口折成
  一栏（`.dmp-card { flex-direction: column }`），同一份 DOM/role。
- 提供商栏 `.dmp-rail-row` 两个**不同通道**：
  - 范围 = `aria-selected` → `--zmd-panel-deep` 填充 + 1px **inset** `--zmd-line-strong` 环；
  - 当前会话 = `aria-current` → 行左 2px `--zmd-accent` 竖条 + 名字 500。
  行首 `.dmp-rail-index` 两位数序号（弱墨、`aria-hidden`）。
- 搜索行 `.dmp-search-row`：无提示符；`.dmp-search` 底线 1px `--zmd-line-control`，聚焦底线变
  `--zmd-accent` + 2px 焦点环；清除按钮 `.dmp-search-clear` 是直角 `×`（有查询时才存在）。
- 表头 `.dmp-legend[role="note"]`：四个中文列名（文字 / 图片 / 推理 / 窗口），上下各 1px 线，
  **右端无计数**。
- 模型行 `.dmp-row`：`.dmp-row-copy`（名字 + 四轨徽章）+ `.dmp-check`；38px、行间 1px；
  hover `--zmd-hover`；选中 `--zmd-panel-deep` + 2px 蓝左条 + `.dmp-check[data-on]` 蓝底
  `--zmd-on-accent` 勾。
- 分组头：宿主 `MenuGroup` 渲染 `[data-menu-group]` / `[data-menu-group-heading]`，样式表用
  属性选择器钉成不透明 `--zmd-panel` 底 + 1px 下划线，不加字段码/序号。
- 徽章（§6.5）：`Tag` 只留 `.tag` 基础盒，视觉全在 `.dmp-badge*`；四列固定
  `14 / 14 / 14 / 47` + 3×8 gap；缺失事实留 `.dmp-badge-slot` 空轨，不左移邻居；图标单 16 网格、
  `stroke-width: 1.6`、渲染 14px（屏幕 1.4px）、墨色不承载事实。
- 空态 / 加载 / 失败行：`.dmp-empty` / `.dmp-status` / `.dmp-error` / `.dmp-warning` /
  `.dmp-filter-hint`，都是句子，不做横幅。

### 4.3 参数面板

- 头 `.dmp-settings-head`：模型名（14/600）+ 「恢复默认」；**无字段码**。
- 正文 `.dmp-settings-body` 承担滚动（surface 本身不滚）；段标题
  `.dmp-settings-label` = 中文词 + `.zmd-rule` 细线；三段是输入类型 / 上下文窗口 / 推理等级。
- 开关 `.dmp-settings-switch`：32×18 直角；开 = `--zmd-accent` 底 + `--zmd-on-accent` 方块，
  关 = 1px `--zmd-line-control` 框 + `--zmd-ink-mute` 方块。
- 输入 `.dmp-settings-input`：底线 1px，聚焦变蓝 + 2px 焦点环；错误 `.dmp-settings-input-bad` 红底线。
- 推理等级 `.dmp-effort-item`：1px 底线；选中 = `--zmd-panel-deep` + 2px 蓝左条 +
  `.dmp-effort-check[data-on]` 蓝底勾。
- 底部 `.dmp-settings-target`（写入位置，纯文字）与 `.dmp-settings-note`（说明句）。
- 失败原话 `.dmp-settings-alert`（红左条 + 次级墨色，错误色不画字）。
- 不加关闭按钮（原面板没有，新增会改焦点链）。

### 4.4 「模型配置」页

- 页首 `.dmc-head.zmd-wash.zmd-grain`：只有一句 `.dmc-readout`（20px/500，live thing，
  原有 key 重挂载不变）+ 1px 下边线。**无大序号、无字段码、无顶条**。
- 账本行 `.dmc-row` 五轨：`4px 竖条 / 序号 + 名称 + route / 模型格 / 答案词 / 门`；
  48px 高；`.dmc-index` 两位数序号；`.dmc-catalog` 是事实也是目录区门；`.dmc-verdict` 一个词；
  `.dmc-manage` 是纯文字动作（无前缀方块），展开行 = `--zmd-hover` 底 + 门词 hover 蓝下划线。
- 设置井 `.dmc-well`：`--zmd-panel-deep` + 1px `--zmd-line`；标签列**单行中文**（凭据 /
  API 协议 / 自动重试）；表单控件 1px `--zmd-line-control`（表单豁免）；`.dmc-well-rule`
  分隔生命周期；`.dmc-diagnostic` 红左条。
- 目录区 `.dmc-catalog-panel.zmd-wash.zmd-grain`：占名称脊起的整行，1px 边、无 fixed/scrim/
  焦点陷阱；头部只写「模型目录」+ 状态 + 普通计数（`.dmc-roster-count`，12px 弱墨）+ 收起；
  模型行两位序号 / id / `编辑` / 显示名 + 容量事实；`.dmc-model-well` 内嵌井；`+ 添加模型`
  是文字动作；`.dmc-discover-*` 是发现清单（方形勾选框 `.dmc-discover-check`，选中 = 蓝底
  `--zmd-on-accent` 勾；`[data-present]` 行禁用并降为次级墨色）。
- 重试编辑器 `.dmc-retry`：状态词 + 两个数字字段 + 两条说明 + 摘要行（18px 数字 + 微字）+
  五槽灰阶刻度条（实心 `--zmd-ink-mute`、空槽 `--zmd-line`；`aria-hidden`；真实数据；
  reduced-motion 关闭）+ `保存` / `恢复默认`。
- 添加提供商 `.dmc-add`：页尾文字动作（无左条），hover 蓝下划线。
- 状态通道：`data-state`（`ready` / `missing-key` / `unreachable`）、`data-error`
  （可叠加，不改答案词、不画竖条）、`data-well` / `data-catalog`（展开态，不是状态）。

### 4.5 目录区与重试编辑器的细节

- 目录区的展开/收起与 `Esc` 分层、未保存守卫、发现三步流程**都不变**（DESIGN §5.37）；
  本文只换了视觉语言。草稿未保存时收起或切换提供商会先问一句，草稿从不静默消失。
- 重试编辑器入口仍由 schema 决定（读不出 `retryPolicy` 就不显示入口，失败关闭）；
  `mode === 'always'` 照常显示次数并加一句无限重试说明。

### 4.6 材质的落点（哪些表面有 wash/grain）

| 表面 | wash + grain | 依据 |
|---|---|---|
| 模型卡 `.dmp-menu.dmp-card` | 是 | §6.2：卡面是墨晕+纸纹 |
| 参数面板 `.dmp-menu.dmp-settings` | 是 | §6.3 同材质 |
| 配置页页首带 `.dmc-head` | 是 | §6.4：页首是带材质的一条带 |
| 目录区面板 `.dmc-catalog-panel` | 是 | §6.4：目录区是 wash 面板 |
| 设置井 / 模型井 / 行 / 控件 | 否 | 实色 `--zmd-panel-deep` / `--zmd-hover`，不叠纹理 |

### 4.7 类名清单（当前实现；静态审计读这里）

> 本节是机器可读清单：`dmc-` 由 `modelConfigStyles.ts` + `catalogStyles.ts` 定义，
> `.taste-skill/audit-classes.mjs` 以本文为权威比对「定义 / 使用 / 文档」三方；
> `dmp-` 由 `styles.ts` 定义，`zmd-` 由 `designSystem.ts` 定义。清单随样式表更新，
> 不单独维护。

#### `zmd-` 原语（`designSystem.ts`，4 个）

`zmd-wash`（局部墨晕渐变）、`zmd-grain`（纸纹 ::after 覆盖层）、`zmd-rule`（1px 结构线）、
`zmd-num`（`tabular-nums`）。它们只在有边界表面上成对/按需使用，不定义组件。

#### `dmc-`（配置页 + 目录区 + 重试编辑器）

`dmc-actions`、`dmc-add`、`dmc-alert`、`dmc-backoff`、`dmc-backoff-cell`、`dmc-btn`、
`dmc-btn-commit`、`dmc-catalog`、`dmc-catalog-body`、`dmc-catalog-close`、`dmc-catalog-error`、`dmc-catalog-foot`、
`dmc-catalog-guard`、`dmc-catalog-guard-actions`、`dmc-catalog-head`、`dmc-catalog-heading`、`dmc-catalog-note`、`dmc-catalog-notice`、
`dmc-catalog-panel`、`dmc-catalog-section`、`dmc-catalog-status`、`dmc-catalog-title`、`dmc-danger`、`dmc-diagnostic`、
`dmc-discover`、`dmc-discover-actions`、`dmc-discover-adopt`、`dmc-discover-candidate`、`dmc-discover-check`、`dmc-discover-group`、
`dmc-discover-id`、`dmc-discover-label`、`dmc-discover-list`、`dmc-discover-name`、`dmc-discover-panel`、`dmc-discover-search`、
`dmc-discover-tool`、`dmc-discover-tools`、`dmc-empty`、`dmc-field-label`、`dmc-field-value`、`dmc-head`、
`dmc-index`、`dmc-key-action`、`dmc-key-clear`、`dmc-list`、`dmc-manage`、`dmc-model-add`、
`dmc-model-alias`、`dmc-model-danger`、`dmc-model-edit`、`dmc-model-error`、`dmc-model-fact`、`dmc-model-facts`、
`dmc-model-fields`、`dmc-model-id`、`dmc-model-index`、`dmc-model-input`、`dmc-model-label`、`dmc-model-list`、
`dmc-model-name`、`dmc-model-ref`、`dmc-model-row`、`dmc-model-sub`、`dmc-model-tokens`、`dmc-model-well`、
`dmc-model-window`、`dmc-name`、`dmc-notice`、`dmc-notice-action`、`dmc-page`、`dmc-pending`、
`dmc-picker`、`dmc-picker-item`、`dmc-picker-list`、`dmc-protocol`、`dmc-quiet`、`dmc-rail`、
`dmc-readout`、`dmc-reasoning`、`dmc-reasoning-add`、`dmc-reasoning-head`、`dmc-reasoning-help`、`dmc-reasoning-level`、
`dmc-reasoning-remove`、`dmc-reasoning-row`、`dmc-reasoning-value`、`dmc-retry`、`dmc-retry-action`、`dmc-retry-actions`、
`dmc-retry-detail`、`dmc-retry-field`、`dmc-retry-fields`、`dmc-retry-input`、`dmc-retry-label`、`dmc-retry-row`、
`dmc-retry-state`、`dmc-retry-summary`、`dmc-retry-tally`、`dmc-retry-tally-unit`、`dmc-retry-unit`、`dmc-roster-count`、
`dmc-route`、`dmc-row`、`dmc-verdict`、`dmc-well`、`dmc-well-rule`

#### `dmp-`（座位行 + 模型卡 + 参数面板）

`dmp-badge`、`dmp-badge-fact`、`dmp-badge-icon`、`dmp-badge-slot`、`dmp-badge-value`、`dmp-badges`、
`dmp-card`、`dmp-check`、`dmp-chevron`、`dmp-chevron-open`、`dmp-effort-check`、`dmp-effort-item`、
`dmp-effort-list`、`dmp-effort-name`、`dmp-empty`、`dmp-empty-icon`、`dmp-error`、`dmp-error-icon`、
`dmp-filter-clear`、`dmp-filter-hint`、`dmp-groups`、`dmp-legend`、`dmp-legend-icon`、`dmp-legend-item`、
`dmp-legend-word`、`dmp-menu`、`dmp-models`、`dmp-provider-count`、`dmp-provider-failed`、`dmp-provider-failed-dot`、
`dmp-rail`、`dmp-rail-copy`、`dmp-rail-index`、`dmp-rail-name`、`dmp-rail-row`、`dmp-retry`、
`dmp-root`、`dmp-row`、`dmp-row-copy`、`dmp-row-name`、`dmp-search`、`dmp-search-clear`、
`dmp-search-row`、`dmp-search-with-query`、`dmp-settings`、`dmp-settings-alert`、`dmp-settings-alert-icon`、`dmp-settings-body`、
`dmp-settings-button`、`dmp-settings-head`、`dmp-settings-hint`、`dmp-settings-icon`、`dmp-settings-input`、`dmp-settings-input-bad`、
`dmp-settings-label`、`dmp-settings-name`、`dmp-settings-note`、`dmp-settings-note-icon`、`dmp-settings-notice`、`dmp-settings-open`、
`dmp-settings-reset`、`dmp-settings-row`、`dmp-settings-section`、`dmp-settings-switch`、`dmp-settings-target`、`dmp-settings-title`、
`dmp-status`、`dmp-trigger`、`dmp-trigger-effort`、`dmp-trigger-icon`、`dmp-trigger-label`、`dmp-trigger-open`、
`dmp-warning`

#### 状态与语义钩子（不是类）

| 钩子 | 允许值 | 谁读它 |
|---|---|---|
| `data-state` | `ready` / `missing-key` / `unreachable` | `.dmc-row`、`.dmc-rail`、`.dmc-verdict` |
| `data-usable` | `true` / `false` | `.dmc-row`、`.dmc-rail`（`unreachable` 为 false） |
| `data-error` | 存在即 true | `.dmc-row`（诊断，可叠加，不是状态） |
| `data-well` / `data-catalog` | 存在即展开 | `.dmc-row`、`.dmc-model-row`（位置填充，不是状态） |
| `data-key` / `data-invalid` | 草稿键 / 草稿有问题 | `.dmc-model-row`、`.dmc-model-input` |
| `data-present` | `true` | `.dmc-discover-candidate`（已在目录，不可采纳） |
| `data-level` | `0`–`4` | `.dmc-backoff-cell`（刻度档位） |
| `data-state="dormant"` | 固定值 | `.dmc-picker-item`（未添加，不画状态） |
| `aria-selected` / `aria-current` | 布尔 | `.dmp-rail-row`（范围 / 当前会话，两个通道） |
| `aria-checked` / `data-active` | 布尔 | `.dmp-row`（模型在用 / 键盘高亮） |
| `data-on` / `data-open` / `data-edited` | 存在即真 | 勾、触发器、齿轮 |
| `data-menu-material` / `data-menu-group` / `data-menu-group-heading` | 宿主契约 | 卡片表面与分组头 |

## 5. 响应式

- 「模型配置」页只问容器：`.dmc-page { container-type: inline-size }`，分支
  `@container (max-width: 560px)` / `(max-width: 484px)` / `(max-width: 360px)`。
  560 档收紧行距与页首内边距；484 档把井标签列收到 56px；≤360 档（真机 106）把扫描行拆成
  四条线、隐藏序号、可点目标抬到 40px。本轮新增装饰只有序号与墨晕，窄档不需要为装饰再让位。
- 模型卡只问视口：`@media (max-width: 536px)` 把两栏折成一栏（提供商栏变横向条），
  `@media (max-width: 480px)` 收卡宽。同一份 DOM、同一套 role，只有 flex 方向变。
- 106 档的目标不是好看而是**有序**：`scrollWidth == clientWidth`（无横向溢出）、无单字孤行、
  可点目标 ≥40px。静态预览脚本对这三条逐条断言。
- 两套主题共用同一组语义令牌，只换取值；暗色是主稿、亮色是纸面反相版（wash 两端各自换色）。

## 6. 动效

一条减速曲线 `cubic-bezier(0.2, 0, 0, 1)`，只动 `transform` / 颜色：

| 落点 | 实现 |
|---|---|
| 悬停底色 | 120ms |
| 按下 | `translateY(1px)` 80ms |
| 选中勾 / 方块 | `scale(0.6 → 1)` 160ms（`.dmp-check-in`） |
| 计数 / 答案词变化 | `translateY(2px)` 落定 160ms（React key 重挂载） |
| 键盘滚动 | `scroll-behavior: smooth` 只在 `prefers-reduced-motion: no-preference` |
| `prefers-reduced-motion: reduce` | 全部 transition / animation 关闭，内容与状态不变 |

**无扫光、无揭幕、无透明度过渡**；除了勾的落定没有别的入场动画。

## 7. 质量门映射

| 门 | 守什么 |
|---|---|
| `scripts/selfcheck-static.mjs` | 字面量只许出现在 `designSystem.ts` 令牌块；样式表引用必须已声明；`border-radius` 只 0/50%/var；禁 opacity/filter/text-shadow/mix-blend；1px 拆「结构线 / 表单控件边 / 2px 强调条」三类；`clip-path` 不得用作装饰（notch 已删除）；渐变只许 `.zmd-wash` 且 stops 只用 wash 令牌；纸纹只许 `.zmd-grain::after` 的噪点规则；`--zmd-accent` 不得出现在 `color:`；字段码/大序号构件必须不存在；字体资产三方一致 + OFL 文件；宽度预算 331/175/113、536 折叠、560/484/106 |
| `scripts/check-contrast.mjs` | 解析 `designSystem.ts` 两主题令牌；按真实字号量每一处画字规则并登记；墨晕两端各量一次；强调蓝禁作文字、蓝底必须 `--zmd-on-accent`；装饰线亮度区间 |
| `scripts/test-model-config.mjs` / `test-model-config-copy.mjs` | 该页纯逻辑层与文案键集（zh/en 同序、插值对称） |
| `scripts/test-retry-policy.mjs` | 重试策略解析、等待曲线（刻度条的数据来源）、写回文档 |
| `scripts/check-build-fresh.mjs` | 已提交的 `lib/` 是已提交的 `src/` 的忠实产物 |
| `scripts/mutate-anchor-loss.mjs` / `mutate-ink-gates.mjs` | 「门自己的门」：逐条改坏必须变红，否则算失败并点名 |
| `docs/ink-design-language.md` §10 | 以上各条的修订清单与理由（规范侧权威） |

## 8. 不看真机时怎么看它

宿主 token 值从真实安装导出（`scripts/theme-tokens.json` 与主题包）；静态 fixture 用**一套**
抽取器 `scripts/_fixture-css.mjs`：宿主令牌 + `designSystem.ts` + `styles.ts` +
`modelConfigStyles.ts` + `catalogStyles.ts`，并额外跑
`node scripts/_dump-design-css.mjs` 刷新 `shots/_design-system.css`（被 gitignore 的中间产物）。

```bash
node scripts/_preview-ink.mjs    # 四个 fixture：卡（宽/窄）/ 座位+参数面板 / 配置页
node scripts/_shoot-row.cjs      # ink-card*.png；实测卡宽 520 / 窗格 331 / 名字 175 / 徽章条 113 / 行高 38 / 栏 176 + wash/grain 计算样式
node scripts/_shoot-trigger.cjs  # ink-seat*.png、ink-panel*.png；实测触发器 28、齿轮 28、面板 280、三段标题与 wash/grain
node scripts/_shot-page.cjs      # ink-settings-*.png、ink-well/catalog/retry；实测行高 48、右沿 spread 0、106 无溢出、刻度 2 实 3 空、勾选框三态、wash/grain
```

fixture 渲染的是**真实**三张样式表 + `designSystem.ts` 的字体/令牌/材质 + 真实 DOM 结构，
只有宿主面板外壳是假的；**静态预览不是真机**：它能证明排版、两套主题、材质与几何，不证明
宿主窗格里的滚动、焦点链与 Esc 分层，那几项必须在真机里由用户确认（运行纪律见
`docs/agent-safety.md`：不要为此再起第二个 `dsh web`）。HUD 期的 `endfield-*` 图已随方向
否决删除；更早的历史图（`model-config-*` 等）留在 `shots/` 作历史证据。

## 9. 下一个表面怎么沿用

1. 先读 `docs/ink-design-language.md`：它决定「这一屏是谁在回答什么问题」，并按 §6 的逐表面
   语法选结构；本文只帮你把决定落到类名。
2. 令牌、材质与字体只加在 `designSystem.ts`；新表面只加自己的布局类，不复制颜色/字体/渐变。
3. wash 与 grain 只在有边界的表面上成对出现，并且**内容必须抬到纹理之上**（`z-index: 1`）。
4. 强调色只有宿主蓝，且只做图形；错误红只做竖条。文字只用墨色白名单里的令牌。
5. 新装饰只允许「两位序号」，必须 `aria-hidden` 且来自真实渲染顺序；不加字段码/大数字/切角。
6. 窄分支先问容器宽度；先保证有序（无溢出、无孤字、可点 40px），再谈好看。

## 附录 A 旧文（路由账本），已被 2026-10-17 墨色语言取代

> **历史证据，不是现行约定。** 下面全文保留 2026-10-17 之前那一轮
> 「路由账本（route ledger）」的 docs/ui-language.md（只把正文类名改成纯文本，避免旧类名被
> 静态审计当成现行清单，并把标题降级收进附录）。它描述的结构决策（一行一条路由、事实在行上、
> 控制在井里）仍被现行实现继承；视觉语言（令牌、字体、几何、装饰、动效）与类名清单已被墨色
> 语言取代，任何冲突以本文正文与 docs/ink-design-language.md 为准。

### 「模型配置」页的 UI 语言：路由账本（route ledger）

> 这份文件回答三件事：**这页为什么被重做**（§1 诊断）、**它现在遵循什么语言**（§2–§6）、
> **下一个表面怎么沿用这套语言**（§8）。实现细节与取舍证据在 `DESIGN.md` §5.35，
> 运行纪律在 `docs/agent-safety.md`。

#### 1. 诊断：旧版为什么读不下去

旧版（§5.32 的 quiet-instrument）把每一行做成「两段」：第一段陈述身份与答案，第二段是一行
**六个固定轨道的控件**。真机上量出来的问题：

| 观察 | 测量 |
|---|---|
| 每行第二段是六个 12px 小词挤在一行 | 每行 5–6 个可点控件，其中 2–4 个各占一个轨道 |
| 凭据格装不下自己的两个词 | `.dmc-key` 在 560px 宽时是 **108×60**，`替换 API 密钥` / `清除密钥` 竖着占两行 |
| 于是整行出现四条不同的文字基线 | 行高 **108px**；协议选择框浮在 60px 格子的垂直中心，`模型目录` / `自动重试` / `删除` 各自落在不同高度 |
| 11 行在面板里放不下 | 页面高 **1248px**，而宿主设置窗格的可视高度是 **746px** |
| 全页只有一个描边框，而它是个空选择框 | 6 行显示 `未选择`，却占了最宽的 176px 轨道，成为整页最强的视觉元素 |
| 破坏性动作与普通事实同权 | `删除` 与 `模型目录` 同为 12px 文字，相距 20px |
| 没有分组，也没有可比较的列 | 11 行同构展开，行内事实（协议 / 重试 / 目录）互相不在一个列上 |
| 抽屉里每个模型都是四个常开输入框 | 7 个模型 = **28 个框 + 14 个按钮**，在 460px 面板里排成一堵墙 |

更根本的一条：**这页把「事实」和「控制」放在同一条线上同权呈现**。读者要回答「哪一行需要我」，
却必须先穿过每行的五个控件。那不是密度问题，是层级问题。

#### 2. 语言：账本，不是控制表

这页的对象是一个个**路由**（提供商 + 模型地址）。账本的读法是**一行一条，左右成列**，所以：

> 行上只留事实，控制收进这一行的「设置井」；对齐本身就是结构，不需要画线。

四条不可协商的推论：

1. **一行一条路由。** 扫描行在静止态 **48px**，行内没有任何表单控件。
2. **事实在行上，控制在井里。** 行只陈述三件事：它是谁（名称 + route id）、它有多少模型（自有目录条目数，
   没有就写「默认」）、它现在的答案（一个词）。改它的一切都在井里。
3. **对齐即机制。** 四条共享轨道：`4px 竖条 / 弹性身份列 / 模型格 / 答案词 / 门`。
   答案词与门**右对齐**，所以右沿在整张列表里重合（实测 spread 0）。
4. **一个词就是一个控件。** 不用图标按钮、不用胶囊、不用描边（真实表单字段除外）。

井（settings well）是**表单**，不是控件的再一次横排：一列标签（凭据 / API 协议 / 自动重试），
一列值，第三行之后是这一行自己的那条事实——「删除该提供商」。标签列固定 64px，
值与它的名字因此永远不会漂开。

#### 3. 令牌

##### 3.1 字号阶梯（全页四档）

| 档 | 用途 | 规格 |
|---|---|---|
| 20/28 · 600 | 账本余额句（readout） | 全页唯一的大声处 |
| 14/20 · 600 | 行身份：名称 | 与 route id 同一行基线 |
| 13/20 · 400 | 值、动作词、答案词 | 主力字号（= 宿主 13px 正文档） |
| 12/18 · 400 | route id、模型格、标签、诊断句、等待摘要 | 只做次要事实 |

不引入第五档。数字一律 `font-variant-numeric: tabular-nums`（模型数、等待曲线、答案词）。

##### 3.2 墨色阶梯（只有两级可画文字）

| 令牌 | 角色 |
|---|---|
| `--dsw-alias-label-primary` | 正文、值、可点动作的 rest 态、需要处理的答案词 |
| `--dsw-alias-label-secondary` | 标签、route id、次要事实、ready 的答案词、`:disabled` 动作 |

**只做图形、永不画文字**：`--dsw-alias-state-error-primary`（竖条 / 只读提示的左条）、
`--dsw-alias-state-business-primary`（焦点环 / 添加条目的 4px 左条）、`label-tertiary|caption|dimmed`。
理由是可测的：浅色下 error 4.4976:1、business 4.2349:1，都低于正文 4.5:1 的线；
它们作为图形只需要 3:1。

##### 3.3 间距与轨道

- 页面：一个左脊。名称从 **16px** = `4px 竖条 + 12px 间隙` 起；余额句缩进到同一条脊（`margin-left:16px`）。
- 段间距 16px；行内 padding 上下各 10px；井内字段行距 8px；字段标签列 64px + 12px 间隙。
- 行不画分隔线、不铺底色；节奏来自 48px 的行高与 16px 的段距（宿主浅色主题里三种 layer 底色全是同一个白，
  线在深色里才存在，所以线不可靠）。

##### 3.4 圆角、阴影、透明度

`border-radius: 0`；无阴影；无 `opacity` / `filter` / 渐变。安静来自 secondary 墨色，不是淡化。

##### 3.5 唯一的 accent

页面只有一个蓝色动作：页尾「添加模型提供商」，载体是 **4px 实心左竖条**（与状态竖条同形、不同角色不同色：
红＝事实，蓝＝行动）。它不做填充，因为主题里没有「accent 上的文字」这个角色，白字在浅色下 4.2349:1。

#### 4. 组件语法

##### 4.1 账本行（scan line）

```
[4px 竖条]  名称  route-id  ······  4 个模型   可用   管理
```

- 竖条：只表示「这个提供商现在不能服务请求」（缺密钥 / 不可用），其余为空。
- 名称：14/600；route id 12/400 secondary，同一行、同一轨道内。
- 模型格：**事实即门**。有自有目录写 `N 个模型`，否则写 `默认`（title 里是长句「正在使用适配器默认模型」）。
  点它展开模型目录区——这是行上除了门之外的唯一可点处。
- 答案词：一个词（可用 / 已登录 / 缺密钥 / 不可用）。ready 用 secondary，另外两种用 primary。
- 门：`管理`，13px primary，展开下面那一行的设置井；`aria-expanded` + `aria-controls` 成对。

##### 4.2 设置井（settings well）

```
凭据       已配置   替换   清除
API 协议   [ OpenAI Chat Completions ▾ ]
自动重试   修改
           删除 opencode-go
```

- 三行字段 + 一行生命周期。没有填充、没有边、没有圆角；它靠所在行的 `[data-well]` 底色读作「这一行的展开区」。
- 凭据有四种形态，各自说真话：
  - 会话行：`由账号提供`（这行没有密钥格，因为它本来就不存密钥）；
  - 已配置：`已配置` + `替换` + `清除`；
  - 缺密钥：`未配置` + `填写密钥`（井里唯一的主动作）；点开后输入框占满值列，行不变高；
  - 该提供商不接受密钥：整个凭据字段不渲染（宁可不显示，也不给一个写不进去的入口）。
- 协议：真表单字段，保留 1px 边（全页仅两处 1px：这里与重试数字框）。没有协议可选时字段不渲染。
- 自动重试：字段名是 `自动重试`，动作是 `修改`（动作不重复字段名），展开后是行内重试编辑器。
- 生命周期：`删除 <provider>` 在井的最后一行、错误/写失败句之上，与凭据词分开。
- 诊断句：`data-error` 行在井顶显示一句原话（primary 墨色 12px），不改变答案词、不画竖条。

##### 4.3 余额句（readout，页面唯一的 live thing）

`11 个提供商，全部可用` / `8 个提供商可用，3 个需要处理` / `尚未添加任何提供商`。
数字由与行完全相同的读取函数算出（`readingOf`），所以句子与列表永远不会互相打脸。
改 key / 加 / 删之后当场重算；零问题时是句子不是统计。

##### 4.4 添加条目与待添加目录

页尾一条 `添加模型提供商`（4px 蓝左条 + 13/600），点开在下方列出「目录里存在、尚未添加」的提供商；
每一项是一行名称 + route id，hover 填色，不加边。

##### 4.5 状态与语义

| 通道 | 表达什么 | 不许表达什么 |
|---|---|---|
| `data-state`（互斥三值） | ready / missing-key / unreachable | 第四个状态、诊断、加载中 |
| `data-error="true"`（可叠加） | 这个行有一次写失败或目录报错 | 不画竖条、不换答案词、不铺底 |
| 竖条 | 「能不能服务」 | 不能表示诊断，不能当装饰 |
| `data-well` / `data-catalog` | 这一行的设置井正展开 / 它的模型目录区正展开 | 不是状态 |

每个可点元素都有 `:focus-visible` 环（2px business + 2px offset）。焦点顺序 = 渲染顺序：
模型格 → 门 → 井内（凭据动作 → 协议 → 修改 → 删除）。空状态、只读、加载失败都是句子里说清楚，不做横幅。

##### 4.6 模型目录区：行内花名册（inline roster）

模型目录不是弹层，是**账本行自己的展开区**：它占设置内容列（560 / 484 / 106），随页面滚动，
没有 fixed / scrim / 阴影 / 圆角 / 焦点陷阱。它说的是同一句话：**一行一个模型，编辑进井**。

```
openrouter  openrouter             7 个模型   可用   管理
模型目录  已自定义模型目录                              收起

deepseek/deepseek-v4.1-flash              编辑
DeepSeek: DeepSeek V4.1 Flash   上下文 1048576  输出 384K

  ┌ 模型 ID        ┌ 显示名称
  ┌ 上下文窗口     ┌ 最大输出 token 数
  推理等级
  添加档位
  删除模型

+ 添加模型
获取可用模型
保存   恢复默认模型
```

- **头**：只陈述目录自己（`模型目录` + `已自定义模型目录` / `正在使用适配器默认模型`），
  右端一个词 `收起`。**不重复**提供商名与 route id——上面那行账本已经说了。
- **行**（68px，两行文字）：第一行是模型 id（13/600，过长用省略号 + `title` 保全文）与右端的门 `编辑`；
  第二行是显示名与两个容量事实（12px secondary）。空事实不画；两个容量都没填时写 `使用默认容量`
  ——「没有覆盖」也是一条事实，不留空行。
- **井**：2×2 的字段（模型 ID / 显示名称 / 上下文窗口 / 最大输出 token 数），然后是推理档位编辑
  （**没有档位的模型只显示「添加档位」**，不画空表头和解释段），最后一行是 `删除模型`。
- **添加模型**是花名册末尾的一条账本行（`+ 添加模型`），不是工具条里的一个按钮。
- 草稿问题（`data-invalid`）走页面的同一条通道：行左侧 4px 红色竖条 + 井顶一句原话。
- **未保存守卫**：收起 / 切到另一个提供商前若有脏稿，展开区顶部出现
  「有未保存的模型修改。继续编辑 / 放弃修改」一行；草稿从不静默消失。
- 模型发现（获取 → 勾选 → 添加所选）**结构不变**，只跟随页面的字阶与按钮语法；
  候选清单是展开区内唯一的有界滚动区（`max-height: 360px`），页面本身仍是那一份滚动。
- Esc 一次只关一层：模型井 → 目录区（→ 未保存问题）→ 宿主设置面板。

这样 7 个模型的自定义目录从「28 个常开输入框」变成「7 行 + 最多一个展开的井」，而所有可编辑项一个都没少；
同时它不再需要第二个弹层、第二个 scrim、第二个 `aria-modal`。

##### 4.7 类名清单（历史；已被正文 §4.7 的墨色清单取代）

> 这一节是 dmc- 类名的机器可读清单：实现是 `modelConfigStyles.ts` + `catalogStyles.ts`，
> 审计脚本 `.taste-skill/audit-classes.mjs` 以本文件为权威。清单随样式表更新，不单独维护。

dmc-actions、dmc-add、dmc-alert、dmc-btn、dmc-btn-commit、dmc-catalog、dmc-catalog-body、dmc-catalog-close、dmc-catalog-error、dmc-catalog-foot、dmc-catalog-guard、dmc-catalog-guard-actions、dmc-catalog-head、dmc-catalog-heading、dmc-catalog-note、dmc-catalog-notice、dmc-catalog-panel、dmc-catalog-section、dmc-catalog-status、dmc-catalog-title、dmc-danger、dmc-diagnostic、dmc-discover、dmc-discover-actions、dmc-discover-adopt、dmc-discover-candidate、dmc-discover-check、dmc-discover-group、dmc-discover-id、dmc-discover-label、dmc-discover-list、dmc-discover-name、dmc-discover-panel、dmc-discover-search、dmc-discover-tool、dmc-discover-tools、dmc-empty、dmc-field-label、dmc-field-value、dmc-head、dmc-key-action、dmc-key-clear、dmc-list、dmc-manage、dmc-model-add、dmc-model-alias、dmc-model-danger、dmc-model-edit、dmc-model-error、dmc-model-fact、dmc-model-fields、dmc-model-id、dmc-model-input、dmc-model-label、dmc-model-list、dmc-model-name、dmc-model-ref、dmc-model-row、dmc-model-sub、dmc-model-tokens、dmc-model-well、dmc-model-window、dmc-name、dmc-notice、dmc-notice-action、dmc-page、dmc-pending、dmc-picker、dmc-picker-item、dmc-picker-list、dmc-protocol、dmc-quiet、dmc-rail、dmc-readout、dmc-reasoning、dmc-reasoning-add、dmc-reasoning-head、dmc-reasoning-help、dmc-reasoning-level、dmc-reasoning-remove、dmc-reasoning-row、dmc-reasoning-value、dmc-retry、dmc-retry-action、dmc-retry-actions、dmc-retry-field、dmc-retry-fields、dmc-retry-input、dmc-retry-label、dmc-retry-row、dmc-retry-state、dmc-retry-summary、dmc-retry-unit、dmc-route、dmc-row、dmc-verdict、dmc-well

#### 5. 响应式：问容器，不问视口
宿主在设置面板里只给这一页一个固定内容列：1920 视口下 **560px**，768 视口下 **484px**，
390 视口下 **106px**。所以所有窄分支都是 `@container`，不是 `@media`（`@media` 只留给 `prefers-reduced-motion`）。

| 容器 | 行 | 井 |
|---|---|---|
| 560 / 484 | 四轨一行，48px 高；间距 12 / 8 | 标签列 64px + 值列 |
| ≤ 360（实测 106） | 身份 / 答案 / 模型格 / 门 各占一行，控件 40px | 单列，标签在值上方 |

106px 是宿主「800px 面板 + 390 视口」造成的外部约束：这一档的目标不是好看，而是**有序**——
没有横向溢出（`scrollWidth == clientWidth`）、没有单字孤行、可点目标 ≥40px。

#### 6. 动效

两处「落定」+ 控件反馈，全部 transform / color，**没有任何透明度过渡**：

- 余额句与答案词：160ms、`translateY(2px)` 落定；由 React 的 `key` 重挂载触发，只在值变化时播一次；
- 控件：hover 填色 120ms、按下 `translateY(1px)` 80ms、焦点环；
- `prefers-reduced-motion: reduce`：全部 transition / animation 关掉，内容与状态不变。

**不做滚动入场编排。** 这是别人设置面板里的一个分区，不是落地页；在别人的弹层里做首屏动画是错的。
（这是对 `design-taste-frontend`「≥8 个移动元素」下限的有意偏离，理由与 §5.32 相同。）

#### 7. 不看真机时怎么看它

宿主 token 值可以从真实 GUI 导出（`scripts/theme-tokens.json`、`shots/_row-compare.html` 里的静态色板）。
本轮起用静态 fixture 代替 live 截图（**不要**为此再起第二个 `dsh web`，见 `docs/agent-safety.md`）：

```bash
node scripts/_page-preview.mjs     # 生成 shots/_page-preview.html（560 / 484 / 106 三档，真实两张 sheet，560 档含展开的目录区）
node scripts/_shot-page.cjs        # 浅色 + 深色截图到 shots/page-preview-*.png，并打印行高/溢出几何
```

fixture 渲染的是**真实**的 `modelConfigStyles.ts` + `catalogStyles.ts` 样式文本与真实 DOM 结构，只有宿主面板外壳是假的；
它能证明排版与主题，不证明宿主窗格里的滚动、焦点链与 Esc 分层——那几项必须在真机里由用户确认
（§5.37 的真机手测记录在 DESIGN）。旧的 `_drawer-preview.mjs` / `_shot-drawer.cjs` 随抽屉一起退役。

#### 8. 下一个表面怎么沿用

1. **先问这一屏是谁在回答什么问题**，再决定行/列；不要再造「第二段控件行」。
2. 事实放行上，控制进井里；一个词就是一个控件，禁止图标按钮与胶囊（真表单字段除外）。
3. 每页一个大声处（这里是余额句），其余靠 13px 与 secondary 墨色；不靠阴影、边框、字重堆叠。
4. 状态只允许两个通道（答案词 + 竖条）；颜色只做图形。
5. 窄分支问容器宽度；先保证「有序」，再谈好看。
