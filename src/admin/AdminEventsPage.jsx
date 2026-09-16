import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'

const LEERES_FORMULAR = {
  titel: '',
  beschreibung: '',
  start_zeitpunkt: '',
  ende_zeitpunkt: '',
  link: '',
  programm_id: '',
}

// Admin-Pflege des Events-Kalenders (Live-Calls/Webinare/Gruppen-
// termine, events.sql). programm_id leer = plattformweit sichtbar für
// alle Coachies, sonst nur für Coachies mit Zuordnung zum gewählten
// Programm (RLS in der Migration).
export default function AdminEventsPage() {
  const [events, setEvents] = useState([])
  const [programme, setProgramme] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [neu, setNeu] = useState(LEERES_FORMULAR)
  const [speichertNeu, setSpeichertNeu] = useState(false)
  const [bearbeitungId, setBearbeitungId] = useState(null)
  const [bearbeitung, setBearbeitung] = useState(LEERES_FORMULAR)

  async function laden() {
    setLoading(true)
    setError('')
    try {
      const [eventsData, programmeData] = await Promise.all([
        adminFetch('/api/admin/programme?resource=events'),
        adminFetch('/api/admin/programme'),
      ])
      setEvents(eventsData.events ?? [])
      setProgramme(programmeData.programme ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    laden()
  }, [])

  function zuPayload(formular) {
    return {
      titel: formular.titel.trim(),
      beschreibung: formular.beschreibung.trim() || null,
      start_zeitpunkt: formular.start_zeitpunkt
        ? new Date(formular.start_zeitpunkt).toISOString()
        : null,
      ende_zeitpunkt: formular.ende_zeitpunkt
        ? new Date(formular.ende_zeitpunkt).toISOString()
        : null,
      link: formular.link.trim() || null,
      programm_id: formular.programm_id || null,
    }
  }

  async function handleAnlegen(event) {
    event.preventDefault()
    if (!neu.titel.trim() || !neu.start_zeitpunkt) return

    setSpeichertNeu(true)
    setError('')
    try {
      await adminFetch('/api/admin/programme?resource=events', {
        method: 'POST',
        body: JSON.stringify(zuPayload(neu)),
      })
      setNeu(LEERES_FORMULAR)
      await laden()
    } catch (err) {
      setError(err.message)
    } finally {
      setSpeichertNeu(false)
    }
  }

  function bearbeitungStarten(termin) {
    setBearbeitungId(termin.id)
    setBearbeitung({
      titel: termin.titel,
      beschreibung: termin.beschreibung ?? '',
      start_zeitpunkt: termin.start_zeitpunkt?.slice(0, 16) ?? '',
      ende_zeitpunkt: termin.ende_zeitpunkt?.slice(0, 16) ?? '',
      link: termin.link ?? '',
      programm_id: termin.programm_id ?? '',
    })
  }

  async function bearbeitungSpeichern(id) {
    if (!bearbeitung.titel.trim() || !bearbeitung.start_zeitpunkt) return

    setError('')
    try {
      await adminFetch('/api/admin/programme?resource=events', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...zuPayload(bearbeitung) }),
      })
      setBearbeitungId(null)
      await laden()
    } catch (err) {
      setError(err.message)
    }
  }

  async function loeschen(id) {
    if (!window.confirm('Termin wirklich endgültig löschen?')) return

    setError('')
    try {
      await adminFetch('/api/admin/programme?resource=events', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
      await laden()
    } catch (err) {
      setError(err.message)
    }
  }

  function formatZeitpunkt(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) return <p className="text-slate-500">Lädt…</p>

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-mrh-navy">Events</h1>
      <p className="mb-6 text-sm text-mrh-grey">
        Live-Calls, Webinare oder Gruppentermine. Ohne Programm-Auswahl ist ein
        Termin für alle Coachies plattformweit sichtbar.
      </p>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      <form
        onSubmit={handleAnlegen}
        className="mb-6 space-y-3 rounded-xl bg-white p-5 shadow-sm"
      >
        <p className="text-sm font-medium text-mrh-navy">Neuer Termin</p>
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Start
            </label>
            <input
              type="datetime-local"
              value={neu.start_zeitpunkt}
              onChange={(event) =>
                setNeu((prev) => ({ ...prev, start_zeitpunkt: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Ende (optional)
            </label>
            <input
              type="datetime-local"
              value={neu.ende_zeitpunkt}
              onChange={(event) =>
                setNeu((prev) => ({ ...prev, ende_zeitpunkt: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
            />
          </div>
        </div>
        <input
          type="text"
          value={neu.link}
          onChange={(event) => setNeu((prev) => ({ ...prev, link: event.target.value }))}
          placeholder="Link (optional, z. B. Videocall)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
        />
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Programm
          </label>
          <select
            value={neu.programm_id}
            onChange={(event) =>
              setNeu((prev) => ({ ...prev, programm_id: event.target.value }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
          >
            <option value="">Plattformweit (alle Coachies)</option>
            {programme.map((programm) => (
              <option key={programm.id} value={programm.id}>
                {programm.titel}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={speichertNeu || !neu.titel.trim() || !neu.start_zeitpunkt}
          className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
        >
          {speichertNeu ? 'Speichert…' : 'Anlegen'}
        </button>
      </form>

      {events.length === 0 ? (
        <p className="text-sm text-slate-400">Keine Termine.</p>
      ) : (
        <div className="space-y-3">
          {events.map((termin) => (
            <div key={termin.id} className="rounded-xl bg-white p-5 shadow-sm">
              {bearbeitungId === termin.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={bearbeitung.titel}
                    onChange={(event) =>
                      setBearbeitung((prev) => ({ ...prev, titel: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
                  />
                  <textarea
                    value={bearbeitung.beschreibung}
                    onChange={(event) =>
                      setBearbeitung((prev) => ({
                        ...prev,
                        beschreibung: event.target.value,
                      }))
                    }
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="datetime-local"
                      value={bearbeitung.start_zeitpunkt}
                      onChange={(event) =>
                        setBearbeitung((prev) => ({
                          ...prev,
                          start_zeitpunkt: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
                    />
                    <input
                      type="datetime-local"
                      value={bearbeitung.ende_zeitpunkt}
                      onChange={(event) =>
                        setBearbeitung((prev) => ({
                          ...prev,
                          ende_zeitpunkt: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    value={bearbeitung.link}
                    onChange={(event) =>
                      setBearbeitung((prev) => ({ ...prev, link: event.target.value }))
                    }
                    placeholder="Link (optional)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
                  />
                  <select
                    value={bearbeitung.programm_id}
                    onChange={(event) =>
                      setBearbeitung((prev) => ({
                        ...prev,
                        programm_id: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
                  >
                    <option value="">Plattformweit (alle Coachies)</option>
                    {programme.map((programm) => (
                      <option key={programm.id} value={programm.id}>
                        {programm.titel}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => bearbeitungSpeichern(termin.id)}
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
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{termin.titel}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {termin.programme?.titel ?? 'Plattformweit'}
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-mrh-grey">
                    {formatZeitpunkt(termin.start_zeitpunkt)}
                    {termin.ende_zeitpunkt && ` – ${formatZeitpunkt(termin.ende_zeitpunkt)}`}
                  </p>
                  {termin.beschreibung && (
                    <p className="mb-2 whitespace-pre-line text-sm text-slate-600">
                      {termin.beschreibung}
                    </p>
                  )}
                  {termin.link && (
                    <a
                      href={termin.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-2 block text-sm text-mrh-navy underline"
                    >
                      {termin.link}
                    </a>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => bearbeitungStarten(termin)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => loeschen(termin.id)}
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
