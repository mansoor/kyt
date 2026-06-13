import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Cell,
} from 'recharts'
import { getChargingStats } from '@/api/analytics'
import KpiCard from '@/components/KpiCard'

interface Props { carId?: number; days: number }

const YELLOW = '#F59E0B'
const BLUE = '#1A73E8'

function fmt(n: number | null | undefined, unit = '') {
  if (n == null) return '—'
  return `${n.toLocaleString()}${unit}`
}

const tooltipStyle = {
  contentStyle: { background: '#0D1B2A', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#ffffff80' },
  itemStyle: { color: '#fff' },
}

export default function ChargingTab({ carId, days }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-charging', carId, days],
    queryFn: () => getChargingStats(carId, days),
  })

  if (isLoading) return <div className="text-white/40 text-sm py-12 text-center">Loading…</div>
  if (!data) return null

  const { kpis, by_month, by_hour, soc_distribution } = data

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Sessions" value={fmt(kpis.sessions)} />
        <KpiCard label="Total Added" value={fmt(kpis.total_kwh)} sub="kWh" />
        <KpiCard label="Avg Session" value={fmt(kpis.avg_kwh_per_session)} sub="kWh" />
        <KpiCard label="Avg Rate" value={fmt(kpis.avg_charge_rate_kw)} sub="kW" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Avg Duration" value={fmt(Math.round(kpis.avg_duration_min))} sub="min" />
        <KpiCard label="Avg Start SoC" value={fmt(Math.round(kpis.avg_start_soc))} sub="%" />
        <KpiCard label="Avg End SoC" value={fmt(Math.round(kpis.avg_end_soc))} sub="%" />
        <KpiCard label="Total Cost" value={kpis.total_cost > 0 ? fmt(kpis.total_cost, '') : '—'} sub={kpis.total_cost > 0 ? '$' : ''} />
      </div>

      {/* Monthly bar chart */}
      {by_month.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h3 className="text-white/60 text-sm font-medium mb-4">Monthly Energy Added (kWh)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={by_month} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={m => m.slice(5)} />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown, n: unknown) => [
                String(n === 'total_kwh' ? `${v} kWh` : v),
                n === 'total_kwh' ? 'Energy Added' : 'Sessions'
              ] as [string, string]} />
              <Bar dataKey="total_kwh" fill={YELLOW} radius={[4, 4, 0, 0]} name="total_kwh" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By hour of day */}
        <div className="glass rounded-2xl p-5">
          <h3 className="text-white/60 text-sm font-medium mb-4">Sessions by Hour of Day</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={by_hour} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#ffffff40', fontSize: 9 }} tickLine={false} axisLine={false}
                tickFormatter={h => `${h}:00`} interval={3} />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [String(v), 'Sessions'] as [string, string]}
                labelFormatter={(h: unknown) => `${h}:00 – ${Number(h) + 1}:00`} />
              <Bar dataKey="sessions" radius={[3, 3, 0, 0]} name="sessions">
                {by_hour.map((entry, i) => (
                  <Cell key={i} fill={entry.sessions > 0 ? BLUE : '#ffffff15'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* SoC start distribution */}
        <div className="glass rounded-2xl p-5">
          <h3 className="text-white/60 text-sm font-medium mb-4">Start SoC Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={soc_distribution} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="range" tick={{ fill: '#ffffff40', fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [String(v), 'Sessions'] as [string, string]} />
              <Bar dataKey="count" fill="#0D9488" radius={[3, 3, 0, 0]} name="count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {by_month.length === 0 && (
        <div className="text-white/30 text-sm text-center py-8">No charging data in the selected period.</div>
      )}
    </div>
  )
}
