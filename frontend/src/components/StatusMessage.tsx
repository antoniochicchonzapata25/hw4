import type { ReactNode } from 'react'

interface Props {
  kind: 'loading' | 'error' | 'empty'
  children: ReactNode
}

export default function StatusMessage({ kind, children }: Props) {
  return (
    <div className={`status status--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'loading' && <span className="spinner" aria-hidden="true" />}
      <span>{children}</span>
    </div>
  )
}
