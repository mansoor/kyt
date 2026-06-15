import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip as LeafletTooltip } from 'react-leaflet'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { ArrowLeft, Clock, Route, Zap } from 'lucide-react'
import { getDrive, getDrivePositions } from '@/api/drives'
import AppShell from '@/components/AppShell'
import 'leaflet/dist/leaflet.css'

function fmt(n: number | null | undefined, dec = 1) {
  return n != null ? n.toFixed(dec) : '—'
}

function fmtDuration(min: number | null | undefined) {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Colour a position by speed (green→yellow→red, 0–130 km/h)
function speedColor(speed: number | null): string {
  if (speed == null) return '#1A73E8'
  const t = Math.min(speed / 130, 1)
  const r = Math.round(255 * t)
  const g = Math.round(255 * (1 - t))
  return `rgb(${r},${g},30)`
}

const CHART_THEME = {
  contentStyle: { background: '#0D1B2A', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#ffffff80' },
  itemStyle: { color: '#fff' },
}

export default function DriveDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const driveId = Number(id)

  const { data: drive, isLoading } = useQuery({
    queryKey: ['drive', driveId],
    queryFn: () => getDrive(driveId),
  })

  const { data: posData } = useQuery({
    queryKey: ['drive-positions', driveId],
    queryFn: () => getDrivePositions(driveId),
    enabled: !!drive,
  })

  const positions = posData?.positions ?? []
  const hasPositions = positions.length > 0

  // Compute map centre
  const mapCenter = hasPositions
    ? [positions[Math.floor(positions.length / 2)].lat, positions[Math.floor(positions.length / 2)].lng] as [number, number]
    : [0, 0] as [number, number]

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-ink/40">Loading drive…</div>
      </AppShell>
    )
  }

  if (!drive) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-ink/40">Drive not found</div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* Back + header */}
        <div>
          <button
            onClick={() => navigate('/drives')}
            className="flex items-center gap-1.5 text-ink/50 hover:text-ink text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Drives
          </button>
          <h1 className="text-ink text-xl font-bold">
            {drive.start_address ?? 'Unknown'} → {drive.end_address ?? 'Unknown'}
          </h1>
          <p className="text-ink/50 text-sm mt-1">
            {drive.start_date ? format(parseISO(drive.start_date), 'EEEE, MMM d yyyy · HH:mm') : ''}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass rounded-xl p-4">
            <p className="text-ink/50 text-xs uppercase tracking-wider mb-1 flex items-center gap-1"><Route className="w-3 h-3" /> Distance</p>
            <p className="text-ink text-2xl font-bold">{fmt(drive.distance_km)} km</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-ink/50 text-xs uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Duration</p>
            <p className="text-ink text-2xl font-bold">{fmtDuration(drive.duration_min)}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-ink/50 text-xs uppercase tracking-wider mb-1">Max Speed</p>
            <p className="text-ink text-2xl font-bold">{drive.speed_max_kmh ?? '—'} km/h</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-ink/50 text-xs uppercase tracking-wider mb-1 flex items-center gap-1"><Zap className="w-3 h-3" /> Energy</p>
            <p className="text-ink text-2xl font-bold">{fmt(drive.consumption_kwh, 2)} kWh</p>
          </div>
        </div>

        {/* Map */}
        {hasPositions && (
          <div className="glass rounded-2xl overflow-hidden h-72">
            <MapContainer center={mapCenter} zoom={12} className="h-full w-full" zoomControl>
              <TileLayer
                attribution='&copy; <a href="https://openstreetmap.org">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* Colour-coded route segments */}
              {positions.slice(0, -1).map((pt, i) => (
                <Polyline
                  key={i}
                  positions={[[pt.lat, pt.lng], [positions[i + 1].lat, positions[i + 1].lng]]}
                  color={speedColor(pt.speed)}
                  weight={3}
                  opacity={0.85}
                />
              ))}
              <CircleMarker center={[positions[0].lat, positions[0].lng]} radius={6} color="#22c55e" fillOpacity={1}>
                <LeafletTooltip>Start</LeafletTooltip>
              </CircleMarker>
              <CircleMarker center={[positions[positions.length - 1].lat, positions[positions.length - 1].lng]} radius={6} color="#ef4444" fillOpacity={1}>
                <LeafletTooltip>End</LeafletTooltip>
              </CircleMarker>
            </MapContainer>
          </div>
        )}

        {/* Charts */}
        {positions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Speed */}
            <div className="glass rounded-2xl p-4">
              <p className="text-ink/60 text-sm font-medium mb-3">Speed (km/h)</p>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={positions} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip {...CHART_THEME} />
                  <Line type="monotone" dataKey="speed" stroke="#1A73E8" strokeWidth={1.5} dot={false} name="km/h" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Power */}
            <div className="glass rounded-2xl p-4">
              <p className="text-ink/60 text-sm font-medium mb-3">Power (kW)</p>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={positions} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <ReferenceLine y={0} stroke="#ffffff20" />
                  <Tooltip {...CHART_THEME} />
                  <Line type="monotone" dataKey="power" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="kW" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Battery */}
            <div className="glass rounded-2xl p-4">
              <p className="text-ink/60 text-sm font-medium mb-3">Battery (%)</p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={positions} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="battFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1A73E8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1A73E8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={[0, 100]} tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip {...CHART_THEME} />
                  <Area type="monotone" dataKey="battery" stroke="#1A73E8" fill="url(#battFill)" strokeWidth={1.5} dot={false} name="%" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Temperature */}
            <div className="glass rounded-2xl p-4">
              <p className="text-ink/60 text-sm font-medium mb-3">Temperature (°C)</p>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={positions} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip {...CHART_THEME} />
                  <Line type="monotone" dataKey="outside_temp" stroke="#0D9488" strokeWidth={1.5} dot={false} name="Outside °C" />
                  <Line type="monotone" dataKey="inside_temp" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="Inside °C" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
