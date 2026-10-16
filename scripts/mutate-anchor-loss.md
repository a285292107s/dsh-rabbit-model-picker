# 改坏验证 — §5.18 anchor loss

Each mutation breaks one decision the fix rests on, and the gate has to notice.
Run: `node scripts/mutate-anchor-loss.mjs` (also part of `npm test`).

Both gates run: the static one reads the WIRING, the unit one DRIVES the decision.
A mutation is caught if either goes red.

| # | 改动 | 期望 |
|---|------|------|
| 1 | `setTimeout(confirm, …)` → `requestAnimationFrame(confirm)` | 红灯（原缺陷：确认永远不跑，弹窗不关） |
| 2 | 观察对象 `rootRef.current` → `triggerRef.current` | 红灯（锚点级探测） |
| 3 | `setSettingsAt(false)` 删除 | 红灯（一起关） |
| 4 | `if (!open && …) return` 删除 | 红灯（只在打开时监听） |
| 5 | `getClientRects().length > 0` → `isConnected` | 红灯（`display:none` 时仍为 true） |
| 6 | `observer.disconnect()` 删除 | 红灯（拆卸不彻底） |
| 7 | `clearTimeout(timer)` 删除 | 红灯（同上） |
| 8 | 关闭时补一句 `lastActionRef.current?.focus()` | 红灯（不还焦点） |
| 9 | `setSelectionFocus(false)` 删除 | 红灯（第三个闩住的 flag 没松开） |
| 10 | `CONFIRM_LOOKS` 2 → 1（第一次读数就关） | 红灯（一次重排抖动就丢掉用户还在看的弹窗） |
| 11 | `reported = true` 删除（重复上报） | 红灯（调用方从这里关 React 状态） |
| 12 | `stopped` 判断删除（拆掉后仍上报） | 红灯 |
| 13 | 恢复判断写反 | 红灯 |
| 14 | 没 root 时才挂观察 | 红灯 |
| 15 | 计时器不存起来（挂起的复查取消不掉） | 红灯 |

第 10–15 条是**决策**而不是**接线**，加它们之前六条全都**逃过了本仓库所有门**：
静态正则看得见 `setTimeout(confirm` 写在那里，看不见第二次确认**到底有没有发生**——
而那正是这条规则的全部。所以另建了一份驱动真实状态机的单元门（假元素 / 假
ResizeObserver / 可控时钟）来接管这半边。

**两个判定，必须分清**：`MISSED` 是「门太弱」，要加门；`STALE` 是「这条改坏
已经打不上去了」，要改这个文件。以前两者都print 成 `SKIP` 然后静默跳过——
`Picker.tsx` 是 CRLF 而模式用的是 `\n`，于是三条改坏**长期没有真正apply 过**，
脚本却一直报"ok"。脚本现在会分别点名，并且**算失败**。

