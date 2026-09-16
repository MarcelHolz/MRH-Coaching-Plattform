import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'
import MitgliederDateiUpload from './MitgliederDateiUpload'

const TYP_OPTIONEN = [
  { value: 'kpi_handbuch', label: 'KPI-Handbuch' },
  { value: 'audio', label: 'Audio' },
  { value: 'tipp', label: 'Tipp' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

const LEERES_FORMULAR = {
  typ: 'sonstiges',
  titel: '',
  beschreibung: '',
  datei_pfad: '',
  link_url: '',
}

function formatDatum(iso) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Admin-CRUD der Mitglieder-Inhalte (Mitgliederbereich Punkt 4) --
// analog zum bestehenden FAQ-/Material-Pflegemuster. "Live-Sitzung"
// bewusst nicht als eigener Typ hier, sondern als nur_mitglieder-
// Termin im Events-Kalender (siehe AdminEventsPage.jsx).
export default function AdminMitgliederInhaltePage() {
  const [inhalte, setInhalte] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [neu, setNeu] = useState(LEERES_FORMULAR)
  const [speichertNeu, setSpeichertNeu] = useState(false)

  async function laden() {
    setLoading(true)
    setError('')
    try {
      const data = await adminFetch('/api/admin/programme?resource=mitglieder-inhalte')
      setInhalte(data.mitglieder_inhalte ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    laden()
  }, [])

  async function handleAnlegen(event) {
    event.preventDefault()
    if (!neu.titel.trim() || (!neu.datei_pfad && !neu.link_url.trim())) return

    setSpeichertNeu(true)
    setError('')
    try {
      await adminFetch('/api/admin/programme?resource=mitglieder-inhalte', {
        method: 'POST',
        body: JSON.stringify({
          typ: neu.typ,
          titel: neu.titel.trim(),
          beschreibung: neu.beschreibung.trim() || null,
          datei_url: neu.datei_pfad || null,
          link_url: neu.link_url.trim() || null,
        }),
      })
      setNeu(LEERES_FORMULAR)
      await laden()
    } catch (err) {
      setError(err.message)
    } finally {
      setSpeichertNeu(false)
    }
  }

  async function setzeAktiv(id, aktiv) {
    setError('')
    try {
      await adminFetch('/api/admin/programme?resource=mitglieder-inhalte', {
        method: 'PATCH',
        body: JSON.stringify({ id, aktiv }),
      })
      await laden()
    } catch (err) {
      setError(err.message)
    }
  }

  async function loeschen(id) {
    if (!window.confirm('Inhalt wirklich endgültig löschen?')) return

    setError('')
    try {
      await adminFetch('/api/admin/programme?resource=mitglieder-inhalte', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
      await laden()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <p className="text-slate-500">Lädt…</p>

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-mrh-navy">Mitglieder-Inhalte</h1>
      <p className="mb-6 text-sm text-mrh-grey">
        Nur für Coachies mit aktiver Mitgliedschaft sichtbar.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form
        onSubmit={handleAnlegen}
        className="mb-6 space-y-3 rounded-xl bg-white p-5 shadow-sm"
      >
        <p className="text-sm font-medium text-mrh-navy">Neuer Inhalt</p>
        <select
          value={neu.typ}
          onChange={(event) => setNeu((prev) => ({ ...prev, typ: event.target.value }))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
        >
          {TYP_OPTIONEN.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={neu.titel}
          onChange={(event) => setNeu((prev) => ({ ...prev, titel: event.target.value }))}
          placeholder="Titel"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
        />
        <textarea
          value={neu.beschreibung}
          onChange={(event) =>
            setNeu((prev) => ({ ...prev, beschreibung: event.target.value }))
          }
          placeholder="Beschreibung (optional)"
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
        />

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Datei (optional, alternativ zu Link)
          </label>
          <div className="flex items-center gap-3">
            <MitgliederDateiUpload
              onUploaded={(pfad) => setNeu((prev) => ({ ...prev, datei_pfad: pfad }))}
            />
            {neu.datei_pfad && (
              <span className="text-xs text-mrh-grey">Hochgeladen ✓</span>
            )}
          </div>
        </div>

        <input
          type="text"
          value={neu.link_url}
          onChange={(event) => setNeu((prev) => ({ ...prev, link_url: event.target.value }))}
          placeholder="Link (optional, alternativ zur Datei)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
        />

        <button
          type="submit"
          disabled={speichertNeu || !neu.titel.trim() || (!neu.datei_pfad && !neu.link_url.trim())}
          className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
        >
          {speichertNeu ? 'Speichert…' : 'Hinzufügen'}
        </button>
      </form>

      {inhalte.length === 0 ? (
        <p className="text-sm text-slate-400">Keine Inhalte.</p>
      ) : (
        <div className="space-y-3">
          {inhalte.map((inhalt) => (
            <div key={inhalt.id} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-mrh-gold/15 px-2 py-0.5 text-xs font-medium text-mrh-gold-dark">
                  {TYP_OPTIONEN.find((o) => o.value === inhalt.typ)?.label ?? inhalt.typ}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    inhalt.aktiv
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {inhalt.aktiv ? 'Aktiv' : 'Deaktiviert'}
                </span>
              </div>
              <p className="mb-1 text-sm font-medium text-slate-800">{inhalt.titel}</p>
              {inhalt.beschreibung && (
                <p className="mb-2 text-sm text-slate-600">{inhalt.beschreibung}</p>
              )}
              <p className="mb-3 text-xs text-mrh-grey">
                Veröffentlicht {formatDatum(inhalt.veroeffentlicht_am)}
              </p>
              <div className="flex flex-wrap gap-2">
                {inhalt.aktiv ? (
                  <button
                    onClick={() => setzeAktiv(inhalt.id, false)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    Deaktivieren
                  </button>
                ) : (
                  <button
                    onClick={() => setzeAktiv(inhalt.id, true)}
                    className="rounded-lg bg-mrh-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
                  >
                    Aktivieren
                  </button>
                )}
                <button
                  onClick={() => loeschen(inhalt.id)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
