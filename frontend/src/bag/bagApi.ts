import { request } from '../api/client'
import type { BagItem } from './BagContext'

/** One priced bag line. Mirrors backend/models.py BagLine. */
export interface BagLine {
  product_id: string
  name: string | null
  image_url: string | null
  size: string
  requested_quantity: number | null
  quantity: number
  unit_price: number | null
  stock: number
  line_total: number
  available: boolean
  problem: string | null
}

/** Mirrors backend/models.py BagQuote. */
export interface BagQuote {
  lines: BagLine[]
  item_count: number
  subtotal: number
}

/** Price the bag with live catalogue prices and stock (nothing is reserved). */
export function quoteBag(items: BagItem[]): Promise<BagQuote> {
  return request<BagQuote>('/api/bag/quote', { method: 'POST', body: { items } })
}
