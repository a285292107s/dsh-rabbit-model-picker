/**
 * The RETIRED record of the provider scope — and nothing else.
 *
 * The seat used to remember the provider a session's model list was scoped to
 * (`prefs.ts`, §5.13): one `localStorage` key per conversation, written on every
 * change and read on every mount. §5.26 removed that, because the trigger beside
 * the list now names `provider/model` itself: a remembered scope would only ever
 * disagree with it the moment a session resumed on a different provider, and the
 * list is supposed to answer "what can I switch to from here" before it answers
 * "what exists".
 *
 * What is left for this module is a DATA contract, not behaviour. Those keys
 * already exist in users' browsers, and deleting the code that read them does not
 * delete them; they are swept once per activation so an upgraded install does not
 * carry dead entries forever.
 *
 * @module dsh-rabbit-model-picker/client/retiredScope
 */

/**
 * Prefix of the retired record.
 *
 * It keeps its PRE-RENAME spelling on purpose. This is persisted user data
 * written by an older build under the old package name, and a sweep looking for
 * the new name would miss every key it exists to remove. The prefix also covers
 * both shapes the record ever had: the per-session `…provider.v1:<session id>`
 * keys and the single unscoped `…provider.v1` key that preceded them.
 */
const RETIRED_SCOPE_PREFIX = 'dsh-model-picker.provider.'

/**
 * Drop every key the retired scope record could have written.
 *
 * Called once per plugin ACTIVATION (registered as an `effect` in `apply`), not
 * per seat mount: this is a data migration, it is idempotent, and a session that
 * never opens the card should not carry the dead entries either. An absent or
 * denied store is not worth surfacing: losing the sweep costs one dead key, and
 * it must never break the seat.
 */
export function retireStoredScope(): void {
  let store: Storage
  try {
    store = window.localStorage
  } catch {
    return
  }
  try {
    // Collected first, removed after: `localStorage` re-indexes on every removal,
    // so deleting inside the index walk would skip every other key.
    const doomed: string[] = []
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index)
      if (key !== null && key.startsWith(RETIRED_SCOPE_PREFIX)) doomed.push(key)
    }
    for (const key of doomed) store.removeItem(key)
  } catch {
    // A full or read-only store is not a reason to break the seat.
  }
}
