# ADR 0013 — 推理等级改「刻度行 + Default 行」：Default 不是档位，Off 仍是刻度起点

- 状态：已采纳（2026-10-19）
- 相关：`src/client/effort.ts`、`src/client/SettingsMenu.tsx`、`src/client/styles.ts`、`src/client/dictionary.ts`
- 相关决定：ADR [0012](0012-parameter-panel-readout.md)（参数面板读数优先）、`CONTEXT.md`「推理等级选择」

## 背景

推理等级原来是一组平铺胶囊：Default（`defaultEffort` 未声明时才有）+ 适配器声明的全部档位。300px 面板的内容宽 272px，六项按 13/20、10px 内边距量是 312.5px（Default 61.5 / Off 38 / Low 43 / Medium 67.5 / High 47 / Max 45.5 + 5×2 缝）；前五项 265px，Max 放不下，掉到第二行。实测与截图一致。

这不是单个模型的偶发换行：档位名由适配器声明，目前 schema 允许 off / minimal / low / medium / high / xhigh / max 七档；六档就约 317px，即使没有 Default，刻度自己也会换行。把字号或水平内边距压小去换单行，会破坏宿主字阶和点击面，而且对更长、更多的档位仍然不成立。

更根本的问题是三类东西被放进了同一条一维序列：

1. **Default** 是 `effort === undefined` 的「不指定」，由插件生成；只有 `defaultEffort` 未声明时才出现。它不是档位。
2. **Off** 是适配器声明的档位，语义上是刻度的 0 点（Off < Low < Medium < High < Max）。它在配置页里的特殊性（不用填 API 值）属于编辑器校验，不是选择器的排序语义。
3. **Low…Max** 是同一根轴上的有序档位。

平铺让 Default 和 Off 看起来像「低于 Low 的两档」，而换行又把 Max 推成孤儿；宽度的偶然性和语义的偶然性叠在一起。

## 决定

1. 推理等级分成两行：第一行是适配器声明的全部档位，按声明顺序渲染（不排序、不重排）；第二行是 Default，只在它存在时出现。
2. Default 仍属于同一个 `radiogroup`，仍用同一种胶囊；旁边加一句 12/18 注释「不指定档位，由提供商决定」（英文「No level; the provider decides」），用 `--zmd-ink-mute`，让第二行是「另一种状态」而不是被挤下来的孤儿。
3. DOM 顺序与视觉顺序一致：刻度先、Default 后。禁止用 CSS `order` 把 Default 挪到下面——Tab 顺序和 `chain()` 会错。
4. 档位行保留 2px 列距，换行时用 4px 行距（`.dmp-effort-scale { row-gap: 4px }`）；换行时第二行读成刻度的续行，而不是另一组选项。
5. 不把 Off 抽成特殊项：选择器没有 severity 可读，要抽只能硬编码 `id === 'off'` 或假设第一项是 Off；两者都会在「模型没声明 Off」或「声明顺序不同」时出错。
6. Default 不出现时（提供商声明了 `defaultEffort`），只剩刻度行；不预留空行。
7. 这是呈现改动：`reasoningEffort` 的取值、会话级、写入路径、只读行为、`effortChoicesOf` 的 `effort` 语义都不变。

## 取舍

- **放弃「一排塞下六项」**：313px > 272px 是结构性的；压字号/padding 只能暂时过关，且与宿主字阶冲突。
- **放弃 B「Default + Off 一行，刻度一行」**：视觉上更整齐，但 Off 离开刻度起点，且两个条件项都可能缺席（Default 需要没有 `defaultEffort`，Off 可以被删），组会塌；它把「未指定」（不发送值）和「显式 off」（发送一个值）说成同一类。
- **放弃把 Default 做成 `.zmd-btn-ghost` 文字动作**：页脚已有「恢复默认」（重置上下文/输入），两个「默认」动作在同一面板里会打架；胶囊 + 注释仍是 radio 语法。
- **放弃下拉、横向滚动、折叠**：ADR 0012 已经因为「当前值和可选项不能同时看见」否掉了下拉；横向滚动会把选项藏起来。
- **保留 4px 行距**：2px 时换行像一整块密集菜单；4px 足够读出「续行」，又不多占高度。

## 后果

- `.dmp-effort-list` 退役，新增 `.dmp-effort-rows` / `.dmp-effort-scale` / `.dmp-effort-default` / `.dmp-effort-hint`；`.dmp-effort-item`、选中态、hover、focus、禁用态、`chain()` 选择器都不变。
- 新增文案键 `settings.effort.providerDefaultHint`；中英同键同序。
- 这个模型（Off/Low/Medium/High/Max + Default）从「2 行、Max 孤儿」变成「刻度 1 行 + Default 1 行」，高度基本不变（约 60px）。6–7 档时刻度自己会换到第二行，加 Default 共 3 行（约 92px），仍在参数面板 460px 上限内；展开自定义上下文输入框时需静态复核。
- 选中态字重 400→500 会让胶囊宽 1–2.5px；5 档刻度有约 23px 余量，不会因选中改变换行点。6 档时第一行只剩 0.5–2.5px 余量，选中可能改变换行点；这轮不预先加「隐藏 semibold 占位」，真机若看到抖动再补。
- 只在静态 fixture 里按 300px、13/20、10px 内边距测量和中英预览；**不是真机验收**，宿主字体（尤其 macOS）与浏览器缩放可能让断点略有差异。

## 备选（未采用）

- **只把 Default 挪到列表末尾**：第二行仍然是一个没有解释的孤儿，换行点随宽度漂移。
- **把 Default 与 Off 并成「特殊项」组**：见取舍。
- **把 Default 放进读数行**：读数行是值/来源的语义，且右端已有 88px 的「仅本会话」；把控件塞进去会读成当前值，不是选项。
- **用网格/折叠消灭所有孤儿**：改动大于收益；6 档以上的换行仍是可接受的刻度续行。
