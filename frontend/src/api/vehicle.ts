import client from './client'

export interface BatteryHealthData {
  weekly: { week: string; max_rated_km: number; max_ideal_km: number | null; samples: number; est_full_range_km: number }[]
  degradation: { peak_km: number; current_km: number; lost_km: number; pct_retained: number } | null
  estimated_charge_cycles: number
}

export interface LocationsData {
  drives: { type: 'drive'; drive_id: number; start: { lat: number; lng: number }; end: { lat: number; lng: number }; distance_km: number | null; date: string }[]
  charges: { type: 'charge'; charge_id: number; lat: number; lng: number; energy_kwh: number | null; date: string; address: string | null }[]
}

export interface SoftwareUpdate {
  id: number
  car_id: number
  car_name: string | null
  version: string | null
  start_date: string
  end_date: string | null
  duration_min: number | null
}

export interface Geofence {
  id: number
  name: string
  latitude: number
  longitude: number
  radius: number
  cost_per_unit: number | null
  billing_type: string | null
  session_fee: number | null
}

export const getBatteryHealth = (carId?: number) =>
  client.get<BatteryHealthData>('/battery/health', { params: { car_id: carId } }).then(r => r.data)

export const getLocations = (carId?: number) =>
  client.get<LocationsData>('/locations', { params: { car_id: carId } }).then(r => r.data)

export const getSoftwareUpdates = (carId?: number) =>
  client.get<{ updates: SoftwareUpdate[]; total: number }>('/updates', { params: { car_id: carId } }).then(r => r.data)

export const getGeofences = () =>
  client.get<{ geofences: Geofence[] }>('/geofences').then(r => r.data)

export const createGeofence = (body: Omit<Geofence, 'id'>) =>
  client.post<{ id: number; name: string }>('/geofences', body).then(r => r.data)

export const updateGeofence = (id: number, body: Partial<Omit<Geofence, 'id'>>) =>
  client.put<{ id: number; name: string }>(`/geofences/${id}`, body).then(r => r.data)

export const deleteGeofence = (id: number) =>
  client.delete(`/geofences/${id}`)
