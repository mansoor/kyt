import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, Unplug, RotateCw, BatteryMedium } from 'lucide-react'
import { getTeslaAuthUrl, disconnectTesla, getVehicles, wakeVehicle } from '@/api/tesla'

const STATE_COLORS: Record<string, string> = {
  online: 'text-green-400',
  driving: 'text-brand-blue',
  charging: 'text-yellow-400',
  asleep: 'text-white/40',
  updating: 'text-purple-400',
  offline: 'text-red-400',
  unknown: 'text-white/30',
}

export default function TeslaConnect() {
  const queryClient = useQueryClient()
  const [connecting, setConnecting] = useState(false)

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
    refetchInterval: 30_000,
  })

  const disconnectMutation = useMutation({
    mutationFn: disconnectTesla,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
  })

  const wakeMutation = useMutation({
    mutationFn: wakeVehicle,
  })

  async function handleConnect() {
    setConnecting(true)
    try {
      const { url, configured } = await getTeslaAuthUrl()
      if (!configured) {
        alert('Tesla API credentials are not configured. Set TESLA_CLIENT_ID and TESLA_CLIENT_SECRET in your .env file.')
        return
      }
      window.location.href = url
    } catch {
      setConnecting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-base">Tesla Account</h2>
          <p className="text-white/50 text-sm mt-0.5">
            {vehicles.length > 0
              ? `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} connected`
              : 'No vehicles connected'}
          </p>
        </div>
        <div className="flex gap-2">
          {vehicles.length > 0 && (
            <button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
            >
              <Unplug className="w-4 h-4" />
              Disconnect
            </button>
          )}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-brand-blue hover:bg-blue-600 disabled:opacity-60 text-white transition-colors"
          >
            <Zap className="w-4 h-4" />
            {vehicles.length > 0 ? 'Re-connect' : 'Connect Tesla'}
          </button>
        </div>
      </div>

      {vehiclesLoading && (
        <div className="text-white/40 text-sm">Loading vehicles…</div>
      )}

      {vehicles.map((v) => (
        <div key={v.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-brand-dark border border-white/10 flex items-center justify-center">
            <BatteryMedium className="w-5 h-5 text-brand-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{v.name ?? v.vin ?? `Car ${v.id}`}</p>
            <p className="text-white/50 text-sm">{v.model ?? '—'} · {v.vin ?? '—'}</p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-sm font-medium capitalize ${STATE_COLORS[v.state] ?? 'text-white/40'}`}>
              {v.state}
            </p>
            {v.battery_level !== null && (
              <p className="text-white/50 text-xs">{v.battery_level}%</p>
            )}
          </div>
          {v.state === 'asleep' && (
            <button
              onClick={() => wakeMutation.mutate(v.id)}
              disabled={wakeMutation.isPending}
              title="Wake vehicle"
              className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <RotateCw className={`w-4 h-4 ${wakeMutation.isPending ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
