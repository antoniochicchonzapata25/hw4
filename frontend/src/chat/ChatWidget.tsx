import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import Dan from '../brand/Dan'
import ChatProductList from './ChatProductList'
import { fetchChatHistory, productIdFromPath, sendChatMessage } from './chatClient'
import { useChat } from './ChatContext'
import type { ChatMessage, HistoryMessage } from './types'
import '../styles/chat.css'

const WELCOME_ID = 'welcome'

function welcomeFor(firstName: string | null, returning = false): ChatMessage {
  let content =
    'Hi! I’m Dan, the Campus Customs shopping bulldog. Ask me about hoodies, sizes or stock, and I’ll check the shelves for you.'
  if (firstName) {
    content = `${returning ? 'Welcome back' : 'Hi'}, ${firstName}! I’m Dan, your Campus Customs shopping bulldog. Ask me about hoodies, sizes or stock. Your chat is saved to your account.`
  }
  return { id: WELCOME_ID, role: 'assistant', content }
}

const fromHistory = (m: HistoryMessage): ChatMessage => ({
  id: `h${m.id}`,
  role: m.role,
  content: m.content,
  products: m.products,
})

let nextId = 0
const newId = () => `m${Date.now()}-${nextId++}`

export default function ChatWidget() {
  const { isOpen, toggleChat, closeChat, showResults, clearResults } = useChat()
  const { user, checking, refresh: refreshAuth } = useAuth()
  const { pathname } = useLocation()
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeFor(null)])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const userId = user?.id ?? null
  const firstName = user?.first_name ?? null
  // Which account the chat on screen belongs to. Replies that come back after the
  // account changed (logout / another login) are dropped instead of shown.
  const ownerRef = useRef<number | null>(null)

  // Whenever the signed-in account changes, reset the chat so nothing from the previous
  // shopper stays on screen, then load the new account's saved history (guests: none).
  useEffect(() => {
    if (checking) return
    ownerRef.current = userId
    setDraft('')
    setSending(false)
    clearResults()
    setMessages([welcomeFor(firstName)])
    if (userId === null) return
    let active = true
    setLoadingHistory(true)
    fetchChatHistory()
      .then((h) => {
        if (active && ownerRef.current === userId) {
          setMessages([welcomeFor(firstName, h.messages.length > 0), ...h.messages.map(fromHistory)])
        }
      })
      .catch(() => {
        if (active) {
          setMessages((prev) => [
            ...prev,
            { id: newId(), role: 'assistant', content: 'Sorry, I couldn’t load your earlier chat.', error: true },
          ])
        }
      })
      .finally(() => active && setLoadingHistory(false))
    return () => {
      active = false
    }
  }, [userId, firstName, checking, clearResults])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, isOpen])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeChat()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeChat])

  // On phones the chat covers the page, so close it when a product card is opened.
  function closeOnSmallScreens() {
    if (window.matchMedia('(max-width: 560px)').matches) closeChat()
  }

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || sending || loadingHistory) return
    const owner = ownerRef.current
    const userMsg: ChatMessage = { id: newId(), role: 'user', content: text }
    // Logged in: the server loads saved history itself, so send none. Guest: send this session's turns.
    const history =
      owner === null
        ? messages.filter((m) => m.id !== WELCOME_ID && !m.error).map(({ role, content }) => ({ role, content }))
        : []
    const page = { path: pathname, product_id: productIdFromPath(pathname) }
    setMessages((prev) => [...prev, userMsg])
    setDraft('')
    setSending(true)
    try {
      const { reply, products = [], logged_in } = await sendChatMessage({ message: text, history, page })
      if (ownerRef.current !== owner) return // account changed while waiting
      if (logged_in !== (owner !== null)) {
        // The server's view of the session differs from ours (e.g. it expired or the server
        // restarted): re-check who is logged in. That resets the chat to the right account.
        void refreshAuth()
      }
      setMessages((prev) => [...prev, { id: newId(), role: 'assistant', content: reply, products }])
      // Also show the matches on the page (ChatResultsPanel), above whatever page is open.
      if (products.length > 0) showResults(text, products)
    } catch (err) {
      if (ownerRef.current !== owner) return
      // Show the backend's own message (e.g. "assistant is having trouble"); otherwise the
      // server was unreachable (network down, backend stopped, proxy error).
      const content =
        err instanceof ApiError && err.fromServer
          ? err.message
          : 'Sorry, I couldn’t reach the shop assistant. Please check your connection and try again.'
      setMessages((prev) => [...prev, { id: newId(), role: 'assistant', content, error: true }])
    } finally {
      if (ownerRef.current === owner) setSending(false)
    }
  }

  return (
    <div className={`chat ${isOpen ? 'chat--open' : ''}`}>
      <section
        className="chat__panel"
        role="dialog"
        aria-label="Chat with Dan, the Campus Customs shopping assistant"
        aria-hidden={!isOpen}
      >
        <header className="chat__header">
          <div className="chat__avatar" aria-hidden="true">
            <Dan size={46} />
          </div>
          <div>
            <h2 className="chat__title">Dan · Campus Customs</h2>
            <p className="chat__status">
              <span className="chat__dot" /> Shopping assistant · checks live stock
            </p>
          </div>
          <button type="button" className="chat__close" onClick={closeChat} aria-label="Close chat">
            ×
          </button>
        </header>

        <div className="chat__messages" ref={listRef} aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`chat__row chat__row--${m.role}`}>
              {m.role === 'assistant' && <Dan size={28} className="chat__mini-dan" />}
              <div
                className={`chat__msg chat__msg--${m.role} ${m.error ? 'chat__msg--error' : ''} ${
                  m.products?.length ? 'chat__msg--with-cards' : ''
                }`}
              >
                {m.content}
                {m.products && m.products.length > 0 && (
                  <ChatProductList products={m.products} onOpenProduct={closeOnSmallScreens} />
                )}
              </div>
            </div>
          ))}
          {(loadingHistory || sending) && (
            <div className="chat__row chat__row--assistant">
              <Dan size={28} mood="thinking" className="chat__mini-dan chat__mini-dan--thinking" />
              <div
                className="chat__msg chat__msg--assistant chat__typing"
                aria-label={loadingHistory ? 'Loading your earlier chat' : 'Dan is typing'}
              >
                <span className="chat__typing-text">{loadingHistory ? 'Fetching your chat' : 'Dan is sniffing around'}</span>
                <span className="chat__dots" aria-hidden="true">
                  <i /><i /><i />
                </span>
              </div>
            </div>
          )}
        </div>

        <form className="chat__form" onSubmit={send}>
          <textarea
            ref={inputRef}
            className="chat__input"
            rows={1}
            placeholder="Ask Dan about sizes, stock, prices…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) send(e)
            }}
            tabIndex={isOpen ? 0 : -1}
          />
          <button
            type="submit"
            className="chat__send"
            disabled={!draft.trim() || sending || loadingHistory}
            aria-label="Send message"
            tabIndex={isOpen ? 0 : -1}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M3 20.5 21 12 3 3.5l.01 6.6L15 12 3.01 13.9z" fill="currentColor" />
            </svg>
          </button>
        </form>
      </section>

      <button
        type="button"
        className="chat__launcher"
        onClick={toggleChat}
        aria-label={isOpen ? 'Close chat' : 'Chat with Dan, the shopping assistant'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <span className="chat__launcher-x" aria-hidden="true">×</span>
        ) : (
          <>
            <span className="chat__launcher-dan" aria-hidden="true">
              <Dan size={40} />
            </span>
            <span className="chat__launcher-label">Ask Dan</span>
          </>
        )}
      </button>
    </div>
  )
}
