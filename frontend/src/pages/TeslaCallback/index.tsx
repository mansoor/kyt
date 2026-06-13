import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import client from '@/api/client'

export default function TeslaCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      setStatus('error')
      setMessage(`Tesla denied access: ${error}`)
      return
    }

    if (!code || !state) {
      setStatus('error')
      setMessage('Missing OAuth parameters')
      return
    }

    client
      .get(`/tesla/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
      .then(() => {
        setStatus('success')
        setMessage('Tesla account connected successfully!')
        setTimeout(() => navigate('/settings', { replace: true }), 2000)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err?.response?.data?.detail ?? 'Failed to connect Tesla account')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center">
      <div className="glass rounded-2xl p-8 w-full max-w-sm text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-brand-blue animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-semibold">Connecting Tesla account…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-4" />
            <p className="text-white text-lg font-semibold">{message}</p>
            <p className="text-white/50 text-sm mt-2">Redirecting to settings…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <p className="text-white text-lg font-semibold">Connection failed</p>
            <p className="text-white/60 text-sm mt-2">{message}</p>
            <button
              onClick={() => navigate('/settings', { replace: true })}
              className="mt-6 w-full bg-brand-blue hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  )
}
