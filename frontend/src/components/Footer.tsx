import { Link } from 'react-router-dom'
import { Logo } from '../brand/Logo'
import CampusSeal from '../brand/CampusSeal'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div>
          <div className="site-footer__brand">
            <Logo size={50} tagline={false} tone="reverse" />
          </div>
          <p className="site-footer__blurb">
            Yale gear for students, alumni, families and fans, chosen and sold in New Haven.
          </p>
          <p className="site-footer__licensed">
            <CampusSeal size={22} />
            Yale campus collection · New Haven
          </p>
        </div>
        <div>
          <h3 className="site-footer__heading">Shop</h3>
          <ul>
            <li><Link to="/products">All products</Link></li>
            <li><Link to="/products?q=hoodies">Hoodies</Link></li>
            <li><Link to="/products?q=crewnecks">Crewnecks</Link></li>
            <li><Link to="/bag">Your bag</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="site-footer__heading">Campus Customs</h3>
          <ul>
            <li><Link to="/about">Our story</Link></li>
            <li><Link to="/login">Log in</Link></li>
            <li><Link to="/create-account">Create account</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="site-footer__heading">Visit</h3>
          <address>
            57 Broadway
            <br />
            New Haven, CT 06511
          </address>
        </div>
      </div>
      <div className="container site-footer__legal">
        <span>© {new Date().getFullYear()} Campus Customs · Built for MGT 409</span>
        <span className="site-footer__boola" aria-hidden="true">Boola boola ✦ Bulldogs</span>
      </div>
    </footer>
  )
}
