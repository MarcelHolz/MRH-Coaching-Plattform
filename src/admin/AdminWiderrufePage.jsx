import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'

// Übersicht der Widerrufe aus dem Widerrufsbutton (/vertrag-widerrufen).
// Rein manuelle Bearbeitung: Status und Notiz pflegen. Es wird nichts
// automatisch erstattet oder gesperrt. Für die Prüfung, ob das
// Widerrufsrecht erloschen ist, zeigt jede Zeile den gespeicherten
// Widerrufsverzicht des betroffenen Vertrags.
const STATUS = [
  { wert: 'eingegangen', label: 'Eingegangen', farbe: 'bg-amber-100 text-amber-800' },
  { wert: 'manuell_pruefen', label: 'Manuell prüfen', farbe: 'bg-orange-100 text-orange-800' },
  { wert: 'erstattet', label: 'Erstattet', farbe: 'bg-green-100 text-green-700' },
  {
    wert: 'abgelehnt_erloschen',
    label: 'Abgelehnt (erloschen)',
    farbe: 'bg-slate-100 text-slate-600',
  },
]

function formatZeitpunkt(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function Verzichtsanzeige({ vertragsdaten }) {
  if (!vertragsdaten) {
    return <span className="text-mrh-grey">Kein zugeordneter Vertrag</span>
  }
  if (vertragsdaten.nicht_gefunden) {
    return (
      <span className="text-mrh-grey">
        {vertragsdaten.art === 'kurs' ? 'Kurszugang' : 'Mitgliedschaft'} nicht gefunden
      </span>
    )
  }
  return vertragsdaten.widerrufsverzicht_am ? (
    <span className="text-slate-700">
      Widerrufsverzicht am {formatZeitpunkt(vertragsdaten.widerrufsverzicht_am)}
      <span className="text-mrh-grey"> · Vertrag seit {formatZeitpunkt(vertragsdaten.seit)}</span>
    </span>
  ) : (
    <span className="font-medium text-red-700">
      Kein Widerrufsverzicht gespeichert
      <span className="font-normal text-mrh-grey">
        {' '}
        · Vertrag seit {formatZeitpunkt(vertragsdaten.seit)}
      </span>
    </span>
  )
}

function WiderrufKarte({ widerruf, onGespeichert }) {
  const [status, setStatus] = useState(widerruf.status)
  const [notiz, setNotiz] = useState(widerruf.notiz ?? '')
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState('')
  const [gespeichert, setGespeichert] = useState(false)

  const statusInfo = STATUS.find((s) => s.wert === widerruf.status)
  const geaendert = status !== widerruf.status || notiz !== (widerruf.notiz ?? '')

  async function handleSpeichern() {
    setSpeichert(true)
    setFehler('')
    try {
      const data = await adminFetch('/api/admin/coachies?resource=widerrufe', {
        method: 'PATCH',
        body: JSON.stringify({ id: widerruf.id, status, notiz }),
      })
      onGespeichert(data.widerruf)
      setGespeichert(true)
      setTimeout(() => setGespeichert(false), 2000)
    } catch (err) {
      setFehler(err.message)
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800">{widerruf.vertrag}</p>
          <p className="text-sm text-slate-700">
            {widerruf.name} · {widerruf.email}
            {!widerruf.coachie_id && (
              <span className="text-mrh-grey"> · kein Coachie-Konto</span>
            )}
          </p>
          <p className="text-xs text-mrh-grey">
            Eingegangen am {formatZeitpunkt(widerruf.eingegangen_am)}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo?.farbe ?? 'bg-slate-100 text-slate-600'}`}
        >
          {statusInfo?.label ?? widerruf.status}
        </span>
      </div>

      <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-mrh-grey">Widerrufsverzicht</dt>
          <dd>
            <Verzichtsanzeige vertragsdaten={widerruf.vertragsdaten} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-mrh-grey">
            Kaufdatum oder Bestellnummer
          </dt>
          <dd className="text-slate-700">{widerruf.kaufdatum_oder_bestellnr || '–'}</dd>
        </div>
        {widerruf.anmerkung && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-mrh-grey">Anmerkung</dt>
            <dd className="whitespace-pre-line text-slate-700">{widerruf.anmerkung}</dd>
          </div>
        )}
      </dl>

      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
          >
            {STATUS.map((s) => (
              <option key={s.wert} value={s.wert}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Notiz
          </label>
          <input
            type="text"
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="z. B. erstattet über Stripe am …"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
          />
        </div>
        <button
          onClick={handleSpeichern}
          disabled={!geaendert || speichert}
          className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
        >
          {speichert ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
      {widerruf.bearbeitet_am && (
        <p className="mt-2 text-xs text-mrh-grey">
          Zuletzt bearbeitet am {formatZeitpunkt(widerruf.bearbeitet_am)}
        </p>
      )}
      {gespeichert && <p className="mt-2 text-sm text-mrh-gold-dark">Gespeichert.</p>}
      {fehler && <p className="mt-2 text-sm text-red-600">{fehler}</p>}
    </div>
  )
}

export default function AdminWiderrufePage() {
  const [widerrufe, setWiderrufe] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nurOffene, setNurOffene] = useState(true)

  useEffect(() => {
    adminFetch('/api/admin/coachies?resource=widerrufe')
      .then((data) => setWiderrufe(data.widerrufe ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function aktualisiere(neu) {
    setWiderrufe((liste) =>
      liste.map((w) => (w.id === neu.id ? { ...w, ...neu, vertragsdaten: w.vertragsdaten } : w)),
    )
  }

  const offen = (w) => w.status === 'eingegangen' || w.status === 'manuell_pruefen'
  const angezeigt = nurOffene ? widerrufe.filter(offen) : widerrufe

  if (loading) return <p className="text-slate-500">Lädt…</p>

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-mrh-navy">Widerrufe</h1>
      <p className="mb-4 text-sm text-mrh-grey">
        Eingänge über den Widerrufsbutton. Es wird nichts automatisch erstattet oder
        gesperrt. Erstattung und Zugangssperre erledigst du selbst (Stripe bzw.
        Coachies) und hältst hier Status und Notiz fest.
      </p>

      <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={nurOffene}
          onChange={(e) => setNurOffene(e.target.checked)}
          className="h-4 w-4 accent-mrh-navy"
        />
        Nur offene anzeigen ({widerrufe.filter(offen).length})
      </label>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {angezeigt.length === 0 ? (
        <p className="text-sm text-slate-400">
          {nurOffene ? 'Keine offenen Widerrufe.' : 'Noch keine Widerrufe.'}
        </p>
      ) : (
        <div className="space-y-3">
          {angezeigt.map((widerruf) => (
            <WiderrufKarte key={widerruf.id} widerruf={widerruf} onGespeichert={aktualisiere} />
          ))}
        </div>
      )}
    </div>
  )
}
