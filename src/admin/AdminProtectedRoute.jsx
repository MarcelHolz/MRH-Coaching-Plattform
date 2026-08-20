import { Navigate } from 'react-router-dom'
import { useAdminAuth } from './AdminAuthContext'

export default function AdminProtectedRoute({ children }) {
  const { isAuthenticated } = useAdminAuth()

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  return children
}
