import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ProductCard, { cardFromChat } from '../components/ProductCard'
import { useChat } from './ChatContext'

/**
 * "From your chat" panel above the current page: the agent's latest product matches,
 * rendered with the same ProductCard component (and detail links) as the Products page.
 */
export default function ChatResultsPanel() {
  const { results, clearResults } = useChat()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const ref = useRef<HTMLElement>(null)

  // New results: expand and bring the panel into view.
  const version = results?.version
  useEffect(() => {
    if (version === undefined) return
    setCollapsed(false)
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [version])

  // Opening a product page from the results: tuck the panel away so the product is visible.
  useEffect(() => {
    if (pathname.startsWith('/products/')) setCollapsed(true)
  }, [pathname])

  if (!results || results.products.length === 0) return null
  const count = results.products.length

  return (
    <section ref={ref} className="chat-results" aria-label="Products from your chat">
      <div className="container">
        <div className="chat-results__head">
          <div>
            <p className="eyebrow">From your chat</p>
            <h2 className="chat-results__title">
              {count} {count === 1 ? 'match' : 'matches'} for “{results.query}”
            </h2>
          </div>
          <div className="chat-results__actions">
            <button
              type="button"
              className="btn btn--small btn--ghost"
              onClick={() => setCollapsed((v) => !v)}
              aria-expanded={!collapsed}
            >
              {collapsed ? 'Show' : 'Hide'}
            </button>
            <button type="button" className="btn btn--small btn--ghost" onClick={clearResults} aria-label="Clear chat results">
              Clear
            </button>
          </div>
        </div>
        {!collapsed && (
          <div className="product-grid chat-results__grid">
            {results.products.map((p) => (
              <ProductCard key={p.product_id} product={cardFromChat(p)} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
