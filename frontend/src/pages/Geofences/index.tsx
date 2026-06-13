import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Plus, Trash2, Edit2, X, Check, MapPin } from 'lucide-react'
import { getGeofences, createGeofence, updateGeofence, deleteGeofence, Geofence } from '@/api/vehicle'
import AppShell from '@/components/AppShell'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

interface FormState {
  name: string; latitude: string; longitude: string; radius: string
  cost_per_unit: string; billing_type: string; session_fee: string
}

const emptyForm = (): FormState => ({
  name: '', latitude: '', longitude: '', radius: '20',
  cost_per_unit: '', billing_type: '', session_fee: '',
})

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng) } })
  return null
}

export default function GeofencesPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [picking, setPicking] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['geofences'],
    queryFn: getGeofences,
  })

  const createMut = useMutation({
    mutationFn: createGeofence,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['geofences'] }); setEditing(null) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Omit<Geofence, 'id'>> }) => updateGeofence(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['geofences'] }); setEditing(null) },
  })
  const deleteMut = useMutation({
    mutationFn: deleteGeofence,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofences'] }),
  })

  function startEdit(fence: Geofence) {
    setEditing(fence.id)
    setForm({
      name: fence.name,
      latitude: String(fence.latitude),
      longitude: String(fence.longitude),
      radius: String(fence.radius),
      cost_per_unit: fence.cost_per_unit != null ? String(fence.cost_per_unit) : '',
      billing_type: fence.billing_type ?? '',
      session_fee: fence.session_fee != null ? String(fence.session_fee) : '',
    })
  }

  function startNew() {
    setEditing('new')
    setForm(emptyForm())
  }

  function handleSubmit() {
    const body = {
      name: form.name,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      radius: parseFloat(form.radius) || 20,
      cost_per_unit: form.cost_per_unit ? parseFloat(form.cost_per_unit) : null,
      billing_type: form.billing_type || null,
      session_fee: form.session_fee ? parseFloat(form.session_fee) : null,
    }
    if (editing === 'new') createMut.mutate(body)
    else if (typeof editing === 'number') updateMut.mutate({ id: editing, body })
  }

  function handleMapPick(lat: number, lng: number) {
    if (!picking) return
    setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
    setPicking(false)
  }

  const geofences = data?.geofences ?? []
  const mapCenter: [number, number] = geofences.length > 0
    ? [geofences[0].latitude, geofences[0].longitude]
    : [37.7749, -122.4194]

  const previewLat = parseFloat(form.latitude)
  const previewLng = parseFloat(form.longitude)
  const hasPreview = !isNaN(previewLat) && !isNaN(previewLng)

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-teal" /> Geofences
          </h1>
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 bg-brand-blue hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Geofence
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* List */}
          <div className="space-y-3">
            {isLoading && <div className="text-white/40 text-sm">Loading…</div>}
            {geofences.length === 0 && !isLoading && (
              <div className="glass rounded-2xl p-8 text-center text-white/30 text-sm">
                No geofences yet. Add one to tag charging and drive locations.
              </div>
            )}
            {geofences.map(f => (
              <div key={f.id} className={`glass rounded-xl p-4 flex items-start gap-3 transition-all
                ${editing === f.id ? 'ring-2 ring-brand-blue' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{f.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {f.latitude.toFixed(4)}, {f.longitude.toFixed(4)} · r={f.radius}m
                  </p>
                  {f.cost_per_unit != null && (
                    <p className="text-white/30 text-xs">${f.cost_per_unit}/{f.billing_type ?? 'unit'}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(f)}
                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteMut.mutate(f.id)}
                    className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Map + form */}
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-white/10" style={{ height: 300 }}>
              <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap'
                />
                <MapClickHandler onPick={handleMapPick} />
                {geofences.map(f => (
                  <Circle key={f.id}
                    center={[f.latitude, f.longitude]}
                    radius={f.radius}
                    pathOptions={{ color: '#0D9488', fillColor: '#0D9488', fillOpacity: 0.15, weight: 2 }}
                  />
                ))}
                {hasPreview && editing && (
                  <>
                    <Circle
                      center={[previewLat, previewLng]}
                      radius={parseFloat(form.radius) || 20}
                      pathOptions={{ color: '#1A73E8', fillColor: '#1A73E8', fillOpacity: 0.2, weight: 2, dashArray: '4 4' }}
                    />
                    <Marker position={[previewLat, previewLng]} icon={icon} />
                  </>
                )}
              </MapContainer>
            </div>
            {picking && (
              <p className="text-brand-blue text-sm text-center animate-pulse">Click the map to place the geofence center</p>
            )}

            {/* Edit / New form */}
            {editing !== null && (
              <div className="glass rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-white font-medium text-sm">{editing === 'new' ? 'New Geofence' : 'Edit Geofence'}</h3>
                  <button onClick={() => setEditing(null)} className="text-white/40 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <input placeholder="Name" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-blue placeholder-white/30 w-full" />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Latitude" value={form.latitude}
                      onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                      className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-blue placeholder-white/30" />
                    <input placeholder="Longitude" value={form.longitude}
                      onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                      className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-blue placeholder-white/30" />
                  </div>
                  <button onClick={() => setPicking(true)}
                    className="text-brand-blue text-xs text-left hover:underline">
                    ↑ Or click map to pick coordinates
                  </button>
                  <input placeholder="Radius (meters)" value={form.radius}
                    onChange={e => setForm(f => ({ ...f, radius: e.target.value }))}
                    className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-blue placeholder-white/30" />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Cost/unit (optional)" value={form.cost_per_unit}
                      onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))}
                      className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-blue placeholder-white/30" />
                    <select value={form.billing_type}
                      onChange={e => setForm(f => ({ ...f, billing_type: e.target.value }))}
                      className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-blue">
                      <option value="">Billing type</option>
                      <option value="per_kwh">Per kWh</option>
                      <option value="per_minute">Per minute</option>
                      <option value="flat">Flat rate</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(null)}
                    className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSubmit}
                    disabled={!form.name || !form.latitude || !form.longitude}
                    className="flex items-center gap-1.5 bg-brand-blue hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                    <Check className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
