import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProducts } from '../api/useProducts'
import ProductCard, { cardFromProduct } from '../components/ProductCard'
import StatusMessage from '../components/StatusMessage'

// Quick filters: each is just a search query, so they use the same matching as typed searches.
const CATEGORIES = [
  { label: 'All', query: '' },
  { label: 'Hoodies', query: 'hoodies' },
  { label: 'Crewnecks', query: 'crewnecks' },
  { label: 'T-shirts', query: 't-shirts' },
  { label: 'Quarter-zips', query: 'quarter zips' },
  { label: 'Jackets & fleece', query: 'jackets' },
]

const DEBOUNCE_MS = 250

export default function ProductsPage() {
  // The search lives in the URL (?q=hoodies), so results can be shared, bookmarked and kept on Back.
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [draft, setDraft] = useState(query)
  const { data: products, error, loading } = useProducts(query)

  // Keep the box in sync when the URL changes (Back button, category click).
  useEffect(() => {
    setDraft(query)
  }, [query])

  // Search as the shopper types, after a short pause.
  useEffect(() => {
    const next = draft.trim()
    if (next === query) return
    const t = setTimeout(() => setParams(next ? { q: next } : {}, { replace: true }), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [draft, query, setParams])

  function setQuery(q: string) {
    setDraft(q)
    setParams(q ? { q } : {}, { replace: true })
  }

  const activeCategory = CATEGORIES.find((c) => c.query === query)

  return (
    <>
      <section className="page-banner">
        <div className="container">
          <p className="eyebrow eyebrow--light">The collection</p>
          <h1 className="page-banner__title">All products</h1>
          <p className="page-banner__text">
            Hoodies, crewnecks, tees, quarter-zips and jackets for every corner of campus.
          </p>
        </div>
      </section>

      <section className="section container">
        <div className="product-search">
          <form
            className="product-search__form"
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              setQuery(draft.trim())
            }}
          >
            <label htmlFor="product-search" className="visually-hidden">
              Search products
            </label>
            <svg className="product-search__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"
                fill="currentColor"
              />
            </svg>
            <input
              id="product-search"
              type="search"
              className="product-search__input"
              placeholder="Search: hoodies, navy quarter zip, hockey, Branford…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="off"
              maxLength={100}
            />
            {draft && (
              <button type="button" className="product-search__clear" onClick={() => setQuery('')} aria-label="Clear search">
                ×
              </button>
            )}
          </form>
          <div className="product-search__chips" role="group" aria-label="Filter by category">
            {CATEGORIES.map((c) => (
              <button
                key={c.label}
                type="button"
                className={`filter-chip ${activeCategory === c ? 'filter-chip--active' : ''}`}
                aria-pressed={activeCategory === c}
                onClick={() => setQuery(c.query)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {error && <StatusMessage kind="error">Couldn't load products: {error}</StatusMessage>}
        {!products && loading && <StatusMessage kind="loading">Loading the catalogue…</StatusMessage>}
        {products && products.length === 0 && (
          <div className="no-results">
            <h2>No products match “{query}”</h2>
            <p>Try a simpler word like “hoodie”, a sport, a college, or a colour.</p>
            <button type="button" className="btn btn--primary" onClick={() => setQuery('')}>
              Show all products
            </button>
          </div>
        )}
        {products && products.length > 0 && (
          <>
            <p className="results-count" aria-live="polite">
              {query ? `${products.length} ${products.length === 1 ? 'result' : 'results'} for “${query}”` : `${products.length} products`}
              {loading && ' · updating…'}
            </p>
            <div className={`product-grid ${loading ? 'product-grid--loading' : ''}`}>
              {products.map((p) => (
                <ProductCard key={p.product_id} product={cardFromProduct(p)} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  )
}
