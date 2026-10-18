
// Keys persisted by an older build under the package's PRE-RENAME name, so this spelling
// must not be "corrected" to the current one. Covers both shapes the record ever had: the
// per-session `<prefix>v1:<session id>` keys and the older unscoped `<prefix>v1` key.
const RETIRED_SCOPE_PREFIX = 'dsh-model-picker.provider.'

export function retireStoredScope(): void {
  let store: Storage
  try {
    store = window.localStorage
  } catch {
    return
  }
  try {
    const doomed: string[] = []
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index)
      if (key !== null && key.startsWith(RETIRED_SCOPE_PREFIX)) doomed.push(key)
    }
    for (const key of doomed) store.removeItem(key)
  } catch {
  }
}
