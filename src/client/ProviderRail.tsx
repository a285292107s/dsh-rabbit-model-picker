import type { KeyboardEvent, MutableRefObject } from 'react'
import type { Translate } from './contract.ts'

export interface ProviderOption {
  readonly id: string | null
  readonly label: string
  readonly count: number
  readonly failed: boolean
  readonly session: boolean
}

export interface ProviderRailProps {
  readonly options: readonly ProviderOption[]
  readonly current: string | null
  readonly stopIndex: number
  readonly busy: boolean
  readonly t: Translate
  readonly refs: MutableRefObject<(HTMLButtonElement | null)[]>
  readonly onPick: (id: string | null) => void
  readonly onEnterList: () => void
}

export function ProviderRail({
  options, current, stopIndex, busy, t, refs, onPick, onEnterList,
}: ProviderRailProps) {
  const usableOf = (): { option: ProviderOption; index: number }[] =>
    options.map((option, index) => ({ option, index })).filter(({ option }) => !option.failed)

  const move = (delta: number): void => {
    if (busy) return
    const usable = usableOf()
    if (usable.length === 0) return
    const active = usable.findIndex(({ index }) => refs.current[index] === document.activeElement)
    const next = active === -1
      ? (delta > 0 ? 0 : usable.length - 1)
      : (active + delta + usable.length) % usable.length
    const target = usable[next]
    if (target !== undefined) refs.current[target.index]?.focus()
  }

  const jump = (first: boolean): void => {
    if (busy) return
    const usable = usableOf()
    const target = usable[first ? 0 : usable.length - 1]
    if (target !== undefined) refs.current[target.index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing) return
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault()
        event.stopPropagation()
        move(event.key === 'ArrowDown' ? 1 : -1)
        return
      case 'Home':
      case 'End':
        event.preventDefault()
        event.stopPropagation()
        jump(event.key === 'Home')
        return
      case 'ArrowRight':
        event.preventDefault()
        event.stopPropagation()
        onEnterList()
        return
      case 'Enter':
      case ' ': {
        const index = refs.current.findIndex(element => element === document.activeElement)
        const option = index === -1 ? undefined : options[index]
        if (option === undefined || option.failed || busy) return
        event.preventDefault()
        event.stopPropagation()
        onPick(option.id)
        return
      }
      default:
    }
  }

  refs.current = []

  return (
    <div
      className="dmp-rail"
      role="listbox"
      aria-label={t('provider.group')}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => (
        <button
          key={option.id ?? 'all'}
          ref={(element) => { refs.current[index] = element }}
          type="button"
          role="option"
          aria-selected={option.id === current}
          aria-current={option.session ? 'true' : undefined}
          className="dmp-rail-row"
          tabIndex={index === stopIndex ? 0 : -1}
          disabled={busy || option.failed}
          title={option.label}
          onClick={() => { onPick(option.id) }}
        >
          <span className="dmp-rail-copy">
            <span className="dmp-rail-name">{option.label}</span>
          </span>
          {option.failed
            ? (
                <span className="dmp-provider-failed">
                  <span className="dmp-provider-failed-dot" aria-hidden="true" />
                  {t('provider.failed')}
                </span>
              )
            : <span className="dmp-provider-count zmd-num">{option.count}</span>}
        </button>
      ))}
    </div>
  )
}
