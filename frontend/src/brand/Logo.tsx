/**
 * Campus Customs identity: "The Stitched C".
 *
 * A heavy varsity-block C with a second, smaller C sewn inside it as a running stitch.
 * Two Cs = Campus Customs; the stitch = custom embroidery and chenille-patch lettering.
 * It reads as a monogram without spelling "CC" or sitting inside a badge.
 * Drawn in SVG so it stays crisp from 16 px (favicon) to hero size.
 */

/** Outer C: a ring segment with flat, radially cut terminals (open 84° to the right). */
const OUTER_C = 'M52.44 13.6 A27.5 27.5 0 1 0 52.44 50.4 L44.63 43.38 A17 17 0 1 1 44.63 20.62 Z'
/** Inner C: the stitched line, centred in the outer C's counter. */
const INNER_C = 'M39.2 25.6 A9 9 0 1 0 39.2 38.4'

type Tone = 'color' | 'reverse' | 'mono'

interface MarkProps {
  size?: number
  /**
   * "color": navy C + gold stitch (light backgrounds, default)
   * "reverse": cream C + gold stitch (dark backgrounds)
   * "mono": everything in currentColor (one-colour use)
   */
  tone?: Tone
  className?: string
  title?: string
}

const TONES: Record<Tone, { c: string; stitch: string }> = {
  color: { c: 'var(--yale)', stitch: 'var(--gold)' },
  reverse: { c: 'var(--cream)', stitch: 'var(--gold)' },
  mono: { c: 'currentColor', stitch: 'currentColor' },
}

export function LogoMark({ size = 40, tone = 'color', className, title }: MarkProps) {
  const { c, stitch } = TONES[tone]
  const small = size < 28 // at tiny sizes the stitch becomes one solid line so it doesn't blur
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={['logo-mark', className].filter(Boolean).join(' ')}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={OUTER_C} fill={c} />
      {small ? (
        <path d="M38.5 27 A7.6 7.6 0 1 0 38.5 37" fill="none" stroke={stitch} strokeWidth="4.6" strokeLinecap="round" />
      ) : (
        <path
          className="logo-mark__stitch"
          d={INNER_C}
          fill="none"
          stroke={stitch}
          strokeWidth="2.6"
          strokeDasharray="2.8 2.3"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

/** Full lockup: mark + stacked wordmark ("CAMPUS" varsity caps over "Customs" italic serif). */
export function Logo({
  size = 44,
  tagline = true,
  tone = 'color',
}: {
  size?: number
  tagline?: boolean
  tone?: Exclude<Tone, 'mono'>
}) {
  return (
    <span className={`logo logo--${tone}`}>
      <LogoMark size={size} tone={tone} />
      <span className="logo__text">
        <span className="logo__campus">Campus</span>
        <span className="logo__customs">Customs</span>
        {tagline && <span className="logo__tag">Yale apparel · New Haven</span>}
      </span>
    </span>
  )
}
