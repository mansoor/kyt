import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Loader2, Zap } from 'lucide-react'
import { login, signup } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

export default function LoginForm({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const isSignup = mode === 'signup'
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = isSignup
        ? await signup({ email, password, display_name: displayName || undefined })
        : await login({ email, password })
      setUser(user)
      navigate(user.must_change_password ? '/settings' : from, { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } })?.response?.status
      if (status === 429) setError('Too many attempts. Please try again in a minute.')
      else if (status === 401) setError('Invalid email or password.')
      else if (isSignup && status === 403) setError('Setup is already complete — please sign in.')
      else if (isSignup) setError('Could not create the account. Check your details and try again.')
      else setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-8 w-full max-w-sm">
      <div className="flex items-center gap-2 justify-center mb-6">
        <div className="w-8 h-8 rounded-lg bg-brand-red flex items-center justify-center">
          <Zap className="w-5 h-5 text-white fill-white" />
        </div>
        <span className="text-ink text-xl font-bold tracking-tight">Know Your Tesla</span>
      </div>

      <h1 className="text-ink text-center text-lg font-semibold mb-1">
        {isSignup ? 'Create your admin account' : 'Sign in to KYT'}
      </h1>
      {isSignup && (
        <p className="text-ink/50 text-center text-xs mb-5">
          This is a fresh install. The first account becomes the administrator.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
        {isSignup && (
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
        )}

        <div>
          <label htmlFor="email" className="block text-ink/70 text-sm mb-1.5 font-medium">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-ink/5 border border-ink/20 rounded-lg px-3 py-2.5 text-ink placeholder-ink/30 text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-ink/70 text-sm mb-1.5 font-medium">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            minLength={isSignup ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-ink/5 border border-ink/20 rounded-lg px-3 py-2.5 text-ink placeholder-ink/30 text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors"
            placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
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
          className="w-full bg-brand-blue hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-1"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? (isSignup ? 'Creating account…' : 'Signing in…') : (isSignup ? 'Create admin account' : 'Sign In')}
        </button>
      </form>
    </div>
  )
}
