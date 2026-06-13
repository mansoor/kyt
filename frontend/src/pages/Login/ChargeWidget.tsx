import { useQuery } from '@tanstack/react-query'
import { getChargeLevel } from '@/api/auth'
import type { VehicleChargeLevel } from '@/types/auth'

// ── SVG circular gauge ────────────────────────────────────────────────────────
function BatteryGauge({ level }: { level: number | null }) {
  const SIZE = 120
  const STROKE = 10
  const R = (SIZE - STROKE) / 2
  const CENTER = SIZE / 2
  // 240° arc starting at 150° (bottom-left), going clockwise
  const ARC_DEG = 240
  const START_DEG = 150
  const circumference = 2 * Math.PI * R
  const arcLength = (ARC_DEG / 360) * circumference
  const filled = level != null ? (level / 100) * arcLength : 0

  function polar(deg: number) {
    const rad = (deg * Math.PI) / 180
    return {
      x: CENTER + R * Math.cos(rad),
      y: CENTER + R * Math.sin(rad),
    }
  }

  function describeArc(startDeg: number, sweepDeg: number) {
    const start = polar(startDeg)
    const end = polar(startDeg + sweepDeg)
    const large = sweepDeg > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${R} ${R} 0 ${large} 1 ${end.x} ${end.y}`
  }

  const arcColor =
    level == null ? '#4B5563'
    : level <= 20  ? '#DC2626'
    : level <= 50  ? '#D97706'
    : '#059669'

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      {/* Background arc */}
      <path
        d={describeArc(START_DEG, ARC_DEG)}
        fill="none"
        stroke="#1F2937"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      {/* Filled arc */}
      {filled > 0 && (
        <path
          d={describeArc(START_DEG, (filled / arcLength) * ARC_DEG)}
          fill="none"
          stroke={arcColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease-out' }}
        />
      )}
      {/* Centre text */}
      <text
        x={CENTER}
        y={CENTER - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize="22"
        fontWeight="700"
        fontFamily="Inter, sans-serif"
      >
        {level != null ? `${level}%` : '--'}
      </text>
    </svg>
  )
}

// ── State badge ───────────────────────────────────────────────────────────────
function StateBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; color: string }> = {
    Charging:      { label: 'Charging',    color: 'bg-brand-teal/20 text-teal-300 border-teal-500/30' },
    Complete:      { label: 'Full',        color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    Disconnected:  { label: 'Disconnected', color: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30' },
    unknown:       { label: 'No data',     color: 'bg-neutral-500/20 text-neutral-500 border-neutral-500/30' },
  }
  const { label, color } = map[state] ?? { label: state, color: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${color}`}>
      {label}
    </span>
  )
}

// ── Single vehicle card ───────────────────────────────────────────────────────
function VehicleCard({ v }: { v: VehicleChargeLevel }) {
  return (
    <div className="glass rounded-2xl p-4 min-w-[160px] flex flex-col items-center gap-3">
      <p className="text-white/70 text-sm font-medium truncate max-w-[140px]">{v.name}</p>
      <BatteryGauge level={v.battery_level} />
      {v.est_battery_range_km != null && (
        <p className="text-white text-sm font-semibold">{Math.round(v.est_battery_range_km)} km</p>
      )}
      <StateBadge state={v.charging_state} />
      {v.charge_rate_km != null && v.charging_state === 'Charging' && (
        <p className="text-teal-400 text-xs">+{Math.round(v.charge_rate_km)} km/h</p>
      )}
    </div>
  )
}

// ── Placeholder card (no vehicles registered) ─────────────────────────────────
function PlaceholderCard() {
  return (
    <div className="glass rounded-2xl p-4 min-w-[160px] flex flex-col items-center gap-3 opacity-60">
      <p className="text-white/50 text-sm">No vehicles</p>
      <BatteryGauge level={null} />
      <p className="text-white/40 text-xs text-center">Connect a Tesla in Settings</p>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function ChargeWidget() {
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['public', 'charge-level'],
    queryFn: getChargeLevel,
    refetchInterval: 60_000,
    staleTime: 55_000,
  })

  const vehicles = data?.vehicles ?? []
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Vehicle cards row */}
      <div className="flex gap-3 overflow-x-auto pb-2 justify-center w-full">
        {isLoading ? (
          <div className="glass rounded-2xl p-4 min-w-[160px] flex items-center justify-center h-[220px]">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : vehicles.length === 0 ? (
          <PlaceholderCard />
        ) : (
          vehicles.map((v) => <VehicleCard key={v.id} v={v} />)
        )}
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-white/30 text-xs">
          Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {' · '}auto-refreshes every 60s
        </p>
      )}
    </div>
  )
}
