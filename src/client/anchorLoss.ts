const CONFIRM_LOOKS = 2

const CONFIRM_DELAY_MS = 16

function occupiesPage(element: Element): boolean {
  return element.isConnected && element.getClientRects().length > 0
}

export function seatLeftThePage(element: Element | null): boolean {
  return element === null || occupiesPage(element) === false
}

export function observeSeatLoss(root: () => Element | null, onLost: () => void): () => void {
  let frames = 0
  let reported = false
  let stopped = false
  let timer: number | null = null

  const confirm = (): void => {
    if (stopped || reported) return
    if (seatLeftThePage(root()) === false) {
      frames = 0
      return
    }
    frames += 1
    if (frames < CONFIRM_LOOKS) {
      timer = window.setTimeout(confirm, CONFIRM_DELAY_MS)
      return
    }
    reported = true
    onLost()
  }

  const observer = new ResizeObserver(confirm)
  const element = root()
  if (element !== null) observer.observe(element)

  return () => {
    stopped = true
    observer.disconnect()
    if (timer !== null) window.clearTimeout(timer)
  }
}
