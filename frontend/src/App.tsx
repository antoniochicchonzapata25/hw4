import { Link, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { BagProvider } from './bag/BagContext'
import { ChatProvider } from './chat/ChatContext'
import Dan from './brand/Dan'
import Layout from './components/Layout'
import AboutPage from './pages/AboutPage'
import BagPage from './pages/BagPage'
import CreateAccountPage from './pages/auth/CreateAccountPage'
import LoginPage from './pages/auth/LoginPage'
import HomePage from './pages/HomePage'
import ProductDetailPage from './pages/ProductDetailPage'
import ProductsPage from './pages/ProductsPage'

function NotFound() {
  return (
    <div className="container section not-found">
      <Dan size={120} mood="thinking" className="not-found__dan" />
      <h1>Page not found</h1>
      <p>Dan sniffed everywhere, but that page doesn't exist.</p>
      <Link to="/" className="btn btn--primary">
        Go home
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BagProvider>
        <ChatProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/:productId" element={<ProductDetailPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="bag" element={<BagPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="create-account" element={<CreateAccountPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </ChatProvider>
      </BagProvider>
    </AuthProvider>
  )
}
