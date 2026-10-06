import { Link } from 'react-router-dom'
import { formatPrice } from '../api/format'
import type { ChatProductCard } from './types'

interface Props {
  products: ChatProductCard[]
  /** Called after a card is clicked (e.g. to close the chat on small screens). */
  onOpenProduct?: () => void
}

/** Compact clickable product cards inside an assistant chat bubble. */
export default function ChatProductList({ products, onOpenProduct }: Props) {
  return (
    <ul className="chat-cards" aria-label={`${products.length} matching products`}>
      {products.map((p) => (
        <li key={p.product_id}>
          <Link to={`/products/${p.product_id}`} className="chat-card" onClick={onOpenProduct}>
            <img src={p.image_url} alt="" className="chat-card__img" loading="lazy" />
            <span className="chat-card__body">
              <span className="chat-card__name">{p.name}</span>
              <span className="chat-card__desc">{p.short_description}</span>
              <span className="chat-card__meta">
                <span className="chat-card__price">{formatPrice(p.price_usd)}</span>
                {!p.in_stock && <span className="chat-card__soldout">Sold out</span>}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
