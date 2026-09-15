import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'

// Berechnet die geänderten Felder zwischen zwei Zeilenständen einer
// entwurf_historie-Zeile für die Vorher/Nachher-Diff-Ansicht. 'id' wird
// nie als Änderung angezeigt (unveränderlich), unbekannte/fehlende
// Vorher-Werte werden als leer behandelt.
export function berechneFeldDiff(vorher, nachher) {
  const felder = new Set([...Object.keys(vorher ?? {}), ...Object.keys(nachher ?? {})])
  felder.delete('id')

  const diff = []
  for (const feld of felder) {
    const alt = vorher?.[feld] ?? null
    const neu = nachher?.[feld] ?? null
    if (JSON.stringify(alt) !== JSON.stringify(neu)) {
      diff.push({ feld, alt, neu })
    }
  }
  return diff
}

function formatWert(wert) {
  if (wert === null || wert === undefined || wert === '') return '(leer)'
  if (typeof wert === 'boolean') return wert ? 'ja' : 'nein'
  return String(wert)
}

function HistorieDiff({ historie }) {
  if (!historie || historie.length === 0) return null

  return (
    <details className="mt-2 rounded-lg bg-amber-50 p-2 text-xs">
      <summary className="cursor-pointer font-medium text-amber-800">
        {historie.length} Bearbeitung{historie.length === 1 ? '' : 'en'} durch den Agenten
      </summary>
      <div className="mt-2 space-y-2">
        {historie.map((eintrag) => {
          const diff = berechneFeldDiff(eintrag.vorher, eintrag.nachher)
          return (
            <div key={eintrag.id} className="border-t border-amber-200 pt-2 first:border-0 first:pt-0">
              <p className="mb-1 text-[11px] text-amber-700">
                {new Date(eintrag.geaendert_am).toLocaleString('de-DE')}
              </p>
              {diff.length === 0 ? (
                <p className="text-amber-700">Keine inhaltliche Änderung erkennbar.</p>
              ) : (
                <ul className="space-y-1">
                  {diff.map((zeile) => (
                    <li key={zeile.feld}>
                      <span className="font-medium">{zeile.feld}:</span>{' '}
                      <span className="text-red-700 line-through">{formatWert(zeile.alt)}</span>{' '}
                      →{' '}
                      <span className="text-green-700">{formatWert(zeile.neu)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </details>
  )
}

function SessionZeile({ session }) {
  return (
    <li className="rounded-lg border border-slate-100 p-2">
      <p className="text-sm text-slate-700">{session.titel}</p>
      <HistorieDiff historie={session.historie} />
    </li>
  )
}

// Review-Interface für Agent-Entwürfe (Feature 2): listet alle noch
// nicht freigegebenen Programm-Entwürfe des Produktagenten
// (api/agent/inhalte.js) verschachtelt mit Modulen/Sessions, inklusive
// Vorher/Nachher-Diff bei nachträglichen Agent-Bearbeitungen. Freigeben
// veröffentlicht das komplette Programm (aktiv=true, wie der
// "Aktivieren"-Button unter Programme); Ablehnen verwirft den kompletten
// Entwurf inklusive Modulen/Sessions unwiderruflich.
export default function AdminEntwuerfePage() {
  const [programme, setProgramme] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aktionLaeuft, setAktionLaeuft] = useState(null)

  async function laden() {
    setLoading(true)
    setError('')
    try {
      const data = await adminFetch('/api/admin/programme?resource=entwuerfe')
      setProgramme(data.programme ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    laden()
  }, [])

  async function freigeben(id) {
    setAktionLaeuft(id)
    setError('')
    try {
      await adminFetch('/api/admin/programme', {
        method: 'PATCH',
        body: JSON.stringify({ id, aktiv: true }),
      })
      await laden()
    } catch (err) {
      setError(err.message)
    } finally {
      setAktionLaeuft(null)
    }
  }

  async function ablehnen(id, titel) {
    if (
      !window.confirm(
        `Entwurf "${titel}" inklusive aller Module und Sessions endgültig verwerfen?`,
      )
    ) {
      return
    }

    setAktionLaeuft(id)
    setError('')
    try {
      await adminFetch('/api/admin/programme', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
      await laden()
    } catch (err) {
      setError(err.message)
    } finally {
      setAktionLaeuft(null)
    }
  }

  if (loading) return <p className="text-slate-500">Lädt…</p>

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-mrh-navy">Agent-Entwürfe</h1>
      <p className="mb-6 text-sm text-mrh-grey">
        Vom Produktagenten eigenständig angelegte Kurse, noch nicht
        veröffentlicht. Freigeben macht den kompletten Kurs live, Ablehnen
        verwirft ihn inklusive aller Module und Sessions.
      </p>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      {programme.length === 0 ? (
        <p className="text-sm text-slate-400">Keine offenen Entwürfe.</p>
      ) : (
        <div className="space-y-4">
          {programme.map((programm) => {
            const gesamtSessions =
              programm.module.reduce((summe, m) => summe + m.sessions.length, 0) +
              programm.sessions_ohne_modul.length

            return (
              <div key={programm.id} className="rounded-xl bg-white p-5 shadow-sm">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-mrh-navy">{programm.titel}</p>
                    <p className="text-xs text-slate-500">
                      {programm.module.length} Modul{programm.module.length === 1 ? '' : 'e'} ·{' '}
                      {gesamtSessions} Session{gesamtSessions === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    Entwurf
                  </span>
                </div>

                {programm.beschreibung && (
                  <p className="mb-3 whitespace-pre-line text-sm text-slate-600">
                    {programm.beschreibung}
                  </p>
                )}

                <HistorieDiff historie={programm.historie} />

                {(programm.module.length > 0 || programm.sessions_ohne_modul.length > 0) && (
                  <div className="mt-3 space-y-3">
                    {programm.module.map((modul) => (
                      <div key={modul.id}>
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                          {modul.titel}
                        </p>
                        <HistorieDiff historie={modul.historie} />
                        {modul.sessions.length > 0 && (
                          <ul className="mt-1 space-y-1">
                            {modul.sessions.map((session) => (
                              <SessionZeile key={session.id} session={session} />
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                    {programm.sessions_ohne_modul.length > 0 && (
                      <div>
                        {programm.module.length > 0 && (
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                            Ohne Modul
                          </p>
                        )}
                        <ul className="space-y-1">
                          {programm.sessions_ohne_modul.map((session) => (
                            <SessionZeile key={session.id} session={session} />
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => freigeben(programm.id)}
                    disabled={aktionLaeuft === programm.id}
                    className="rounded-lg bg-mrh-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
                  >
                    Freigeben
                  </button>
                  <button
                    onClick={() => ablehnen(programm.id, programm.titel)}
                    disabled={aktionLaeuft === programm.id}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Ablehnen
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
