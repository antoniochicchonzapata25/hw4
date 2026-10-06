import type { Product, ProductDetail } from './types'

export class ApiError extends Error {
  status: number
  /** True when the message came from our FastAPI backend (safe to show to shoppers). */
  fromServer: boolean
  constructor(status: number, message: string, fromServer = false) {
    super(message)
    this.status = status
    this.fromServer = fromServer
  }
}

/** Turn a FastAPI error body into one readable sentence. */
function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  // 422 validation errors: [{ msg: "Value error, Enter a valid email address.", loc: [...] }, ...]
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d: { msg?: string }) => (d.msg ?? '').replace(/^Value error, /, ''))
      .filter(Boolean)
      .join(' ')
  }
  return `Request failed (${status})`
}

export async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin', // send the HttpOnly session cookie
  })
  if (!res.ok) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* non-JSON error body */
    }
    const fromServer = (body as { detail?: unknown } | null)?.detail !== undefined
    throw new ApiError(res.status, errorMessage(res.status, body), fromServer)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/** All products, or only those matching `query` (same search as the chatbot), best first. */
export function fetchProducts(query?: string): Promise<Product[]> {
  const q = query?.trim()
  return request<Product[]>(q ? `/api/products?q=${encodeURIComponent(q)}` : '/api/products')
}

export function fetchProduct(productId: string): Promise<ProductDetail> {
  return request<ProductDetail>(`/api/products/${encodeURIComponent(productId)}`)
}
