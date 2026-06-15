import client from './client'

export interface Channel {
  id: string
  kind: string
  target: string | null
  is_enabled: boolean
}

export interface AlertRule {
  id: string
  type: string
  car_id: number | null
  is_enabled: boolean
  params: Record<string, unknown>
  last_fired_at: string | null
}

export interface SmtpOut {
  smtp_host: string | null
  smtp_port: number | null
  smtp_username: string | null
  smtp_from: string | null
  smtp_use_tls: boolean
  password_set: boolean
}

export async function listChannels(): Promise<Channel[]> {
  const res = await client.get<Channel[]>('/notifications/channels')
  return res.data
}

export async function updateChannel(id: string, data: { target?: string | null; is_enabled?: boolean }): Promise<Channel> {
  const res = await client.patch<Channel>(`/notifications/channels/${id}`, data)
  return res.data
}

export async function sendTest(): Promise<void> {
  await client.post('/notifications/test')
}

export async function listAlerts(): Promise<AlertRule[]> {
  const res = await client.get<AlertRule[]>('/notifications/alerts')
  return res.data
}

export async function createAlert(data: {
  type: string
  car_id?: number | null
  is_enabled?: boolean
  params?: Record<string, unknown>
}): Promise<AlertRule> {
  const res = await client.post<AlertRule>('/notifications/alerts', data)
  return res.data
}

export async function updateAlert(
  id: string,
  data: { is_enabled?: boolean; car_id?: number | null; params?: Record<string, unknown> },
): Promise<AlertRule> {
  const res = await client.patch<AlertRule>(`/notifications/alerts/${id}`, data)
  return res.data
}

export async function deleteAlert(id: string): Promise<void> {
  await client.delete(`/notifications/alerts/${id}`)
}

export async function getSmtp(): Promise<SmtpOut> {
  const res = await client.get<SmtpOut>('/notifications/smtp')
  return res.data
}

export async function updateSmtp(data: {
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_username?: string | null
  smtp_password?: string | null
  smtp_from?: string | null
  smtp_use_tls?: boolean
}): Promise<SmtpOut> {
  const res = await client.put<SmtpOut>('/notifications/smtp', data)
  return res.data
}
