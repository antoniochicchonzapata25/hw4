import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LOW_STOCK_THRESHOLD, stockLevel } from '../api/format'
import type { ProductDetail } from '../api/types'
import { MAX_PER_LINE, useBag } from './BagContext'

/**
 * Size picker + quantity + "Add to bag" for the product page. Sold-out sizes can't be
 * picked, and the quantity can't exceed current stock (minus what's already in the bag).
 */
export default function AddToBag({ product }: { product: ProductDetail }) {
  const { items, add } = useBag()
  const [size, setSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState<{ size: string; qty: number } | null>(null)

  // New product page: reset the choices.
  useEffect(() => {
    setSize(null)
    setQty(1)
    setAdded(null)
  }, [product.product_id])

  const stockFor = (s: string) => product.inventory.find((i) => i.size === s)?.quantity ?? 0
  const inBag = (s: string) => items.find((i) => i.product_id === product.product_id && i.size === s)?.quantity ?? 0
  const maxQty = size ? Math.max(0, Math.min(stockFor(size), MAX_PER_LINE) - inBag(size)) : 0
  const soldOut = product.total_stock <= 0

  function choose(s: string) {
    setSize(s)
    setQty(1)
    setAdded(null)
  }

  function addToBag() {
    if (!size || qty < 1 || qty > maxQty) return
    add({ product_id: product.product_id, size, quantity: qty })
    setAdded({ size, qty })
    setQty(1)
  }

  return (
    <>
      <div className="detail__block">
        <h2 className="detail__label" id="size-label">
          {soldOut ? 'Sizes' : 'Choose a size'}
        </h2>
        <div className="sizes" role="radiogroup" aria-labelledby="size-label">
          {product.inventory.map((s) => {
            const level = stockLevel(s.quantity)
            const selected = size === s.size
            return (
              <button
                key={s.size}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`size size--${level} ${selected ? 'size--selected' : ''}`}
                disabled={level === 'out'}
                onClick={() => choose(s.size)}
              >
                <span className="size__name">{s.size}</span>
                <span className="size__qty">
                  {level === 'out' ? 'Sold out' : level === 'low' ? `Only ${s.quantity} left` : `${s.quantity} in stock`}
                </span>
              </button>
            )
          })}
        </div>
        <p className="detail__note">
          {product.total_stock} units in stock across all sizes. Sizes with {LOW_STOCK_THRESHOLD} or fewer left are
          highlighted; sold-out sizes can’t be added.
        </p>
      </div>

      {!soldOut && (
        <div className="add-bag">
          <div className="qty" aria-label="Quantity">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={!size || qty <= 1} aria-label="Decrease quantity">
              −
            </button>
            <span aria-live="polite">{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={!size || qty >= maxQty} aria-label="Increase quantity">
              +
            </button>
          </div>
          <button type="button" className="btn btn--primary btn--large add-bag__btn" onClick={addToBag} disabled={!size || maxQty < 1}>
            {size ? 'Add to bag' : 'Select a size'}
          </button>
        </div>
      )}
      {size && maxQty < 1 && !added && (
        <p className="add-bag__msg add-bag__msg--warn">You already have all {stockFor(size)} available in size {size} in your bag.</p>
      )}
      {added && (
        <p className="add-bag__msg" role="status">
          Added {added.qty} × size {added.size} to your bag. <Link to="/bag">View bag</Link>
        </p>
      )}
    </>
  )
}
