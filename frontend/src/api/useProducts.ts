import { useEffect, useState } from 'react'
import { fetchProduct, fetchProducts } from './client'
import type { Product, ProductDetail } from './types'

interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

export function useProducts(query?: string): AsyncState<Product[]> {
  const [state, setState] = useState<AsyncState<Product[]>>({ data: null, error: null, loading: true })
  useEffect(() => {
    let active = true
    setState((prev) => ({ ...prev, loading: true }))
    fetchProducts(query)
      .then((data) => active && setState({ data, error: null, loading: false }))
      .catch((err: Error) => active && setState({ data: null, error: err.message, loading: false }))
    return () => {
      active = false
    }
  }, [query])
  return state
}

export function useProduct(productId: string | undefined): AsyncState<ProductDetail> & { notFound: boolean } {
  const [state, setState] = useState<AsyncState<ProductDetail> & { notFound: boolean }>({
    data: null,
    error: null,
    loading: true,
    notFound: false,
  })
  useEffect(() => {
    if (!productId) return
    let active = true
    setState({ data: null, error: null, loading: true, notFound: false })
    fetchProduct(productId)
      .then((data) => active && setState({ data, error: null, loading: false, notFound: false }))
      .catch(
        (err: Error & { status?: number }) =>
          active && setState({ data: null, error: err.message, loading: false, notFound: err.status === 404 }),
      )
    return () => {
      active = false
    }
  }, [productId])
  return state
}
