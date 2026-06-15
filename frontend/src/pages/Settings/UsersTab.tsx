import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2, UserPlus, Copy, Check, ShieldCheck, Shield } from 'lucide-react'
import { listUsers, updateUser, deleteUser, createInvite, listInvites, deleteInvite, type Invite } from '@/api/users'
import { useAuthStore } from '@/store/authStore'

export default function UsersTab() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: listUsers })
  const { data: invites = [] } = useQuery({ queryKey: ['admin-invites'], queryFn: listInvites })

  const [email, setEmail] = useState('')
  const [asAdmin, setAsAdmin] = useState(false)
  const [newInvite, setNewInvite] = useState<Invite | null>(null)
  const [copied, setCopied] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const refreshUsers = () => qc.invalidateQueries({ queryKey: ['admin-users'] })
  const refreshInvites = () => qc.invalidateQueries({ queryKey: ['admin-invites'] })

  const updateMut = useMutation({
    mutationFn: (d: { id: string; is_active?: boolean; is_superuser?: boolean }) => updateUser(d.id, d),
    onSuccess: refreshUsers,
  })
  const deleteUserMut = useMutation({ mutationFn: deleteUser, onSuccess: refreshUsers })
  const inviteMut = useMutation({
    mutationFn: () => createInvite({ email, is_superuser: asAdmin }),
    onSuccess: (inv) => { setNewInvite(inv); setEmail(''); setAsAdmin(false); setInviteError(null); refreshInvites() },
    onError: (err: unknown) => setInviteError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Could not create invite'),
  })
  const delInviteMut = useMutation({ mutationFn: deleteInvite, onSuccess: refreshInvites })

  const inputCls = 'bg-ink/5 border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-brand-blue'

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  return (
    <div className="space-y-8">
      {/* Invite */}
      <section className="space-y-3">
        <h2 className="text-ink font-semibold text-base">Invite a user</h2>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-ink/60 text-sm mb-1.5">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={`${inputCls} w-full`} placeholder="friend@example.com" />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink/70 py-2">
            <input type="checkbox" checked={asAdmin} onChange={(e) => setAsAdmin(e.target.checked)} className="accent-brand-blue w-4 h-4" />
            Administrator
          </label>
          <button
            onClick={() => inviteMut.mutate()}
            disabled={inviteMut.isPending || !email}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {inviteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Invite
          </button>
        </div>
        {inviteError && <p className="text-red-400 text-sm">{inviteError}</p>}

        {newInvite?.invite_url && (
          <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-lg p-3 space-y-2">
            <p className="text-ink text-sm font-medium">Invite created for {newInvite.email}</p>
            <p className="text-ink/50 text-xs">Share this link (or copy it manually if email isn't set up):</p>
            <div className="flex items-center gap-2">
              <input readOnly value={newInvite.invite_url} className={`${inputCls} flex-1 font-mono text-xs`} />
              <button onClick={() => copyLink(newInvite.invite_url!)} className="p-2 rounded-lg bg-ink/10 hover:bg-ink/15 text-ink transition-colors">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Pending invites */}
      {invites.length > 0 && (
        <section className="space-y-2 border-t border-ink/10 pt-6">
          <h2 className="text-ink font-semibold text-base">Pending invites</h2>
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 bg-ink/5 border border-ink/10 rounded-lg px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-ink text-sm">{inv.email}{inv.is_superuser ? ' · admin' : ''}</p>
                <p className="text-ink/40 text-xs">Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
              </div>
              <button onClick={() => delInviteMut.mutate(inv.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Users */}
      <section className="space-y-2 border-t border-ink/10 pt-6">
        <h2 className="text-ink font-semibold text-base">Users</h2>
        {users.map((u) => {
          const isMe = u.id === me?.id
          return (
            <div key={u.id} className="flex items-center gap-3 bg-ink/5 border border-ink/10 rounded-lg px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-ink text-sm font-medium truncate">
                  {u.display_name ?? u.email}{isMe && <span className="text-ink/40"> (you)</span>}
                </p>
                <p className="text-ink/40 text-xs truncate">
                  {u.email} · {u.is_active ? 'active' : 'disabled'} · {u.last_login ? `last seen ${new Date(u.last_login).toLocaleDateString()}` : 'never signed in'}
                </p>
              </div>
              <button
                title={u.is_superuser ? 'Revoke admin' : 'Make admin'}
                disabled={isMe}
                onClick={() => updateMut.mutate({ id: u.id, is_superuser: !u.is_superuser })}
                className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${u.is_superuser ? 'text-brand-blue hover:bg-brand-blue/10' : 'text-ink/40 hover:bg-ink/10'}`}
              >
                {u.is_superuser ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              </button>
              <button
                disabled={isMe}
                onClick={() => updateMut.mutate({ id: u.id, is_active: !u.is_active })}
                className="text-xs px-2 py-1 rounded-md bg-ink/10 hover:bg-ink/15 text-ink/70 transition-colors disabled:opacity-30"
              >
                {u.is_active ? 'Disable' : 'Enable'}
              </button>
              <button
                disabled={isMe}
                onClick={() => { if (confirm(`Delete ${u.email}?`)) deleteUserMut.mutate(u.id) }}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </section>
    </div>
  )
}
