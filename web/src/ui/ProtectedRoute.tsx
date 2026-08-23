import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../data/auth'

export function ProtectedRoute() {
  const { session, loading, mustChangePassword } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}
