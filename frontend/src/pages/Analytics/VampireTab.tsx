import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { getVampireDrain } from '@/api/analytics'
import KpiCard from '@/components/KpiCard'

interface Props { carId?: number; days: number }

const tooltipStyle = {
  contentStyle: { background: '#0D1B2A', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#ffffff80' },
  itemStyle: { color: '#fff' },
}

export default function VampireTab({ carId, days }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-vampire', carId, days],
    queryFn: () => getVampireDrain(carId, days),
  })

  if (isLoading) return <div className="text-ink/40 text-sm py-12 text-center">Loading…</div>
  if (!data) return null

  const { kpis, by_day } = data

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-4 flex items-start gap-3">
        <div className="text-purple-400 text-lg shrink-0 mt-0.5">🧛</div>
        <p className="text-ink/50 text-sm">
          Vampire drain is battery % lost while the car is parked (sleeping or idle). Lower is better.
          Sentry mode, pre-conditioning, and poor cell temperatures all increase drain.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Avg / Hour" value={kpis.avg_drain_pct_per_hour} sub="%" />
        <KpiCard label="Avg / Day" value={kpis.avg_drain_pct_per_day} sub="%" />
        <KpiCard label="Total Lost" value={kpis.total_drain_pct} sub="%" />
        <KpiCard label="Days with Data" value={kpis.days_with_data} />
      </div>

      {/* Daily drain bar chart */}
      {by_day.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h3 className="text-ink/60 text-sm font-medium mb-4">Daily Vampire Drain (%)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={by_day} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle}
                formatter={(v: unknown, n: unknown) => [
                  n === 'total_drain_pct' ? `${v}%` : `${v} hr`,
                  n === 'total_drain_pct' ? 'Battery lost' : 'Parked hours',
                ] as [string, string]} />
              <Bar dataKey="total_drain_pct" fill="#A855F7" radius={[3, 3, 0, 0]} name="total_drain_pct" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Drain rate line */}
      {by_day.filter(d => d.avg_drain_pct_hr != null).length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h3 className="text-ink/60 text-sm font-medium mb-4">Drain Rate (%/hour)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={by_day} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle}
                formatter={(v: unknown) => [`${v}%/hr`, 'Drain rate'] as [string, string]} />
              <Bar dataKey="avg_drain_pct_hr" fill="#6366F1" radius={[3, 3, 0, 0]} name="avg_drain_pct_hr" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {by_day.length === 0 && (
        <div className="text-ink/30 text-sm text-center py-8">No parking data in the selected period.</div>
      )}
    </div>
  )
}
