import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UserOut } from '@/types/auth'
import { applyTheme, watchSystemTheme } from '@/theme'

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
      setUser: (user) => {
        if (user.theme) {
          applyTheme(user.theme)
          watchSystemTheme(user.theme)
        }
        set({ user, isAuthenticated: true })
      },
      clearUser: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'kyt-auth',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
