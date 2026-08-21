import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function ProgressRing({ prozent }) {
  const size = 88
  const stroke = 8
  const radius = (size - stroke) / 2
  const umfang = 2 * Math.PI * radius
  const offset = umfang * (1 - prozent / 100)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e7e1d4"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#d9772e"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={umfang}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold text-mrh-navy">{prozent}%</span>
        <span className="text-[10px] text-mrh-grey">Fortschritt</span>
      </div>
    </div>
  )
}

function formatDatum(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function CoachieDashboardPage() {
  const { coachie } = useAuth()
  const [programme, setProgramme] = useState([])
  const [abgelaufeneProgramme, setAbgelaufeneProgramme] = useState(0)
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
        .select('programm_id, zugriff_bis, programme(id, titel, beschreibung, aktiv)')
        .eq('coachie_id', coachie.id)

      if (zuordnungenError) {
        if (!cancelled) {
          setError('Programme konnten nicht geladen werden.')
          setLoading(false)
        }
        return
      }

      // Ist zugriff_bis abgelaufen, blendet RLS das verknüpfte Programm
      // serverseitig aus (programme kommt dann als null zurück) -- das
      // ist der Fall, den wir dem Coachie explizit erklären, statt ihn
      // stillschweigend wie ein deaktiviertes Programm zu behandeln.
      const jetzt = new Date()
      const abgelaufen = (zuordnungen ?? []).filter(
        (z) => !z.programme && z.zugriff_bis && new Date(z.zugriff_bis) < jetzt,
      ).length

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
          let letzteAktivitaet = null

          if (sessionIds.length > 0) {
            const { data: status } = await supabase
              .from('coachie_status')
              .select('session_id, status, aktualisiert_am')
              .eq('coachie_id', coachie.id)
              .in('session_id', sessionIds)

            abgeschlossen = (status ?? []).filter(
              (s) => s.status === 'abgeschlossen',
            ).length

            const zeitstempel = (status ?? [])
              .map((s) => s.aktualisiert_am)
              .filter(Boolean)
              .sort()
            letzteAktivitaet = zeitstempel.length
              ? zeitstempel[zeitstempel.length - 1]
              : null
          }

          return {
            ...programm,
            gesamt: sessionIds.length,
            abgeschlossen,
            letzteAktivitaet,
          }
        }),
      )

      if (!cancelled) {
        setProgramme(programmeMitFortschritt)
        setAbgelaufeneProgramme(abgelaufen)
        setLoading(false)
      }
    }

    loadProgramme()

    return () => {
      cancelled = true
    }
  }, [coachie])

  if (loading) {
    return <p className="text-mrh-grey">Lädt…</p>
  }

  if (error) {
    return <p className="text-red-600">{error}</p>
  }

  const gesamtSessions = programme.reduce((sum, p) => sum + p.gesamt, 0)
  const gesamtAbgeschlossen = programme.reduce(
    (sum, p) => sum + p.abgeschlossen,
    0,
  )
  const gesamtProzent =
    gesamtSessions > 0
      ? Math.round((gesamtAbgeschlossen / gesamtSessions) * 100)
      : 0

  const aktivesProgramm = programme.length
    ? [...programme].sort((a, b) =>
        (b.letzteAktivitaet ?? '').localeCompare(a.letzteAktivitaet ?? ''),
      )[0]
    : null

  const abgelaufenHinweis = abgelaufeneProgramme > 0 && (
    <div className="mb-6 rounded-xl border border-mrh-orange/30 bg-mrh-orange/10 p-4 text-sm text-mrh-navy">
      {abgelaufeneProgramme === 1
        ? 'Der Zugriff auf eines deiner Programme ist abgelaufen.'
        : `Der Zugriff auf ${abgelaufeneProgramme} deiner Programme ist abgelaufen.`}{' '}
      Melde dich bei Marcel für eine Verlängerung.
    </div>
  )

  return (
    <div>
      {programme.length === 0 ? (
        <div>
          <h1 className="mb-2 text-2xl font-semibold text-mrh-navy">
            Schön, dass du da bist{coachie?.name ? `, ${coachie.name}` : ''}.
          </h1>
          {abgelaufenHinweis}
          <p className="text-mrh-grey">
            Noch kein Programm zugewiesen. Melde dich bei Marcel.
          </p>
        </div>
      ) : (
        <>
          {abgelaufenHinweis}
          <div className="mb-8 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <img
                  src="/brand/marcel-blazer.webp"
                  alt=""
                  className="hidden h-20 w-20 shrink-0 rounded-full object-cover object-top sm:block"
                />
                <div>
                  <h1 className="text-2xl font-semibold text-mrh-navy">
                    Schön, dass du da bist{coachie?.name ? `, ${coachie.name}` : ''}.
                  </h1>
                  <p className="mt-1 text-sm text-mrh-grey">Deine Programme im Überblick.</p>
                </div>
              </div>
              <ProgressRing prozent={gesamtProzent} />
            </div>
            {aktivesProgramm && (
              <Link
                to={`/coachie/programme/${aktivesProgramm.id}`}
                className="flex items-center justify-center bg-mrh-orange py-4 text-sm font-semibold text-white transition hover:bg-mrh-orange-dark"
              >
                Programm fortsetzen
              </Link>
            )}
          </div>

          <h2 className="mb-4 text-lg font-semibold text-mrh-navy">Deine Programme</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {programme.map((programm) => {
              const prozent =
                programm.gesamt > 0
                  ? Math.round((programm.abgeschlossen / programm.gesamt) * 100)
                  : 0
              const begonnen = Boolean(programm.letzteAktivitaet)
              const letzteAktivitaetText = formatDatum(programm.letzteAktivitaet)

              return (
                <Link
                  key={programm.id}
                  to={`/coachie/programme/${programm.id}`}
                  className="rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <span
                    className={`mb-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      begonnen
                        ? 'bg-mrh-orange/15 text-mrh-orange-dark'
                        : 'bg-mrh-navy/10 text-mrh-navy'
                    }`}
                  >
                    {begonnen ? 'Begonnen' : 'Programm starten'}
                  </span>
                  <h3 className="mb-1 font-semibold text-slate-800">
                    {programm.titel}
                  </h3>
                  <p className="mb-4 line-clamp-2 text-sm text-mrh-grey">
                    {programm.beschreibung}
                  </p>
                  <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-mrh-orange transition-all"
                      style={{ width: `${prozent}%` }}
                    />
                  </div>
                  <p className="text-xs text-mrh-grey">
                    {programm.abgeschlossen} von {programm.gesamt} Sessions abgeschlossen
                  </p>
                  {letzteAktivitaetText && (
                    <p className="mt-1 text-xs text-mrh-grey">
                      Letzte Aktivität {letzteAktivitaetText}
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
