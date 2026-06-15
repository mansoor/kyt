import { ReactNode, useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Zap, LayoutDashboard, Car, BatteryCharging, BarChart2,
  Battery, MapPin, Crosshair, Cpu, Settings, LogOut, ChevronDown,
} from 'lucide-react'
import { logout } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

const PRIMARY_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/drives', label: 'Drives', icon: Car },
  { to: '/charges', label: 'Charges', icon: BatteryCharging },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
]

const MORE_NAV = [
  { to: '/battery', label: 'Battery Health', icon: Battery },
  { to: '/locations', label: 'Locations', icon: MapPin },
  { to: '/geofences', label: 'Geofences', icon: Crosshair },
  { to: '/updates', label: 'Software Updates', icon: Cpu },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, clearUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearUser()
    navigate('/login', { replace: true })
  }

  const moreActive = MORE_NAV.some(n => location.pathname.startsWith(n.to))

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="border-b border-ink/10 px-4 py-3 flex items-center gap-4 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md bg-brand-red flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-ink font-bold tracking-tight hidden sm:block">KYT</span>
        </div>

        {/* Primary nav */}
        <nav className="flex items-center gap-0.5 flex-1 overflow-hidden">
          {PRIMARY_NAV.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                  ${active ? 'bg-ink/10 text-ink' : 'text-ink/50 hover:text-ink hover:bg-ink/5'}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            )
          })}

          {/* More dropdown */}
          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreOpen(o => !o)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${moreActive || moreOpen ? 'bg-ink/10 text-ink' : 'text-ink/50 hover:text-ink hover:bg-ink/5'}`}
            >
              <span className="hidden md:inline">More</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>

            {moreOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-52 bg-paper border border-ink/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                {MORE_NAV.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname.startsWith(to)
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                        ${active ? 'bg-ink/10 text-ink' : 'text-ink/50 hover:text-ink hover:bg-ink/5'}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/settings"
            className={`p-1.5 rounded-lg transition-colors
              ${location.pathname === '/settings' ? 'text-ink bg-ink/10' : 'text-ink/50 hover:text-ink hover:bg-ink/5'}`}
          >
            <Settings className="w-4 h-4" />
          </Link>
          <span className="text-ink/20 hidden sm:block">|</span>
          <span className="text-ink/40 text-sm hidden lg:block max-w-32 truncate">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="p-1.5 text-ink/50 hover:text-ink hover:bg-ink/5 rounded-lg transition-colors"
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
