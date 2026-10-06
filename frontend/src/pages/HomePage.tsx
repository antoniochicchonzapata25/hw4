import { Link } from 'react-router-dom'
import type { Product } from '../api/types'
import { useProducts } from '../api/useProducts'
import Dan from '../brand/Dan'
import { useChat } from '../chat/ChatContext'
import ProductCard, { cardFromProduct } from '../components/ProductCard'
import StatusMessage from '../components/StatusMessage'
import CampusSeal from '../brand/CampusSeal'

// Pick a varied "featured" row: one product per garment family, then fill up.
const FAMILIES = ['hood', 'crewneck', 't-shirt', 'quarter-zip', 'jacket', 'fleece', 'performance', 'mockneck']

function pickFeatured(products: Product[], count = 8): Product[] {
  const chosen: Product[] = []
  for (const family of FAMILIES) {
    const match = products.find(
      (p) => p.total_stock > 0 && p.garment_type.toLowerCase().includes(family) && !chosen.includes(p),
    )
    if (match) chosen.push(match)
  }
  for (const p of products) {
    if (chosen.length >= count) break
    if (!chosen.includes(p)) chosen.push(p)
  }
  return chosen.slice(0, count)
}

// Category tiles link into the Products-page search (same search as the chatbot).
const CATEGORIES = [
  { label: 'Hoodies', note: 'Library nights', query: 'hoodies', match: 'hood' },
  { label: 'Crewnecks', note: 'Game day', query: 'crewnecks', match: 'crewneck' },
  { label: 'Quarter-zips', note: 'Family Weekend', query: 'quarter zips', match: 'quarter-zip' },
  { label: 'Tees', note: 'Every day', query: 't-shirts', match: 't-shirt' },
  { label: 'Jackets', note: 'First snow', query: 'jackets', match: 'jacket' },
]

const TICKER = ['Hoodies', 'Crewnecks', 'Quarter-zips', 'Tees', 'Fleece', 'Residential colleges', 'Varsity sports', 'The Game']

const PROMISES = [
  { title: 'Campus through and through', text: 'Crests, wordmarks and bulldogs for every college, team and tradition.' },
  { title: 'Made to be worn', text: 'Heavyweight fleece, soft tees and quarter-zips that hold up from first-year to reunion.' },
  { title: 'Right here in New Haven', text: 'A local team that knows the colleges, the teams and the traditions.' },
]

export default function HomePage() {
  const { data: products, error, loading } = useProducts()
  const { openChat } = useChat()
  const featured = products ? pickFeatured(products) : []
  const heroPrints = featured.slice(0, 3)
  const tileImage = (match: string) =>
    products?.find((p) => p.total_stock > 0 && p.garment_type.toLowerCase().includes(match))?.image_url

  return (
    <>
      {/* ---------- Editorial hero ---------- */}
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__copy">
            <p className="eyebrow">
              <span className="eyebrow__dot" aria-hidden="true" /> Fall ’26 · New Haven
            </p>
            <h1 className="hero__title">
              Wear your Yale
              <br />
              <em className="hero__accent">every</em> day.
            </h1>
            <p className="hero__lead">
              Hoodies for late nights in the library, crewnecks for game day, quarter-zips for
              Family Weekend. Campus Customs is where Bulldogs of every class year find gear
              they’ll actually live in.
            </p>
            <div className="hero__actions">
              <Link to="/products" className="btn btn--primary btn--large">
                Shop the collection <span aria-hidden="true">→</span>
              </Link>
              <button type="button" className="btn btn--ghost btn--large" onClick={openChat}>
                <Dan size={26} /> Ask Dan
              </button>
            </div>
            <dl className="hero__stats">
              <div>
                <dt>{products ? products.length : '—'}</dt>
                <dd>styles to browse</dd>
              </div>
              <div>
                <dt>XS–XXL</dt>
                <dd>every size, live stock</dd>
              </div>
              <div>
                <dt>57</dt>
                <dd>Broadway, New Haven</dd>
              </div>
            </dl>
          </div>

          <div className="hero__collage" aria-hidden="true">
            {heroPrints.map((p, i) => (
              <div key={p.product_id} className={`hero__tile hero__tile--${i + 1}`}>
                <div className="print print--lift">
                  <img src={p.image_url} alt="" />
                </div>
                <span className="hero__caption">{p.name}</span>
              </div>
            ))}
            <div className="hero__sticker">
              <span>Est.</span>
              <strong>on Broadway</strong>
              <span>New Haven</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Varsity ticker ---------- */}
      <div className="ticker" aria-hidden="true">
        <div className="ticker__track">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i}>
              {t} <b>✦</b>
            </span>
          ))}
        </div>
      </div>

      {/* ---------- Shop by category ---------- */}
      <section className="section container">
        <div className="section__head">
          <div>
            <p className="eyebrow">Find your fit</p>
            <h2 className="section__title">Shop by category</h2>
          </div>
          <Link to="/products" className="link-arrow">
            Browse everything →
          </Link>
        </div>
        <div className="categories">
          {CATEGORIES.map((c) => {
            const img = tileImage(c.match)
            return (
              <Link key={c.label} to={`/products?q=${encodeURIComponent(c.query)}`} className="category">
                <div className="category__media">
                  <div className="print">{img && <img src={img} alt="" loading="lazy" />}</div>
                </div>
                <span className="category__note">{c.note}</span>
                <span className="category__label">
                  {c.label} <span aria-hidden="true">→</span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ---------- Featured ---------- */}
      <section className="section section--tint">
        <div className="container">
          <div className="section__head">
            <div>
              <p className="eyebrow">Fresh on the shelves</p>
              <h2 className="section__title">Featured gear</h2>
            </div>
            <Link to="/products" className="link-arrow">
              View all products →
            </Link>
          </div>
          {loading && <StatusMessage kind="loading">Loading products…</StatusMessage>}
          {error && <StatusMessage kind="error">Couldn't load products: {error}</StatusMessage>}
          {products && (
            <div className="product-grid">
              {featured.map((p) => (
                <ProductCard key={p.product_id} product={cardFromProduct(p)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Collection band (original Campus Customs seal) ---------- */}
      <section className="licensed">
        <div className="container licensed__inner">
          <div className="licensed__mark">
            <CampusSeal size={112} withText />
          </div>
          <p className="licensed__text">
            <strong>The Yale campus collection.</strong> Every design is chosen and sold by the Campus
            Customs team in New Haven.
          </p>
          <ul className="licensed__promises">
            {PROMISES.map((p) => (
              <li key={p.title}>
                <strong>{p.title}</strong>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Meet Dan ---------- */}
      <section className="dan-band">
        <div className="container dan-band__inner">
          <Dan size={132} className="dan-band__dan" title="Dan, the Campus Customs shopping bulldog" />
          <div className="dan-band__copy">
            <p className="eyebrow eyebrow--light">Need a hand?</p>
            <h2 className="dan-band__title">Meet Dan, our shopping bulldog.</h2>
            <p className="dan-band__text">
              Not sure which hoodie runs warmest, or whether your size is in? Dan checks live stock,
              finds similar styles when something’s sold out, and pulls matching products right onto
              the page.
            </p>
          </div>
          <button type="button" className="btn btn--light btn--large" onClick={openChat}>
            Chat with Dan
          </button>
        </div>
      </section>
    </>
  )
}
