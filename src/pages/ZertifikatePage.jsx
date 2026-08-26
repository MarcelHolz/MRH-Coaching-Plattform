import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import ZertifikatButton from '../components/ZertifikatButton'

function formatDatum(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// "Meine Abschlüsse": reine Übersicht bereits erbrachter Leistung, kein
// Punkte-/Level-System. Nutzt dieselbe 100%-Logik wie der
// Abschluss-Moment in CoachieProgramPage.jsx und den bestehenden
// api/certificate.js-Endpunkt für den erneuten Download.
export default function ZertifikatePage() {
  const { coachie, session } = useAuth()
  const [abschluesse, setAbschluesse] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!coachie?.id) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      const { data: zuordnungen, error: zuordnungenError } = await supabase
        .from('coachie_programme')
        .select('programm_id, programme(id, titel, aktiv)')
        .eq('coachie_id', coachie.id)

      if (zuordnungenError) {
        if (!cancelled) {
          setError('Abschlüsse konnten nicht geladen werden.')
          setLoading(false)
        }
        return
      }

      const aktiveProgramme = (zuordnungen ?? [])
        .filter((z) => z.programme?.aktiv)
        .map((z) => z.programme)

      const ergebnisse = await Promise.all(
        aktiveProgramme.map(async (programm) => {
          const { data: sessions } = await supabase
            .from('sessions')
            .select('id')
            .eq('programm_id', programm.id)

          const sessionIds = (sessions ?? []).map((s) => s.id)
          if (sessionIds.length === 0) return null

          const { data: status } = await supabase
            .from('coachie_status')
            .select('status, aktualisiert_am')
            .eq('coachie_id', coachie.id)
            .in('session_id', sessionIds)

          const abgeschlossen = (status ?? []).filter(
            (s) => s.status === 'abgeschlossen',
          )
          if (abgeschlossen.length < sessionIds.length) return null

          const abschlussdatum = abgeschlossen
            .map((s) => s.aktualisiert_am)
            .filter(Boolean)
            .sort()
            .at(-1)

          return { programm, abschlussdatum }
        }),
      )

      if (!cancelled) {
        setAbschluesse(
          ergebnisse
            .filter(Boolean)
            .sort((a, b) =>
              (b.abschlussdatum ?? '').localeCompare(a.abschlussdatum ?? ''),
            ),
        )
        setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [coachie])

  if (loading) return <p className="text-mrh-grey">Lädt…</p>
  if (error) return <p className="text-red-600">{error}</p>

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-mrh-navy">
        Meine Abschlüsse
      </h1>
      <p className="mb-6 text-sm text-mrh-grey">
        Alle Programme, die du zu 100% abgeschlossen hast.
      </p>

      {abschluesse.length === 0 ? (
        <p className="text-sm text-mrh-grey">
          Noch keine Abschlüsse -- schließe ein Programm vollständig ab, um
          hier dein Zertifikat zu finden.
        </p>
      ) : (
        <div className="space-y-3">
          {abschluesse.map(({ programm, abschlussdatum }) => (
            <div
              key={programm.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-5 shadow-sm"
            >
              <div>
                <p className="font-semibold text-slate-800">{programm.titel}</p>
                {abschlussdatum && (
                  <p className="text-xs text-mrh-grey">
                    Abgeschlossen am {formatDatum(abschlussdatum)}
                  </p>
                )}
              </div>
              {session?.access_token && (
                <ZertifikatButton
                  programmId={programm.id}
                  programmTitel={programm.titel}
                  accessToken={session.access_token}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
