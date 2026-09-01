import { requireAdmin } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const supabase = getSupabaseAdmin()

  const [coachies, programme, assignments, sessions, status, module] =
    await Promise.all([
      supabase.from('coachies').select('*').order('name', { ascending: true }),
      supabase.from('programme').select('*'),
      supabase.from('coachie_programme').select('*'),
      supabase.from('sessions').select('*'),
      supabase.from('coachie_status').select('*'),
      supabase.from('module').select('*'),
    ])

  const firstError = [
    coachies,
    programme,
    assignments,
    sessions,
    status,
    module,
  ].find((result) => result.error)

  if (firstError) {
    res.status(500).json({ error: firstError.error.message })
    return
  }

  // Abschlussquote pro Session, rein aggregiert (keine Coachie-Namen/-IDs
  // im Ergebnis) -- "gestartet" zählt alle Coachies mit je einer
  // Zuordnung zum Programm der Session (auch mit abgelaufenem
  // zugriff_bis, siehe Aufgabenstellung), "abgeschlossen" nur die davon
  // mit Status "abgeschlossen" für genau diese Session.
  const sessionStats = sessions.data.map((session) => {
    const coachieIds = new Set(
      assignments.data
        .filter((a) => a.programm_id === session.programm_id)
        .map((a) => a.coachie_id),
    )
    const gestartet = coachieIds.size

    const abgeschlossen = status.data.filter(
      (s) =>
        s.session_id === session.id &&
        s.status === 'abgeschlossen' &&
        coachieIds.has(s.coachie_id),
    ).length

    const quote =
      gestartet > 0 ? Math.round((abgeschlossen / gestartet) * 100) : 0

    const bewertungen = status.data
      .filter((s) => s.session_id === session.id && s.bewertung != null)
      .map((s) => s.bewertung)
    const durchschnittBewertung =
      bewertungen.length > 0
        ? Math.round(
            (bewertungen.reduce((sum, b) => sum + b, 0) / bewertungen.length) *
              10,
          ) / 10
        : null

    return {
      session_id: session.id,
      gestartet,
      abgeschlossen,
      quote,
      durchschnittBewertung,
      anzahlBewertungen: bewertungen.length,
    }
  })

  res.status(200).json({
    coachies: coachies.data,
    programme: programme.data,
    assignments: assignments.data,
    sessions: sessions.data,
    status: status.data,
    module: module.data,
    sessionStats,
  })
}
