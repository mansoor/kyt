import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { parseISO, formatDistanceToNow } from 'date-fns'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Car, BatteryMedium, Zap, Route, Clock, Settings } from 'lucide-react'
import { getDashboardSummary } from '@/api/dashboard'
import AppShell from '@/components/AppShell'
import KpiCard from '@/components/KpiCard'

const STATE_DOT: Record<string, string> = {
  online: 'bg-green-400',
  driving: 'bg-brand-blue',
  charging: 'bg-yellow-400',
  asleep: 'bg-white/20',
  updating: 'bg-purple-400',
  offline: 'bg-red-400',
  unknown: 'bg-white/10',
}

function fmt(n: number | null | undefined, unit = '') {
  if (n == null) return '—'
  return `${n.toLocaleString()}${unit}`
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [activeCar, setActiveCar] = useState<number | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', activeCar],
    queryFn: () => getDashboardSummary(activeCar),
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-white/40">Loading…</div>
      </AppShell>
    )
  }

  const { vehicles = [], kpis, battery_history = [], recent_activity = [] } = data ?? {}

  if (vehicles.length === 0) {
    return (
      <AppShell>
        <div className="flex flex-col items-center text-center py-24 gap-5 px-6">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Car className="w-7 h-7 text-white/30" />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold mb-1">No vehicles connected</h1>
            <p className="text-white/50 text-sm">Connect your Tesla account in Settings to start.</p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 bg-brand-blue hover:bg-blue-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" /> Go to Settings
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Vehicle selector + cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveCar(activeCar === v.id ? undefined : v.id)}
              className={`glass rounded-2xl p-5 text-left transition-all ${activeCar === v.id ? 'ring-2 ring-brand-blue' : 'hover:bg-white/10'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white font-semibold">{v.name ?? v.vin ?? `Car ${v.id}`}</p>
                  <p className="text-white/40 text-xs">{v.model ?? '—'}</p>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${STATE_DOT[v.state] ?? 'bg-white/10'}`} />
              </div>
              {v.battery_level !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50 flex items-center gap-1">
                      <BatteryMedium className="w-3.5 h-3.5" /> Battery
                    </span>
                    <span className="text-white font-medium">{v.battery_level}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-brand-blue transition-all"
                      style={{ width: `${v.battery_level}%` }}
                    />
                  </div>
                </div>
              )}
              <p className="text-white/30 text-xs mt-2 capitalize">{v.state}</p>
            </button>
          ))}
        </div>

        {/* 7-day KPIs */}
        {kpis && (
          <>
            <h2 className="text-white/50 text-xs font-medium uppercase tracking-wider">Last 7 Days</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Drives" value={kpis.drives} />
              <KpiCard label="Distance" value={fmt(kpis.distance_km)} sub="km" />
              <KpiCard label="Energy used" value={fmt(kpis.energy_consumed_kwh)} sub="kWh" />
              <KpiCard label="Energy added" value={fmt(kpis.energy_added_kwh)} sub="kWh" />
            </div>
          </>
        )}

        {/* Battery history chart */}
        {battery_history.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <h2 className="text-white/60 text-sm font-medium mb-4">Battery Level — Last 30 Days</h2>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={battery_history} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="battGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1A73E8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1A73E8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0D1B2A', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#ffffff80' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="avg" stroke="#1A73E8" fill="url(#battGrad)" strokeWidth={2} dot={false} name="Avg %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent activity */}
        {recent_activity.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <h2 className="text-white/60 text-sm font-medium mb-4">Recent Activity</h2>
            <div className="space-y-2">
              {recent_activity.map((ev, i) => (
                <button
                  key={i}
                  onClick={() => navigate(ev.type === 'drive' ? `/drives/${ev.id}` : `/charges/${ev.id}`)}
                  className="w-full flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ev.type === 'drive' ? 'bg-brand-blue/20' : 'bg-yellow-500/20'}`}>
                    {ev.type === 'drive'
                      ? <Route className="w-4 h-4 text-brand-blue" />
                      : <Zap className="w-4 h-4 text-yellow-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium capitalize">{ev.type}</p>
                    <p className="text-white/40 text-xs">
                      {formatDistanceToNow(parseISO(ev.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {ev.type === 'drive' && ev.distance_km != null && (
                      <p className="text-white text-sm">{ev.distance_km} km</p>
                    )}
                    {ev.type === 'charge' && ev.energy_added_kwh != null && (
                      <p className="text-white text-sm">{ev.energy_added_kwh} kWh</p>
                    )}
                    {ev.duration_min != null && (
                      <p className="text-white/40 text-xs flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />{ev.duration_min}m
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
