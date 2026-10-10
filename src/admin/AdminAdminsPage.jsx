import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'

function formatZeitpunkt(iso) {
  if (!iso) return 'noch nie'
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const feldKlassen =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none'

// Admin-Konten verwalten: Liste, Einladen per E-Mail, Aktivieren und
// Deaktivieren. Die Regeln (nicht selbst deaktivieren, letzter aktiver
// Admin bleibt aktiv) prüft der Server; die Oberfläche sperrt die
// entsprechenden Schaltflächen zusätzlich.
export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState([])
  const [ich, setIch] = useState(null)
  const [notfall, setNotfall] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [meldung, setMeldung] = useState('')

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [laedtEin, setLaedtEin] = useState(false)
  const [aendertId, setAendertId] = useState(null)

  async function laden() {
    setError('')
    try {
      const data = await adminFetch('/api/admin/coachies?resource=admins')
      setAdmins(data.admins ?? [])
      setIch(data.ich)
      setNotfall(data.notfall)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    laden()
  }, [])

  async function handleEinladen(event) {
    event.preventDefault()
    setLaedtEin(true)
    setError('')
    setMeldung('')
    try {
      const data = await adminFetch('/api/admin/coachies?resource=admins', {
        method: 'POST',
        body: JSON.stringify({ email, name }),
      })
      setMeldung(
        data.eingeladen
          ? `Einladung an ${data.admin.email} verschickt. Nach dem Festlegen des Passworts geht es unter /admin/login weiter.`
          : `${data.admin.email} hat schon ein Konto und kann sich ab sofort mit dem bestehenden Passwort unter /admin/login anmelden. Ein Hinweis per E-Mail ist unterwegs.`,
      )
      setEmail('')
      setName('')
      await laden()
    } catch (err) {
      setError(err.message)
    } finally {
      setLaedtEin(false)
    }
  }

  async function handleAktiv(admin, aktiv) {
    if (!aktiv && !window.confirm(`${admin.name || admin.email} wirklich deaktivieren?`)) return
    setAendertId(admin.id)
    setError('')
    setMeldung('')
    try {
      await adminFetch('/api/admin/coachies?resource=admins', {
        method: 'PATCH',
        body: JSON.stringify({ id: admin.id, aktiv }),
      })
      await laden()
    } catch (err) {
      setError(err.message)
    } finally {
      setAendertId(null)
    }
  }

  if (loading) return <p className="text-slate-500">Lädt…</p>

  const aktiveAnzahl = admins.filter((a) => a.aktiv).length

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-mrh-navy">Admins</h1>
      <p className="mb-6 text-sm text-mrh-grey">
        Jeder Admin meldet sich mit eigener E-Mail und eigenem Passwort unter{' '}
        <code className="rounded bg-slate-100 px-1">/admin/login</code> an. Ein
        Admin-Konto ist kein Coachie-Konto und umgekehrt.
      </p>

      {notfall && (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Du bist über den Notfallzugang angemeldet. Lege dir hier ein eigenes
          Admin-Konto an. Sobald alle Admins eigene Konten haben, kann
          ADMIN_PASSWORD in Vercel entfernt werden.
        </p>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {meldung && <p className="mb-4 text-sm text-mrh-gold-dark">{meldung}</p>}

      <form
        onSubmit={handleEinladen}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-xl bg-white p-5 shadow-sm"
      >
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="neu-email" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            E-Mail
          </label>
          <input
            id="neu-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={feldKlassen}
          />
        </div>
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="neu-name" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Name
          </label>
          <input
            id="neu-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={feldKlassen}
          />
        </div>
        <button
          type="submit"
          disabled={laedtEin}
          className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
        >
          {laedtEin ? 'Lädt ein…' : 'Admin einladen'}
        </button>
      </form>

      {admins.length === 0 ? (
        <p className="text-sm text-slate-400">Noch keine Admin-Konten.</p>
      ) : (
        <div className="space-y-2">
          {admins.map((admin) => {
            const istIch = admin.id === ich
            const letzterAktiver = admin.aktiv && aktiveAnzahl <= 1
            const sperrgrund = istIch
              ? 'Du kannst dich nicht selbst deaktivieren.'
              : letzterAktiver
                ? 'Der letzte aktive Admin kann nicht deaktiviert werden.'
                : ''
            return (
              <div
                key={admin.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {admin.name || admin.email}
                    {istIch && <span className="ml-2 text-xs text-mrh-grey">(du)</span>}
                  </p>
                  <p className="text-xs text-mrh-grey">{admin.email}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-mrh-grey">
                  <span>Letzter Login: {formatZeitpunkt(admin.letzter_login_am)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      admin.aktiv ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {admin.aktiv ? 'Aktiv' : 'Deaktiviert'}
                  </span>
                  {admin.aktiv ? (
                    <button
                      onClick={() => handleAktiv(admin, false)}
                      disabled={Boolean(sperrgrund) || aendertId === admin.id}
                      title={sperrgrund || undefined}
                      className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {aendertId === admin.id ? 'Speichert…' : 'Deaktivieren'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAktiv(admin, true)}
                      disabled={aendertId === admin.id}
                      className="rounded-lg border border-mrh-navy px-2 py-1 text-xs text-mrh-navy transition hover:bg-mrh-navy/5 disabled:opacity-50"
                    >
                      {aendertId === admin.id ? 'Speichert…' : 'Aktivieren'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
