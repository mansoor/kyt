import client from './client'

export interface Drive {
  id: number
  car_id: number
  start_date: string
  end_date: string | null
  distance_km: number | null
  duration_min: number | null
  speed_max_kmh: number | null
  consumption_kwh: number | null
  start_range_km: number | null
  end_range_km: number | null
  outside_temp_avg: number | null
  start_address: string | null
  end_address: string | null
}

export interface DriveDetail extends Drive {
  car_name: string | null
  car_model: string | null
  power_max_kw: number | null
  power_min_kw: number | null
}

export interface DrivePosition {
  t: string
  lat: number
  lng: number
  speed: number | null
  power: number | null
  battery: number | null
  elevation: number | null
  outside_temp: number | null
  inside_temp: number | null
}

export interface DrivesResponse {
  total: number
  page: number
  page_size: number
  pages: number
  kpis: {
    total_drives: number
    total_km: number
    total_min: number
    total_kwh: number
    avg_consumption_wh_km: number
  }
  drives: Drive[]
}

export async function listDrives(params: {
  car_id?: number
  from?: string
  to?: string
  page?: number
  page_size?: number
  sort?: string
  order?: string
}): Promise<DrivesResponse> {
  const { data } = await client.get<DrivesResponse>('/drives', { params })
  return data
}

export async function getDrive(id: number): Promise<DriveDetail> {
  const { data } = await client.get<DriveDetail>(`/drives/${id}`)
  return data
}

export async function getDrivePositions(id: number): Promise<{ drive_id: number; positions: DrivePosition[] }> {
  const { data } = await client.get(`/drives/${id}/positions`)
  return data
}

export function exportDrivesUrl(params: { car_id?: number; from?: string; to?: string }): string {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][])
  return `/api/drives/export?${qs}`
}
