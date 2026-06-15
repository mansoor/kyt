import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Cpu } from 'lucide-react'
import { getSoftwareUpdates } from '@/api/vehicle'
import { getDashboardSummary } from '@/api/dashboard'
import AppShell from '@/components/AppShell'

export default function UpdatesPage() {
  const [activeCar, setActiveCar] = useState<number | undefined>()

  const { data: dash } = useQuery({
    queryKey: ['dashboard', undefined],
    queryFn: () => getDashboardSummary(),
    staleTime: 5 * 60 * 1000,
  })
  const vehicles = dash?.vehicles ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['software-updates', activeCar],
    queryFn: () => getSoftwareUpdates(activeCar),
  })

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-ink text-xl font-bold flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" /> Software Updates
          </h1>
          {vehicles.length > 1 && (
            <select
              value={activeCar ?? ''}
              onChange={e => setActiveCar(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-ink/5 border border-ink/10 text-ink text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-blue"
            >
              <option value="">All vehicles</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.name ?? v.vin ?? `Car ${v.id}`}</option>
              ))}
            </select>
          )}
        </div>

        {isLoading && <div className="text-ink/40 text-sm py-12 text-center">Loading…</div>}

        {data && (
          <>
            {data.total === 0 ? (
              <div className="glass rounded-2xl p-10 text-center text-ink/30 text-sm">
                No software updates recorded yet.
              </div>
            ) : (
              <div className="glass rounded-2xl divide-y divide-ink/5">
                {data.updates.map((u) => (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                      <Cpu className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-ink font-semibold text-sm">
                        {u.version ?? 'Unknown version'}
                      </p>
                      <p className="text-ink/40 text-xs">
                        {formatDistanceToNow(parseISO(u.start_date), { addSuffix: true })}
                        {u.car_name && ` · ${u.car_name}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {u.duration_min != null && (
                        <p className="text-ink/50 text-xs">{Math.round(u.duration_min)} min</p>
                      )}
                      <p className={`text-xs font-medium mt-0.5 ${u.end_date ? 'text-green-400' : 'text-yellow-400'}`}>
                        {u.end_date ? 'Complete' : 'In progress'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
