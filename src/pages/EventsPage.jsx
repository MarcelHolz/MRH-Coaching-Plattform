import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Events-Kalender: direkter Supabase-Client-Zugriff mit RLS (siehe
// supabase_migrations/events.sql), kein eigener Endpunkt nötig --
// analog zu Testimonials/Lesezeichen. Die Policy filtert serverseitig
// bereits auf eigene Programme oder plattformweite Termine, hier nur
// noch zusätzlich auf "in der Zukunft" für eine aufgeräumte Ansicht.
export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    let cancelled = false

    async function laden() {
      const { data, error } = await supabase
        .from('events')
        .select('id, titel, beschreibung, start_zeitpunkt, ende_zeitpunkt, link, programme(titel)')
        .gte('start_zeitpunkt', new Date().toISOString())
        .order('start_zeitpunkt', { ascending: true })

      if (cancelled) return

      if (error) {
        setFehler('Termine konnten nicht geladen werden.')
      } else {
        setEvents(data ?? [])
      }
      setLoading(false)
    }

    laden()
    return () => {
      cancelled = true
    }
  }, [])

  function formatZeitpunkt(iso) {
    return new Date(iso).toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) return null

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-mrh-navy">Termine</h1>
        <p className="mt-1 text-sm text-mrh-grey">
          Live-Calls, Webinare und Gruppentermine aus deinen Programmen.
        </p>
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      {events.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-mrh-grey shadow-sm">
          Aktuell keine anstehenden Termine.
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((termin) => (
            <div key={termin.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-800">{termin.titel}</p>
                <span className="rounded-full bg-mrh-gold/15 px-2 py-0.5 text-xs font-medium text-mrh-gold-dark">
                  {termin.programme?.titel ?? 'Plattformweit'}
                </span>
              </div>
              <p className="mb-2 text-sm text-mrh-grey">
                {formatZeitpunkt(termin.start_zeitpunkt)}
                {termin.ende_zeitpunkt && ` – ${formatZeitpunkt(termin.ende_zeitpunkt)}`}
              </p>
              {termin.beschreibung && (
                <p className="mb-2 whitespace-pre-line text-sm text-slate-600">
                  {termin.beschreibung}
                </p>
              )}
              {termin.link && (
                <a
                  href={termin.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-lg bg-mrh-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
                >
                  Zum Termin
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
