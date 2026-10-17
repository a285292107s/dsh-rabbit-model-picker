/**
 * The badge icon family: four square technical glyphs for the four model facts a
 * row states.
 *
 * WHY THIS ARTWORK IS DRAWN HERE. The host icon set
 * (`@deepseek-ai/dsh-client-ui-primitives`) ships no text-modality and no
 * image-modality glyph at all, and borrowing the two that do fit the other
 * facts would put two drawing styles in one 113px strip. So all four are drawn
 * here in one hand.
 *
 * THE LANGUAGE (docs/endfield-design-language.md §4.5). One grammar for the
 * whole family: a 1px square FRAME with the fact drawn inside it, on one 16-unit
 * grid, at one stroke weight. The frame is the "instrument face" of the row: it
 * is what makes four different little marks read as four cells of one console
 * rather than four borrowed icons. Square caps and mitred joins are deliberate —
 * the HUD language is all right angles, and a rounded cap on a 1px line is the
 * one place the old family still looked like a different product.
 *
 *   text    the frame, two horizontal lines of copy inside it.
 *   image   the frame, a mountain (two peaks) inside it.
 *   effort  the frame, three ascending short bars inside it — the reasoning
 *           column states that the model can think, and three rising bars are
 *           the neutral technical mark for "levels" rather than a metaphor.
 *   context the frame, two facing proportion brackets inside it — the window as
 *           a measured span, not a picture frame (which would collide with the
 *           text glyph's outline).
 *
 * THE FOUR GLYPHS SHARE ONE GRID AND ONE WEIGHT, so every cell of the strip is
 * the same optical object. `BADGE_STROKE` is the only weight constant: on the
 * 16-unit viewBox rendered at 14px it draws 1.4px, which is the line the
 * surrounding host iconography uses (`1.6 × 14/16 = 1.4`).
 *
 * ONLY THE "HAS THIS FACT" STATE HAS A GLYPH. The row drops every `off` fact
 * before drawing the strip (`specs.filter(spec => !spec.off)`), so absence is
 * stated by the empty track and by the row's `aria-label`/`title` sentence.
 * There is no slashed variant, by construction.
 *
 * @module dsh-rabbit-model-picker/client/BadgeIcons
 */

import type { ReactElement, ReactNode } from 'react'
import type { BadgeFact } from './facts.ts'

/** Stroke width on the shared 16-unit grid, chosen for a ~14px render (1.4px on screen). */
const BADGE_STROKE = 1.6

/** Props of {@link BadgeIcon}. */
export interface BadgeIconProps {
  /** Which fact the badge states. */
  readonly fact: BadgeFact
  /** Square edge in px; the badges run the family at 14 so the strip reads at a glance. */
  readonly size?: number
  /** Layout class from the render site. */
  readonly className?: string
}

/**
 * The frame every glyph sits in: an 11-unit square, centred in the 16-unit box.
 *
 * It is stated once here rather than copied into four artworks, because the four
 * marks are four INTERIORS of one object — the moment one of them spells its own
 * frame they stop agreeing on the plane they sit on.
 */
const FRAME = 'M3 2.5 H13 V13.5 H3 Z'

/**
 * The strokes of one glyph.
 * @param fact - which fact the badge states.
 * @returns the glyph's paths.
 */
function artworkOf(fact: BadgeFact): ReactNode {
  switch (fact) {
    case 'text':
      // Two lines of copy inside the frame.
      return (
        <>
          <path d={FRAME} />
          <path d="M5.4 6.6 H10.6" />
          <path d="M5.4 9.8 H10.6" />
        </>
      )
    case 'image':
      // A mountain profile: two peaks over a baseline, framed.
      return (
        <>
          <path d={FRAME} />
          <path d="M4.8 11.2 L6.9 8.4 L8.4 10.2 L10.2 8.1 L11.2 11.2" />
        </>
      )
    case 'effort':
      // Three ascending short bars: the neutral technical mark for levels.
      return (
        <>
          <path d={FRAME} />
          <path d="M5.6 10.6 V9.4" />
          <path d="M8 10.6 V7.6" />
          <path d="M10.4 10.6 V5.8" />
        </>
      )
    case 'context':
      // Two facing proportion brackets: a measured span inside the frame.
      return (
        <>
          <path d={FRAME} />
          <path d="M6.4 5.8 H5.4 V10.6 H6.4" />
          <path d="M9.6 5.8 H10.6 V10.6 H9.6" />
        </>
      )
  }
}

/**
 * Render one badge glyph.
 * @param props - see {@link BadgeIconProps}.
 * @returns the inline SVG; it is decorative, the surrounding badge carries the copy.
 */
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
