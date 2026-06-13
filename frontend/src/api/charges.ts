import client from './client'

export interface Charge {
  id: number
  car_id: number
  start_date: string
  end_date: string | null
  location: string
  energy_added_kwh: number
  energy_used_kwh: number
  start_battery: number | null
  end_battery: number | null
  duration_min: number | null
  outside_temp: number | null
  cost: number | null
  range_gained_km: number | null
  efficiency_pct: number | null
}

export interface ChargeDetail {
  id: number
  car_id: number
  car_name: string | null
  start_date: string
  end_date: string | null
  location: string
  latitude: number | null
  longitude: number | null
  energy_added_kwh: number | null
  energy_used_kwh: number | null
  start_battery: number | null
  end_battery: number | null
  start_range_km: number | null
  end_range_km: number | null
  duration_min: number | null
  outside_temp_avg: number | null
  cost: number | null
  charging_status: string | null
}

export interface ChargeReading {
  t: string
  battery: number | null
  energy_added: number | null
  power_kw: number | null
  voltage: number | null
  current: number | null
  outside_temp: number | null
}

export interface ChargesResponse {
  total: number
  page: number
  page_size: number
  pages: number
  kpis: {
    total_charges: number
    total_kwh_added: number
    total_kwh_used: number
    total_cost: number
    avg_duration_min: number
  }
  charges: Charge[]
}

export async function listCharges(params: {
  car_id?: number
  from?: string
  to?: string
  page?: number
  page_size?: number
  sort?: string
  order?: string
}): Promise<ChargesResponse> {
  const { data } = await client.get<ChargesResponse>('/charges', { params })
  return data
}

export async function getCharge(id: number): Promise<ChargeDetail> {
  const { data } = await client.get<ChargeDetail>(`/charges/${id}`)
  return data
}

export async function getChargeReadings(id: number): Promise<{
  charge_id: number
  readings: ChargeReading[]
  charge_curve: { soc: number; power_kw: number }[]
}> {
  const { data } = await client.get(`/charges/${id}/readings`)
  return data
}

export function exportChargesUrl(params: { car_id?: number; from?: string; to?: string }): string {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][])
  return `/api/charges/export?${qs}`
}
