import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useBag } from '../bag/BagContext'
import { Logo } from '../brand/Logo'

const MAIN_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products', end: false },
  { to: '/about', label: 'About Us', end: false },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `nav__link ${isActive ? 'nav__link--active' : ''}`

export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { count: bagCount } = useBag()

  async function onLogout() {
    await logout()
    navigate('/')
  }

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <header className="site-header">
      <div className="promo-bar">
        <span>Yale apparel &amp; gifts</span>
        <span className="promo-bar__sep" aria-hidden="true">✦</span>
        <span>57 Broadway, New Haven</span>
        <span className="promo-bar__sep" aria-hidden="true">✦</span>
        <span>Questions? Ask Dan, our shopping bulldog</span>
      </div>

      <nav className="nav container" aria-label="Main">
        <Link to="/" className="nav__brand" aria-label="Campus Customs home">
          <Logo size={50} />
        </Link>

        <button
          type="button"
          className="nav__toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="nav-menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className={`nav__burger ${menuOpen ? 'nav__burger--open' : ''}`} />
        </button>

        <div id="nav-menu" className={`nav__menu ${menuOpen ? 'nav__menu--open' : ''}`}>
          <ul className="nav__links">
            {MAIN_LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className={linkClass}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <ul className="nav__account">
            <li>
              <NavLink to="/bag" className={linkClass} aria-label={`Shopping bag, ${bagCount} ${bagCount === 1 ? 'item' : 'items'}`}>
                <span className="nav__bag">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M7 7V6a5 5 0 0 1 10 0v1h3l-1 14H5L4 7h3zm2 0h6V6a3 3 0 0 0-6 0v1z" fill="currentColor" />
                  </svg>
                  Bag
                  {bagCount > 0 && (
                    // key = count, so the badge re-mounts and plays its "bump" when the bag changes
                    <span key={bagCount} className="nav__bag-count">
                      {bagCount}
                    </span>
                  )}
                </span>
              </NavLink>
            </li>
            {user ? (
              <>
                <li className="nav__user" title={user.email}>
                  <span className="nav__avatar" aria-hidden="true">
                    {user.first_name.charAt(0).toUpperCase()}
                  </span>
                  Hi, {user.first_name}
                </li>
                <li>
                  <button type="button" className="btn btn--small btn--ghost" onClick={onLogout}>
                    Log out
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <NavLink to="/login" className={linkClass}>
                    Log in
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/create-account"
                    className={({ isActive }) => `btn btn--small ${isActive ? 'btn--primary' : 'btn--outline'}`}
                  >
                    Create account
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </div>
      </nav>
    </header>
  )
}
