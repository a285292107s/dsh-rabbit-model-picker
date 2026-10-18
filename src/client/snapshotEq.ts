
// The snapshots fed here must stay plain JSON-shaped data (objects, arrays, strings,
// numbers, booleans). A Map or a Date has no own enumerable keys, so two different ones
// would compare equal — silently, and React would never see the change.
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
