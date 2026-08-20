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
  abgeschlossen: 'bg-green-100 text-green-700',
}

export default function AdminProgressPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterCoachie, setFilterCoachie] = useState('')

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

                  return (
                    <div key={programm.id}>
                      <p className="mb-1 text-sm font-medium text-slate-700">
                        {programm.titel}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {programmSessions.map((session) => {
                          const sessionStatus = status.find(
                            (s) =>
                              s.coachie_id === coachie.id &&
                              s.session_id === session.id,
                          )
                          const statusWert = sessionStatus?.status ?? 'offen'

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
}
