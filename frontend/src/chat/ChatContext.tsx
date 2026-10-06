import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ChatProductCard } from './types'

/** The latest product matches from the chat, shown in a panel on the page. */
export interface ChatResults {
  query: string
  products: ChatProductCard[]
  /** Increments on every new result set, so the panel can re-open and scroll into view. */
  version: number
}

interface ChatContextValue {
  isOpen: boolean
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
  results: ChatResults | null
  showResults: (query: string, products: ChatProductCard[]) => void
  clearResults: () => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

/**
 * Shared chat state: whether the floating chat is open (so any page can open it,
 * e.g. "Ask about this item"), and the latest product cards the agent returned.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<ChatResults | null>(null)
  const openChat = useCallback(() => setIsOpen(true), [])
  const closeChat = useCallback(() => setIsOpen(false), [])
  const toggleChat = useCallback(() => setIsOpen((v) => !v), [])
  const showResults = useCallback((query: string, products: ChatProductCard[]) => {
    setResults((prev) => ({ query, products, version: (prev?.version ?? 0) + 1 }))
  }, [])
  const clearResults = useCallback(() => setResults(null), [])
  const value = useMemo(
    () => ({ isOpen, openChat, closeChat, toggleChat, results, showResults, clearResults }),
    [isOpen, openChat, closeChat, toggleChat, results, showResults, clearResults],
  )
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>')
  return ctx
}
