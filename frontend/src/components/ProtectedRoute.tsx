import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getMe } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

interface Props {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: Props) {
  const { isAuthenticated, setUser, clearUser } = useAuthStore()
  const location = useLocation()
  const [checking, setChecking] = useState(!isAuthenticated)

  useEffect(() => {
    if (isAuthenticated) return
    // Attempt to rehydrate session from cookie on page refresh
    getMe()
      .then(setUser)
      .catch(() => clearUser())
      .finally(() => setChecking(false))
  }, [isAuthenticated, setUser, clearUser])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
