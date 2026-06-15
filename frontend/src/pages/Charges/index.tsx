import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, subDays } from 'date-fns'
import { ChevronLeft, ChevronRight, Download, ArrowUpDown } from 'lucide-react'
import { listCharges, exportChargesUrl } from '@/api/charges'
import AppShell from '@/components/AppShell'
import KpiCard from '@/components/KpiCard'

function fmt(n: number | null | undefined, dec = 1) {
  return n != null ? n.toFixed(dec) : '—'
}

function fmtDuration(min: number | null | undefined) {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function ChargesPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('start_date')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [from] = useState(() => subDays(new Date(), 30).toISOString())
  const [to] = useState(() => new Date().toISOString())

  const { data, isLoading } = useQuery({
    queryKey: ['charges', page, sort, order, from, to],
    queryFn: () => listCharges({ from, to, page, page_size: 25, sort, order }),
    placeholderData: (prev) => prev,
  })

  function toggleSort(col: string) {
    if (sort === col) setOrder(o => o === 'desc' ? 'asc' : 'desc')
    else { setSort(col); setOrder('desc') }
    setPage(1)
  }

  const kpis = data?.kpis
  const charges = data?.charges ?? []

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-ink text-xl font-bold">Charges</h1>
          <a
            href={exportChargesUrl({ from, to })}
            className="flex items-center gap-1.5 text-ink/50 hover:text-ink text-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </a>
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <KpiCard label="Sessions" value={kpis.total_charges} />
            <KpiCard label="Energy added" value={`${fmt(kpis.total_kwh_added)} kWh`} />
            <KpiCard label="Energy used" value={`${fmt(kpis.total_kwh_used)} kWh`} />
            <KpiCard label="Total cost" value={`$${fmt(kpis.total_cost, 2)}`} />
            <KpiCard label="Avg duration" value={fmtDuration(kpis.avg_duration_min)} />
          </div>
        )}

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-ink/40">Loading charges…</div>
          ) : charges.length === 0 ? (
            <div className="p-10 text-center text-ink/40">No charges in the selected period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10">
                    {[
                      { key: 'start_date', label: 'Date' },
                      { key: null, label: 'Location' },
                      { key: null, label: 'SoC' },
                      { key: 'charge_energy_added', label: 'Energy' },
                      { key: 'duration_min', label: 'Duration' },
                      { key: null, label: 'Range gained' },
                      { key: null, label: 'Efficiency' },
                      { key: 'cost', label: 'Cost' },
                    ].map(({ key, label }) => (
                      <th
                        key={label}
                        onClick={() => key && toggleSort(key)}
                        className={`px-4 py-3 text-left text-ink/50 font-medium ${key ? 'cursor-pointer hover:text-ink' : ''}`}
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          {key && sort === key && <ArrowUpDown className="w-3 h-3" />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {charges.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/charges/${c.id}`)}
                      className="border-b border-ink/5 hover:bg-ink/5 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-ink/70 whitespace-nowrap">
                        {format(parseISO(c.start_date), 'MMM d, HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-ink/70 max-w-xs truncate">{c.location}</td>
                      <td className="px-4 py-3 text-ink/70 whitespace-nowrap">
                        {c.start_battery ?? '—'}% → {c.end_battery ?? '—'}%
                      </td>
                      <td className="px-4 py-3 text-ink font-medium">{fmt(c.energy_added_kwh)} kWh</td>
                      <td className="px-4 py-3 text-ink/70">{fmtDuration(c.duration_min)}</td>
                      <td className="px-4 py-3 text-ink/70">{c.range_gained_km != null ? `+${fmt(c.range_gained_km, 0)} km` : '—'}</td>
                      <td className="px-4 py-3 text-ink/70">{c.efficiency_pct != null ? `${fmt(c.efficiency_pct)}%` : '—'}</td>
                      <td className="px-4 py-3 text-ink/70">{c.cost != null ? `$${fmt(c.cost, 2)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-ink/10">
              <span className="text-ink/40 text-sm">{data.total} total</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg disabled:opacity-30 text-ink/60 hover:text-ink hover:bg-ink/10 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-ink/50 text-sm">{page} / {data.pages}</span>
                <button
                  onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                  disabled={page === data.pages}
                  className="p-1.5 rounded-lg disabled:opacity-30 text-ink/60 hover:text-ink hover:bg-ink/10 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
