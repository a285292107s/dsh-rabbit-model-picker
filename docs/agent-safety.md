# 运行与验证纪律：不要结束别人的进程，不要起第二个 `dsh web`

> 这份文件记的是一次真实事故，以及事故之后定下的硬规则。
> 它不解释产品设计（那是 `DESIGN.md`），只回答一个问题：
> **在用户正在使用 DSH 的机器上，一个 agent 允许对 DSH 进程做什么、禁止做什么。**

## 1. 事故记录（2026-10-17 18:03–18:07）

### 1.1 当时在做什么

任务是把「设置 → 模型配置」页的 UI 重做一遍。前一轮已经确认这个页面在真实 GUI 里的表现，
本轮需要新的真机截图与测量。为了不看用户的屏幕、也不碰用户正在用的实例，我做了下面这件事：

| 时间 | 动作 | 结果 |
|---|---|---|
| 18:03:04 | 用**同一个 `DSH_HOME`（`~/.dsh`）、同一个 `web` profile**，另起一个 `dsh web --port 3081 --no-open` | 启动成功，拿到一条带 token 的 URL |
| 18:03–18:05 | 让 `scripts/verify-model-config-tab.cjs` 连到这个 3081 实例跑 35 项真机检查（含**通过「通用设置 → 外观」切换主题再恢复**、展开模型目录区、模型发现、Esc 分层等） | 35/35 PASS |
| 18:04:58 | `~/.dsh/profiles/web/cordis.patch.yml` 的 mtime 变化（**不是脚本写的**，写入者未定位） | 同一时刻 `.plugin-manager` 没有任何操作记录 |
| 18:06:05–18:06:12 | 在插件仓库里写一次性预览文件，并用 Playwright 起 headless Chromium 截图 | 正常 |
| **≈18:07** | **用户原本的服务器（pid 11668，17:23:14 在 Windows Terminal 的 pwsh 里手动启动）退出** | 该实例没有包装日志，**exit code 与 stderr 全部丢失** |
| 18:07:07 | 用户（从 Explorer 启动 `~/.dsh/dsh-web-log.ps1`）把它重新拉起，新 pid 44868 占用 3080 | 新实例启动正常 |

### 1.2 为什么这件事可疑

1. **DSH 没有多实例隔离。** 同一个 `DSH_HOME` / profile 下的这些东西是两个进程共享的普通文件：
   `sessions/`、`storages/session_projcache/`、`storages/*.json`、设置文档、`profiles/web/cordis.patch.yml`、
   `.plugin-manager/`、以及 `client-hmr` 的文件监听。两个 host 同时做 read-modify-write 时，
   任何一个读到半写文件、或任何一个 watcher 触发重载，都可能让**另一个**进程退出。
2. **那 35 项检查不是只读的。** `R5` 会通过 host 的设置服务切换「外观」主题再恢复；
   打开 GUI 本身也会创建会话状态。也就是说我确实**通过第二个 host 写了共享的设置与会话**。
3. **时间上完全吻合。** 第二次启动在 18:03:04，旧实例在 18:07 前退出；中间窗口正是上面这些写入发生的时候。
4. **`cordis.patch.yml` 在窗口内被改写过一次**（18:04:58）。它不是我写的，也不是 plugin-manager 写的，
   我至今没有定位到写入者。一个 host 的配置文件在另一个 host 运行期间被改写，本身就是重载/崩溃的候选原因。

### 1.3 不能证明的部分（如实记）

- 旧的 11668 是**手动**在终端里启动的，没有经过 `dsh-web-log.ps1`。
  因此没有 `web-*.log` 的 exit code，没有 `.stderr.log` 的 FATAL 文本，`logs/reports/` 与 `crashdumps/` 也没有东西。
- Windows 事件日志在同一窗口内没有 node.exe 的 Application Error / WER 记录。
  也就是说：**「第二个实例导致退出」是风险最高、时间最吻合的推断，不是我拿到了因果证据。**
  （反过来说，如果旧实例当时是用 `dsh-web-log.ps1` 起的，这次就能直接读到 exit code 分类：
  `0` 正常、`1` JS fatal、`134` V8 堆耗尽、`-1073740791` Windows fail-fast。见该脚本头部。）
- 机器上同时还有别的 agent 会话在写 `session_projcache`（窗口内新增的会话属于 `mytab` / `hsr wiki` 等工作区）。
  它们也是共享状态的并发写入方。
- 12 分钟后（18:35）用户明确要求：**最终效果由用户自己检查**，agent 不再对真实 GUI 做 live 验证。

### 1.4 已经做的止损

- 立即结束 3081 实例（先按端口反查 owner，再只结束那一个 PID），确认 3081 不再监听；
- 之后没有再启动任何 DSH 实例、没有执行任何 `Stop-Process` / `taskkill`；
- 没有改动用户设置里的任何东西（主题检查当轮已完成恢复）；
- 本轮 UI 工作只走静态证据：构建、静态门、单元测试、用宿主真实 token 值渲染的静态 fixture。

## 2. 硬规则（违反任何一条都算事故）

### R1 绝不结束不是自己启动的 DSH 进程

- 不执行 `Stop-Process -Name node`、`taskkill /IM node.exe` 这类宽泛命令。机器上永远有别的 node。
- 只能结束**自己在本次会话里启动、并记录了 PID 与端口**的进程。
- 结束前先反查：`Get-NetTCPConnection -LocalPort <port>` 拿 OwningProcess，再核对它的命令行确实是自己的实例。
- 启动服务类进程时记下 `(pid, port, 启动时间)`，写进当轮笔记；不用「大概是那个」去杀。
- **用户的 `dsh web` 只能由用户重启**。发现它退出了，做的是取证与告知，不是「帮你重启」。

### R2 绝不在同一个 `DSH_HOME` / profile 上启动第二个 `dsh web`

- 换端口也不行：端口是唯一不共享的东西，其余全共享。
- 需要隔离时，建一份**独立的 home**：
  - 复制 profile 配置（`cordis.yml`、`cordis.patch.yml`、`package.json`、`pnpm-*`），
  - 让 `node_modules/dsh-rabbit-model-picker` 指向同一个仓库（junction / symlink），
  - 用 `DSH_HOME=<隔离目录> dsh web --port <空闲端口> --no-open`，
  - 并且仍然按 R3 只读使用。
- 隔离实例用完即停，并记录它的 PID。

### R3 对真实 GUI 的验证默认只读

- 不点保存、不点删除、不点添加、不输入凭据、不切主题、不改任何设置。
- 需要写才能测的检查（例如主题切换、脏草稿保存）：**跳过并在报告里写明跳过原因**，不要用「反正会恢复」说服自己。
- 只做：打开设置、读 DOM、量几何、截图、Esc 关闭。
- 已知例外：`scripts/verify-model-config-tab.cjs` 的 `R5`（主题切换）与 `A9/A20`（脏草稿门控，不提交）
  属于写路径。对**用户自己的实例**跑这个脚本之前，必须先确认可以写，或者先加 `--read-only` 之类的开关。
  **默认不要对用户实例跑整轮 harness。**

### R4 获取 GUI 凭证只读日志，不要猜、不要重置

- `dsh web` 每次启动生成新 token；旧 URL 会 401。
- 从用户在跑的实例里读：该进程终端输出，或 `~/.dsh/logs/web-*.log` 里 `url : dsh web: ...?token=...` 那一行。
- 读不到就向用户要，不要自己重启一个来「拿到 token」。

### R5 崩溃取证看包装日志，不要靠印象

- 用 `~/.dsh/dsh-web-log.ps1` 启动的实例会留下：`web-<stamp>.log`（banner、URL、采样曲线、exit record）、
  `.stdout.log` / `.stderr.log`、`.metrics.csv`、`logs/reports/report.*.json`、`crashdumps/*.dmp`。
- exit code 语义：`0` 正常退出、`1` JS fatal（stderr 里找 `fatal uncaught exception`）、
  `134` V8 堆耗尽、`-1073740791`（0xC0000409）Windows fail-fast（此时 JS 没跑，stderr 可能为空）。
- **手动启动的实例没有任何这类证据**——这也是 R2/R3 存在的理由。

### R6 结束自己的后台任务也要有边界

- 后台 job 用 job id 管理；job 失效（unknown job）时，先用端口/PID 反查确认那个进程是不是自己的，
  再决定是否结束。
- 不删除、不清空别人的日志、会话、缓存目录（`sessions/`、`storages/`、`logs/` 都不属于本仓库）。

## 3. 动手前检查表（对真实 GUI 做任何事之前）

1. 这个 DSH 是**用户正在用的**那个吗？（是 → 只读，且先告知）
2. 我需要的只是截图/测量吗？（是 → 用静态 fixture + 宿主真实 token；见 `docs/ui-language.md` §7）
3. 这个脚本会写吗？（会 → 换只读路径，或明确跳过并记录）
4. 我要启动进程吗？（要 → 独立 home、独立端口、记录 PID、用完停止）
5. 我要结束进程吗？（先反查端口→PID→命令行，确认是自己的）
6. 如果它在这期间退出，我能拿出什么证据？（没有包装日志 → 先别动它）

## 4. 本轮之后的做法

- UI 视觉验证改为两条腿：**静态 fixture**（用真实 `--dsw-*` token 值与真实 sheet 渲染三种宽度、两种主题）
  加上**用户自己在 GUI 里看**。agent 不再为了截图去起第二个实例。
- 需要在真机里量的东西（面板真实宽度、宿主滚动容器、行内展开区的滚动位置），若必须 live 验证，
  由用户在合适的时候提供一次性 token 与明确许可，并按 R3 只读执行。
