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
