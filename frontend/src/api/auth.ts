import client from './client'
import type { ChargeLevelResponse, LoginRequest, UserOut } from '@/types/auth'

export async function login(data: LoginRequest): Promise<UserOut> {
  const res = await client.post<UserOut>('/auth/login', data)
  return res.data
}

export async function logout(): Promise<void> {
  await client.delete('/auth/logout')
}

export async function getMe(): Promise<UserOut> {
  const res = await client.get<UserOut>('/auth/me')
  return res.data
}

export async function getChargeLevel(): Promise<ChargeLevelResponse> {
  const res = await client.get<ChargeLevelResponse>('/public/charge-level')
  return res.data
}
