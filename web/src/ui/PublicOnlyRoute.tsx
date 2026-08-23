import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../data/auth'

export function PublicOnlyRoute() {
  const { session, loading, mustChangePassword } = useAuth()

  if (loading) return null
  if (session) return <Navigate to={mustChangePassword ? '/change-password' : '/'} replace />
  return <Outlet />
}
