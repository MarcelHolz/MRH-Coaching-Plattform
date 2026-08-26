import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Passwort-Änderung direkt über den Supabase-Client (kein eigener
// API-Endpunkt nötig, RLS/Auth regelt das schon). Das "aktuelle
// Passwort" wird über einen erneuten signInWithPassword-Aufruf
// geprüft, bevor updateUser() das neue Passwort setzt -- Supabase
// selbst verlangt für updateUser() keine Re-Authentifizierung, aber
// ohne diese Prüfung könnte jeder mit einer offenen Sitzung (z. B. an
// einem fremden Rechner) das Passwort ändern, ohne es zu kennen.
export default function EinstellungenPage() {
  const { coachie } = useAuth()
  const [aktuellesPasswort, setAktuellesPasswort] = useState('')
  const [neuesPasswort, setNeuesPasswort] = useState('')
  const [neuesPasswortWiederholung, setNeuesPasswortWiederholung] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [erfolg, setErfolg] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setErfolg(false)

    if (neuesPasswort !== neuesPasswortWiederholung) {
      setError('Die beiden neuen Passwörter stimmen nicht überein.')
      return
    }
    if (neuesPasswort.length < 8) {
      setError('Das neue Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }

    setSubmitting(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: coachie.email,
        password: aktuellesPasswort,
      })

      if (signInError) {
        setError('Aktuelles Passwort ist falsch.')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: neuesPasswort,
      })

      if (updateError) {
        setError('Passwort konnte nicht geändert werden.')
        return
      }

      setErfolg(true)
      setAktuellesPasswort('')
      setNeuesPasswort('')
      setNeuesPasswortWiederholung('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-mrh-navy">Einstellungen</h1>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-800">Passwort ändern</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Aktuelles Passwort
            </label>
            <input
              type="password"
              required
              value={aktuellesPasswort}
              onChange={(e) => setAktuellesPasswort(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Neues Passwort
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={neuesPasswort}
              onChange={(e) => setNeuesPasswort(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Neues Passwort wiederholen
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={neuesPasswortWiederholung}
              onChange={(e) => setNeuesPasswortWiederholung(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {erfolg && (
            <p className="text-sm text-mrh-gold-dark">
              Passwort wurde geändert.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
          >
            {submitting ? 'Speichert…' : 'Passwort ändern'}
          </button>
        </form>
      </div>
    </div>
  )
}
