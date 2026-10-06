const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatPrice(price: number): string {
  return usd.format(price)
}

export const LOW_STOCK_THRESHOLD = 5

export type StockLevel = 'out' | 'low' | 'in'

export function stockLevel(quantity: number): StockLevel {
  if (quantity <= 0) return 'out'
  if (quantity <= LOW_STOCK_THRESHOLD) return 'low'
  return 'in'
}

export function titleCase(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase())
}
