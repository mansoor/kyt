import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, Unplug, RotateCw, BatteryMedium, CheckCircle, Circle, Loader2, AlertCircle } from 'lucide-react'
import { getTeslaAuthUrl, disconnectTesla, getVehicles, wakeVehicle, getSetupStatus, runSetup } from '@/api/tesla'

const STATE_COLORS: Record<string, string> = {
  online: 'text-green-400',
  driving: 'text-brand-blue',
  charging: 'text-yellow-400',
  asleep: 'text-ink/40',
  updating: 'text-purple-400',
  offline: 'text-red-400',
  unknown: 'text-ink/30',
}

function StepIcon({ done, active, error }: { done: boolean; active: boolean; error?: boolean }) {
  if (error) return <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
  if (done) return <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
  if (active) return <Loader2 className="w-5 h-5 text-brand-blue animate-spin shrink-0" />
  return <Circle className="w-5 h-5 text-ink/20 shrink-0" />
}

export default function TeslaConnect() {
  const queryClient = useQueryClient()

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['tesla-setup-status'],
    queryFn: getSetupStatus,
    refetchInterval: false,
  })

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
    refetchInterval: 30_000,
  })

  const setupMutation = useMutation({
    mutationFn: runSetup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesla-setup-status'] })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: disconnectTesla,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['tesla-setup-status'] })
    },
  })

  const wakeMutation = useMutation({
    mutationFn: wakeVehicle,
  })

  async function handleConnect() {
    const { url, configured } = await getTeslaAuthUrl()
    if (!configured) {
      alert('Tesla API credentials not configured. Set TESLA_CLIENT_ID and TESLA_CLIENT_SECRET in your .env file.')
      return
    }
    window.location.href = url
  }

  const needsSetup = status && (!status.keys_generated || !status.registered)
  const setupDone = status?.keys_generated && status?.registered
  const hasVehicles = vehicles.length > 0

  return (
    <div className="space-y-6">

      {/* Setup wizard — only shown until fully registered */}
      {!statusLoading && needsSetup && (
        <div className="bg-ink/5 border border-ink/10 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-ink font-semibold text-sm">Fleet API Setup</h3>
            <p className="text-ink/50 text-xs mt-0.5">One-time setup required before connecting your Tesla account.</p>
          </div>

          <div className="space-y-3">
            {/* Step 1 */}
            <div className="flex items-start gap-3">
              <StepIcon done={!!status?.keys_generated} active={false} />
              <div>
                <p className={`text-sm font-medium ${status?.keys_generated ? 'text-ink/50 line-through' : 'text-ink'}`}>
                  Generate security keys
                </p>
                <p className="text-ink/40 text-xs mt-0.5">Creates an EC key pair. Public key is served automatically.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3">
              <StepIcon done={!!status?.registered} active={setupMutation.isPending} error={setupMutation.isError} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${status?.registered ? 'text-ink/50 line-through' : 'text-ink'}`}>
                  Register with Tesla Fleet API
                </p>
                <p className="text-ink/40 text-xs mt-0.5">Tesla verifies your domain and public key.</p>
                {setupMutation.isError && (
                  <p className="text-red-400 text-xs mt-1">
                    {(setupMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Setup failed — check backend logs'}
                  </p>
                )}
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3">
              <StepIcon done={hasVehicles} active={false} />
              <div>
                <p className={`text-sm font-medium ${hasVehicles ? 'text-ink/50 line-through' : 'text-ink/50'}`}>
                  Connect your Tesla account
                </p>
                <p className="text-ink/40 text-xs mt-0.5">Authorise KYT to read your vehicle data.</p>
              </div>
            </div>
          </div>

          {!status?.registered && (
            <button
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending || !status?.configured}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-blue hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {setupMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
                : setupMutation.isError
                ? 'Retry Setup'
                : 'Run Setup'}
            </button>
          )}

          {!status?.configured && (
            <p className="text-amber-400 text-xs text-center">
              TESLA_CLIENT_ID and TESLA_CLIENT_SECRET must be set in .env before setup.
            </p>
          )}
        </div>
      )}

      {/* Tesla account section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-ink font-semibold text-base">Tesla Account</h2>
            <p className="text-ink/50 text-sm mt-0.5">
              {hasVehicles
                ? `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} connected`
                : 'No vehicles connected'}
            </p>
          </div>
          <div className="flex gap-2">
            {hasVehicles && (
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
              disabled={!setupDone && !hasVehicles}
              title={!setupDone && !hasVehicles ? 'Complete Fleet API setup first' : undefined}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-brand-blue hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              <Zap className="w-4 h-4" />
              {hasVehicles ? 'Re-connect' : 'Connect Tesla'}
            </button>
          </div>
        </div>

        {vehiclesLoading && <div className="text-ink/40 text-sm">Loading vehicles…</div>}

        {vehicles.map((v) => (
          <div key={v.id} className="bg-ink/5 border border-ink/10 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-paper border border-ink/10 flex items-center justify-center">
              <BatteryMedium className="w-5 h-5 text-brand-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-ink font-medium truncate">{v.name ?? v.vin ?? `Car ${v.id}`}</p>
              <p className="text-ink/50 text-sm">{v.model ?? '—'} · {v.vin ?? '—'}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-medium capitalize ${STATE_COLORS[v.state] ?? 'text-ink/40'}`}>
                {v.state}
              </p>
              {v.battery_level !== null && (
                <p className="text-ink/50 text-xs">{v.battery_level}%</p>
              )}
            </div>
            {v.state === 'asleep' && (
              <button
                onClick={() => wakeMutation.mutate(v.id)}
                disabled={wakeMutation.isPending}
                title="Wake vehicle"
                className="p-2 rounded-lg hover:bg-ink/10 text-ink/40 hover:text-ink transition-colors"
              >
                <RotateCw className={`w-4 h-4 ${wakeMutation.isPending ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
