
// Shapes consumed from a DSH baseline package: the browser bundle resolves it from the
// shell's frozen module table at runtime (baseline externals are implicit), so it must NOT
// be added to `dsh.client.external`. Only the consumed surface is declared here.
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type {
    ComponentPropsWithoutRef, CSSProperties, InputHTMLAttributes, ReactElement, ReactNode, Ref, RefObject, SVGProps,
  } from 'react'

  export function MenuSurface(
    props: ComponentPropsWithoutRef<'div'> & {
      ref?: Ref<HTMLDivElement> | RefObject<HTMLDivElement | null> | undefined
    },
  ): ReactElement

  export function MenuGroup(props: { label: string; children?: ReactNode }): ReactElement

  export function observeStickyMenuGroups(viewport: HTMLElement): () => void

  export function Input(
    props: InputHTMLAttributes<HTMLInputElement> & {
      icon?: ReactNode
      className?: string
      ref?: Ref<HTMLInputElement> | RefObject<HTMLInputElement | null> | undefined
    },
  ): ReactElement

  export function StateDot(props: {
    state: 'done' | 'warning' | 'ongoing' | 'error' | 'idle'
    size?: number
    className?: string
  }): ReactElement

  export function Switch(props: {
    checked: boolean
    onChange: (next: boolean) => void
    label: string
    disabled?: boolean
    title?: string
    className?: string
  }): ReactElement

  export type TagTone = 'outline' | 'solid' | 'neutral' | 'quiet' | 'success' | 'info' | 'warning' | 'danger'

  export function Tag(props: { tone?: TagTone; className?: string | undefined; children?: ReactNode }): ReactElement

  export function Toast(props: {
    text: string
    icon?: ReactNode
    anchor?: HTMLElement | null
    onDone: () => void
  }): ReactElement

  export function Tooltip(props: {
    label: string | (() => string)
    side?: 'right' | 'bottom' | 'top'
    align?: 'center' | 'end'
    gap?: number
    disabled?: boolean
    portal?: boolean
    children: ReactElement
  }): ReactElement

  export function useAnchoredPosition(options: {
    open: boolean
    anchorRef: RefObject<HTMLElement | null>
    panelRef: RefObject<HTMLElement | null>
    side?: 'top' | 'bottom'
    align?: 'start' | 'end'
    gap: number
    margin: number
  }): CSSProperties | null

  export function rankByName<T extends { readonly name: string; readonly label?: string }>(
    items: readonly T[],
    rawQuery: string,
  ): readonly T[]

  type IconProps = SVGProps<SVGSVGElement> & { size?: number }
  export function IconCheckOutlineRegular(props: IconProps): ReactElement
  export function IconChevronDownOutlineRegular(props: IconProps): ReactElement
  export function IconCloseFillRegular(props: IconProps): ReactElement
  export function IconDataOutlineRegular(props: IconProps): ReactElement
  export function IconInfoOutlineRegular(props: IconProps): ReactElement
  export function IconSettingsOutlineRegular(props: IconProps): ReactElement
  export function IconWarningOutlineRegular(props: IconProps): ReactElement
}
