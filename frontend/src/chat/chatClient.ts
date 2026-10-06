import { request } from '../api/client'
import type { ChatHistoryResponse, ChatReply, ChatRequest } from './types'

/**
 * Send a chat message to the shop assistant (FastAPI → PydanticAI agent).
 * The session cookie goes along automatically, so the server knows who is chatting.
 * Throws ApiError with a readable message if the backend or model fails.
 */
export function sendChatMessage(body: ChatRequest): Promise<ChatReply> {
  return request<ChatReply>('/api/chat', { method: 'POST', body })
}

/** The logged-in shopper's saved conversation (empty for guests). */
export function fetchChatHistory(): Promise<ChatHistoryResponse> {
  return request<ChatHistoryResponse>('/api/chat/history')
}

/** The product the shopper is viewing, from the current route (/products/:productId). */
export function productIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/products\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}
