export type ThemePref = 'system' | 'light' | 'dark'

export interface UserOut {
  id: string
  email: string
  is_active: boolean
  is_superuser: boolean
  display_name: string | null
  theme: ThemePref
  must_change_password: boolean
  created_at: string
  last_login: string | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface VehicleChargeLevel {
  id: number
  name: string
  battery_level: number | null
  charging_state: string
  charge_rate_km: number | null
  est_battery_range_km: number | null
}

export interface ChargeLevelResponse {
  vehicles: VehicleChargeLevel[]
}
