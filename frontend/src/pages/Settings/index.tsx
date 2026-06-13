import { useAuthStore } from '@/store/authStore'
import AppShell from '@/components/AppShell'
import TeslaConnect from './TeslaConnect'

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-white text-2xl font-bold">Settings</h1>
          <p className="text-white/50 mt-1 text-sm">Manage your Tesla connection and account preferences.</p>
        </div>

        <section className="glass rounded-2xl p-6">
          <TeslaConnect />
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="text-white font-semibold text-base mb-4">Account</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Email</span>
              <span className="text-white">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Role</span>
              <span className="text-white">{user?.is_superuser ? 'Administrator' : 'User'}</span>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
