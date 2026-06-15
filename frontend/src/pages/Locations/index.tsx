import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from 'react-leaflet'
import { MapPin } from 'lucide-react'
import { getLocations } from '@/api/vehicle'
import { getDashboardSummary } from '@/api/dashboard'
import AppShell from '@/components/AppShell'
import 'leaflet/dist/leaflet.css'

export default function LocationsPage() {
  const [activeCar, setActiveCar] = useState<number | undefined>()
  const [showDrives, setShowDrives] = useState(true)
  const [showCharges, setShowCharges] = useState(true)

  const { data: dash } = useQuery({
    queryKey: ['dashboard', undefined],
    queryFn: () => getDashboardSummary(),
    staleTime: 5 * 60 * 1000,
  })
  const vehicles = dash?.vehicles ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['locations', activeCar],
    queryFn: () => getLocations(activeCar),
  })

  // Compute map center from first available point
  const centerLat = data?.charges[0]?.lat ?? data?.drives[0]?.start.lat ?? 37.7749
  const centerLng = data?.charges[0]?.lng ?? data?.drives[0]?.start.lng ?? -122.4194

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-ink text-xl font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-blue" /> Locations
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
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
            <label className="flex items-center gap-1.5 text-ink/60 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={showDrives} onChange={e => setShowDrives(e.target.checked)}
                className="accent-brand-blue" />
              Drives
            </label>
            <label className="flex items-center gap-1.5 text-ink/60 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={showCharges} onChange={e => setShowCharges(e.target.checked)}
                className="accent-yellow-400" />
              Charges
            </label>
          </div>
        </div>

        {/* Stats row */}
        {data && (
          <div className="flex gap-4 text-sm">
            <span className="text-ink/40">{data.drives.length} drives shown</span>
            <span className="text-ink/20">·</span>
            <span className="text-ink/40">{data.charges.length} charge locations</span>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden border border-ink/10" style={{ height: 520 }}>
          {isLoading ? (
            <div className="h-full bg-ink/5 flex items-center justify-center text-ink/30 text-sm">
              Loading map…
            </div>
          ) : (
            <MapContainer
              center={[centerLat, centerLng]}
              zoom={10}
              style={{ height: '100%', width: '100%', background: '#0D1B2A' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
              />

              {showDrives && data?.drives.map(d => (
                <Polyline
                  key={d.drive_id}
                  positions={[[d.start.lat, d.start.lng], [d.end.lat, d.end.lng]]}
                  color="#1A73E8"
                  weight={1.5}
                  opacity={0.5}
                >
                  <Popup>
                    <div className="text-xs">
                      <strong>Drive {d.drive_id}</strong><br />
                      {d.distance_km != null ? `${d.distance_km} km` : '—'}
                    </div>
                  </Popup>
                </Polyline>
              ))}

              {showDrives && data?.drives.map(d => (
                <CircleMarker
                  key={`ds-${d.drive_id}`}
                  center={[d.start.lat, d.start.lng]}
                  radius={3}
                  pathOptions={{ color: '#22C55E', fillColor: '#22C55E', fillOpacity: 0.8, weight: 1 }}
                >
                  <Popup><div className="text-xs">Drive start</div></Popup>
                </CircleMarker>
              ))}

              {showDrives && data?.drives.map(d => (
                <CircleMarker
                  key={`de-${d.drive_id}`}
                  center={[d.end.lat, d.end.lng]}
                  radius={3}
                  pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.8, weight: 1 }}
                >
                  <Popup><div className="text-xs">Drive end</div></Popup>
                </CircleMarker>
              ))}

              {showCharges && data?.charges.map(c => (
                <CircleMarker
                  key={`c-${c.charge_id}`}
                  center={[c.lat, c.lng]}
                  radius={5}
                  pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.85, weight: 1 }}
                >
                  <Popup>
                    <div className="text-xs">
                      {c.address && <strong>{c.address}</strong>}<br />
                      {c.energy_kwh != null ? `${c.energy_kwh} kWh added` : 'Charge'}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-5 text-xs text-ink/40">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Drive start</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Drive end</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />Charge location</span>
        </div>
      </div>
    </AppShell>
  )
}
