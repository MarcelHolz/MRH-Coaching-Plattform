import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAdminAuth } from './AdminAuthContext'
import PasswortFeld from '../components/PasswortFeld'
import { supabase } from '../lib/supabaseClient'
import { merkeAdminZiel } from '../lib/passwortZiel'

const feldKlassen =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy'

// Admin-Login mit persönlichem Konto (E-Mail + Passwort, Supabase Auth,
// serverseitig geprüft in api/admin/login.js). Getrennt vom Coachie-Login:
// es entsteht keine Supabase-Session im Browser, nur ein Admin-Token.
// Der Notfallzugang mit dem gemeinsamen ADMIN_PASSWORD bleibt erreichbar,
// bis die Variable in Vercel entfernt wird.
export default function AdminLoginPage() {
  const { login, isAuthenticated } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [modus, setModus] = useState('konto')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [vergessenGesendet, setVergessenGesendet] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(modus === 'konto' ? email : null, password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message || 'Anmeldung fehlgeschlagen.')
    } finally {
      setSubmitting(false)
    }
  }

  // Gleicher Recovery-Flow wie beim Coachie-Login. Der Merker sorgt dafür,
  // dass es nach dem Festlegen des Passworts hierher zurückgeht. Immer
  // dieselbe Bestätigung, egal ob die Adresse existiert.
  async function handleVergessen() {
    setError('')
    if (!email.trim()) {
      setError('Bitte zuerst deine E-Mail-Adresse eintragen.')
      return
    }
    merkeAdminZiel()
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/passwort-festlegen`,
    })
    setVergessenGesendet(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mrh-cream px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-mrh-navy">Admin-Bereich</h1>
        <p className="mb-6 text-sm text-slate-500">MRH Coaching-Plattform</p>

        {location.state?.hinweis && (
          <p className="mb-4 rounded-lg bg-mrh-cream p-3 text-sm text-slate-700">
            {location.state.hinweis}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {modus === 'konto' && (
            <div>
              <label htmlFor="admin-email" className="mb-1 block text-sm font-medium text-slate-700">
                E-Mail
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={feldKlassen}
              />
            </div>
          )}
          <div>
            <label htmlFor="admin-passwort" className="mb-1 block text-sm font-medium text-slate-700">
              {modus === 'konto' ? 'Passwort' : 'Notfall-Passwort'}
            </label>
            <PasswortFeld
              id="admin-passwort"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={feldKlassen}
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

        <div className="mt-4 flex flex-col items-start gap-2 text-sm">
          {modus === 'konto' &&
            (vergessenGesendet ? (
              <p className="text-slate-600">
                Falls zu dieser Adresse ein Konto existiert, wurde ein Link zum
                Zurücksetzen des Passworts verschickt.
              </p>
            ) : (
              <button type="button" onClick={handleVergessen} className="text-mrh-navy hover:underline">
                Passwort vergessen?
              </button>
            ))}
          <button
            type="button"
            onClick={() => {
              setModus(modus === 'konto' ? 'notfall' : 'konto')
              setError('')
              setPassword('')
            }}
            className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
          >
            {modus === 'konto' ? 'Notfallzugang' : 'Zurück zur Anmeldung mit E-Mail'}
          </button>
        </div>
      </div>
    </div>
  )
}
