import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminFetch } from '../lib/adminFetch'

// Neue Startseite des Admin-Bereichs (ersetzt den bisherigen Blind-
// Redirect auf "Programme") -- gibt auf einen Blick den aktuellen
// Stand wieder und verlinkt direkt in die Bereiche, die Aufmerksamkeit
// brauchen, statt sie erst über die Navigation suchen zu müssen.
function KennzahlKarte({ label, wert, hinweis, to }) {
  const inhalt = (
    <div className="rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-mrh-navy">{wert}</p>
      {hinweis && <p className="mt-1 text-sm text-mrh-grey">{hinweis}</p>}
    </div>
  )

  return to ? <Link to={to}>{inhalt}</Link> : inhalt
}

export default function AdminDashboardPage() {
  const [programme, setProgramme] = useState([])
  const [coachies, setCoachies] = useState([])
  const [testimonials, setTestimonials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function laden() {
      setLoading(true)
      setError('')
      try {
        const [programmeData, coachiesData, testimonialsData] = await Promise.all([
          adminFetch('/api/admin/programme'),
          adminFetch('/api/admin/coachies'),
          adminFetch('/api/admin/programme?resource=testimonials'),
        ])
        setProgramme(programmeData.programme ?? [])
        setCoachies(coachiesData.coachies ?? [])
        setTestimonials(testimonialsData.testimonials ?? [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    laden()
  }, [])

  if (loading) return <p className="text-slate-500">Lädt…</p>
  if (error) return <p className="text-red-600">{error}</p>

  const aktiveProgramme = programme.filter((p) => p.aktiv)
  const offeneTestimonials = testimonials.filter((t) => !t.freigegeben)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-mrh-navy">Übersicht</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KennzahlKarte
          label="Aktive Programme"
          wert={aktiveProgramme.length}
          hinweis={`von ${programme.length} gesamt`}
          to="/admin/programme"
        />
        <KennzahlKarte
          label="Coachies"
          wert={coachies.length}
          to="/admin/coachies"
        />
        <KennzahlKarte
          label="Offene Testimonials"
          wert={offeneTestimonials.length}
          hinweis={
            offeneTestimonials.length > 0 ? 'warten auf Freigabe' : 'alles freigegeben'
          }
          to="/admin/testimonials"
        />
        <KennzahlKarte
          label="Teaser-Programme"
          wert={programme.filter((p) => p.teaser_aktiv).length}
          to="/admin/programme"
        />
      </div>

      {offeneTestimonials.length > 0 && (
        <div className="mb-8 rounded-xl border border-mrh-gold/30 bg-mrh-gold/10 p-5">
          <p className="font-medium text-mrh-navy">
            {offeneTestimonials.length}{' '}
            {offeneTestimonials.length === 1
              ? 'Testimonial wartet'
              : 'Testimonials warten'}{' '}
            auf Freigabe
          </p>
          <Link
            to="/admin/testimonials"
            className="mt-1 inline-block text-sm text-mrh-navy hover:underline"
          >
            Jetzt sichten →
          </Link>
        </div>
      )}

      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
        Bereiche
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/admin/programme"
          className="rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <p className="font-semibold text-slate-800">Kurse</p>
          <p className="mt-1 text-sm text-mrh-grey">
            Programme, Verkauf, Module und Sessions verwalten.
          </p>
        </Link>
        <Link
          to="/admin/coachies"
          className="rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <p className="font-semibold text-slate-800">Coachies</p>
          <p className="mt-1 text-sm text-mrh-grey">
            Coachies, Programm-Zuordnungen und Testergebnisse.
          </p>
        </Link>
        <Link
          to="/admin/fortschritt"
          className="rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <p className="font-semibold text-slate-800">Fortschritt</p>
          <p className="mt-1 text-sm text-mrh-grey">
            Abschlussquoten pro Coachie und pro Session.
          </p>
        </Link>
        <Link
          to="/admin/testimonials"
          className="rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <p className="font-semibold text-slate-800">Testimonials</p>
          <p className="mt-1 text-sm text-mrh-grey">
            Eingereichte Kundenstimmen sichten und freigeben.
          </p>
        </Link>
      </div>
    </div>
  )
}
