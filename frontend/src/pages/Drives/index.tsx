import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, subDays } from 'date-fns'
import { ChevronLeft, ChevronRight, Download, ArrowUpDown } from 'lucide-react'
import { listDrives, exportDrivesUrl } from '@/api/drives'
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

export default function DrivesPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('start_date')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [from] = useState(() => subDays(new Date(), 30).toISOString())
  const [to] = useState(() => new Date().toISOString())

  const { data, isLoading } = useQuery({
    queryKey: ['drives', page, sort, order, from, to],
    queryFn: () => listDrives({ from, to, page, page_size: 25, sort, order }),
    placeholderData: (prev) => prev,
  })

  function toggleSort(col: string) {
    if (sort === col) setOrder(o => o === 'desc' ? 'asc' : 'desc')
    else { setSort(col); setOrder('desc') }
    setPage(1)
  }

  const kpis = data?.kpis
  const drives = data?.drives ?? []

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-xl font-bold">Drives</h1>
          <a
            href={exportDrivesUrl({ from, to })}
            className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </a>
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <KpiCard label="Drives" value={kpis.total_drives} />
            <KpiCard label="Distance" value={`${fmt(kpis.total_km)} km`} />
            <KpiCard label="Drive time" value={fmtDuration(kpis.total_min)} />
            <KpiCard label="Energy used" value={`${fmt(kpis.total_kwh)} kWh`} />
            <KpiCard label="Avg consumption" value={`${fmt(kpis.avg_consumption_wh_km)} Wh/km`} />
          </div>
        )}

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-white/40">Loading drives…</div>
          ) : drives.length === 0 ? (
            <div className="p-10 text-center text-white/40">No drives in the selected period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {[
                      { key: 'start_date', label: 'Date' },
                      { key: null, label: 'Route' },
                      { key: 'distance', label: 'Distance' },
                      { key: 'duration_min', label: 'Duration' },
                      { key: 'speed_max', label: 'Max Speed' },
                      { key: 'consumption_kWh', label: 'Energy' },
                      { key: null, label: 'Range Δ' },
                    ].map(({ key, label }) => (
                      <th
                        key={label}
                        onClick={() => key && toggleSort(key)}
                        className={`px-4 py-3 text-left text-white/50 font-medium ${key ? 'cursor-pointer hover:text-white' : ''}`}
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
                  {drives.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => navigate(`/drives/${d.id}`)}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                        {format(parseISO(d.start_date), 'MMM d, HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-white/60 max-w-xs truncate">
                        <span className="truncate block">{d.start_address ?? '—'}</span>
                        <span className="text-white/30 text-xs truncate block">{d.end_address ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{fmt(d.distance_km)} km</td>
                      <td className="px-4 py-3 text-white/70">{fmtDuration(d.duration_min)}</td>
                      <td className="px-4 py-3 text-white/70">{d.speed_max_kmh ?? '—'} km/h</td>
                      <td className="px-4 py-3 text-white/70">{fmt(d.consumption_kwh, 2)} kWh</td>
                      <td className="px-4 py-3 text-white/50 text-xs">
                        {d.start_range_km && d.end_range_km
                          ? `${fmt(d.start_range_km, 0)} → ${fmt(d.end_range_km, 0)} km`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
              <span className="text-white/40 text-sm">{data.total} total</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg disabled:opacity-30 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-white/50 text-sm">{page} / {data.pages}</span>
                <button
                  onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                  disabled={page === data.pages}
                  className="p-1.5 rounded-lg disabled:opacity-30 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
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
