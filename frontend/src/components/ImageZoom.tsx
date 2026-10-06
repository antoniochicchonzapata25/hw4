import { useEffect, useState, type MouseEvent, type PointerEvent } from 'react'

interface Props {
  src: string
  alt: string
}

const HOVER_SCALE = 2
const ZOOM_LEVELS = [1, 2, 3]

/** Percent position of a pointer inside an element, for transform-origin. */
function originFrom(e: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect()
  const x = ((e.clientX - r.left) / r.width) * 100
  const y = ((e.clientY - r.top) / r.height) * 100
  return `${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`
}

/**
 * Large product image.
 * - Desktop: hover magnifies the area under the cursor.
 * - Click / tap (or the button): opens a full-screen viewer with click-to-zoom and pan.
 */
export default function ImageZoom({ src, alt }: Props) {
  const [hoverOrigin, setHoverOrigin] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  return (
    <>
      <div className="zoom">
        <button
          type="button"
          className="zoom__frame"
          onMouseMove={(e) => setHoverOrigin(originFrom(e))}
          onMouseLeave={() => setHoverOrigin(null)}
          onClick={() => setViewerOpen(true)}
          aria-label={`Open full-screen zoom for ${alt}`}
        >
          <img
            src={src}
            alt={alt}
            className="zoom__img print__img"
            style={
              hoverOrigin
                ? { transform: `scale(${HOVER_SCALE})`, transformOrigin: hoverOrigin }
                : undefined
            }
          />
        </button>
        <button type="button" className="zoom__hint" onClick={() => setViewerOpen(true)}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm-1 2h2v2h2v2h-2v2H9v-2H7V9h2z"
              fill="currentColor"
            />
          </svg>
          Click to zoom
        </button>
      </div>
      {viewerOpen && <ZoomViewer src={src} alt={alt} onClose={() => setViewerOpen(false)} />}
    </>
  )
}

function ZoomViewer({ src, alt, onClose }: Props & { onClose: () => void }) {
  const [level, setLevel] = useState(0)
  const [origin, setOrigin] = useState('50% 50%')
  const scale = ZOOM_LEVELS[level]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setLevel((l) => Math.min(l + 1, ZOOM_LEVELS.length - 1))
      if (e.key === '-') setLevel((l) => Math.max(l - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`Zoomed view of ${alt}`} onClick={onClose}>
      <div className="viewer__toolbar" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setLevel((l) => Math.max(l - 1, 0))}
          disabled={level === 0}
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="viewer__level">{scale}×</span>
        <button
          type="button"
          onClick={() => setLevel((l) => Math.min(l + 1, ZOOM_LEVELS.length - 1))}
          disabled={level === ZOOM_LEVELS.length - 1}
          aria-label="Zoom in"
        >
          +
        </button>
        <button type="button" onClick={onClose} aria-label="Close zoom" className="viewer__close">
          ×
        </button>
      </div>
      <div
        className={`viewer__stage ${scale > 1 ? 'viewer__stage--zoomed' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setOrigin(originFrom(e))
          setLevel((l) => (l + 1) % ZOOM_LEVELS.length)
        }}
        onPointerMove={(e) => scale > 1 && setOrigin(originFrom(e))}
      >
        <img
          src={src}
          alt={alt}
          className="viewer__img"
          style={{ transform: `scale(${scale})`, transformOrigin: origin }}
          draggable={false}
        />
      </div>
      <p className="viewer__help">Click the image to zoom · move to pan · Esc to close</p>
    </div>
  )
}
