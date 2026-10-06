/**
 * "Dan", the Campus Customs shopping bulldog: an original cartoon inspired by Yale's
 * bulldog mascot, drawn in SVG (no raster image). Used as the chatbot's face.
 * Bulldog cues: wide flat head, small folded "rose" ears, heavy jowls, big nose, underbite.
 */

interface Props {
  size?: number
  /** "happy" (default) or "thinking" (eyes glance up, for the typing indicator). */
  mood?: 'happy' | 'thinking'
  className?: string
  title?: string
}

export default function Dan({ size = 48, mood = 'happy', className, title }: Props) {
  const lookUp = mood === 'thinking' ? -1.8 : 0
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* Folded rose ears */}
      <path d="M22 30 Q8 27 9 43 Q17 41 27 35 Z" fill="#7a5a43" stroke="var(--dan-line)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M78 30 Q92 27 91 43 Q83 41 73 35 Z" fill="#7a5a43" stroke="var(--dan-line)" strokeWidth="2.4" strokeLinejoin="round" />

      {/* Wide, flat-topped head */}
      <path
        d="M50 22 C71 22 86 28 88 46 C90 60 86 70 80 77 C72 86 61 90 50 90 C39 90 28 86 20 77 C14 70 10 60 12 46 C14 28 29 22 50 22 Z"
        fill="#f7efe3"
        stroke="var(--dan-line)"
        strokeWidth="2.6"
      />
      {/* Brindle patch */}
      <path d="M58 31 C70 29 80 35 80 46 C72 50 62 48 58 42 Z" fill="#c9a27a" />
      {/* Forehead wrinkles + brows */}
      <path
        d="M38 30 Q50 26 62 30 M42 35 Q50 32 58 35 M28 41 Q34 38 41 40 M59 40 Q66 38 72 41"
        fill="none"
        stroke="var(--dan-line)"
        strokeWidth="1.9"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Eyes, set wide */}
      <g transform={`translate(0 ${lookUp})`}>
        <circle cx="35" cy="48" r="5" fill="var(--dan-line)" />
        <circle cx="65" cy="48" r="5" fill="var(--dan-line)" />
        <circle cx="36.8" cy="46.3" r="1.6" fill="#fff" />
        <circle cx="66.8" cy="46.3" r="1.6" fill="#fff" />
      </g>

      {/* Heavy jowls (two lobes) */}
      <path
        d="M50 57 C40 53 23 57 23 69 C23 81 37 83 45 77 L50 75 L55 77 C63 83 77 81 77 69 C77 57 60 53 50 57 Z"
        fill="#fffaf2"
        stroke="var(--dan-line)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Big nose */}
      <path d="M39 57 Q50 50 61 57 Q61 64 50 66 Q39 64 39 57 Z" fill="var(--dan-line)" />
      <ellipse cx="46" cy="56.6" rx="3" ry="1.3" fill="#fff" opacity="0.5" />
      <path d="M50 66 L50 71" stroke="var(--dan-line)" strokeWidth="2" strokeLinecap="round" />

      {/* Underbite: lower jaw with two little fangs pointing up */}
      <path d="M39 76 Q50 89 61 76 Q50 81 39 76 Z" fill="#3a2626" stroke="var(--dan-line)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M42.6 78.6 L44 73.6 L45.8 79.6 Z M54.2 79.6 L56 73.6 L57.4 78.6 Z" fill="#fff" stroke="var(--dan-line)" strokeWidth="1.1" strokeLinejoin="round" />

      {/* Cheek blush */}
      <ellipse cx="22" cy="61" rx="4.2" ry="2.4" fill="#f2a7a0" opacity="0.45" />
      <ellipse cx="78" cy="61" rx="4.2" ry="2.4" fill="#f2a7a0" opacity="0.45" />

      {/* Navy collar with gold tag */}
      <path d="M24 85 Q50 96 76 85 L78 90.5 Q50 102 22 90.5 Z" fill="var(--yale)" stroke="var(--dan-line)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="50" cy="94.4" r="4" fill="var(--gold)" stroke="var(--dan-line)" strokeWidth="1.4" />
    </svg>
  )
}
