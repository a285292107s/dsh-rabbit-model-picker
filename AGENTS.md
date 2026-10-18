# AGENTS.md

dsh-rabbit-model-picker 是面向 DeepSeek Harness(DSH)的**外部插件**:browser 半区在 `priority: -10`
遮蔽输入条的 `conversation.input.model` 座位,用一张两窗格模型卡(提供商栏 + 模型列表)替换默认选择器;
同一插件还带「设置 → 模型配置」平行页(与官方模型页并存、功能对等)与 Host 侧的限流文案恢复。
安装/回退只改 profile(一条 Loader 行),**不碰 DSH 安装目录**。

## 协作方式

仓库只有一位维护者——我,以 AI 辅助开发。任务里的另行说明覆盖下面几条。

- **只在值得问的时候问。** 影响实质、反向成本高的不清晰点(范围、取舍、"完成"的样子)直接问;
  细节未明就说明假设后直接做——一次往返比一次可回退的改动贵。改契约、改交互形态之前先问。
- **从第一性原理出发,不为流程而流程。** 从代码、数据与约束出发,不套熟悉的套路;不做投机抽象、
  没人要的开关、预防性动作(多读文档、多开 worktree、为小改动建 PLAN/goal/todo)。检查只在被要求、
  或读代码读不出结论时跑。
- **先实现功能,等我确认无误后再做必要的验证。** **我没有主动要求时不写测试**(单元、集成、验收、
  改坏验证都算),**UI 样式相关的测试不写**。
- **真机验收是硬规则。** 不起第二个 `dsh web`、不结束/重启任何进程(包括用户正在用的 DSH 与其
  node)、不写 `~/.dsh` 的会话/设置/缓存。碰真实 GUI 前先读完 `docs/agent-safety.md` 的 R0–R6
  (两次事故的边界都在那里);拿不准 → 问我,不猜。
- **写作像跟同事说话。** 熟悉的词优先,一段只说一件事;术语用 `CONTEXT.md` 的规范名,它文末
  「废弃叫法」里的词不得在代码、文案、文档里复活。汇报说清改了什么、为什么、怎么验、有哪些风险
  或限制;**没实测的写成"未验证 / 缺口",不要写成已解决**。

## 构建与产物

单个 npm 包(不是 pnpm workspace),Node 22,`npm install`。

- `npm run build` **不是检查,是产物**:esbuild 出 `lib/index.js`(host,node ESM)与
  `lib/client.js`(browser,lazy-CJS factory)。`src/` 是唯一真源,`lib/` 是**提交进仓库的构建
  产物**,只能由构建生成;改 `src/` 必须重建并把 `lib/` 与 `src/` **同一提交**——git 安装不构建,
  漏提交会让用户装到旧行为或 `failed to import`。
- `npm run typecheck` 只查 `src/`。`npm run font:build` 需要 Python/网络,产物
  `src/client/fontAsset.ts` 已提交,**不要手改 `fontAsset.ts`**。
- **没有自动化测试,也没有 src↔lib 漂移门。** 改完 `src/` 跑 `typecheck` + `build`,必要时对比
  产物哈希确认 `lib/` 确实重建过。构建脚本自带的接线自检(座位 key、`priority: -10`、无 `default`
  导出)是唯一的机器门。

## 改源码

- 源码在 `src/`:host 半边 `src/index.ts` + `src/host/`,browser 半边 `src/client/`。
- 生效方式:**host 改动要重启 `dsh web`** 才会加载新的 `lib/index.js`(插件目录不在 HMR 的 root
  面内),重启只由用户做;browser 改动重建后刷新页面生效(旧 bundle 可能被缓存——先
  `Network.setCacheDisabled` 再 reload,并在记录结论前确认 bundle 里确实有改动)。
- **视觉改动落在既有语法里**,没有规范文档可依:令牌真源是 `designSystem.ts` 的 `--zmd-*` 块,
  类名与状态钩子看 `src/` 现状。颜色字面量只许出现在令牌块;样式表只用 `var(--zmd-*)` 与宿主
  `var(--dsw-*)`;字号守五档白名单(10/12/14/16/24,宿主 Tag 11 与图标字形 16 是既有例外);
  类名前缀 `dmp-`(输入条三表面)/ `dmc-`(模型配置页)/ `zmd-`(共享原子);退役类名不得复活。
  **这些规则没有静态门兜底,由实现与我的确认遵守。**
- 文案 zh/en 同键同序(`dictionary.ts`、`modelConfigCopy.ts`)。
- 不能随手改的契约:座位 shadowing(`priority: -10`)、模型卡单层与设置页唯一 modal、范围不持久化、
  配置写入只走 Host 服务(`settings/mutate` 带 revision 冲突重读、`credentials/set|unset`)、宽度
  预算。**改它们不是改代码,是改决定。**
- 新逻辑放进单一职责的模块(既有形态是纯逻辑/纯函数与渲染分离);已经很大的文件不顺手重排
  ——**拆分是独立一轮**,先修眼前的问题。`src/` 不留注释;读代码推不出来的理由写进 ADR 或提交说明。
- 改「模型配置」页时,`docs/models-page-parity-checklist.md` 的 A–E 五组就是交付范围;
  查官方页行为看 `docs/official-models-page-notes.md` 与 `docs/settings-models-tab-feasibility.md`
  ——那是史料,不是现行契约。
- 提交沿用仓库风格:`feat/fix/test/docs/chore/perf:` + 中文主语;`src/` 与重建的 `lib/` 同一提交;
  方向级决定新写一份 `docs/adr/000N-*.md`(递增编号,不改旧的那份)。
