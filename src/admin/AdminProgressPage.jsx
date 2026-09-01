import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'

const STATUS_LABEL = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  abgeschlossen: 'Abgeschlossen',
}

const STATUS_FARBE = {
  offen: 'bg-slate-100 text-slate-600',
  in_bearbeitung: 'bg-amber-100 text-amber-700',
  abgeschlossen: 'bg-mrh-gold/15 text-mrh-gold-dark',
}

// Ab dieser Quote gilt ein Übergang zwischen zwei Sessions als auffälliger
// Abbruchpunkt -- rein visuelle Schwelle für die rote Einfärbung des
// Balkens, keine harte Grenze.
const QUOTE_WARNSCHWELLE = 50

function quoteFarbe(quote) {
  if (quote >= 75) return 'bg-mrh-gold'
  if (quote >= QUOTE_WARNSCHWELLE) return 'bg-amber-400'
  return 'bg-red-400'
}

export default function AdminProgressPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterCoachie, setFilterCoachie] = useState('')
  const [ansicht, setAnsicht] = useState('coachies')
  const [offeneModule, setOffeneModule] = useState(new Set())

  function toggleModul(key) {
    setOffeneModule((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    adminFetch('/api/admin/progress')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const coachies = data?.coachies ?? []
  const programme = data?.programme ?? []
  const assignments = data?.assignments ?? []
  const sessions = data?.sessions ?? []
  const status = data?.status ?? []
  const sessionStats = data?.sessionStats ?? []
  const module = data?.module ?? []

  const sichtbareCoachies = filterCoachie
    ? coachies.filter((c) => c.id === filterCoachie)
    : coachies

  if (loading) return <p className="text-slate-500">Lädt…</p>
  if (error) return <p className="text-red-600">{error}</p>

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-mrh-navy">
        Fortschrittsübersicht
      </h1>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setAnsicht('coachies')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            ansicht === 'coachies'
              ? 'bg-mrh-navy text-white'
              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Pro Coachie
        </button>
        <button
          onClick={() => setAnsicht('sessions')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            ansicht === 'sessions'
              ? 'bg-mrh-navy text-white'
              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Abschlussquote pro Session
        </button>
      </div>

      {ansicht === 'sessions' && (
        <div className="mb-6 space-y-6">
          {programme.map((programm) => {
            const programmSessions = sessions
              .filter((s) => s.programm_id === programm.id)
              .sort((a, b) => a.reihenfolge - b.reihenfolge)

            if (programmSessions.length === 0) return null

            return (
              <div key={programm.id} className="rounded-xl bg-white p-5 shadow-sm">
                <h2 className="mb-3 font-semibold text-slate-800">
                  {programm.titel}
                </h2>
                <div className="space-y-2">
                  {programmSessions.map((session) => {
                    const stats = sessionStats.find(
                      (s) => s.session_id === session.id,
                    )
                    const quote = stats?.quote ?? 0

                    return (
                      <div key={session.id} className="flex items-center gap-3">
                        <span className="w-48 shrink-0 truncate text-sm text-slate-700">
                          {session.titel}
                        </span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${quoteFarbe(quote)}`}
                            style={{ width: `${quote}%` }}
                          />
                        </div>
                        <span className="w-28 shrink-0 text-right text-xs text-slate-500">
                          {quote}%
                          {stats && (
                            <>
                              {' '}
                              ({stats.abgeschlossen}/{stats.gestartet})
                            </>
                          )}
                        </span>
                        <span className="w-20 shrink-0 text-right text-xs text-mrh-gold-dark">
                          {stats?.durchschnittBewertung != null
                            ? `★ ${stats.durchschnittBewertung} (${stats.anzahlBewertungen})`
                            : '–'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {programme.every(
            (p) => sessions.filter((s) => s.programm_id === p.id).length === 0,
          ) && <p className="text-sm text-slate-400">Keine Sessions vorhanden.</p>}
        </div>
      )}

      {ansicht === 'coachies' && (
        <>
      <div className="mb-6">
        <select
          value={filterCoachie}
          onChange={(e) => setFilterCoachie(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
        >
          <option value="">Alle Coachies</option>
          {coachies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-6">
        {sichtbareCoachies.map((coachie) => {
          const coachieProgramme = assignments
            .filter((a) => a.coachie_id === coachie.id)
            .map((a) => programme.find((p) => p.id === a.programm_id))
            .filter(Boolean)

          return (
            <div key={coachie.id} className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-slate-800">
                {coachie.name}{' '}
                <span className="text-sm font-normal text-slate-400">
                  ({coachie.email})
                </span>
              </h2>

              {coachieProgramme.length === 0 && (
                <p className="text-sm text-slate-400">
                  Keine Programme zugeordnet.
                </p>
              )}

              <div className="space-y-4">
                {coachieProgramme.map((programm) => {
                  const programmSessions = sessions
                    .filter((s) => s.programm_id === programm.id)
                    .sort((a, b) => a.reihenfolge - b.reihenfolge)

                  const programmModule = module
                    .filter((m) => m.programm_id === programm.id)
                    .sort((a, b) => a.reihenfolge - b.reihenfolge)

                  const sessionsOhneModul = programmSessions.filter(
                    (s) => !s.modul_id,
                  )

                  const gruppen = [
                    ...programmModule.map((modul) => ({
                      key: modul.id,
                      titel: modul.titel,
                      sessions: programmSessions.filter(
                        (s) => s.modul_id === modul.id,
                      ),
                    })),
                    ...(sessionsOhneModul.length > 0
                      ? [
                          {
                            key: 'ohne-modul',
                            titel: 'Ohne Modul',
                            sessions: sessionsOhneModul,
                          },
                        ]
                      : []),
                  ].filter((gruppe) => gruppe.sessions.length > 0)

                  return (
                    <div key={programm.id}>
                      <p className="mb-1 text-sm font-medium text-slate-700">
                        {programm.titel}
                      </p>
                      <div className="space-y-2">
                        {gruppen.map((gruppe) => {
                          const gruppenKey = `${coachie.id}:${programm.id}:${gruppe.key}`
                          const offen = offeneModule.has(gruppenKey)
                          const abgeschlossenAnzahl = gruppe.sessions.filter(
                            (session) => {
                              const sessionStatus = status.find(
                                (s) =>
                                  s.coachie_id === coachie.id &&
                                  s.session_id === session.id,
                              )
                              return sessionStatus?.status === 'abgeschlossen'
                            },
                          ).length

                          return (
                            <div key={gruppe.key}>
                              <button
                                onClick={() => toggleModul(gruppenKey)}
                                className="flex w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                              >
                                <span className="text-slate-400">
                                  {offen ? '▾' : '▸'}
                                </span>
                                <span className="font-medium">
                                  {gruppe.titel}
                                </span>
                                <span className="text-slate-400">
                                  ({abgeschlossenAnzahl}/{gruppe.sessions.length}{' '}
                                  abgeschlossen)
                                </span>
                              </button>

                              {offen && (
                                <div className="mt-2 flex flex-wrap gap-2 pl-5">
                                  {gruppe.sessions.map((session) => {
                                    const sessionStatus = status.find(
                                      (s) =>
                                        s.coachie_id === coachie.id &&
                                        s.session_id === session.id,
                                    )
                                    const statusWert =
                                      sessionStatus?.status ?? 'offen'

                                    return (
                                      <span
                                        key={session.id}
                                        title={session.titel}
                                        className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_FARBE[statusWert]}`}
                                      >
                                        {session.titel}: {STATUS_LABEL[statusWert]}
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
        </>
      )}
    </div>
  )
}
