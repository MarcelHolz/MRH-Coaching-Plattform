import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { formatPreis, UST_HINWEIS } from '../lib/preis'
import RechtsFooter from '../components/RechtsFooter'

// Öffentliche Startseite (/): schlanke Übersicht aller öffentlich
// kaufbaren Programme. Daten über api/checkout.js?resource=uebersicht
// (service_role), nicht anonym über den Supabase-Client. Die
// Standortbestimmung (bzw. jedes kostenlose Programm) steht als Einstieg
// hervorgehoben oben.
const EINSTIEG_SLUG = 'standort'

function istEinstieg(programm) {
  return programm.slug === EINSTIEG_SLUG || programm.preis_cent === 0
}

function aktuellerPreis(programm) {
  const heute = new Date().toISOString().slice(0, 10)
  const einfuehrung =
    programm.einfuehrungspreis_cent != null &&
    programm.einfuehrungspreis_gueltig_bis &&
    heute <= programm.einfuehrungspreis_gueltig_bis
  return einfuehrung ? programm.einfuehrungspreis_cent : programm.preis_cent
}

function PreisAnzeige({ programm, hell = false }) {
  const preis = aktuellerPreis(programm)
  if (preis == null) return null
  if (preis === 0) {
    return <p className="text-sm font-semibold text-mrh-gold-soft">Kostenlos</p>
  }
  return (
    <div>
      <p className="text-sm font-semibold text-mrh-gold-soft">{formatPreis(preis)}</p>
      <p className={`text-[10px] ${hell ? 'text-white/60' : 'text-white/50'}`}>
        {UST_HINWEIS}
      </p>
    </div>
  )
}

function Einstieg({ programm }) {
  return (
    <Link
      to={`/kaufen/${programm.slug}`}
      className="group mb-10 grid overflow-hidden rounded-3xl bg-mrh-navy text-white shadow-lg transition hover:-translate-y-0.5 sm:grid-cols-2"
    >
      <div className="relative min-h-48 bg-mrh-navy-dark">
        {programm.bild_url && (
          <img
            src={programm.bild_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
        )}
      </div>
      <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-mrh-gold-soft">
          Hier starten
        </p>
        <h2 className="font-serif text-2xl font-semibold">{programm.titel}</h2>
        {programm.subline && <p className="text-sm text-white/70">{programm.subline}</p>}
        <PreisAnzeige programm={programm} hell />
        <span className="mt-2 inline-block w-fit rounded-full bg-gradient-to-br from-mrh-gold to-mrh-gold-dark px-5 py-2 text-sm font-semibold text-white">
          {aktuellerPreis(programm) === 0 ? 'Kostenlos starten' : 'Mehr erfahren'}
        </span>
      </div>
    </Link>
  )
}

function ProgrammKachel({ programm }) {
  return (
    <Link
      to={`/kaufen/${programm.slug}`}
      className="flex flex-col overflow-hidden rounded-2xl bg-white/5 transition hover:-translate-y-0.5 hover:bg-white/10"
    >
      <div className="aspect-video bg-mrh-navy">
        {programm.bild_url && (
          <img src={programm.bild_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-serif text-lg font-semibold text-white">{programm.titel}</h3>
        {programm.subline && (
          <p className="line-clamp-3 text-sm text-white/60">{programm.subline}</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <PreisAnzeige programm={programm} />
          <span className="text-sm font-medium text-mrh-gold-soft">Ansehen</span>
        </div>
      </div>
    </Link>
  )
}

export default function StartPage() {
  const { session } = useAuth()
  const [programme, setProgramme] = useState([])
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/checkout?resource=uebersicht')
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || 'Programme konnten nicht geladen werden.')
        if (!cancelled) setProgramme(data.programme ?? [])
      })
      .catch((err) => {
        if (!cancelled) setFehler(err.message)
      })
      .finally(() => {
        if (!cancelled) setLaedt(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const einstieg = programme.find(istEinstieg)
  const weitere = programme.filter((p) => p !== einstieg)

  return (
    <div className="min-h-screen bg-mrh-black text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-6">
        <a href="https://mrh-beratung.de" className="font-semibold">
          MRH Beratung &amp; Coaching
        </a>
        <Link
          to={session ? '/coachie' : '/login'}
          className="rounded-full border border-white/30 px-4 py-1.5 text-sm transition hover:bg-white/10"
        >
          {session ? 'Mein Bereich' : 'Anmelden'}
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
        <h1 className="mb-2 font-serif text-4xl font-semibold">Online-Programme</h1>
        <p className="mb-10 max-w-2xl text-white/60">
          Für Führung, Persönlichkeit und Zahlen. In deinem Tempo, mit Begleitung,
          wenn du sie brauchst.
        </p>

        {laedt ? (
          <p className="text-white/50">Lädt…</p>
        ) : fehler ? (
          <p className="text-red-400">{fehler}</p>
        ) : (
          <>
            {einstieg && <Einstieg programm={einstieg} />}
            {weitere.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {weitere.map((programm) => (
                  <ProgrammKachel key={programm.slug} programm={programm} />
                ))}
              </div>
            )}
            {programme.length === 0 && (
              <p className="text-white/60">Neue Programme folgen in Kürze.</p>
            )}
          </>
        )}

        <RechtsFooter dunkel className="mt-16" />
      </main>
    </div>
  )
}
