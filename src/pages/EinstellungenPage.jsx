import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import AvatarUpload from '../components/AvatarUpload'
import { initialen } from '../lib/initialen'

// Empfehlungsprogramm: zeigt den persönlichen, lazy vergebenen
// Empfehlungscode (api/certificate.js?resource=empfehlung) plus einen
// fertigen Beispiellink zum Kopieren. Belohnungslogik (Rabatt,
// Guthaben, o.ä.) ist bewusst noch nicht abgebildet -- das entscheidet
// Marcel später, siehe README-Abschnitt "Empfehlungsprogramm".
function EmpfehlungsprogrammSection({ accessToken }) {
  const [daten, setDaten] = useState(null)
  const [fehler, setFehler] = useState('')
  const [kopiert, setKopiert] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    async function laden() {
      try {
        const response = await fetch('/api/certificate?resource=empfehlung', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(data?.error || 'Empfehlungscode konnte nicht geladen werden.')
        }

        if (!cancelled) setDaten(data)
      } catch (err) {
        if (!cancelled) setFehler(err.message)
      }
    }

    laden()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  if (fehler) return null
  if (!daten) return null

  const link = daten.beispielProgramm
    ? `${window.location.origin}/kaufen/${daten.beispielProgramm.slug}?ref=${daten.code}`
    : null

  async function kopieren(text) {
    try {
      await navigator.clipboard.writeText(text)
      setKopiert(true)
      setTimeout(() => setKopiert(false), 2000)
    } catch {
      // Zwischenablage nicht verfügbar (z. B. fehlende Berechtigung) --
      // der Code/Link steht trotzdem sichtbar da, kein Blocker.
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 font-semibold text-slate-800">Empfehlungsprogramm</h2>
      <p className="mb-4 text-sm text-mrh-grey">
        Empfiehl MRH weiter -- mit deinem persönlichen Code oder Link.
      </p>

      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        Dein Code
      </label>
      <div className="mb-4 flex gap-2">
        <input
          readOnly
          value={daten.code}
          className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
        />
        <button
          onClick={() => kopieren(daten.code)}
          className="shrink-0 rounded-lg border border-mrh-gold px-3 py-2 text-sm font-medium text-mrh-gold-dark transition hover:bg-mrh-gold/10"
        >
          {kopiert ? 'Kopiert!' : 'Kopieren'}
        </button>
      </div>

      {link && (
        <>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Beispiellink ({daten.beispielProgramm.titel})
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
            />
            <button
              onClick={() => kopieren(link)}
              className="shrink-0 rounded-lg border border-mrh-gold px-3 py-2 text-sm font-medium text-mrh-gold-dark transition hover:bg-mrh-gold/10"
            >
              {kopiert ? 'Kopiert!' : 'Kopieren'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Passwort-Änderung direkt über den Supabase-Client (kein eigener
// API-Endpunkt nötig, RLS/Auth regelt das schon). Das "aktuelle
// Passwort" wird über einen erneuten signInWithPassword-Aufruf
// geprüft, bevor updateUser() das neue Passwort setzt -- Supabase
// selbst verlangt für updateUser() keine Re-Authentifizierung, aber
// ohne diese Prüfung könnte jeder mit einer offenen Sitzung (z. B. an
// einem fremden Rechner) das Passwort ändern, ohne es zu kennen.
export default function EinstellungenPage() {
  const { coachie, session, refreshCoachie } = useAuth()
  const [avatarFehler, setAvatarFehler] = useState('')
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

  async function handleAvatarUploaded(url) {
    setAvatarFehler('')
    const { error } = await supabase
      .from('coachies')
      .update({ avatar_url: url })
      .eq('id', coachie.id)

    if (error) {
      setAvatarFehler('Profilbild konnte nicht gespeichert werden.')
      return
    }

    await refreshCoachie()
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-mrh-navy">Einstellungen</h1>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-800">Profilbild</h2>
        <div className="flex items-center gap-4">
          {coachie?.avatar_url ? (
            <img
              src={coachie.avatar_url}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mrh-navy text-lg font-semibold text-white">
              {initialen(coachie?.name)}
            </span>
          )}
          <AvatarUpload
            accessToken={session?.access_token}
            onUploaded={handleAvatarUploaded}
          />
        </div>
        {avatarFehler && <p className="mt-2 text-xs text-red-600">{avatarFehler}</p>}
      </div>

      <EmpfehlungsprogrammSection accessToken={session?.access_token} />

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
