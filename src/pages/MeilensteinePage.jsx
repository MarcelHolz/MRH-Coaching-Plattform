import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Reine, isoliert testbare Berechnungsfunktion (Feature "Fortschritts-
// Badges"): leitet private Meilensteine ausschließlich aus bereits
// vorhandenen Daten ab (coachie_programme/module/sessions/
// coachie_status) -- bewusst KEINE neue Tabelle/Migration, kein neuer
// Endpunkt. "Datum" ist der späteste aktualisiert_am-Zeitpunkt der
// beteiligten Sessions (Näherung, da kein exakter Erreichungs-
// Zeitstempel je Schwelle gespeichert wird).
export function berechneMeilensteine({ zuordnungen, module, sessions, statusListe }) {
  const statusBySession = new Map(statusListe.map((s) => [s.session_id, s]))
  const badges = []

  function spaetestesDatum(sessionListe) {
    return sessionListe
      .map((s) => statusBySession.get(s.id)?.aktualisiert_am)
      .filter(Boolean)
      .sort()
      .at(-1)
  }

  for (const zuordnung of zuordnungen) {
    const programmSessions = sessions.filter((s) => s.programm_id === zuordnung.programm_id)
    if (programmSessions.length === 0) continue

    const abgeschlossen = programmSessions.filter(
      (s) => statusBySession.get(s.id)?.status === 'abgeschlossen',
    )
    const prozent = Math.round((abgeschlossen.length / programmSessions.length) * 100)
    const titel = zuordnung.programme?.titel ?? 'Programm'

    if (prozent >= 100) {
      badges.push({
        id: `programm-100-${zuordnung.programm_id}`,
        titel: `"${titel}" abgeschlossen`,
        datum: spaetestesDatum(abgeschlossen),
      })
    } else if (prozent >= 50) {
      badges.push({
        id: `programm-50-${zuordnung.programm_id}`,
        titel: `Halbzeit bei "${titel}" (50 %)`,
        datum: spaetestesDatum(abgeschlossen),
      })
    }

    const programmModule = module.filter((m) => m.programm_id === zuordnung.programm_id)
    for (const modul of programmModule) {
      const modulSessions = programmSessions.filter((s) => s.modul_id === modul.id)
      if (modulSessions.length === 0) continue

      const modulAbgeschlossen = modulSessions.every(
        (s) => statusBySession.get(s.id)?.status === 'abgeschlossen',
      )
      if (modulAbgeschlossen) {
        badges.push({
          id: `modul-${modul.id}`,
          titel: `Modul "${modul.titel}" abgeschlossen`,
          datum: spaetestesDatum(modulSessions),
        })
      }
    }
  }

  return badges.sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))
}

// Fortschritts-Badges (Feature 4): bewusst kein öffentliches Ranking --
// private Meilensteine, die ausschließlich der jeweilige Coachie selbst
// sieht (auch nicht innerhalb der Peer Group). Da coachie_status per
// RLS ohnehin nur die eigenen Zeilen liefert (coachie_id = auth.uid()),
// ist diese Seite allein durch die bestehende RLS bereits korrekt
// abgeschottet -- keine neue Policy nötig.
export default function MeilensteinePage() {
  const { coachie } = useAuth()
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    if (!coachie?.id) return
    let cancelled = false

    async function laden() {
      const { data: zuordnungen, error: zuordnungenError } = await supabase
        .from('coachie_programme')
        .select('programm_id, programme(titel)')
        .eq('coachie_id', coachie.id)

      if (cancelled) return

      if (zuordnungenError) {
        setFehler('Meilensteine konnten nicht geladen werden.')
        setLoading(false)
        return
      }

      const programmIds = (zuordnungen ?? []).map((z) => z.programm_id)
      if (programmIds.length === 0) {
        setBadges([])
        setLoading(false)
        return
      }

      const [{ data: module }, { data: sessions }] = await Promise.all([
        supabase.from('module').select('id, programm_id, titel').in('programm_id', programmIds),
        supabase.from('sessions').select('id, programm_id, modul_id').in('programm_id', programmIds),
      ])

      if (cancelled) return

      const sessionIds = (sessions ?? []).map((s) => s.id)
      let statusListe = []
      if (sessionIds.length > 0) {
        const { data: statusData } = await supabase
          .from('coachie_status')
          .select('session_id, status, aktualisiert_am')
          .eq('coachie_id', coachie.id)
          .in('session_id', sessionIds)
        statusListe = statusData ?? []
      }

      if (cancelled) return

      setBadges(
        berechneMeilensteine({
          zuordnungen: zuordnungen ?? [],
          module: module ?? [],
          sessions: sessions ?? [],
          statusListe,
        }),
      )
      setLoading(false)
    }

    laden()
    return () => {
      cancelled = true
    }
  }, [coachie])

  function formatDatum(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  if (loading) return null

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-mrh-navy">Meine Meilensteine</h1>
        <p className="mt-1 text-sm text-mrh-grey">
          Nur für dich sichtbar -- kein Vergleich, kein Ranking.
        </p>
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      {badges.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-mrh-grey shadow-sm">
          Noch keine Meilensteine erreicht -- mach weiter, der erste kommt bestimmt bald.
        </p>
      ) : (
        <ul className="space-y-3">
          {badges.map((badge) => (
            <li
              key={badge.id}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mrh-gold/15 text-lg">
                🏅
              </span>
              <div>
                <p className="font-medium text-slate-800">{badge.titel}</p>
                {badge.datum && (
                  <p className="text-xs text-mrh-grey">{formatDatum(badge.datum)}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
