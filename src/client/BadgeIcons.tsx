/**
 * The badge icon family: four line glyphs for the four model facts a row states.
 *
 * WHY THIS ARTWORK IS DRAWN HERE. The host icon set
 * (`@deepseek-ai/dsh-client-ui-primitives`) ships no text-modality and no
 * image-modality glyph at all, and borrowing the two that do fit the other
 * facts would put two drawing styles in one ~170px strip. So all four are drawn
 * to the host's own rules — `fill="none"`, `currentColor`, round caps and joins,
 * one `viewBox` for the family — which is what makes the strip read as part of
 * the shell.
 *
 * THE FOUR GLYPHS, and the metaphor each one commits to. The text and image
 * marks follow the reference style the user pointed at (commandcode.ai): a page
 * for text, an eye for vision — both drawn here on the same 16 grid, one weight.
 *
 *   text    a page with a folded corner and two lines of text: the document
 *           itself, the mark the reference uses for "Text input". It replaced an
 *           earlier bare letterform "T", which in a zh UI read as the CJK
 *           character 工.
 *   image   an eye: the reference's "Vision" mark for image input.
 *   effort  a brain's silhouette, the two lobes meeting at a stem — the mark the
 *           rest of this product already uses for "thinking" (the chat's
 *           reasoning disclosure and the composer's own effort chip), and the
 *           same mark the reference uses for "Reasoning". Drawn
 *           from the same 24-unit artwork the host ships for that mark, so a
 *           reader who has seen a thinking row recognises this one. Earlier
 *           versions used three ascending bars, which said "how many levels" and
 *           nothing about what they were levels *of*.
 *   context a window: a rounded frame with its title bar and one line of
 *           content inside. Chosen over the width/span marks (`[—]`, `|—|`) that
 *           were tried first, because those read as a minus sign at small sizes
 *           while this one says 窗口/window outright — and it stays distinct
 *           from the image glyph, which is an eye, not a frame.
 *
 * ONLY THE "HAS THIS FACT" STATE HAS A GLYPH. There used to be a second state —
 * the same glyph with a diagonal "not available" slash, minus the detail that
 * turned to mush under it, in the quiet tone — and it is gone, because nothing
 * ever rendered it: the row drops every `off` fact before drawing the strip
 * (`specs.filter(spec => !spec.off)`, so the four tracks show only what the
 * model HAS, and the absence is stated by the row's `aria-label` and `title`
 * instead). Colour was never the only signal even then. A missing ability is
 * therefore not drawn at all — see the `off` field of `BadgeSpec` for the data
 * half, which the aria sentence still uses.
 *
 * THE GRID. The first three glyphs are drawn on the host's 16-unit grid, which
 * is the grid the icons around them use; the brain is the host's own 24-unit
 * artwork and keeps its own `viewBox`. Both are square and both fill their box,
 * and every glyph carries an explicit `stroke-width` in ITS OWN user units so
 * the family draws one weight on screen: at the row's 14px a 1.6-unit stroke on
 * the 16 grid and a 2.4-unit stroke on the 24 grid both land on 1.4px. (The
 * brain's own 2 units would draw 1.17px — 17% lighter than its three
 * neighbours, which is visible as a thinner mark in the same strip. Inheriting
 * the host's 1px would be worse still: 0.58px across 24 units.)
 *
 * @module dsh-rabbit-model-picker/client/BadgeIcons
 */

import type { ReactElement, ReactNode } from 'react'
import type { BadgeFact } from './facts.ts'

/** Stroke width on the 16-unit grid, chosen for a ~14px render (see the module note). */
const BADGE_STROKE = 1.6

/**
 * The brain keeps the host's 24-unit artwork, so it needs its own weight: 1.6
 * units of a 16-unit box is 0.1 of the side, and 0.1 of 24 units is 2.4. That
 * makes all four glyphs draw the same 1.4px at the row's 14px.
 */
const BRAIN_STROKE = 2.4

/** The brain: two lobes around a stem, the mark this product already uses for thinking. */
const BRAIN: readonly string[] = [
  'M3.87326 10.9728C3.65146 10.5059 3.52734 9.98359 3.52734 9.43228C3.52734 7.71144 4.73657 6.27302 6.35167 5.92041',
  'M20.1268 10.9728C20.3487 10.5059 20.4728 9.98359 20.4728 9.43228C20.4728 7.71144 19.2635 6.27302 17.6484 5.92041',
  'M5.58108 10.9731C3.87945 10.9731 2.5 12.3526 2.5 14.0542C2.5 15.7559 3.87945 17.1353 5.58108 17.1353C6.03924 17.1353 6.47405 17.0353 6.86486 16.8559L7.37838 16.6218',
  'M18.4184 10.9731C20.12 10.9731 21.4995 12.3526 21.4995 14.0542C21.4995 15.7559 20.12 17.1353 18.4184 17.1353C17.9602 17.1353 17.5254 17.0353 17.1346 16.8559L16.6211 16.6218',
  'M12.0013 5.22866C12.0013 3.73973 10.7943 2.53271 9.30532 2.53271C7.81639 2.53271 6.60938 3.73973 6.60938 5.22866C6.60938 6.11056 7.03282 6.89355 7.68749 7.38542',
  'M12 5.19595C12 3.70702 13.207 2.5 14.6959 2.5C16.1849 2.5 17.3919 3.70702 17.3919 5.19595C17.3919 6.07784 16.9684 6.86084 16.3138 7.3527',
  'M12 5.06738V17.6485',
  'M11.9996 17.6488C11.9996 19.7758 10.2753 21.5001 8.14823 21.5001C6.02118 21.5001 4.29688 19.7758 4.29688 17.6488V17.1353',
  'M12 17.6488C12 19.7758 13.7243 21.5001 15.8514 21.5001C17.9784 21.5001 19.7027 19.7758 19.7027 17.6488V17.1353',
]

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
 * The strokes of one glyph.
 * @param fact - which fact the badge states.
 * @returns the glyph's paths.
 */
function artworkOf(fact: BadgeFact): ReactNode {
  switch (fact) {
    case 'text':
      // A page with a folded corner and two lines of text — the site's "Text
      // input" mark.
      return (
        <>
          <path d="M5.4 2.5 H8.5 L12 6 V12.1 A1.4 1.4 0 0 1 10.6 13.5 H5.4 A1.4 1.4 0 0 1 4 12.1 V3.9 A1.4 1.4 0 0 1 5.4 2.5 Z" />
          <path d="M8.5 2.5 V6 H12" />
          <path d="M6.5 9 H9.5" />
          <path d="M6.5 11 H9.5" />
        </>
      )
    case 'image':
      // An eye — the site's "Vision" mark for image input.
      return (
        <>
          <path d="M2.75 8 C4.6 4.8 6.5 3.5 8 3.5 C9.5 3.5 11.4 4.8 13.25 8 C11.4 11.2 9.5 12.5 8 12.5 C6.5 12.5 4.6 11.2 2.75 8 Z" />
          <circle cx="8" cy="8" r="1.6" />
        </>
      )
    case 'effort':
      return <>{BRAIN.map(path => <path key={path} d={path} />)}</>
    case 'context':
      return (
        <>
          <rect x="2.75" y="3.75" width="10.5" height="8.5" rx="1.5" />
          {/* Title bar: the line that makes the frame a window rather than a picture. */}
          <path d="M2.75 6.5 H13.25" />
          <path d="M5.1 8.9 H10.9" />
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
  // The brain keeps the host's 24-unit artwork (and its own stroke weight); the
  // other three are drawn on the 16-unit grid the icons around them use.
  const brain = fact === 'effort'
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={brain ? '0 0 24 24' : '0 0 16 16'}
      fill="none"
      stroke="currentColor"
      strokeWidth={brain ? BRAIN_STROKE : BADGE_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {artworkOf(fact)}
    </svg>
  )
}
