import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2, Plus, Send, Bell } from 'lucide-react'
import {
  listChannels, updateChannel, sendTest,
  listAlerts, createAlert, updateAlert, deleteAlert,
} from '@/api/notifications'
import { getGeofences } from '@/api/vehicle'
import { getVehicles } from '@/api/tesla'
import { ALERT_TYPES, WEEKDAYS, metaFor, type ParamField } from './alertTypes'

export default function NotificationsTab() {
  const qc = useQueryClient()
  const { data: channels = [] } = useQuery({ queryKey: ['channels'], queryFn: listChannels })
  const { data: alerts = [] } = useQuery({ queryKey: ['alerts'], queryFn: listAlerts })
  const { data: geofences } = useQuery({ queryKey: ['geofences'], queryFn: getGeofences })
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: getVehicles })

  const email = channels.find((c) => c.kind === 'email')
  const [testMsg, setTestMsg] = useState<string | null>(null)

  const channelMut = useMutation({
    mutationFn: (data: { id: string; target?: string | null; is_enabled?: boolean }) =>
      updateChannel(data.id, { target: data.target, is_enabled: data.is_enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  })
  const testMut = useMutation({
    mutationFn: sendTest,
    onSuccess: () => setTestMsg('Test email sent.'),
    onError: (err: unknown) => setTestMsg((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Test failed.'),
  })
  const toggleMut = useMutation({
    mutationFn: (data: { id: string; is_enabled: boolean }) => updateAlert(data.id, { is_enabled: data.is_enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })
  const delMut = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const geofenceList = geofences?.geofences ?? []
  const inputCls = 'bg-ink/5 border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-brand-blue'

  return (
    <div className="space-y-8">
      {/* Email channel */}
      <section className="space-y-3">
        <h2 className="text-ink font-semibold text-base">Email notifications</h2>
        {email && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-ink/60 text-sm mb-1.5">Send to</label>
              <input
                defaultValue={email.target ?? ''}
                onBlur={(e) => channelMut.mutate({ id: email.id, target: e.target.value })}
                className={`${inputCls} w-full`}
                placeholder="you@example.com"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink/70 py-2">
              <input
                type="checkbox"
                checked={email.is_enabled}
                onChange={(e) => channelMut.mutate({ id: email.id, is_enabled: e.target.checked })}
                className="accent-brand-blue w-4 h-4"
              />
              Enabled
            </label>
            <button
              onClick={() => { setTestMsg(null); testMut.mutate() }}
              disabled={testMut.isPending}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ink/10 hover:bg-ink/15 text-ink text-sm font-medium transition-colors"
            >
              {testMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send test
            </button>
          </div>
        )}
        {testMsg && <p className="text-sm text-ink/60">{testMsg}</p>}
        <p className="text-ink/40 text-xs">Email delivery uses the relay configured under the Email (SMTP) tab by an administrator.</p>
      </section>

      {/* Alert rules */}
      <section className="space-y-3 border-t border-ink/10 pt-6">
        <h2 className="text-ink font-semibold text-base">Alerts</h2>
        {alerts.length === 0 && (
          <p className="text-ink/50 text-sm flex items-center gap-2"><Bell className="w-4 h-4" /> No alerts configured yet.</p>
        )}
        <div className="space-y-2">
          {alerts.map((rule) => {
            const meta = metaFor(rule.type)
            const carName = rule.car_id ? (vehicles.find((v) => v.id === rule.car_id)?.name ?? `Car ${rule.car_id}`) : 'All cars'
            return (
              <div key={rule.id} className="flex items-center gap-3 bg-ink/5 border border-ink/10 rounded-lg px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={rule.is_enabled}
                  onChange={(e) => toggleMut.mutate({ id: rule.id, is_enabled: e.target.checked })}
                  className="accent-brand-blue w-4 h-4 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-ink text-sm font-medium">{meta?.label ?? rule.type}</p>
                  <p className="text-ink/50 text-xs truncate">{carName}{summariseParams(rule.params)}</p>
                </div>
                <button onClick={() => delMut.mutate(rule.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>

        <AddAlertForm
          geofences={geofenceList}
          vehicles={vehicles.map((v) => ({ id: v.id, name: v.name }))}
          onCreate={async (payload) => { await createAlert(payload); qc.invalidateQueries({ queryKey: ['alerts'] }) }}
          inputCls={inputCls}
        />
      </section>
    </div>
  )
}

function summariseParams(params: Record<string, unknown>): string {
  const bits: string[] = []
  if (params.threshold_pct != null) bits.push(`≤ ${params.threshold_pct}%`)
  if (params.target_pct != null) bits.push(`target ${params.target_pct}%`)
  if (params.limit_kmh != null) bits.push(`> ${params.limit_kmh} km/h`)
  if (params.start && params.end) bits.push(`${params.start}–${params.end}`)
  return bits.length ? ` · ${bits.join(' · ')}` : ''
}

function AddAlertForm({
  geofences, vehicles, onCreate, inputCls,
}: {
  geofences: { id: number; name: string }[]
  vehicles: { id: number; name: string | null }[]
  onCreate: (p: { type: string; car_id: number | null; params: Record<string, unknown> }) => Promise<void>
  inputCls: string
}) {
  const [type, setType] = useState(ALERT_TYPES[0].type)
  const [carId, setCarId] = useState<number | null>(null)
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const meta = metaFor(type)

  function setParam(key: string, value: unknown) {
    setParams((p) => ({ ...p, [key]: value }))
  }

  async function submit() {
    setSaving(true)
    try {
      await onCreate({ type, car_id: carId, params })
      setParams({})
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-ink/5 border border-dashed border-ink/15 rounded-lg p-4 space-y-3 mt-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-ink/60 text-xs mb-1">Alert type</label>
          <select value={type} onChange={(e) => { setType(e.target.value); setParams({}) }} className={`${inputCls} w-full`}>
            {ALERT_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-ink/60 text-xs mb-1">Vehicle</label>
          <select
            value={carId ?? ''}
            onChange={(e) => setCarId(e.target.value ? Number(e.target.value) : null)}
            className={`${inputCls} w-full`}
          >
            <option value="">All cars</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name ?? `Car ${v.id}`}</option>)}
          </select>
        </div>
      </div>

      {meta && meta.fields.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {meta.fields.map((f) => (
            <ParamInput key={f.key} field={f} value={params[f.key]} onChange={(v) => setParam(f.key, v)} geofences={geofences} inputCls={inputCls} />
          ))}
        </div>
      )}
      {meta && <p className="text-ink/40 text-xs">{meta.description}</p>}

      <button
        onClick={submit}
        disabled={saving}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Add alert
      </button>
    </div>
  )
}

function ParamInput({
  field, value, onChange, geofences, inputCls,
}: {
  field: ParamField
  value: unknown
  onChange: (v: unknown) => void
  geofences: { id: number; name: string }[]
  inputCls: string
}) {
  if (field.kind === 'number') {
    return (
      <div>
        <label className="block text-ink/60 text-xs mb-1">{field.label}{field.suffix ? ` (${field.suffix})` : ''}</label>
        <input
          type="number"
          value={(value as number) ?? field.default ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className={`${inputCls} w-full`}
        />
      </div>
    )
  }
  if (field.kind === 'time') {
    return (
      <div>
        <label className="block text-ink/60 text-xs mb-1">{field.label}</label>
        <input type="time" value={(value as string) ?? field.default ?? ''} onChange={(e) => onChange(e.target.value)} className={`${inputCls} w-full`} />
      </div>
    )
  }
  if (field.kind === 'geofence') {
    return (
      <div>
        <label className="block text-ink/60 text-xs mb-1">{field.label}</label>
        <select value={(value as number) ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)} className={`${inputCls} w-full`}>
          <option value="">Any location</option>
          {geofences.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
    )
  }
  // weekdays
  const selected = (value as number[]) ?? []
  return (
    <div className="sm:col-span-2">
      <label className="block text-ink/60 text-xs mb-1">{field.label}</label>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((d, i) => {
          const on = selected.includes(i)
          return (
            <button
              key={d}
              type="button"
              onClick={() => onChange(on ? selected.filter((x) => x !== i) : [...selected, i])}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
                ${on ? 'border-brand-blue bg-brand-blue/10 text-ink' : 'border-ink/15 text-ink/50 hover:text-ink'}`}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}
