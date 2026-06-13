import { useNavigate } from 'react-router-dom'
import { LogOut, Zap } from 'lucide-react'
import { logout } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

export default function DashboardPage() {
  const { user, clearUser } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearUser()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top nav */}
      <header className="bg-brand-dark border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-red flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-white font-bold text-lg">Know Your Tesla</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/60 text-sm">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-white/50 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      {/* Phase 1 placeholder */}
      <main className="max-w-4xl mx-auto px-6 py-20 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-brand-dark flex items-center justify-center">
          <Zap className="w-9 h-9 text-brand-blue fill-brand-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Welcome to Know Your Tesla</h1>
          <p className="text-neutral-500 max-w-md">
            Phase 1 complete — authentication and infrastructure are live.
            Connect a Tesla vehicle in <strong>Settings</strong> to start collecting data.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center mt-4">
          {['Dashboard', 'Drives', 'Charges', 'Efficiency', 'Battery Health', 'Settings'].map((label) => (
            <span
              key={label}
              className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-400 text-sm border border-neutral-200"
            >
              {label}
            </span>
          ))}
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          Remaining pages are built in Phase 3–5
        </p>
      </main>
    </div>
  )
}
