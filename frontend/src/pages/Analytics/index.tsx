import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart2, Zap, Ghost, CalendarDays } from 'lucide-react'
import { getDashboardSummary } from '@/api/dashboard'
import AppShell from '@/components/AppShell'
import EfficiencyTab from './EfficiencyTab'
import ChargingTab from './ChargingTab'
import VampireTab from './VampireTab'
import TimelineTab from './TimelineTab'

const TABS = [
  { id: 'efficiency', label: 'Efficiency', icon: BarChart2 },
  { id: 'charging', label: 'Charging', icon: Zap },
  { id: 'vampire', label: 'Vampire Drain', icon: Ghost },
  { id: 'timeline', label: 'Timeline', icon: CalendarDays },
] as const

type TabId = typeof TABS[number]['id']

const DAYS_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '1 year' },
]

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('efficiency')
  const [activeCar, setActiveCar] = useState<number | undefined>()
  const [days, setDays] = useState(90)

  const { data: dash } = useQuery({
    queryKey: ['dashboard', undefined],
    queryFn: () => getDashboardSummary(),
    staleTime: 5 * 60 * 1000,
  })
  const vehicles = dash?.vehicles ?? []

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Header + controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-white text-xl font-bold">Analytics</h1>
          <div className="flex items-center gap-3">
            {/* Vehicle filter */}
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
            {/* Time range (hide on timeline tab) */}
            {activeTab !== 'timeline' && (
              <select
                value={days}
                onChange={e => setDays(Number(e.target.value))}
                className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-blue"
              >
                {DAYS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === id
                  ? 'bg-brand-blue text-white shadow'
                  : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'efficiency' && <EfficiencyTab carId={activeCar} days={days} />}
        {activeTab === 'charging' && <ChargingTab carId={activeCar} days={days} />}
        {activeTab === 'vampire' && <VampireTab carId={activeCar} days={Math.min(days, 90)} />}
        {activeTab === 'timeline' && <TimelineTab carId={activeCar} />}

      </div>
    </AppShell>
  )
}
