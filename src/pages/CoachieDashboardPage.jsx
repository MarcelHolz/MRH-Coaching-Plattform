import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatPreis } from '../lib/preis'

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
          stroke="#b9913f"
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
  const { coachie, istErsterLogin, konsumiereErstenLogin } = useAuth()
  const [programme, setProgramme] = useState([])
  const [teaserProgramme, setTeaserProgramme] = useState([])
  const [freemiumProgramme, setFreemiumProgramme] = useState([])
  const [abgelaufeneProgramme, setAbgelaufeneProgramme] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ersterLoginRedirect, setErsterLoginRedirect] = useState(null)
  const [naechsterSchrittProgramm, setNaechsterSchrittProgramm] = useState(null)

  useEffect(() => {
    if (!coachie?.id) return

    let cancelled = false

    async function loadProgramme() {
      setLoading(true)
      setError('')

      const { data: zuordnungen, error: zuordnungenError } = await supabase
        .from('coachie_programme')
        .select(
          'programm_id, zugriff_bis, zugewiesen_am, programme(id, titel, beschreibung, aktiv, bild_url, coach_foto_url, begruessung_text)',
        )
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
        .filter((z) => z.programme && z.programme.aktiv)
        .map((z) => ({
          ...z.programme,
          zugriff_bis: z.zugriff_bis,
          zugewiesen_am: z.zugewiesen_am,
        }))

      const zugeordneteIds = new Set(
        (zuordnungen ?? []).map((z) => z.programm_id),
      )

      const { data: teaser } = await supabase
        .from('programme')
        .select(
          'id, titel, beschreibung, preis_cent, preis_anzeigen, slug, oeffentlich_kaufbar, bild_url',
        )
        .eq('teaser_aktiv', true)
        .eq('aktiv', true)

      const teaserOhneEigene = (teaser ?? []).filter(
        (t) => !zugeordneteIds.has(t.id),
      )

      const { data: freemium } = await supabase
        .from('programme')
        .select('id, titel, beschreibung, bild_url')
        .eq('freemium_aktiv', true)
        .eq('aktiv', true)

      const freemiumOhneEigene = (freemium ?? []).filter(
        (p) => !zugeordneteIds.has(p.id),
      )

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
        setTeaserProgramme(teaserOhneEigene)
        setFreemiumProgramme(freemiumOhneEigene)
        setAbgelaufeneProgramme(abgelaufen)

        // Aktives Onboarding: nur beim allerersten Login auswerten, danach
        // sofort konsumieren, damit spätere Besuche des Dashboards (z. B.
        // über "Zurück zur Übersicht") nicht erneut umgeleitet werden.
        if (istErsterLogin) {
          if (programmeMitFortschritt.length === 1) {
            setErsterLoginRedirect(
              `/coachie/programme/${programmeMitFortschritt[0].id}?start=1`,
            )
          } else if (programmeMitFortschritt.length > 1) {
            const zuletztZugeordnet = [...programmeMitFortschritt].sort((a, b) =>
              (b.zugewiesen_am ?? '').localeCompare(a.zugewiesen_am ?? ''),
            )[0]
            setNaechsterSchrittProgramm(zuletztZugeordnet)
          }
          konsumiereErstenLogin()
        }

        setLoading(false)
      }
    }

    loadProgramme()

    return () => {
      cancelled = true
    }
  }, [coachie])

  if (ersterLoginRedirect) {
    return <Navigate to={ersterLoginRedirect} replace />
  }

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
    <div className="mb-6 rounded-xl border border-mrh-gold/30 bg-mrh-gold/10 p-4 text-sm text-mrh-navy">
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
          <h1 className="mb-2 font-serif text-2xl font-semibold text-mrh-navy">
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
                  <h1 className="font-serif text-2xl font-semibold text-mrh-navy">
                    Schön, dass du da bist{coachie?.name ? `, ${coachie.name}` : ''}.
                  </h1>
                  <p className="mt-1 text-sm text-mrh-grey">
                    {naechsterSchrittProgramm ? (
                      <>
                        Dein nächster Schritt:{' '}
                        <Link
                          to={`/coachie/programme/${naechsterSchrittProgramm.id}`}
                          className="font-medium text-mrh-gold-dark hover:underline"
                        >
                          {naechsterSchrittProgramm.titel}
                        </Link>
                      </>
                    ) : (
                      'Deine Programme im Überblick.'
                    )}
                  </p>
                </div>
              </div>
              <ProgressRing prozent={gesamtProzent} />
            </div>
            {aktivesProgramm && (
              <Link
                to={`/coachie/programme/${aktivesProgramm.id}`}
                className="flex items-center justify-center bg-mrh-gold py-4 text-sm font-semibold text-white transition hover:bg-mrh-gold-dark"
              >
                Programm fortsetzen
              </Link>
            )}
          </div>

          {aktivesProgramm &&
            (aktivesProgramm.coach_foto_url || aktivesProgramm.begruessung_text) && (
              <div className="mb-8 flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
                {aktivesProgramm.coach_foto_url && (
                  <img
                    src={aktivesProgramm.coach_foto_url}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-full object-cover"
                  />
                )}
                {aktivesProgramm.begruessung_text && (
                  <p className="font-serif italic text-mrh-navy">
                    &bdquo;{aktivesProgramm.begruessung_text}&ldquo;
                  </p>
                )}
              </div>
            )}

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
                  <div className="mb-3 flex items-start gap-3">
                    {programm.bild_url && (
                      <img
                        src={programm.bild_url}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span
                        className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          prozent === 100
                            ? 'bg-mrh-gold text-white'
                            : begonnen
                              ? 'bg-mrh-gold/15 text-mrh-gold-dark'
                              : 'bg-mrh-navy/10 text-mrh-navy'
                        }`}
                      >
                        {prozent === 100
                          ? 'Abgeschlossen'
                          : begonnen
                            ? 'Begonnen'
                            : 'Programm starten'}
                      </span>
                      <h3 className="font-semibold text-slate-800">
                        {programm.titel}
                      </h3>
                    </div>
                  </div>
                  <p className="mb-4 line-clamp-2 text-sm text-mrh-grey">
                    {programm.beschreibung}
                  </p>
                  <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-mrh-gold transition-all"
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
                  {programm.zugriff_bis && (
                    <p className="mt-1 text-xs text-mrh-grey">
                      Zugriff bis {formatDatum(programm.zugriff_bis)}
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        </>
      )}

      {teaserProgramme.length > 0 && (
        <div className={programme.length === 0 ? 'mt-8' : 'mt-10'}>
          <h2 className="mb-4 text-lg font-semibold text-mrh-navy">
            Weitere Programme
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {teaserProgramme.map((programm) => (
              <div
                key={programm.id}
                className="rounded-xl bg-mrh-black p-5 text-white"
              >
                <div className="mb-3 flex items-start gap-3">
                  {programm.bild_url && (
                    <img
                      src={programm.bild_url}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="mb-2 inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-mrh-gold-soft">
                      Vorschau
                    </span>
                    <h3 className="font-serif font-semibold text-white">
                      {programm.titel}
                    </h3>
                  </div>
                </div>
                <p className="mb-4 line-clamp-2 text-sm text-white/70">
                  {programm.beschreibung}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-mrh-gold-soft">
                    {programm.preis_anzeigen
                      ? (formatPreis(programm.preis_cent) ?? 'Preis auf Anfrage')
                      : 'Preis auf Anfrage'}
                  </span>
                  {programm.oeffentlich_kaufbar && programm.slug && (
                    <a
                      href={`/kaufen/${programm.slug}`}
                      className="rounded-full bg-mrh-gold px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-gold-dark"
                    >
                      Mehr erfahren
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {freemiumProgramme.length > 0 && (
        <div
          className={
            programme.length === 0 && teaserProgramme.length === 0
              ? 'mt-8'
              : 'mt-10'
          }
        >
          <h2 className="mb-4 text-lg font-semibold text-mrh-navy">
            Kostenlos reinschnuppern
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {freemiumProgramme.map((programm) => (
              <Link
                key={programm.id}
                to={`/coachie/programme/${programm.id}`}
                className="rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-3 flex items-start gap-3">
                  {programm.bild_url && (
                    <img
                      src={programm.bild_url}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="mb-2 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Kostenlose Vorschau
                    </span>
                    <h3 className="font-serif font-semibold text-slate-800">
                      {programm.titel}
                    </h3>
                  </div>
                </div>
                {programm.beschreibung && (
                  <p className="line-clamp-2 text-sm text-slate-500">
                    {programm.beschreibung}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
