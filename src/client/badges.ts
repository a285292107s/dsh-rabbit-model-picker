import type { ModelReasoning, RouteAddress, RouteCapability, Translate } from './contract.ts'
import type { BadgeFact } from './facts.ts'
import { formatWindow } from './format.ts'

export type { BadgeFact }

export const BADGE_FACTS: readonly BadgeFact[] = ['text', 'image', 'effort', 'context']

export interface BadgeSpec {
  readonly fact: BadgeFact
  readonly off: boolean
  readonly value: string
  readonly sentence: string
}

export interface BadgeInput {
  readonly address: RouteAddress | null
  readonly capability?: RouteCapability | undefined
  readonly reasoning: ModelReasoning | undefined
  readonly t: Translate
}

function modalitiesOf(
  address: RouteAddress | null, capability: RouteCapability | undefined,
): readonly string[] | undefined {
  if (address !== null && address.input.length > 0) return address.input
  if (capability?.inputModalities !== undefined && capability.inputModalities.length > 0) {
    return capability.inputModalities
  }
  if (address !== null && address.defaultInput.length > 0) return address.defaultInput
  return undefined
}

function capacityOf(
  address: RouteAddress | null, capability: RouteCapability | undefined,
): number | undefined {
  return address?.contextWindow ?? capability?.contextWindow ?? address?.defaultContextWindow
}

export function badgeSpecsOf({ address, capability, reasoning, t }: BadgeInput): BadgeSpec[] {
  const specs: BadgeSpec[] = []

  const modalities = modalitiesOf(address, capability)

  const text = modalities === undefined || modalities.includes('text')
  specs.push({
    fact: 'text',
    off: !text,
    value: '',
    sentence: t(text ? 'badge.text.on' : 'badge.text.off'),
  })

  const image = modalities !== undefined && modalities.includes('image')
  specs.push({
    fact: 'image',
    off: !image,
    value: '',
    sentence: t(image ? 'badge.image.on' : 'badge.image.off'),
  })

  if (reasoning === undefined) {
    specs.push({ fact: 'effort', off: true, value: '', sentence: t('badge.effort.off') })
  } else {
    specs.push({ fact: 'effort', off: false, value: '', sentence: t('badge.effort.on') })
  }

  const capacity = capacityOf(address, capability)
  if (capacity !== undefined) {
    const value = formatWindow(capacity)
    if (value !== '') {
      specs.push({ fact: 'context', off: false, value, sentence: t('badge.context', { value }) })
    }
  }

  return specs
}
