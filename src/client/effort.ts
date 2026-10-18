
import type { ModelReasoning, Translate } from './contract.ts'

export interface EffortChoice {
  readonly key: string
  readonly effort: string | undefined
  readonly label: string
}

export function effortLabelOf(reasoning: ModelReasoning, effort: string | undefined, t: Translate): string {
  if (effort === undefined) return t('effort.providerDefault')
  return reasoning.efforts.find(level => level.id === effort)?.name ?? effort
}

export function effortChoicesOf(reasoning: ModelReasoning, t: Translate): EffortChoice[] {
  return [
    ...reasoning.defaultEffort === undefined
      ? [{ key: 'provider-default', effort: undefined, label: t('effort.providerDefault') }]
      : [],
    ...reasoning.efforts.map(level => ({ key: `effort:${level.id}`, effort: level.id, label: level.name })),
  ]
}
