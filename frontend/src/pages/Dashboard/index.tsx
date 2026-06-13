import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LogOut, Zap, Settings, BatteryMedium, Car } from 'lucide-react'
import { logout } from '@/api/auth'
import { getVehicles } from '@/api/tesla'
import { useAuthStore } from '@/store/authStore'

const STATE_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  driving: 'bg-brand-blue',
  charging: 'bg-yellow-500',
  asleep: 'bg-white/20',
  updating: 'bg-purple-500',
  offline: 'bg-red-500',
  unknown: 'bg-white/10',
}

export default function DashboardPage() {
  const { user, clearUser } = useAuthStore()
  const navigate = useNavigate()

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
    refetchInterval: 30_000,
  })

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearUser()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-brand-dark">
      {/* Top nav */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-red flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-white font-bold tracking-tight">Know Your Tesla</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="text-white/50 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <span className="text-white/20">|</span>
          <span className="text-white/50 text-sm">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-white/50 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Vehicles */}
        {vehicles.length > 0 ? (
          <>
            <h2 className="text-white/60 text-sm font-medium uppercase tracking-wider">Your Vehicles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vehicles.map((v) => (
                <div key={v.id} className="glass rounded-2xl p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-semibold">{v.name ?? v.vin ?? `Car ${v.id}`}</p>
                      <p className="text-white/40 text-sm">{v.model ?? '—'}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${STATE_COLORS[v.state] ?? 'bg-white/10'} text-white capitalize`}>
                      {v.state}
                    </span>
                  </div>
                  {v.battery_level !== null && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50 flex items-center gap-1"><BatteryMedium className="w-4 h-4" /> Battery</span>
                        <span className="text-white font-medium">{v.battery_level}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-blue transition-all duration-1000"
                          style={{ width: `${v.battery_level}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-center py-20 gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Car className="w-8 h-8 text-white/30" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold mb-2">No vehicles connected</h1>
              <p className="text-white/50 text-sm max-w-xs">
                Connect your Tesla account in Settings to start collecting data.
              </p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 bg-brand-blue hover:bg-blue-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              Go to Settings
            </button>
          </div>
        )}

        {/* Nav grid (future pages) */}
        {vehicles.length > 0 && (
          <div>
            <h2 className="text-white/60 text-sm font-medium uppercase tracking-wider mb-4">Pages</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {['Drives', 'Charges', 'Efficiency', 'Battery Health', 'Timeline', 'Statistics'].map((label) => (
                <div
                  key={label}
                  className="glass rounded-xl p-4 text-white/30 text-sm font-medium cursor-not-allowed select-none"
                >
                  {label}
                  <span className="block text-xs text-white/20 mt-0.5">Coming in Phase 3</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
