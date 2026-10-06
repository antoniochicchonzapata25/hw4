import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ChatResultsPanel from '../chat/ChatResultsPanel'
import ChatWidget from '../chat/ChatWidget'
import Footer from './Footer'
import NavBar from './NavBar'

export default function Layout() {
  const { pathname } = useLocation()

  // Start each new page at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <NavBar />
      <main className="app__main">
        <ChatResultsPanel />
        {/* key = path, so each page fades/slides in on navigation (off for reduced motion) */}
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <Footer />
      <ChatWidget />
    </div>
  )
}
