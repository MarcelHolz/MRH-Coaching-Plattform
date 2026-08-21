import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { invite } from '../lib/supabaseClient'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    const redirectTo = invite.active
      ? '/passwort-festlegen'
      : (location.state?.from ?? '/coachie')
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch {
      setError('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-mrh-cream">
      <div className="flex w-full items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-xl font-semibold text-mrh-navy">
            MRH Beratung &amp; Coaching
          </h1>
          <p className="mb-6 text-sm text-mrh-grey">Anmelden als Coachie</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                E-Mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Passwort
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-mrh-navy py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
            >
              {submitting ? 'Anmelden…' : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>

      <div className="relative hidden w-1/2 overflow-hidden bg-mrh-navy lg:block">
        <img
          src="/brand/marcel-blazer.webp"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-mrh-navy/90 via-mrh-navy/40 to-transparent p-10 pt-24">
          <p className="text-lg font-medium text-white">
            Klarheit ist der Anfang jeder guten Entscheidung.
          </p>
        </div>
      </div>
    </div>
  )
}
