import { Link, useParams } from 'react-router-dom'
import { formatPrice, stockLevel, titleCase } from '../api/format'
import { useProduct } from '../api/useProducts'
import AddToBag from '../bag/AddToBag'
import { useChat } from '../chat/ChatContext'
import ImageZoom from '../components/ImageZoom'
import StatusMessage from '../components/StatusMessage'
import CampusSeal from '../brand/CampusSeal'

const STOCK_LABEL = { in: 'In stock', low: 'Low stock', out: 'Sold out' } as const

export default function ProductDetailPage() {
  const { productId } = useParams()
  const { data: product, error, loading, notFound } = useProduct(productId)
  const { openChat } = useChat()

  if (loading) {
    return (
      <div className="container section">
        <StatusMessage kind="loading">Loading product…</StatusMessage>
      </div>
    )
  }

  if (notFound || !product) {
    return (
      <div className="container section not-found">
        <h1>{notFound ? 'Product not found' : 'Something went wrong'}</h1>
        <p>{notFound ? "We couldn't find that item. It may have been retired." : error}</p>
        <Link to="/products" className="btn btn--primary">
          Back to all products
        </Link>
      </div>
    )
  }

  const inStockSizes = product.inventory.filter((s) => s.quantity > 0)
  const overall = stockLevel(product.total_stock)

  return (
    <div className="container section">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to="/products">Products</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="detail">
        <div className="detail__media">
          <ImageZoom src={product.image_url} alt={product.name} />
        </div>

        <div className="detail__info">
          <p className="product-card__type">{titleCase(product.garment_type)}</p>
          <h1 className="detail__name">{product.name}</h1>
          <p className="detail__price">{formatPrice(product.price)}</p>

          <p className={`stock-pill stock-pill--${overall}`}>
            {overall === 'out'
              ? 'Sold out in all sizes'
              : `${STOCK_LABEL[overall]} · ${inStockSizes.length} of ${product.inventory.length} sizes available`}
          </p>

          <p className="detail__desc">{product.description}</p>

          <p className="detail__licensed">
            <CampusSeal size={20} />
            Part of our Yale campus collection
          </p>

          <div className="detail__block">
            <h2 className="detail__label">Colors in this design</h2>
            <ul className="chips">
              {product.colors.map((c) => (
                <li key={c} className="chip">
                  {titleCase(c)}
                </li>
              ))}
            </ul>
          </div>

          <AddToBag product={product} />

          <div className="detail__actions">
            <button type="button" className="btn btn--outline" onClick={openChat}>
              Ask about this item
            </button>
            <Link to="/products" className="btn btn--ghost">
              Keep shopping
            </Link>
          </div>

          <details className="detail__more">
            <summary>Product details</summary>
            <dl>
              <dt>Product ID</dt>
              <dd>{product.product_id}</dd>
              <dt>Category</dt>
              <dd>{titleCase(product.garment_type)}</dd>
              <dt>Tags</dt>
              <dd>{product.search_tags.join(', ')}</dd>
            </dl>
          </details>
        </div>
      </div>
    </div>
  )
}
