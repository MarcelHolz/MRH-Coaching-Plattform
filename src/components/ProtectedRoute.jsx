import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { invite } from '../lib/supabaseClient'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Lädt…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (invite.active && location.pathname !== '/passwort-festlegen') {
    return <Navigate to="/passwort-festlegen" replace />
  }

  return children
}
