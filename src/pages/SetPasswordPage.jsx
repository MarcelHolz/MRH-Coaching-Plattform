import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pendingPasswordSetup, supabase } from '../lib/supabaseClient'

export default function SetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }
    if (password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      setError('Passwort konnte nicht gesetzt werden. Bitte versuche es erneut.')
      return
    }

    pendingPasswordSetup.active = false
    navigate('/coachie', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-mrh-cream">
      <div className="flex w-full items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-xl font-semibold text-mrh-navy">
            Passwort festlegen
          </h1>
          <p className="mb-6 text-sm text-mrh-grey">
            Willkommen bei MRH Beratung &amp; Coaching. Leg ein Passwort fest,
            mit dem du dich künftig mit deiner E-Mail-Adresse anmeldest.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Neues Passwort
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Passwort bestätigen
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-mrh-navy py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
            >
              {submitting ? 'Speichert…' : 'Passwort speichern'}
            </button>
          </form>
        </div>
      </div>

      <div className="relative hidden w-1/2 overflow-hidden bg-mrh-navy lg:block">
        <img
          src="/brand/marcel-hemd.webp"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-mrh-navy/90 via-mrh-navy/40 to-transparent p-10 pt-24">
          <p className="font-serif text-lg italic leading-snug text-white/90">
            Der erste Schritt ist gemacht.
          </p>
        </div>
      </div>
    </div>
  )
}
