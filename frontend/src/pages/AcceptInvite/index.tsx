import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, Zap } from 'lucide-react'
import { acceptInvite } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

export default function AcceptInvitePage() {
  const { token = '' } = useParams()
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await acceptInvite({ token, password, display_name: displayName || undefined })
      setUser(user)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Could not accept the invite. It may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-12">
      <div className="glass rounded-2xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-8 h-8 rounded-lg bg-brand-red flex items-center justify-center">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="text-ink text-xl font-bold tracking-tight">Know Your Tesla</span>
        </div>

        <h1 className="text-ink text-center text-lg font-semibold mb-1">Accept your invite</h1>
        <p className="text-ink/50 text-center text-xs mb-5">Set a password to activate your account.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="display_name" className="block text-ink/70 text-sm mb-1.5 font-medium">
              Display name <span className="text-ink/30">(optional)</span>
            </label>
            <input
              id="display_name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-ink/5 border border-ink/20 rounded-lg px-3 py-2.5 text-ink placeholder-ink/30 text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-ink/70 text-sm mb-1.5 font-medium">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-ink/5 border border-ink/20 rounded-lg px-3 py-2.5 text-ink placeholder-ink/30 text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors"
              placeholder="At least 8 characters"
            />
          </div>

          {error && (
            <p role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-blue hover:bg-blue-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-1"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Activating…' : 'Activate account'}
          </button>
        </form>
      </div>
    </div>
  )
}
