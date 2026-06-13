import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { Battery, TrendingDown, Zap, Activity } from 'lucide-react'
import { getBatteryHealth } from '@/api/vehicle'
import { getDashboardSummary } from '@/api/dashboard'
import AppShell from '@/components/AppShell'
import { useState } from 'react'

const tooltipStyle = {
  contentStyle: { background: '#0D1B2A', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#ffffff80' },
  itemStyle: { color: '#fff' },
}

export default function BatteryPage() {
  const [activeCar, setActiveCar] = useState<number | undefined>()

  const { data: dash } = useQuery({
    queryKey: ['dashboard', undefined],
    queryFn: () => getDashboardSummary(),
    staleTime: 5 * 60 * 1000,
  })
  const vehicles = dash?.vehicles ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['battery-health', activeCar],
    queryFn: () => getBatteryHealth(activeCar),
  })

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <Battery className="w-5 h-5 text-green-400" /> Battery Health
          </h1>
          {vehicles.length > 1 && (
            <select
              value={activeCar ?? ''}
              onChange={e => setActiveCar(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-blue"
            >
              <option value="">All vehicles</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.name ?? v.vin ?? `Car ${v.id}`}</option>
              ))}
            </select>
          )}
        </div>

        {isLoading && <div className="text-white/40 text-sm py-12 text-center">Loading…</div>}

        {data && (
          <>
            {/* Degradation KPIs */}
            {data.degradation ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Peak Range', value: `${data.degradation.peak_km} km`, icon: Activity, color: 'text-green-400' },
                  { label: 'Current Range', value: `${data.degradation.current_km} km`, icon: Battery, color: 'text-brand-blue' },
                  { label: 'Lost', value: `${data.degradation.lost_km} km`, icon: TrendingDown, color: 'text-red-400' },
                  { label: 'Retained', value: `${data.degradation.pct_retained}%`, icon: Zap, color: 'text-yellow-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="glass rounded-2xl p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                      <p className="text-white/40 text-xs">{label}</p>
                    </div>
                    <p className="text-white font-bold text-xl">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass rounded-2xl p-5 text-white/40 text-sm text-center">
                Not enough data yet. Battery health tracking requires positions with high SoC (≥90%).
              </div>
            )}

            {/* Charge cycles */}
            <div className="glass rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-white/40 text-xs mb-0.5">Estimated Charge Cycles</p>
                <p className="text-white font-bold text-lg">{data.estimated_charge_cycles.toLocaleString()}</p>
              </div>
              <p className="text-white/30 text-xs ml-auto text-right max-w-48">
                Counted as charging sessions with &gt;10 kWh added.
              </p>
            </div>

            {/* Range over time */}
            {data.weekly.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h2 className="text-white/60 text-sm font-medium mb-4">Max Observed Range at ≥90% SoC (weekly)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.weekly} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#ffffff08" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={d => d.slice(0, 7)} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false}
                      domain={['auto', 'auto']} unit=" km" />
                    <Tooltip {...tooltipStyle}
                      formatter={(v: unknown) => [`${v} km`, 'Max rated range']} />
                    {data.degradation && (
                      <ReferenceLine y={data.degradation.peak_km} stroke="#22C55E40" strokeDasharray="4 4"
                        label={{ value: 'Peak', fill: '#22C55E80', fontSize: 10 }} />
                    )}
                    <Area type="monotone" dataKey="max_rated_km" stroke="#22C55E" fill="url(#rangeGrad)"
                      strokeWidth={2} dot={false} name="max_rated_km" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Weekly data table */}
            {data.weekly.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h2 className="text-white/60 text-sm font-medium mb-4">Weekly Range History</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        {['Week', 'Max Rated Range', 'Samples'].map(h => (
                          <th key={h} className="text-left text-white/40 font-medium pb-2 pr-6">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.weekly].reverse().map(w => (
                        <tr key={w.week} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 pr-6 text-white/60">{w.week}</td>
                          <td className="py-2 pr-6 text-white font-medium">{w.max_rated_km} km</td>
                          <td className="py-2 pr-6 text-white/40">{w.samples}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
