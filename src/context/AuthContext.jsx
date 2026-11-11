import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { toUser } from '../lib/adapters.js'
import { api, setAuthToken, setUnauthorizedHandler } from '../lib/api.js'
import { useToast } from './ToastContext.jsx'

const SESSION_KEY = 'dokan:auth'

// The earlier mock version kept these in the browser, including plain-text passwords.
const LEGACY_KEYS = ['dokan:accounts', 'dokan:session', 'dokan:store:v1']

const AuthContext = createContext(null)

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

function writeSession(session, remember) {
  clearSession()
  try {
    ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Storage can be unavailable (private mode). The session then lasts until refresh.
  }
}

function readSession() {
  try {
    LEGACY_KEYS.forEach((key) => {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    })
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Read once at start-up, so the first requests already carry the token.
const initialSession = readSession()
setAuthToken(initialSession?.token ?? null)

export function AuthProvider({ children }) {
  const { toast } = useToast()
  const [user, setUser] = useState(initialSession?.user ?? null)

  const startSession = useCallback(({ token, user: apiUser }, remember) => {
    const nextUser = toUser(apiUser)
    setAuthToken(token)
    writeSession({ token, user: nextUser }, remember)
    setUser(nextUser)
  }, [])

  const login = useCallback(
    async (email, password, remember) => {
      // api() returns the parsed body and throws an ApiError with a readable message on failure.
      const { data } = await api('/api/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      })
      startSession(data, remember)
    },
    [startSession],
  )

  /** Local testing only: the API offers this route under `npm run dev:local`. It does not contact Google. */
  const loginWithGoogle = useCallback(async () => {
    const { data } = await api('/api/auth/demo', { method: 'POST' })
    startSession(data, true)
  }, [startSession])

  const register = useCallback(
    async ({ name, email, password }) => {
      const { data } = await api('/api/auth/register', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), password },
      })
      startSession(data, true)
    },
    [startSession],
  )

  const logout = useCallback(() => {
    setAuthToken(null)
    clearSession()
    setUser(null)
  }, [])

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await api('/api/auth/password', { method: 'PUT', body: { currentPassword, newPassword } })
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout()
      toast('Your session has ended. Please sign in again.', 'info')
    })
    return () => setUnauthorizedHandler(() => {})
  }, [logout, toast])

  const value = useMemo(
    () => ({ user, login, loginWithGoogle, register, logout, changePassword }),
    [user, login, loginWithGoogle, register, logout, changePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}