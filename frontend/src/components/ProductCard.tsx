import { Link } from 'react-router-dom'
import { formatPrice, titleCase } from '../api/format'
import type { Product } from '../api/types'
import type { ChatProductCard } from '../chat/types'

/** The fields a card needs. Catalogue products and chat results both map to this. */
export interface CardProduct {
  product_id: string
  name: string
  garment_type: string
  description: string
  price: number
  image_url: string
  soldOut: boolean
}

export function cardFromProduct(p: Product): CardProduct {
  return { ...p, soldOut: p.total_stock <= 0 }
}

export function cardFromChat(c: ChatProductCard): CardProduct {
  return {
    product_id: c.product_id,
    name: c.name,
    garment_type: c.garment_type,
    description: c.short_description,
    price: c.price_usd,
    image_url: c.image_url,
    soldOut: !c.in_stock,
  }
}

/**
 * Storefront product card. Links to the shared detail page at /products/:productId.
 * The photo sits in a "print" on a mat (see .print in index.css), so black- and
 * white-background product photos look like one consistent gallery.
 */
export default function ProductCard({ product }: { product: CardProduct }) {
  return (
    <Link to={`/products/${product.product_id}`} className="product-card">
      <div className="product-card__media">
        <div className="print">
          <img src={product.image_url} alt={product.name} loading="lazy" />
        </div>
        {product.soldOut && <span className="badge badge--muted product-card__badge">Sold out</span>}
        <span className="product-card__view" aria-hidden="true">
          View →
        </span>
      </div>
      <div className="product-card__body">
        <p className="product-card__type">{titleCase(product.garment_type)}</p>
        <h3 className="product-card__name">{product.name}</h3>
        <p className="product-card__desc">{product.description}</p>
        <p className="product-card__price">{formatPrice(product.price)}</p>
      </div>
    </Link>
  )
}
