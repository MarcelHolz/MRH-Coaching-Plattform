import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'

function formatDatum(iso) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Reine, isoliert testbare Funktion: zählt Empfehlungen je Werber und
// sortiert absteigend nach Anzahl für die Rangliste.
export function berechneRangliste(empfehlungen) {
  const proWerber = new Map()
  for (const eintrag of empfehlungen) {
    const key = eintrag.werber?.email ?? eintrag.werber_coachie_id
    proWerber.set(key, (proWerber.get(key) ?? 0) + 1)
  }

  return [...proWerber.entries()]
    .map(([key, anzahl]) => ({ key, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl)
}

// Admin-Übersicht erfolgreicher Empfehlungen (Feature
// Empfehlungsprogramm) -- rein lesend. Belohnungslogik (Rabatt,
// Guthaben, o.ä.) ist bewusst noch nicht abgebildet, siehe README.
export default function AdminEmpfehlungenPage() {
  const [empfehlungen, setEmpfehlungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function laden() {
      setLoading(true)
      setError('')
      try {
        const data = await adminFetch('/api/admin/coachies?resource=empfehlungen')
        setEmpfehlungen(data.empfehlungen ?? [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    laden()
  }, [])

  if (loading) return <p className="text-slate-500">Lädt…</p>

  const rangliste = berechneRangliste(empfehlungen)

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-mrh-navy">Empfehlungsprogramm</h1>
      <p className="mb-6 text-sm text-mrh-grey">
        Erfolgreiche Empfehlungen -- jede Zeile ist ein abgeschlossener Kauf
        über den persönlichen Empfehlungscode eines Coachies.
        Belohnungslogik (Rabatt, Guthaben o.ä.) ist noch nicht festgelegt.
      </p>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      {empfehlungen.length === 0 ? (
        <p className="text-sm text-slate-400">Noch keine erfolgreichen Empfehlungen.</p>
      ) : (
        <>
          <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Rangliste
            </p>
            <ul className="space-y-1 text-sm">
              {rangliste.map(({ key, anzahl }) => (
                <li key={key} className="flex justify-between">
                  <span className="text-slate-700">{key}</span>
                  <span className="font-medium text-mrh-navy">
                    {anzahl} Empfehlung{anzahl === 1 ? '' : 'en'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            {empfehlungen.map((eintrag) => (
              <div
                key={eintrag.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm"
              >
                <div className="text-sm">
                  <span className="font-medium text-slate-700">
                    {eintrag.werber?.name ?? 'Unbekannt'}
                  </span>{' '}
                  <span className="text-slate-400">hat</span>{' '}
                  <span className="font-medium text-slate-700">
                    {eintrag.geworbener?.name ?? 'Unbekannt'}
                  </span>{' '}
                  <span className="text-slate-400">geworben für</span>{' '}
                  <span className="text-slate-700">
                    {eintrag.programme?.titel ?? '–'}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {formatDatum(eintrag.erstellt_am)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
