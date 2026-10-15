/**
 * "Did anything a subscriber can SEE actually change?" — one answer, shared by
 * both stores that wake React.
 *
 * WHY THIS EXISTS. Both stores publish by building a NEW snapshot object and
 * notifying every listener. `useSyncExternalStore` decides whether to re-render
 * by comparing the snapshot it last read against the one it reads now with
 * `Object.is`, so a store that allocates on every publish forces a re-render on
 * every notification — including the ones that carry no change at all. Measured
 * on the reference catalog (8 providers, 64 models): opening the menu produced
 * **16** wakeups for **8** route changes, so half of them re-rendered the whole
 * model list for nothing, and every later open of the parameter panel
 * re-rendered it again over values that had not moved.
 *
 * A store cannot fix that by comparing references: the object it just built is
 * always a new one. It has to compare the CONTENT, which is what this module is.
 * With it, `publish` can return the previous snapshot untouched when nothing
 * observable moved, and both halves of the cost disappear — no listener runs, and
 * the identity React compares stays the same.
 *
 * WHAT "OBSERVABLE" MEANS. Everything in these snapshots is plain data: strings,
 * numbers, booleans, arrays and string-keyed records, all built by this plugin
 * from Host answers. So structural equality is exactly the right question, and
 * there is no hidden state (a `Map`, a `Date`, a class instance) that a value
 * comparison would miss. `undefined` is compared as a value rather than treated
 * as absent, so a field that goes from `undefined` to a number is a change and
 * the reverse is too — the two would otherwise be indistinguishable from a key
 * that was never there, and these snapshots use optional fields (`contextWindow`,
 * `maxTokens`, `error`) for real states.
 *
 * @module dsh-rabbit-model-picker/client/snapshotEq
 */

/**
 * Whether two snapshot values are structurally equal.
 *
 * Deliberately total over the JSON-shaped data these stores hold, and
 * deliberately NOT a general-purpose deep-equal: it answers one question for two
 * callers, so it is small enough to read in full and to pin with a unit gate.
 *
 * Arrays are compared element-wise and in order (the catalog's provider order is
 * meaningful — it is the order the rail lists). Records are compared by key SET
 * first, so a snapshot that merely gained or lost a key is a change even when
 * every shared key still matches; key ORDER is not compared, because nothing
 * downstream reads it and a reordered-but-equal payload is not a change a
 * subscriber can see.
 * @param left - the snapshot in hand (or any value).
 * @param right - the snapshot just built.
 * @returns true when no subscriber could tell them apart.
 */
export function sameSnapshot(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== 'object' || typeof right !== 'object') return false
  if (left === null || right === null) return false

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    if (left.length !== right.length) return false
    return left.every((item, index) => sameSnapshot(item, right[index]))
  }

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every(
    key => Object.hasOwn(right, key) && sameSnapshot((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
  )
}
