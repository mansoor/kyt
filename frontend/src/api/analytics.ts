import client from './client'

export interface EfficiencyData {
  kpis: {
    drives: number
    avg_wh_km: number
    best_wh_km: number
    worst_wh_km: number
    avg_temp_c: number
  }
  by_day: { day: string; avg_wh_km: number; total_km: number; drives: number }[]
  by_temp: { temp: number; wh_km: number; km: number }[]
  by_speed: { speed: number; wh_km: number; km: number }[]
}

export interface ChargingData {
  kpis: {
    sessions: number
    total_kwh: number
    avg_kwh_per_session: number
    avg_duration_min: number
    avg_start_soc: number
    avg_end_soc: number
    total_cost: number
    avg_charge_rate_kw: number
  }
  by_month: { month: string; sessions: number; total_kwh: number; avg_kwh: number }[]
  by_hour: { hour: number; sessions: number; kwh: number }[]
  soc_distribution: { range: string; bucket: number; count: number }[]
}

export interface VampireData {
  kpis: {
    avg_drain_pct_per_hour: number
    avg_drain_pct_per_day: number
    total_drain_pct: number
    days_with_data: number
  }
  by_day: { day: string; avg_drain_pct_hr: number | null; total_drain_pct: number; parked_hours: number }[]
}

export interface TimelineDay {
  date: string
  drives: number
  distance_km: number
  drive_min: number
  drive_kwh: number
  charges: number
  charge_kwh: number
}

export const getEfficiency = (carId?: number, days = 90) =>
  client.get<EfficiencyData>('/analytics/efficiency', { params: { car_id: carId, days } }).then(r => r.data)

export const getChargingStats = (carId?: number, days = 180) =>
  client.get<ChargingData>('/analytics/charging', { params: { car_id: carId, days } }).then(r => r.data)

export const getVampireDrain = (carId?: number, days = 30) =>
  client.get<VampireData>('/analytics/vampire-drain', { params: { car_id: carId, days } }).then(r => r.data)

export const getTimeline = (carId?: number) =>
  client.get<{ days: TimelineDay[] }>('/analytics/timeline', { params: { car_id: carId } }).then(r => r.data)
