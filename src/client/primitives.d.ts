/**
 * Type boundary for the one DSH baseline package this plugin consumes.
 *
 * The browser bundle resolves `@deepseek-ai/dsh-client-ui-primitives` from the
 * shell's frozen module table at runtime (it is a `PLATFORM_MODULES` entry, so
 * baseline externals are implicit and must NOT be declared in the manifest).
 * The package is not installed in this repository, so the shapes this plugin
 * uses are declared here instead — mirroring `ui-primitives/src/index.ts` of
 * dsh 0.2.0-rc.2. Only the surface actually consumed is declared: an
 * entry point that grows a new primitive import must add it here, which keeps
 * the boundary visible in review.
 *
 * @module dsh-rabbit-model-picker/client/primitives
 */

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type {
    ComponentPropsWithoutRef, CSSProperties, InputHTMLAttributes, ReactElement, ReactNode, Ref, RefObject, SVGProps,
  } from 'react'

  /** Shared menu material; the portal/placement rules live with the caller. */
  export function MenuSurface(
    props: ComponentPropsWithoutRef<'div'> & {
      ref?: Ref<HTMLDivElement> | RefObject<HTMLDivElement | null> | undefined
    },
  ): ReactElement

  /** One labelled, sticky-headed menu group. */
  export function MenuGroup(props: { label: string; children?: ReactNode }): ReactElement

  /** Sticky-heading observer for a group viewport; returns its cleanup. */
  export function observeStickyMenuGroups(viewport: HTMLElement): () => void

  /** Single-line text input atom. */
  export function Input(
    props: InputHTMLAttributes<HTMLInputElement> & {
      icon?: ReactNode
      className?: string
      ref?: Ref<HTMLInputElement> | RefObject<HTMLInputElement | null> | undefined
    },
  ): ReactElement

  /** Loader/state indicator. */
  export function StateDot(props: {
    state: 'done' | 'warning' | 'ongoing' | 'error' | 'idle'
    size?: number
    className?: string
  }): ReactElement

  /** Controlled toggle switch; its accessible name is the caller's. */
  export function Switch(props: {
    checked: boolean
    onChange: (next: boolean) => void
    label: string
    disabled?: boolean
    title?: string
    className?: string
  }): ReactElement

  /** Palette selector of the read-only {@link Tag}. */
  export type TagTone = 'outline' | 'solid' | 'neutral' | 'quiet' | 'success' | 'info' | 'warning' | 'danger'

  /**
   * Read-only fact chip. It renders a `<span>` — supplying no handler cannot make
   * it interactive, which is what makes it the right atom for a badge that only
   * states a fact.
   */
  export function Tag(props: { tone?: TagTone; className?: string | undefined; children?: ReactNode }): ReactElement

  /** Transient banner, portaled to the body. */
  export function Toast(props: {
    text: string
    icon?: ReactNode
    anchor?: HTMLElement | null
    onDone: () => void
  }): ReactElement

  /** Hover/focus bubble anchored to one child element. */
  export function Tooltip(props: {
    label: string | (() => string)
    side?: 'right' | 'bottom' | 'top'
    align?: 'center' | 'end'
    gap?: number
    disabled?: boolean
    portal?: boolean
    children: ReactElement
  }): ReactElement

  /** Fixed placement of a portaled panel from its anchor rect. */
  export function useAnchoredPosition(options: {
    open: boolean
    anchorRef: RefObject<HTMLElement | null>
    panelRef: RefObject<HTMLElement | null>
    side?: 'top' | 'bottom'
    align?: 'start' | 'end'
    gap: number
    margin: number
  }): CSSProperties | null

  /** Fuzzy menu ranking: prefix hits, then alignment score, then source order. */
  export function rankByName<T extends { readonly name: string; readonly label?: string }>(
    items: readonly T[],
    rawQuery: string,
  ): readonly T[]

  /** Icon atoms (regular weight, currentColor). */
  type IconProps = SVGProps<SVGSVGElement> & { size?: number }
  export function IconCheckOutlineRegular(props: IconProps): ReactElement
  export function IconChevronDownOutlineRegular(props: IconProps): ReactElement
  export function IconCloseFillRegular(props: IconProps): ReactElement
  export function IconDataOutlineRegular(props: IconProps): ReactElement
  export function IconInfoOutlineRegular(props: IconProps): ReactElement
  export function IconSettingsOutlineRegular(props: IconProps): ReactElement
  export function IconWarningOutlineRegular(props: IconProps): ReactElement
}
