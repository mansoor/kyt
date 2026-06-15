import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Check, Monitor, Sun, Moon } from 'lucide-react'
import { updateProfile, changePassword } from '@/api/users'
import { useAuthStore } from '@/store/authStore'
import { applyTheme } from '@/theme'
import type { ThemePref } from '@/types/auth'

const THEMES: { value: ThemePref; label: string; icon: typeof Monitor }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export default function ProfileTab() {
  const { user, setUser } = useAuthStore()
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [theme, setTheme] = useState<ThemePref>(user?.theme ?? 'system')

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwDone, setPwDone] = useState(false)

  const profileMut = useMutation({
    mutationFn: () => updateProfile({ display_name: displayName, theme }),
    onSuccess: (u) => setUser(u),
  })

  const passwordMut = useMutation({
    mutationFn: () => changePassword({ current_password: current, new_password: next }),
    onSuccess: () => {
      setPwDone(true); setPwError(null); setCurrent(''); setNext('')
      if (user) setUser({ ...user, must_change_password: false })
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPwError(detail ?? 'Could not change password')
      setPwDone(false)
    },
  })

  function selectTheme(t: ThemePref) {
    setTheme(t)
    applyTheme(t)   // instant preview; persisted on save
  }

  const inputCls = 'w-full bg-ink/5 border border-ink/15 rounded-lg px-3 py-2.5 text-ink placeholder-ink/30 text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors'

  return (
    <div className="space-y-8">
      {user?.must_change_password && (
        <div className="text-amber-500 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Please choose a new password to secure your account.
        </div>
      )}

      {/* Profile */}
      <section className="space-y-4">
        <h2 className="text-ink font-semibold text-base">Profile</h2>
        <div>
          <label className="block text-ink/60 text-sm mb-1.5">Email</label>
          <input value={user?.email ?? ''} disabled className={`${inputCls} opacity-60`} />
        </div>
        <div>
          <label className="block text-ink/60 text-sm mb-1.5">Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="Your name" />
        </div>

        <div>
          <label className="block text-ink/60 text-sm mb-1.5">Theme</label>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => selectTheme(value)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors
                  ${theme === value ? 'border-brand-blue bg-brand-blue/10 text-ink' : 'border-ink/15 text-ink/60 hover:text-ink hover:bg-ink/5'}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => profileMut.mutate()}
          disabled={profileMut.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
        >
          {profileMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : profileMut.isSuccess ? <Check className="w-4 h-4" /> : null}
          Save profile
        </button>
      </section>

      {/* Password */}
      <section className="space-y-4 border-t border-ink/10 pt-6">
        <h2 className="text-ink font-semibold text-base">Change password</h2>
        <div>
          <label className="block text-ink/60 text-sm mb-1.5">Current password</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} autoComplete="current-password" />
        </div>
        <div>
          <label className="block text-ink/60 text-sm mb-1.5">New password</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} autoComplete="new-password" placeholder="At least 8 characters" />
        </div>
        {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
        {pwDone && <p className="text-green-500 text-sm">Password updated.</p>}
        <button
          onClick={() => passwordMut.mutate()}
          disabled={passwordMut.isPending || !current || next.length < 8}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink/10 hover:bg-ink/15 disabled:opacity-50 text-ink text-sm font-semibold transition-colors"
        >
          {passwordMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Update password
        </button>
      </section>
    </div>
  )
}
