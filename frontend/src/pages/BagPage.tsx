import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../api/format'
import { MAX_PER_LINE, useBag } from '../bag/BagContext'
import { quoteBag, type BagQuote } from '../bag/bagApi'
import StatusMessage from '../components/StatusMessage'

/** Shopping bag: a list of chosen items with live prices. Not a checkout. */
export default function BagPage() {
  const { items, setQuantity, remove } = useBag()
  const [quote, setQuote] = useState<BagQuote | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Re-price whenever the bag changes, so prices and stock always come from the database.
  useEffect(() => {
    if (items.length === 0) {
      setQuote({ lines: [], item_count: 0, subtotal: 0 })
      return
    }
    let active = true
    quoteBag(items)
      .then((q) => {
        if (active) {
          setQuote(q)
          setError(null)
        }
      })
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [items])

  // If stock dropped below what's in the bag, lower the bag to what can actually be bought.
  useEffect(() => {
    quote?.lines.forEach((l) => {
      if (l.available && l.requested_quantity && l.quantity < l.requested_quantity) {
        setQuantity(l.product_id, l.size, l.quantity)
      }
    })
  }, [quote, setQuantity])

  return (
    <section className="section container bag">
      <div className="bag__head">
        <h1 className="section__title">Your bag</h1>
        <Link to="/products" className="link-arrow">
          ← Continue shopping
        </Link>
      </div>

      <p className="bag__notice" role="note">
        This bag is a shopping list to help you plan. Online checkout isn’t available yet, so no order
        has been placed and nothing has been charged or reserved. Visit us at 57 Broadway to buy.
      </p>

      {error && <StatusMessage kind="error">Couldn’t load prices: {error}</StatusMessage>}
      {!quote && !error && <StatusMessage kind="loading">Loading your bag…</StatusMessage>}

      {quote && items.length === 0 && (
        <div className="no-results">
          <h2>Your bag is empty</h2>
          <p>Pick a size on any product page and choose “Add to bag”.</p>
          <Link to="/products" className="btn btn--primary">
            Browse products
          </Link>
        </div>
      )}

      {quote && items.length > 0 && (
        <div className="bag__layout">
          <ul className="bag__lines">
            {quote.lines.map((line) => (
              <li key={`${line.product_id}-${line.size}`} className={`bag-line ${line.available ? '' : 'bag-line--unavailable'}`}>
                <Link to={`/products/${line.product_id}`} className="bag-line__img">
                  {line.image_url && <img src={line.image_url} alt={line.name ?? ''} />}
                </Link>
                <div className="bag-line__info">
                  <Link to={`/products/${line.product_id}`} className="bag-line__name">
                    {line.name ?? line.product_id}
                  </Link>
                  <p className="bag-line__meta">
                    Size <strong>{line.size}</strong>
                    {line.unit_price !== null && <> · {formatPrice(line.unit_price)} each</>}
                  </p>
                  {line.problem && <p className="bag-line__problem">{line.problem}</p>}
                  <div className="bag-line__controls">
                    <div className="qty" aria-label={`Quantity for ${line.name ?? line.product_id}, size ${line.size}`}>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.product_id, line.size, (line.requested_quantity ?? 1) - 1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span aria-live="polite">{line.requested_quantity ?? line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.product_id, line.size, (line.requested_quantity ?? 0) + 1)}
                        disabled={!line.available || (line.requested_quantity ?? 0) >= Math.min(line.stock, MAX_PER_LINE)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <button type="button" className="bag-line__remove" onClick={() => remove(line.product_id, line.size)}>
                      Remove
                    </button>
                  </div>
                </div>
                <p className="bag-line__total">{line.available ? formatPrice(line.line_total) : '—'}</p>
              </li>
            ))}
          </ul>

          <aside className="bag__summary">
            <h2>Summary</h2>
            <div className="bag__row">
              <span>Items</span>
              <span>{quote.item_count}</span>
            </div>
            <div className="bag__row bag__row--total">
              <span>Subtotal</span>
              <span>{formatPrice(quote.subtotal)}</span>
            </div>
            <p className="bag__fine">Prices and stock are checked live. Taxes not included.</p>
            <Link to="/products" className="btn btn--primary btn--large bag__cta">
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </section>
  )
}
