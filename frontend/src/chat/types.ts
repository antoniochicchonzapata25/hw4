export type ChatRole = 'user' | 'assistant'

/** A product card returned by the chat API. Mirrors backend/models.py ProductCard. */
export interface ChatProductCard {
  product_id: string
  name: string
  garment_type: string
  price_usd: number
  short_description: string
  image_url: string
  in_stock: boolean
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  /** Product cards the assistant attached to this reply (empty/undefined for plain replies). */
  products?: ChatProductCard[]
  /** Local error notice (not sent back to the agent as history). */
  error?: boolean
}

/** Where the shopper is when sending a message. Mirrors backend/models.py PageContext. */
export interface PageContext {
  path: string
  product_id: string | null
}

/** Body of POST /api/chat. Mirrors backend/models.py ChatRequest. */
export interface ChatRequest {
  message: string
  /** Guests only; ignored by the server for logged-in shoppers (it uses saved history). */
  history: Pick<ChatMessage, 'role' | 'content'>[]
  page: PageContext
}

/** One saved message. Mirrors backend/models.py HistoryMessage. */
export interface HistoryMessage {
  id: number
  role: ChatRole
  content: string
  products: ChatProductCard[]
  created_at: string
}

/** Response of GET /api/chat/history. Mirrors backend/models.py ChatHistoryResponse. */
export interface ChatHistoryResponse {
  logged_in: boolean
  messages: HistoryMessage[]
}

/** Response of POST /api/chat. Mirrors backend/models.py ChatResponse. */
export interface ChatReply {
  reply: string
  products: ChatProductCard[]
  /** Whether the server saw a valid login session for this request. */
  logged_in: boolean
}
