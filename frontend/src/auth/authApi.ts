import { request } from '../api/client'

export interface User {
  id: number
  name: string
  email: string
  first_name: string
  last_name: string
}

export interface RegisterInput {
  first_name: string
  last_name: string
  email: string
  password: string
}

export const MIN_PASSWORD = 8

export function register(input: RegisterInput): Promise<User> {
  return request<User>('/api/auth/register', { method: 'POST', body: input })
}

export function login(email: string, password: string): Promise<User> {
  return request<User>('/api/auth/login', { method: 'POST', body: { email, password } })
}

export function logout(): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST' })
}

/** The logged-in user, or null if there is no valid session cookie. */
export function fetchCurrentUser(): Promise<User | null> {
  return request<User | null>('/api/auth/me')
}
