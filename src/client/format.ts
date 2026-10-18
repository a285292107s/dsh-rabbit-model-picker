export function formatWindow(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return ''
  if (tokens < 1_000) return String(Math.round(tokens))
  if (tokens < 1_000_000) {
    const thousands = Math.round(tokens / 1_000)
    return thousands >= 1_000 ? '1M' : `${thousands}K`
  }
  return `${Math.round(tokens / 1_000_000)}M`
}

export function formatWindowStatement(raw: string, stored?: number): string {
  const text = raw.trim()
  if (text === '') return ''
  const digits = text.replace(/[\s_]/g, '').toUpperCase()
  const match = /^(\d+(?:\.\d+)?)([KM])?$/.exec(digits)
  if (match === null) return text
  const scale = match[2] === 'M' ? 1_000_000 : match[2] === 'K' ? 1_000 : 1
  const tokens = Math.round(Number(match[1]) * scale)
  return formatWindow(tokens) || formatWindow(stored ?? 0) || text
}

