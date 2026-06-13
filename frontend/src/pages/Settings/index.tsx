import { useNavigate } from 'react-router-dom'
import { LogOut, Zap } from 'lucide-react'
import { logout } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import TeslaConnect from './TeslaConnect'

export default function SettingsPage() {
  const clearUser = useAuthStore((s) => s.clearUser)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    clearUser()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-brand-dark">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-red flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-white font-bold tracking-tight">Know Your Tesla</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-sm">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <div>
          <button
            onClick={() => navigate('/')}
            className="text-white/50 hover:text-white text-sm mb-6 transition-colors"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-white text-2xl font-bold">Settings</h1>
          <p className="text-white/50 mt-1 text-sm">Manage your Tesla connection and account preferences.</p>
        </div>

        {/* Tesla section */}
        <section className="glass rounded-2xl p-6">
          <TeslaConnect />
        </section>

        {/* Account section */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-white font-semibold text-base mb-4">Account</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Email</span>
              <span className="text-white">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Role</span>
              <span className="text-white">{user?.is_superuser ? 'Administrator' : 'User'}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
