import client from './client'

export interface VehicleCard {
  id: number
  name: string
  model: string | null
  vin: string | null
  state: string
  battery_level: number | null
  latitude: number | null
  longitude: number | null
}

export interface DashboardSummary {
  vehicles: VehicleCard[]
  kpis: {
    drives: number
    distance_km: number
    drive_time_min: number
    energy_consumed_kwh: number
    charges: number
    energy_added_kwh: number
    total_cost: number
  }
  battery_history: { day: string; min: number; max: number; avg: number }[]
  recent_activity: {
    type: 'drive' | 'charge'
    id: number
    timestamp: string
    distance_km: number | null
    duration_min: number | null
    energy_kwh: number | null
    energy_added_kwh: number | null
  }[]
}

export async function getDashboardSummary(carId?: number): Promise<DashboardSummary> {
  const params = carId ? { car_id: carId } : {}
  const { data } = await client.get<DashboardSummary>('/dashboard/summary', { params })
  return data
}
