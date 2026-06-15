import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { icon as leafletIcon } from 'leaflet'
import {
  AreaChart, Area, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ArrowLeft, Zap, Clock, MapPin } from 'lucide-react'
import { getCharge, getChargeReadings } from '@/api/charges'
import AppShell from '@/components/AppShell'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icon in bundlers
const markerIcon = leafletIcon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function fmt(n: number | null | undefined, dec = 1) {
  return n != null ? n.toFixed(dec) : '—'
}

function fmtDuration(min: number | null | undefined) {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const CHART_THEME = {
  contentStyle: { background: '#0D1B2A', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#ffffff80' },
  itemStyle: { color: '#fff' },
}

export default function ChargeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const chargeId = Number(id)

  const { data: charge, isLoading } = useQuery({
    queryKey: ['charge', chargeId],
    queryFn: () => getCharge(chargeId),
  })

  const { data: readingsData } = useQuery({
    queryKey: ['charge-readings', chargeId],
    queryFn: () => getChargeReadings(chargeId),
    enabled: !!charge,
  })

  const readings = readingsData?.readings ?? []
  const chargeCurve = readingsData?.charge_curve ?? []

  if (isLoading) {
    return <AppShell><div className="flex items-center justify-center h-64 text-ink/40">Loading…</div></AppShell>
  }
  if (!charge) {
    return <AppShell><div className="flex items-center justify-center h-64 text-ink/40">Not found</div></AppShell>
  }

  const hasMap = charge.latitude != null && charge.longitude != null

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* Back + header */}
        <div>
          <button
            onClick={() => navigate('/charges')}
            className="flex items-center gap-1.5 text-ink/50 hover:text-ink text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Charges
          </button>
          <h1 className="text-ink text-xl font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-yellow-400" />
            {charge.location}
          </h1>
          <p className="text-ink/50 text-sm mt-1">
            {charge.start_date ? format(parseISO(charge.start_date), 'EEEE, MMM d yyyy · HH:mm') : ''}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass rounded-xl p-4">
            <p className="text-ink/50 text-xs uppercase tracking-wider mb-1 flex items-center gap-1"><Zap className="w-3 h-3" /> Added</p>
            <p className="text-ink text-2xl font-bold">{fmt(charge.energy_added_kwh)} kWh</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-ink/50 text-xs uppercase tracking-wider mb-1">SoC</p>
            <p className="text-ink text-2xl font-bold">{charge.start_battery ?? '—'}% → {charge.end_battery ?? '—'}%</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-ink/50 text-xs uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Duration</p>
            <p className="text-ink text-2xl font-bold">{fmtDuration(charge.duration_min)}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-ink/50 text-xs uppercase tracking-wider mb-1">Range gained</p>
            <p className="text-ink text-2xl font-bold">
              {charge.start_range_km && charge.end_range_km
                ? `+${fmt(charge.end_range_km - charge.start_range_km, 0)} km`
                : '—'}
            </p>
          </div>
        </div>

        {/* Map */}
        {hasMap && (
          <div className="glass rounded-2xl overflow-hidden h-56">
            <MapContainer
              center={[charge.latitude!, charge.longitude!]}
              zoom={14}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://openstreetmap.org">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[charge.latitude!, charge.longitude!]} icon={markerIcon}>
                <Popup>{charge.location}</Popup>
              </Marker>
            </MapContainer>
          </div>
        )}

        {/* Charts */}
        {readings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Battery SoC */}
            <div className="glass rounded-2xl p-4">
              <p className="text-ink/60 text-sm font-medium mb-3">Battery Level (%)</p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={readings} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="socFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={[0, 100]} tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip {...CHART_THEME} />
                  <Area type="monotone" dataKey="battery" stroke="#22c55e" fill="url(#socFill)" strokeWidth={1.5} dot={false} name="%" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Power */}
            <div className="glass rounded-2xl p-4">
              <p className="text-ink/60 text-sm font-medium mb-3">Charger Power (kW)</p>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={readings} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip {...CHART_THEME} />
                  <Line type="monotone" dataKey="power_kw" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="kW" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Voltage */}
            <div className="glass rounded-2xl p-4">
              <p className="text-ink/60 text-sm font-medium mb-3">Voltage (V)</p>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={readings} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip {...CHART_THEME} />
                  <Line type="monotone" dataKey="voltage" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="V" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Charge curve: SoC vs Power */}
            {chargeCurve.length > 1 && (
              <div className="glass rounded-2xl p-4">
                <p className="text-ink/60 text-sm font-medium mb-3">Charge Curve (SoC → Power)</p>
                <ResponsiveContainer width="100%" height={120}>
                  <ScatterChart margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
                    <XAxis dataKey="soc" name="SoC %" unit="%" tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="power_kw" name="Power" unit=" kW" tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip {...CHART_THEME} cursor={{ stroke: '#ffffff20' }} />
                    <Scatter data={chargeCurve} fill="#1A73E8" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Energy added cumulative */}
        {readings.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <p className="text-ink/60 text-sm font-medium mb-3">Energy Added (kWh cumulative)</p>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={readings} margin={{ top: 2, right: 4, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" hide />
                <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip {...CHART_THEME} />
                <Area type="monotone" dataKey="energy_added" stroke="#f59e0b" fill="url(#energyFill)" strokeWidth={1.5} dot={false} name="kWh" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </AppShell>
  )
}
