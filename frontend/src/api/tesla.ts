import client from './client'

export interface AuthURLResponse {
  url: string
  configured: boolean
}

export interface Vehicle {
  id: number
  name: string | null
  model: string | null
  vin: string | null
  state: string
  battery_level: number | null
}

export async function getTeslaAuthUrl(): Promise<AuthURLResponse> {
  const { data } = await client.get<AuthURLResponse>('/tesla/auth/url')
  return data
}

export async function disconnectTesla(): Promise<void> {
  await client.delete('/tesla/auth/disconnect')
}

export async function getVehicles(): Promise<Vehicle[]> {
  const { data } = await client.get<Vehicle[]>('/tesla/vehicles')
  return data
}

export async function wakeVehicle(carId: number): Promise<void> {
  await client.post(`/tesla/vehicles/${carId}/wake`)
}

export interface SetupStatus {
  configured: boolean
  keys_generated: boolean
  registered: boolean
  connected: boolean
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const { data } = await client.get<SetupStatus>('/tesla/auth/setup-status')
  return data
}

export async function runSetup(): Promise<void> {
  await client.post('/tesla/auth/setup')
}
