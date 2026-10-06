import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'

/** One line in the shopping bag. Only ids and choices are kept; prices come live from the API. */
export interface BagItem {
  product_id: string
  size: string
  quantity: number
}

export const MAX_PER_LINE = 20

interface BagContextValue {
  items: BagItem[]
  count: number
  add: (item: BagItem) => void
  setQuantity: (productId: string, size: string, quantity: number) => void
  remove: (productId: string, size: string) => void
  clear: () => void
}

const BagContext = createContext<BagContextValue | null>(null)

const GUEST_KEY = 'cc_bag:guest'
const keyFor = (userId: number | null) => (userId === null ? GUEST_KEY : `cc_bag:user:${userId}`)

function load(key: string): BagItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(raw)
      ? raw.filter((i) => typeof i?.product_id === 'string' && typeof i?.size === 'string' && i.quantity > 0)
      : []
  } catch {
    return []
  }
}

function merge(into: BagItem[], extra: BagItem[]): BagItem[] {
  const out = into.map((i) => ({ ...i })) // copy, never mutate previous state
  for (const e of extra) {
    const hit = out.find((i) => i.product_id === e.product_id && i.size === e.size)
    if (hit) hit.quantity = Math.min(hit.quantity + e.quantity, MAX_PER_LINE)
    else out.push({ ...e })
  }
  return out
}

/**
 * Shopping bag kept in the browser (localStorage), one bag per guest or account, so a
 * shared browser never shows one account's bag to another. Logging in moves the guest
 * bag into the account's bag. This is not checkout: nothing is reserved or paid.
 */
export function BagProvider({ children }: { children: ReactNode }) {
  const { user, checking } = useAuth()
  const userId = user?.id ?? null
  const [items, setItems] = useState<BagItem[]>([])
  const keyRef = useRef<string | null>(null)

  // Switch bags when the account changes.
  useEffect(() => {
    if (checking) return
    const key = keyFor(userId)
    let next = load(key)
    if (userId !== null) {
      const guest = load(GUEST_KEY)
      if (guest.length) {
        next = merge(next, guest)
        localStorage.removeItem(GUEST_KEY)
        localStorage.setItem(key, JSON.stringify(next))
      }
    }
    keyRef.current = key
    setItems(next)
  }, [userId, checking])

  const update = useCallback((fn: (prev: BagItem[]) => BagItem[]) => {
    setItems((prev) => {
      const next = fn(prev)
      if (keyRef.current) localStorage.setItem(keyRef.current, JSON.stringify(next))
      return next
    })
  }, [])

  const add = useCallback((item: BagItem) => update((prev) => merge(prev, [item])), [update])
  const setQuantity = useCallback(
    (productId: string, size: string, quantity: number) =>
      update((prev) =>
        prev
          .map((i) =>
            i.product_id === productId && i.size === size
              ? { ...i, quantity: Math.max(0, Math.min(quantity, MAX_PER_LINE)) }
              : i,
          )
          .filter((i) => i.quantity > 0),
      ),
    [update],
  )
  const remove = useCallback(
    (productId: string, size: string) => update((prev) => prev.filter((i) => !(i.product_id === productId && i.size === size))),
    [update],
  )
  const clear = useCallback(() => update(() => []), [update])

  const value = useMemo(
    () => ({ items, count: items.reduce((n, i) => n + i.quantity, 0), add, setQuantity, remove, clear }),
    [items, add, setQuantity, remove, clear],
  )
  return <BagContext.Provider value={value}>{children}</BagContext.Provider>
}

export function useBag(): BagContextValue {
  const ctx = useContext(BagContext)
  if (!ctx) throw new Error('useBag must be used inside <BagProvider>')
  return ctx
}
