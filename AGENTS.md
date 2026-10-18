# AGENTS.md

dsh-rabbit-model-picker 是面向 DeepSeek Harness(DSH)的**外部插件**:browser 半区在 `priority: -10`
遮蔽输入条的 `conversation.input.model` 座位,用一张两窗格模型卡(提供商栏 + 模型列表)替换默认选择器;
同一插件还带「设置 → 模型配置」平行页(与官方模型页并存、功能对等)与 Host 侧的限流文案恢复。
安装/回退只改 profile(一条 Loader 行),**不碰 DSH 安装目录**。`src/` 是源码唯一真源,`lib/` 是
**提交进仓库的构建产物**。

## 与维护者的协作方式

仓库只有一位维护者——我,以 AI 辅助开发。任务里的另行说明**覆盖**下面五条默认。

1. **只在真正值得问的时候问。** 影响实质、反向成本高的不清晰点(范围、取舍、"完成"的样子)直接问;
   只是细节未明就说明假设后直接做——一次往返比一次可回退的改动贵。
2. **从第一性原理出发思考。** 从底层目标与仓库真实的事实(代码、数据、约束)出发,不套熟悉的套路,
   并写出**取舍的理由**。继承来的选择——包括此前 AI 的决定与文档——不值得保留就质疑并明说;
   `DESIGN.md` 是决策账本:**编号更大、更晚的章节赢**,旧章节是证据,不是命令。
3. **不做过度防御性设计,也不做过度流程。** 选满足需求的最简设计:不加投机结构(为未来做的抽象、
   没人要的开关),不做预防性动作(多读文档、多开 worktree、为小改动建 PLAN/goal/todo)。检查只在
   被要求、或读代码读不出结论时跑。
4. **先实现功能,等我确认无误后再做必要的验证。** 功能落地先给我看。**我没有主动要求时不写测试**
   (单元、集成、验收、改坏验证都算);**UI 样式相关的测试不写**。
5. **真机验收是硬规则,不是偏好。** 不起第二个 `dsh web`、不结束/重启任何进程(包括用户正在用的
   DSH 与其 node)、不写 `~/.dsh` 的会话/设置/缓存。要碰真实 GUI 前先读 `docs/agent-safety.md`
   (R0–R6 与两次事故);拿不准 → 问我,不猜。

## 写作风格

像跟同事交谈那样自然地讨论技术概念,目标是**第一次阅读就能理解**。

- 熟悉的词与具体描述能表达同样意思时优先用它们,别用抽象或技术化的说法;别假设读者会自行解码。
- 每个段落只表达一个主要观点,按读者容易理解的顺序组织。
- 术语用 `CONTEXT.md` 的规范名;它文末「废弃叫法」里的词不得在代码、文案、文档里复活。
- 汇报改动时说清改了什么、为什么改、如何验证、有哪些风险或限制。**没实测的部分如实写成
  "未验证 / 缺口",不要写成已解决**——本仓库有真实的 live 验证缺口。

## 文档地图:动手前读哪份

| 要做什么 | 读什么 |
|---|---|
| 改交互/架构,或查一个决定为什么这么定 | `DESIGN.md`:决策账本,`§5.x` 按时间追加(最新赢),`§8.x` 是实测记录;按编号检索,别通读 |
| 命名、写界面文案、判断说法是否已废弃 | `CONTEXT.md`:规范中文名 + 废弃叫法 |
| 方向级取舍 | `docs/adr/000N-*.md`;新决定按递增编号新增 |
| 碰进程、起服务、真机验证 | `docs/agent-safety.md`,先读完 R0–R6 |
| 改「模型配置」页的能力范围 | `docs/models-page-parity-checklist.md`:A–E 五组即交付范围 |
| 查官方页行为 | `docs/official-models-page-notes.md`、`docs/settings-models-tab-feasibility.md`:史料,不是现行契约 |
| 动视觉 | 没有规范文档了:令牌真源是 `src/client/designSystem.ts` 的 `--zmd-*` 块,类名与状态钩子看 `src/` 现状,颜色字面量只许出现在令牌块 |

## 包管理器与构建

单个 npm 包(不是 pnpm workspace),Node 22,`npm install`。

- `npm run build` **不是检查,是产物**:esbuild 出 `lib/index.js`(host,node ESM)与
  `lib/client.js`(browser,lazy-CJS factory)。改 `src/` 必须跑,并把重建后的 `lib/` 与 `src/`
  **同一提交**;git 安装不构建,漏提交 `lib/` 会让用户装到旧行为或 `failed to import`。
- `npm run typecheck` 只查 `src/`。`npm run font:build` 需要 Python/网络,产物
  `src/client/fontAsset.ts` 已提交,**不要手改 `fontAsset.ts`**。
- **没有自动化测试,也没有 src↔lib 漂移门**(2026-10-18 删除,见 `DESIGN.md` §5.43)。
  改完 `src/` 后跑 `typecheck` + `build`,必要时对比产物哈希确认 `lib/` 确实重建过。

## 修改源码

- 源码唯一真源在 `src/`:host 半边 `src/index.ts` + `src/host/`,browser 半边 `src/client/`。
  `lib/` 是构建产物,不要手改或单独编辑。
- 生效方式:**host 改动要重启 `dsh web`** 才会加载新的 `lib/index.js`(插件目录不在 HMR 的 root
  面内),重启只由用户做;browser 改动重建后刷新页面生效(旧 bundle 可能被缓存——先
  `Network.setCacheDisabled` 再 reload,并在记录结论前断言 bundle 里确实有改动)。
- 视觉改动落在既有语法里:颜色字面量只许出现在 `designSystem.ts` 的 `--zmd-*` 令牌块;样式表只用
  `var(--zmd-*)` 与宿主 `var(--dsw-*)`;字号守五档白名单(10/12/14/16/24,宿主 Tag 11 与图标字形
  16 是既有例外);类名前缀 `dmp-`(输入条三表面)/ `dmc-`(模型配置页)/ `zmd-`(共享原子);
  退役类名不得复活。**这些规则没有静态门兜底,由实现与我的确认遵守。**
- 文案:zh/en 同键同序(`dictionary.ts`、`modelConfigCopy.ts`)。
- 几条不能随手改的契约:座位 shadowing(`priority: -10`)、模型卡单层与设置页唯一 modal、范围不
  持久化、配置写入只走 Host 服务(`settings/mutate` 带 revision 冲突重读、`credentials/set|unset`)、
  宽度预算。**改它们不是改代码,是改决定——先问我。**
- 新逻辑优先放进单一职责的模块(既有形态是纯逻辑/纯函数与渲染分离);已经很大的文件不顺手重排
  ——**拆分是独立一轮**,先修眼前的问题。
- 提交沿用仓库风格:`feat/fix/test/docs/chore/perf:` + 中文主语;`src/` 与重建的 `lib/` 同一提交;
  新决定在 `DESIGN.md` 追加 `§5.x`,方向级取舍写新 ADR。
