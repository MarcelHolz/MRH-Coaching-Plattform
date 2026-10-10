import { createContext, useContext, useEffect, useState } from 'react'
import {
  adminFetch,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from '../lib/adminFetch'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!getAdminToken(),
  )

  useEffect(() => {
    setIsAuthenticated(!!getAdminToken())
  }, [])

  // Mit E-Mail: persönliches Admin-Konto. Ohne E-Mail: Notfallzugang
  // über das gemeinsame ADMIN_PASSWORD (solange es in Vercel gesetzt ist).
  async function login(email, password) {
    const data = await adminFetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(email ? { email, password } : { password }),
    })
    setAdminToken(data.token)
    setIsAuthenticated(true)
  }

  function logout() {
    clearAdminToken()
    setIsAuthenticated(false)
  }

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error(
      'useAdminAuth muss innerhalb eines AdminAuthProvider verwendet werden.',
    )
  }
  return context
}
