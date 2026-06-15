import { useState } from 'react'
import { Car, User, Bell, Users, Mail } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import AppShell from '@/components/AppShell'
import TeslaConnect from './TeslaConnect'
import ProfileTab from './ProfileTab'
import NotificationsTab from './NotificationsTab'
import UsersTab from './UsersTab'
import SmtpTab from './SmtpTab'

type TabId = 'tesla' | 'profile' | 'notifications' | 'users' | 'smtp'

export default function SettingsPage() {
  const isAdmin = useAuthStore((s) => s.user?.is_superuser)
  const [tab, setTab] = useState<TabId>('profile')

  const allTabs: { id: TabId; label: string; icon: typeof Car; admin?: boolean }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'tesla', label: 'Tesla', icon: Car },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'users', label: 'Users', icon: Users, admin: true },
    { id: 'smtp', label: 'Email (SMTP)', icon: Mail, admin: true },
  ]
  const tabs = allTabs.filter((t) => !t.admin || isAdmin)

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-ink text-2xl font-bold">Settings</h1>
          <p className="text-ink/50 mt-1 text-sm">Manage your account, vehicles, alerts and preferences.</p>
        </div>

        <div className="flex gap-1 border-b border-ink/10 mb-6 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors
                ${tab === id ? 'border-brand-blue text-ink' : 'border-transparent text-ink/50 hover:text-ink'}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <section className="glass rounded-2xl p-6">
          {tab === 'profile' && <ProfileTab />}
          {tab === 'tesla' && <TeslaConnect />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'users' && isAdmin && <UsersTab />}
          {tab === 'smtp' && isAdmin && <SmtpTab />}
        </section>
      </div>
    </AppShell>
  )
}
