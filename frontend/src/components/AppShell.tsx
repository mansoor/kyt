import { ReactNode } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Zap, LayoutDashboard, Car, BatteryCharging, BarChart2, Settings, LogOut } from 'lucide-react'
import { logout } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/drives', label: 'Drives', icon: Car },
  { to: '/charges', label: 'Charges', icon: BatteryCharging },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, clearUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearUser()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col">
      <header className="border-b border-white/10 px-6 py-3 flex items-center gap-6 shrink-0">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded-md bg-brand-red flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-white font-bold tracking-tight hidden sm:block">KYT</span>
        </div>

        <nav className="flex items-center gap-1 flex-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${active ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/settings"
            className={`text-sm transition-colors flex items-center gap-1.5
              ${location.pathname === '/settings' ? 'text-white' : 'text-white/50 hover:text-white'}`}
          >
            <Settings className="w-4 h-4" />
          </Link>
          <span className="text-white/20 hidden sm:block">|</span>
          <span className="text-white/40 text-sm hidden sm:block">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-white/50 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
