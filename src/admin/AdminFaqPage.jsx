import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'

const LEERES_FORMULAR = { frage: '', antwort: '' }

// Admin-Pflege der FAQ-Wissensbasis für den Coachie-Chat (Feature "KI-
// Chat für FAQs", faq.sql). Einträge, die der Produktagent über
// api/agent/inhalte.js?resource=faq als Vorschlag anlegt, landen mit
// aktiv=false als Entwurf und erscheinen hier zur Freigabe -- gleiches
// Muster wie Programme/Module/Sessions.
export default function AdminFaqPage() {
  const [eintraege, setEintraege] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('alle')
  const [neu, setNeu] = useState(LEERES_FORMULAR)
  const [speichertNeu, setSpeichertNeu] = useState(false)
  const [bearbeitungId, setBearbeitungId] = useState(null)
  const [bearbeitung, setBearbeitung] = useState(LEERES_FORMULAR)

  async function laden() {
    setLoading(true)
    setError('')
    try {
      const data = await adminFetch('/api/admin/programme?resource=faq')
      setEintraege(data.faq_eintraege ?? [])
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
    if (!neu.frage.trim() || !neu.antwort.trim()) return

    setSpeichertNeu(true)
    setError('')
    try {
      await adminFetch('/api/admin/programme?resource=faq', {
        method: 'POST',
        body: JSON.stringify({ frage: neu.frage.trim(), antwort: neu.antwort.trim() }),
      })
      setNeu(LEERES_FORMULAR)
      await laden()
    } catch (err) {
      setError(err.message)
    } finally {
      setSpeichertNeu(false)
    }
  }

  function bearbeitungStarten(eintrag) {
    setBearbeitungId(eintrag.id)
    setBearbeitung({ frage: eintrag.frage, antwort: eintrag.antwort })
  }

  async function bearbeitungSpeichern(id) {
    if (!bearbeitung.frage.trim() || !bearbeitung.antwort.trim()) return

    setError('')
    try {
      await adminFetch('/api/admin/programme?resource=faq', {
        method: 'PATCH',
        body: JSON.stringify({
          id,
          frage: bearbeitung.frage.trim(),
          antwort: bearbeitung.antwort.trim(),
        }),
      })
      setBearbeitungId(null)
      await laden()
    } catch (err) {
      setError(err.message)
    }
  }

  async function setzeAktiv(id, aktiv) {
    setError('')
    try {
      await adminFetch('/api/admin/programme?resource=faq', {
        method: 'PATCH',
        body: JSON.stringify({ id, aktiv }),
      })
      await laden()
    } catch (err) {
      setError(err.message)
    }
  }

  async function loeschen(id) {
    if (!window.confirm('FAQ-Eintrag wirklich endgültig löschen?')) return

    setError('')
    try {
      await adminFetch('/api/admin/programme?resource=faq', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
      await laden()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <p className="text-slate-500">Lädt…</p>

  const sichtbare = eintraege.filter((eintrag) => {
    if (filter === 'entwuerfe') return !eintrag.aktiv
    if (filter === 'aktiv') return eintrag.aktiv
    return true
  })

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-mrh-navy">FAQ-Chat</h1>
      <p className="mb-6 text-sm text-mrh-grey">
        Wissensbasis für den FAQ-Chat im Coachie-Bereich. Nur aktive Einträge
        werden dem Chat als Kontext gegeben.
      </p>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      <form
        onSubmit={handleAnlegen}
        className="mb-6 space-y-3 rounded-xl bg-white p-5 shadow-sm"
      >
        <p className="text-sm font-medium text-mrh-navy">Neuer Eintrag</p>
        <input
          type="text"
          value={neu.frage}
          onChange={(event) => setNeu((prev) => ({ ...prev, frage: event.target.value }))}
          placeholder="Frage"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
        />
        <textarea
          value={neu.antwort}
          onChange={(event) => setNeu((prev) => ({ ...prev, antwort: event.target.value }))}
          placeholder="Antwort"
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={speichertNeu || !neu.frage.trim() || !neu.antwort.trim()}
          className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
        >
          {speichertNeu ? 'Speichert…' : 'Hinzufügen'}
        </button>
      </form>

      <div className="mb-6 flex gap-2">
        {[
          { value: 'alle', label: 'Alle' },
          { value: 'aktiv', label: 'Aktiv' },
          { value: 'entwuerfe', label: 'Entwürfe' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === option.value
                ? 'bg-mrh-navy text-white'
                : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {sichtbare.length === 0 ? (
        <p className="text-sm text-slate-400">Keine Einträge.</p>
      ) : (
        <div className="space-y-3">
          {sichtbare.map((eintrag) => (
            <div key={eintrag.id} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    eintrag.aktiv
                      ? 'bg-mrh-gold/15 text-mrh-gold-dark'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {eintrag.aktiv ? 'Aktiv' : 'Entwurf'}
                </span>
              </div>

              {bearbeitungId === eintrag.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={bearbeitung.frage}
                    onChange={(event) =>
                      setBearbeitung((prev) => ({ ...prev, frage: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
                  />
                  <textarea
                    value={bearbeitung.antwort}
                    onChange={(event) =>
                      setBearbeitung((prev) => ({ ...prev, antwort: event.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => bearbeitungSpeichern(eintrag.id)}
                      className="rounded-lg bg-mrh-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
                    >
                      Speichern
                    </button>
                    <button
                      onClick={() => setBearbeitungId(null)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mb-1 text-sm font-medium text-slate-800">{eintrag.frage}</p>
                  <p className="mb-3 whitespace-pre-line text-sm text-slate-600">
                    {eintrag.antwort}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => bearbeitungStarten(eintrag)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      Bearbeiten
                    </button>
                    {!eintrag.aktiv && (
                      <button
                        onClick={() => setzeAktiv(eintrag.id, true)}
                        className="rounded-lg bg-mrh-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
                      >
                        Freigeben
                      </button>
                    )}
                    {eintrag.aktiv && (
                      <button
                        onClick={() => setzeAktiv(eintrag.id, false)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                      >
                        Deaktivieren
                      </button>
                    )}
                    <button
                      onClick={() => loeschen(eintrag.id)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
                    >
                      Löschen
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
