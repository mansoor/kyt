import { useQuery } from '@tanstack/react-query'
import { getTimeline, TimelineDay } from '@/api/analytics'

interface Props { carId?: number }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function cellColor(day: TimelineDay): string {
  if (day.drives === 0 && day.charges === 0) return '#ffffff08'
  const km = day.distance_km
  if (km === 0 && day.charges > 0) return '#F59E0B40' // charge only
  if (km < 20) return '#1A73E830'
  if (km < 60) return '#1A73E870'
  if (km < 120) return '#1A73E8B0'
  return '#1A73E8'
}

function cellTitle(day: TimelineDay): string {
  const parts: string[] = [day.date]
  if (day.drives > 0) parts.push(`${day.drives} drive${day.drives > 1 ? 's' : ''}, ${day.distance_km} km`)
  if (day.charges > 0) parts.push(`${day.charges} charge${day.charges > 1 ? 's' : ''}, ${day.charge_kwh} kWh`)
  return parts.join('\n')
}

export default function TimelineTab({ carId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-timeline', carId],
    queryFn: () => getTimeline(carId),
  })

  if (isLoading) return <div className="text-white/40 text-sm py-12 text-center">Loading…</div>
  if (!data) return null

  const { days } = data

  // Build week columns: pad start so first day aligns to correct weekday
  const firstDate = new Date(days[0]?.date + 'T00:00:00')
  const startPad = firstDate.getDay() // 0=Sun
  const padded: (TimelineDay | null)[] = [
    ...Array(startPad).fill(null),
    ...days,
  ]
  // Chunk into weeks
  const weeks: (TimelineDay | null)[][] = []
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7))
  }

  // Month labels: find the first week index where month changes
  const monthLabels: { weekIdx: number; label: string }[] = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    const firstReal = week.find(d => d !== null)
    if (!firstReal) return
    const m = new Date(firstReal.date + 'T00:00:00').getMonth()
    if (m !== lastMonth) {
      monthLabels.push({ weekIdx: wi, label: MONTHS[m] })
      lastMonth = m
    }
  })

  // Aggregate KPIs
  const totalDrives = days.reduce((s, d) => s + d.drives, 0)
  const totalKm = days.reduce((s, d) => s + d.distance_km, 0)
  const totalCharges = days.reduce((s, d) => s + d.charges, 0)
  const totalChargeKwh = days.reduce((s, d) => s + d.charge_kwh, 0)
  const activeDays = days.filter(d => d.drives > 0 || d.charges > 0).length

  const CELL = 13 // cell size px
  const GAP = 2

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        {[
          { label: 'Active Days', value: activeDays },
          { label: 'Total Drives', value: totalDrives },
          { label: 'Total km', value: `${totalKm.toFixed(0)}` },
          { label: 'Charges', value: totalCharges },
          { label: 'Energy Added', value: `${totalChargeKwh.toFixed(0)} kWh` },
        ].map(({ label, value }) => (
          <div key={label} className="glass rounded-xl p-4">
            <p className="text-white/40 text-xs mb-1">{label}</p>
            <p className="text-white font-bold text-lg">{value}</p>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="glass rounded-2xl p-5 overflow-x-auto">
        <h3 className="text-white/60 text-sm font-medium mb-4">Activity — Last 12 Months</h3>
        <div className="min-w-max">
          {/* Month labels */}
          <div className="flex mb-1" style={{ marginLeft: 28 }}>
            {weeks.map((_, wi) => {
              const ml = monthLabels.find(m => m.weekIdx === wi)
              return (
                <div key={wi} style={{ width: CELL + GAP, flexShrink: 0 }}>
                  {ml && <span className="text-white/40 text-[10px]">{ml.label}</span>}
                </div>
              )
            })}
          </div>
          {/* Grid */}
          <div className="flex gap-0.5">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1">
              {DAYS.map((d, i) => (
                <div key={d} style={{ height: CELL, fontSize: 9, color: '#ffffff40', lineHeight: `${CELL}px` }}>
                  {i % 2 === 1 ? d.slice(0, 1) : ''}
                </div>
              ))}
            </div>
            {/* Week columns */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {Array(7).fill(null).map((_, di) => {
                  const cell = week[di] ?? null
                  return (
                    <div
                      key={di}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 2,
                        background: cell ? cellColor(cell) : '#ffffff05',
                        cursor: cell && (cell.drives > 0 || cell.charges > 0) ? 'default' : 'default',
                        flexShrink: 0,
                      }}
                      title={cell ? cellTitle(cell) : ''}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 text-white/40 text-xs">
          <span>Less</span>
          {['#ffffff08', '#1A73E830', '#1A73E870', '#1A73E8B0', '#1A73E8'].map(c => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
          ))}
          <span>More</span>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: '#F59E0B40' }} className="ml-3" />
          <span>Charge only</span>
        </div>
      </div>

      {days.length === 0 && (
        <div className="text-white/30 text-sm text-center py-8">No activity in the last year.</div>
      )}
    </div>
  )
}
