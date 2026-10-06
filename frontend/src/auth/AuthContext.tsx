import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from './authApi'
import type { RegisterInput, User } from './authApi'

interface AuthContextValue {
  user: User | null
  /** True until the initial "who am I?" check finishes. */
  checking: boolean
  login: (email: string, password: string) => Promise<User>
  register: (input: RegisterInput) => Promise<User>
  logout: () => Promise<void>
  /** Re-ask the server who is logged in (e.g. after the session expired). */
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Holds the logged-in user for the whole app. The session itself lives in an
 * HttpOnly cookie set by FastAPI; on load we ask /api/auth/me who it belongs to.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    authApi
      .fetchCurrentUser()
      .then((u) => active && setUser(u))
      .catch(() => active && setUser(null))
      .finally(() => active && setChecking(false))
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const u = await authApi.login(email, password)
    setUser(u)
    return u
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const u = await authApi.register(input)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      setUser(await authApi.fetchCurrentUser())
    } catch {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, checking, login, register, logout, refresh }),
    [user, checking, login, register, logout, refresh],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
