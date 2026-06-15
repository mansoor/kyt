import { QueryClientProvider, QueryClient, useQuery } from '@tanstack/react-query'
import ChargeWidget from './ChargeWidget'
import LoginForm from './LoginForm'
import { getBootstrapStatus } from '@/api/auth'

// Standalone QueryClient for the public login page (no auth needed)
const publicQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 55_000 } },
})

function LoginInner() {
  const { data } = useQuery({ queryKey: ['bootstrap-status'], queryFn: getBootstrapStatus })
  return <LoginForm mode={data?.needs_setup ? 'signup' : 'login'} />
}

export default function LoginPage() {
  return (
    <QueryClientProvider client={publicQueryClient}>
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-12 gap-8">
        {/* Subtle radial glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand-blue/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-brand-red/5 blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-8">
          {/* Battery gauge widget */}
          <ChargeWidget />

          {/* Login or first-run signup form */}
          <LoginInner />
        </div>
      </div>
    </QueryClientProvider>
  )
}
