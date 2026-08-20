import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function CoachieDashboardPage() {
  const { coachie } = useAuth()
  const [programme, setProgramme] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!coachie?.id) return

    let cancelled = false

    async function loadProgramme() {
      setLoading(true)
      setError('')

      const { data: zuordnungen, error: zuordnungenError } = await supabase
        .from('coachie_programme')
        .select('programm_id, programme(id, titel, beschreibung, aktiv)')
        .eq('coachie_id', coachie.id)

      if (zuordnungenError) {
        if (!cancelled) {
          setError('Programme konnten nicht geladen werden.')
          setLoading(false)
        }
        return
      }

      const aktiveProgramme = (zuordnungen ?? [])
        .map((z) => z.programme)
        .filter((p) => p && p.aktiv)

      const programmeMitFortschritt = await Promise.all(
        aktiveProgramme.map(async (programm) => {
          const { data: sessions } = await supabase
            .from('sessions')
            .select('id')
            .eq('programm_id', programm.id)

          const sessionIds = (sessions ?? []).map((s) => s.id)
          let abgeschlossen = 0

          if (sessionIds.length > 0) {
            const { data: status } = await supabase
              .from('coachie_status')
              .select('session_id, status')
              .eq('coachie_id', coachie.id)
              .in('session_id', sessionIds)

            abgeschlossen = (status ?? []).filter(
              (s) => s.status === 'abgeschlossen',
            ).length
          }

          return {
            ...programm,
            gesamt: sessionIds.length,
            abgeschlossen,
          }
        }),
      )

      if (!cancelled) {
        setProgramme(programmeMitFortschritt)
        setLoading(false)
      }
    }

    loadProgramme()

    return () => {
      cancelled = true
    }
  }, [coachie])

  if (loading) {
    return <p className="text-slate-500">Lädt…</p>
  }

  if (error) {
    return <p className="text-red-600">{error}</p>
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-mrh-navy">
        Deine Programme
      </h1>

      {programme.length === 0 ? (
        <p className="text-slate-500">
          Dir wurde noch kein Programm zugewiesen. Bitte wende dich an Marcel.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programme.map((programm) => {
            const prozent =
              programm.gesamt > 0
                ? Math.round((programm.abgeschlossen / programm.gesamt) * 100)
                : 0

            return (
              <Link
                key={programm.id}
                to={`/coachie/programme/${programm.id}`}
                className="rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <h2 className="mb-1 font-semibold text-slate-800">
                  {programm.titel}
                </h2>
                <p className="mb-4 line-clamp-2 text-sm text-slate-500">
                  {programm.beschreibung}
                </p>
                <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-mrh-navy transition-all"
                    style={{ width: `${prozent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {programm.abgeschlossen} von {programm.gesamt} Sessions abgeschlossen
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
