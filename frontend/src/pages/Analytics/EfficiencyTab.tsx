import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
} from 'recharts'
import { getEfficiency } from '@/api/analytics'
import KpiCard from '@/components/KpiCard'

interface Props { carId?: number; days: number }

export default function EfficiencyTab({ carId, days }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-efficiency', carId, days],
    queryFn: () => getEfficiency(carId, days),
  })

  if (isLoading) return <div className="text-ink/40 text-sm py-12 text-center">Loading…</div>
  if (!data) return null

  const { kpis, by_day, by_temp, by_speed } = data

  const tooltipStyle = {
    contentStyle: { background: '#0D1B2A', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 },
    labelStyle: { color: '#ffffff80' },
    itemStyle: { color: '#fff' },
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Avg Efficiency" value={kpis.avg_wh_km} sub="Wh/km" />
        <KpiCard label="Best Drive" value={kpis.best_wh_km} sub="Wh/km" />
        <KpiCard label="Worst Drive" value={kpis.worst_wh_km} sub="Wh/km" />
        <KpiCard label="Avg Temp" value={kpis.avg_temp_c} sub="°C" />
      </div>

      {/* Daily efficiency line chart */}
      {by_day.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h3 className="text-ink/60 text-sm font-medium mb-4">Daily Average Efficiency (Wh/km)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={by_day} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${v} Wh/km`, 'Efficiency'] as [string, string]} />
              <Line type="monotone" dataKey="avg_wh_km" stroke="#1A73E8" strokeWidth={2} dot={false} name="Wh/km" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Temp scatter */}
        {by_temp.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <h3 className="text-ink/60 text-sm font-medium mb-4">Efficiency vs Outside Temp</h3>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#ffffff08" />
                <XAxis type="number" dataKey="temp" name="Temp" unit="°C"
                  tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="number" dataKey="wh_km" name="Wh/km"
                  tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                <ZAxis type="number" dataKey="km" range={[20, 100]} />
                <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }}
                  formatter={(v: unknown, n: unknown) => [n === 'wh_km' ? `${v} Wh/km` : `${v}°C`, n === 'wh_km' ? 'Efficiency' : 'Temp'] as [string, string]} />
                <ReferenceLine y={200} stroke="#ffffff15" strokeDasharray="4 4" />
                <Scatter data={by_temp} fill="#1A73E8" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Speed scatter */}
        {by_speed.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <h3 className="text-ink/60 text-sm font-medium mb-4">Efficiency vs Max Speed</h3>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#ffffff08" />
                <XAxis type="number" dataKey="speed" name="Speed" unit=" km/h"
                  tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="number" dataKey="wh_km" name="Wh/km"
                  tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                <ZAxis type="number" dataKey="km" range={[20, 100]} />
                <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }}
                  formatter={(v: unknown, n: unknown) => [n === 'wh_km' ? `${v} Wh/km` : `${v} km/h`, n === 'wh_km' ? 'Efficiency' : 'Speed'] as [string, string]} />
                <Scatter data={by_speed} fill="#0D9488" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {by_day.length === 0 && by_temp.length === 0 && (
        <div className="text-ink/30 text-sm text-center py-8">No drive data in the selected period.</div>
      )}
    </div>
  )
}
