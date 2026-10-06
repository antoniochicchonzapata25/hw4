/**
 * Original Campus Customs collection seal: a gold stitched rosette with a navy star.
 * Drawn in SVG; it is not, and does not imitate, any Yale logo. It makes no licensing
 * claim. Used next to the plain-text "Yale campus collection" lines on the site.
 */

interface Props {
  size?: number
  /** Ring text around the seal (only legible at larger sizes). */
  withText?: boolean
  className?: string
}

const STAR = 'M32 20.5 L35.3 28.6 L44 29.2 L37.3 34.8 L39.4 43.3 L32 38.6 L24.6 43.3 L26.7 34.8 L20 29.2 L28.7 28.6 Z'

export default function CampusSeal({ size = 24, withText = false, className }: Props) {
  const small = size < 32
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={['campus-seal', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="31" fill="var(--gold)" />
      {!small && (
        <circle cx="32" cy="32" r="27.5" fill="none" stroke="var(--yale-900)" strokeWidth="1.2" strokeDasharray="2.4 2" opacity="0.55" />
      )}
      <circle cx="32" cy="32" r={withText ? 14.5 : small ? 21 : 19} fill="var(--cream)" />
      <path d={STAR} fill="var(--yale)" transform={withText ? 'translate(32 32) scale(0.62) translate(-32 -32)' : small ? 'translate(32 32) scale(1.05) translate(-32 -32)' : undefined} />
      {withText && (
        <>
          <defs>
            {/* ring starts at the left so the text reads clockwise across the top */}
            <path id="campus-seal-ring" d="M32 32 m-21.5 0 a21.5 21.5 0 1 1 43 0 a21.5 21.5 0 1 1 -43 0" />
          </defs>
          <text fontFamily="var(--varsity)" fontSize="4.3" fill="var(--yale-900)">
            {/* textLength spreads the letters evenly around the whole ring (2πr ≈ 135) */}
            <textPath href="#campus-seal-ring" startOffset="0" textLength="133" lengthAdjust="spacing">
              YALE CAMPUS COLLECTION ✦ NEW HAVEN ✦
            </textPath>
          </text>
        </>
      )}
    </svg>
  )
}
