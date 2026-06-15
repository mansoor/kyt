import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Check } from 'lucide-react'
import { getSmtp, updateSmtp } from '@/api/notifications'

export default function SmtpTab() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['smtp'], queryFn: getSmtp })

  const [host, setHost] = useState('')
  const [port, setPort] = useState<number | ''>(587)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [from, setFrom] = useState('')
  const [useTls, setUseTls] = useState(true)

  useEffect(() => {
    if (!data) return
    setHost(data.smtp_host ?? '')
    setPort(data.smtp_port ?? 587)
    setUsername(data.smtp_username ?? '')
    setFrom(data.smtp_from ?? '')
    setUseTls(data.smtp_use_tls)
  }, [data])

  const saveMut = useMutation({
    mutationFn: () => updateSmtp({
      smtp_host: host || null,
      smtp_port: port === '' ? null : Number(port),
      smtp_username: username || null,
      smtp_password: password || null,   // only sent when changed
      smtp_from: from || null,
      smtp_use_tls: useTls,
    }),
    onSuccess: () => { setPassword(''); qc.invalidateQueries({ queryKey: ['smtp'] }) },
  })

  const inputCls = 'w-full bg-ink/5 border border-ink/15 rounded-lg px-3 py-2.5 text-ink placeholder-ink/30 text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors'

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-ink font-semibold text-base">Email relay (SMTP)</h2>
        <p className="text-ink/50 text-sm mt-0.5">Used to deliver all user email notifications via Apprise.</p>
      </div>

      <div>
        <label className="block text-ink/60 text-sm mb-1.5">SMTP host</label>
        <input value={host} onChange={(e) => setHost(e.target.value)} className={inputCls} placeholder="smtp.gmail.com" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-ink/60 text-sm mb-1.5">Port</label>
          <input type="number" value={port} onChange={(e) => setPort(e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} placeholder="587" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink/70 self-end pb-2.5">
          <input type="checkbox" checked={useTls} onChange={(e) => setUseTls(e.target.checked)} className="accent-brand-blue w-4 h-4" />
          Use STARTTLS
        </label>
      </div>
      <div>
        <label className="block text-ink/60 text-sm mb-1.5">From address</label>
        <input value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} placeholder="kyt@example.com" />
      </div>
      <div>
        <label className="block text-ink/60 text-sm mb-1.5">Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} autoComplete="off" placeholder="smtp username" />
      </div>
      <div>
        <label className="block text-ink/60 text-sm mb-1.5">
          Password {data?.password_set && <span className="text-ink/30">(set — leave blank to keep)</span>}
        </label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} autoComplete="new-password" placeholder={data?.password_set ? '••••••••' : 'app password'} />
      </div>

      <button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
      >
        {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saveMut.isSuccess ? <Check className="w-4 h-4" /> : null}
        Save SMTP settings
      </button>
    </div>
  )
}
