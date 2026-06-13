import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UserOut } from '@/types/auth'

interface AuthStore {
  user: UserOut | null
  isAuthenticated: boolean
  setUser: (user: UserOut) => void
  clearUser: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearUser: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'kyt-auth',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
