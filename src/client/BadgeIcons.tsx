import type { ReactElement, ReactNode } from 'react'
import type { BadgeFact } from './facts.ts'

const BADGE_STROKE = 1.6

export interface BadgeIconProps {
  readonly fact: BadgeFact
  readonly size?: number
  readonly className?: string
}

const FRAME = 'M3 2.5 H13 V13.5 H3 Z'

function artworkOf(fact: BadgeFact): ReactNode {
  switch (fact) {
    case 'text':
      return (
        <>
          <path d={FRAME} />
          <path d="M5.4 6.6 H10.6" />
          <path d="M5.4 9.8 H10.6" />
        </>
      )
    case 'image':
      return (
        <>
          <path d={FRAME} />
          <path d="M4.8 11.2 L6.9 8.4 L8.4 10.2 L10.2 8.1 L11.2 11.2" />
        </>
      )
    case 'effort':
      return (
        <>
          <path d={FRAME} />
          <path d="M5.6 10.6 V9.4" />
          <path d="M8 10.6 V7.6" />
          <path d="M10.4 10.6 V5.8" />
        </>
      )
    case 'context':
      return (
        <>
          <path d={FRAME} />
          <path d="M6.4 5.8 H5.4 V10.6 H6.4" />
          <path d="M9.6 5.8 H10.6 V10.6 H9.6" />
        </>
      )
  }
}

export function BadgeIcon({ fact, size = 14, className }: BadgeIconProps): ReactElement {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={BADGE_STROKE}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {artworkOf(fact)}
    </svg>
  )
}
