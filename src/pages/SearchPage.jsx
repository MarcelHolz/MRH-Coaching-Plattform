import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Rein clientseitige Suche über bereits für den Coachie zugängliche
// Inhalte: die drei Tabellen werden ungefiltert abgefragt, RLS liefert
// serverseitig ohnehin nur das, was der Coachie sehen darf (zugeordnete
// Programme, plus ggf. die eine Freemium-Startsession) -- keine eigene
// API-Route nötig. Bei der überschaubaren Datenmenge reicht ein simples
// includes()-Filtern, keine Fuzzy-Suche/Volltextindex nötig.
export default function SearchPage() {
  const { coachie } = useAuth()
  const [programme, setProgramme] = useState([])
  const [module, setModule] = useState([])
  const [sessions, setSessions] = useState([])
  const [lesezeichenIds, setLesezeichenIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!coachie?.id) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      const [
        { data: p, error: pErr },
        { data: m, error: mErr },
        { data: s, error: sErr },
        { data: l, error: lErr },
      ] = await Promise.all([
        supabase.from('programme').select('id, titel'),
        supabase.from('module').select('id, titel, programm_id, reihenfolge'),
        supabase
          .from('sessions')
          .select('id, titel, beschreibung, programm_id, modul_id, reihenfolge'),
        supabase
          .from('session_lesezeichen')
          .select('session_id')
          .eq('coachie_id', coachie.id),
      ])

      if (cancelled) return

      if (pErr || mErr || sErr || lErr) {
        setError('Suche konnte nicht geladen werden.')
        setLoading(false)
        return
      }

      setProgramme(p ?? [])
      setModule(m ?? [])
      setSessions(s ?? [])
      setLesezeichenIds(new Set((l ?? []).map((eintrag) => eintrag.session_id)))
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [coachie])

  const programmTitel = useMemo(
    () => Object.fromEntries(programme.map((p) => [p.id, p.titel])),
    [programme],
  )

  // Nur Programme, von denen tatsächlich mindestens eine Session sichtbar
  // ist, zählen als "zugänglich" -- ein Teaser-Programm ist zwar über
  // seine eigene Policy in der programme-Tabelle lesbar, aber ohne
  // Zuordnung sind keine Sessions sichtbar und soll daher nicht als
  // Suchtreffer erscheinen, den man dann nicht öffnen kann.
  const zugaenglicheProgrammIds = useMemo(
    () => new Set(sessions.map((s) => s.programm_id)),
    [sessions],
  )

  function ersteSessionVon(kandidaten) {
    return [...kandidaten].sort((a, b) => a.reihenfolge - b.reihenfolge)[0] ?? null
  }

  const ergebnisse = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const treffer = []
    const gesehen = new Set()

    function hinzufuegen(session, grund) {
      if (!session || gesehen.has(session.id)) return
      gesehen.add(session.id)
      treffer.push({
        session,
        programmTitel: programmTitel[session.programm_id] ?? '',
        grund,
      })
    }

    for (const session of sessions) {
      if (
        session.titel?.toLowerCase().includes(q) ||
        session.beschreibung?.toLowerCase().includes(q)
      ) {
        hinzufuegen(session, session.titel)
      }
    }

    for (const modul of module) {
      if (!modul.titel?.toLowerCase().includes(q)) continue
      const sessionsImModul = sessions.filter((s) => s.modul_id === modul.id)
      hinzufuegen(ersteSessionVon(sessionsImModul), `Modul: ${modul.titel}`)
    }

    for (const programm of programme) {
      if (!programm.titel?.toLowerCase().includes(q)) continue
      if (!zugaenglicheProgrammIds.has(programm.id)) continue
      const sessionsImProgramm = sessions.filter(
        (s) => s.programm_id === programm.id,
      )
      hinzufuegen(ersteSessionVon(sessionsImProgramm), `Programm: ${programm.titel}`)
    }

    return treffer
  }, [query, sessions, module, programme, programmTitel, zugaenglicheProgrammIds])

  // "Meine Lesezeichen" als Standardansicht, solange kein Suchbegriff
  // eingegeben ist -- Filter statt eigenem Dashboard-Bereich (siehe
  // Aufgabenstellung, "oder als Filter in der Suche").
  const lesezeichenSessions = useMemo(
    () =>
      sessions
        .filter((s) => lesezeichenIds.has(s.id))
        .map((session) => ({
          session,
          programmTitel: programmTitel[session.programm_id] ?? '',
        })),
    [sessions, lesezeichenIds, programmTitel],
  )

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-mrh-navy">Suche</h1>

      <input
        type="search"
        autoFocus
        placeholder="Suche über deine Programme, Module und Sessions…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-6 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
      />

      {loading && <p className="text-mrh-grey">Lädt…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && query.trim() && (
        <div className="space-y-2">
          {ergebnisse.length === 0 ? (
            <p className="text-sm text-mrh-grey">Keine Treffer.</p>
          ) : (
            ergebnisse.map(({ session, programmTitel: pTitel, grund }) => (
              <Link
                key={session.id}
                to={`/coachie/programme/${session.programm_id}?session=${session.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <p className="font-medium text-slate-800">{session.titel}</p>
                <p className="text-xs text-mrh-grey">
                  {pTitel}
                  {grund !== session.titel ? ` · ${grund}` : ''}
                </p>
              </Link>
            ))
          )}
        </div>
      )}

      {!loading && !error && !query.trim() && (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-mrh-grey">
            Meine Lesezeichen
          </h2>
          {lesezeichenSessions.length === 0 ? (
            <p className="text-sm text-mrh-grey">
              Noch keine Lesezeichen -- markiere Sessions mit dem ☆-Symbol.
            </p>
          ) : (
            <div className="space-y-2">
              {lesezeichenSessions.map(({ session, programmTitel: pTitel }) => (
                <Link
                  key={session.id}
                  to={`/coachie/programme/${session.programm_id}?session=${session.id}`}
                  className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <p className="font-medium text-slate-800">
                    ★ {session.titel}
                  </p>
                  <p className="text-xs text-mrh-grey">{pTitel}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
