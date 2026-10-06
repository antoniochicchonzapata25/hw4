import { Link } from 'react-router-dom'
import CampusSeal from '../brand/CampusSeal'

const VALUES = [
  {
    title: 'Pride you can wear',
    text: 'We stock the crests, wordmarks and bulldogs that mean something here, from the residential colleges to the boathouse and the rink.',
  },
  {
    title: 'Quality over quantity',
    text: 'We would rather carry a hoodie you keep for ten years than ten you forget. Every piece is picked for fabric, fit and finish.',
  },
  {
    title: 'A neighbor first',
    text: 'We are a New Haven shop serving a New Haven community: students, faculty, staff, alumni, families, and the city that surrounds them.',
  },
]

export default function AboutPage() {
  return (
    <>
      <section className="page-banner">
        <div className="container">
          <p className="eyebrow eyebrow--light">About us</p>
          <h1 className="page-banner__title">Gear with a home address</h1>
          <p className="page-banner__text">
            Campus Customs is a Yale apparel and gift shop on Broadway, a few steps from Old
            Campus.
          </p>
        </div>
      </section>

      <section className="section container about">
        <div className="about__story">
          <h2 className="section__title">Our story</h2>
          <p>
            Some of the best moments at Yale come with a uniform: the navy hoodie pulled on before
            an early seminar, the crewneck you wore when you finally won your intramural final, the
            tee with your residential college crest that you still sleep in years after
            graduation. Campus Customs exists to make those pieces.
          </p>
          <p>
            We work with carefully chosen designs and dependable makers, then curate a
            collection that feels unmistakably Yale without looking like everyone else's. You'll
            find everyday staples alongside sport-specific gear for fencing, sailing, hockey,
            crew and more, plus college designs and gifts for the people cheering you on from
            home.
          </p>
          <p>
            Come by the shop at 57 Broadway or browse online. Either way, our team is happy to
            help you find the right size, color or gift.
          </p>
          <Link to="/products" className="btn btn--primary btn--large">
            Browse the collection
          </Link>
        </div>

        <aside className="about__visit">
          <h3>Visit the shop</h3>
          <address>
            57 Broadway
            <br />
            New Haven, CT 06511
          </address>
          <p className="about__visit-note">Stop by to try on sizes. Our team is happy to help.</p>
          <p className="about__licensed">
            <CampusSeal size={40} />
            <span>Yale campus collection · New Haven</span>
          </p>
        </aside>
      </section>

      <section className="section section--tint">
        <div className="container">
          <h2 className="section__title section__title--center">What we stand for</h2>
          <div className="values">
            {VALUES.map((v) => (
              <div key={v.title} className="value">
                <h3 className="value__title">{v.title}</h3>
                <p>{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
