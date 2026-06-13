import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import router from '@/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 minutes
      gcTime: 10 * 60 * 1000,          // 10 minutes
      retry: (count, error: unknown) => {
        const status = (error as { response?: { status: number } })?.response?.status
        return status !== 401 && count < 2
      },
      refetchOnWindowFocus: true,
    },
  },
})

export default function App() {
  const clearUser = useAuthStore((s) => s.clearUser)

  useEffect(() => {
    const handler = () => {
      clearUser()
      queryClient.clear()
    }
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [clearUser])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
