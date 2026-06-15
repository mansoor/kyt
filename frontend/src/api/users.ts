import client from './client'
import type { UserOut, ThemePref } from '@/types/auth'

export interface Invite {
  id: string
  email: string
  is_superuser: boolean
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
  invite_url?: string | null
}

export async function updateProfile(data: { display_name?: string | null; theme?: ThemePref }): Promise<UserOut> {
  const res = await client.patch<UserOut>('/users/me/profile', data)
  return res.data
}

export async function changePassword(data: { current_password: string; new_password: string }): Promise<void> {
  await client.post('/users/me/password', data)
}

export async function listUsers(): Promise<UserOut[]> {
  const res = await client.get<UserOut[]>('/users')
  return res.data
}

export async function updateUser(id: string, data: { is_active?: boolean; is_superuser?: boolean }): Promise<UserOut> {
  const res = await client.patch<UserOut>(`/users/${id}`, data)
  return res.data
}

export async function deleteUser(id: string): Promise<void> {
  await client.delete(`/users/${id}`)
}

export async function createInvite(data: { email: string; is_superuser: boolean }): Promise<Invite> {
  const res = await client.post<Invite>('/users/invite', data)
  return res.data
}

export async function listInvites(): Promise<Invite[]> {
  const res = await client.get<Invite[]>('/users/invites')
  return res.data
}

export async function deleteInvite(id: string): Promise<void> {
  await client.delete(`/users/invites/${id}`)
}
