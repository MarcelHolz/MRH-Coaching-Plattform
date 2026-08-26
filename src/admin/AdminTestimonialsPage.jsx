import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'

function formatDatum(iso) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Sichtung eingereichter Testimonials (Feature 2) -- bewusst kein
// automatischer Weg zur Freigabe: jedes Testimonial muss hier einzeln
// von Hand freigegeben werden, bevor es auf der Verkaufsseite
// (/kaufen/:slug) erscheint (Datenschutz/Qualitätskontrolle, siehe
// Aufgabenstellung).
export default function AdminTestimonialsPage() {
  const [testimonials, setTestimonials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('offen')

  async function laden() {
    setLoading(true)
    setError('')
    try {
      const data = await adminFetch('/api/admin/programme?resource=testimonials')
      setTestimonials(data.testimonials ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    laden()
  }, [])

  async function setzeFreigabe(id, freigegeben) {
    setError('')
    try {
      await adminFetch('/api/admin/programme?resource=testimonials', {
        method: 'PATCH',
        body: JSON.stringify({ id, freigegeben }),
      })
      await laden()
    } catch (err) {
      setError(err.message)
    }
  }

  async function loeschen(id) {
    if (!window.confirm('Testimonial wirklich endgültig löschen?')) return

    setError('')
    try {
      await adminFetch('/api/admin/programme?resource=testimonials', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
      await laden()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <p className="text-slate-500">Lädt…</p>

  const sichtbare = testimonials.filter((t) => {
    if (filter === 'offen') return !t.freigegeben
    if (filter === 'freigegeben') return t.freigegeben
    return true
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-mrh-navy">Testimonials</h1>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      <div className="mb-6 flex gap-2">
        {[
          { value: 'offen', label: 'Zu prüfen' },
          { value: 'freigegeben', label: 'Freigegeben' },
          { value: 'alle', label: 'Alle' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === option.value
                ? 'bg-mrh-navy text-white'
                : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {sichtbare.length === 0 ? (
        <p className="text-sm text-slate-400">Keine Einträge.</p>
      ) : (
        <div className="space-y-3">
          {sichtbare.map((testimonial) => (
            <div key={testimonial.id} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-slate-500">
                  <span className="font-medium text-slate-700">
                    {testimonial.coachies?.name ?? 'Unbekannt'}
                  </span>{' '}
                  · {testimonial.programme?.titel ?? '–'} ·{' '}
                  {formatDatum(testimonial.erstellt_am)}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    testimonial.freigegeben
                      ? 'bg-mrh-gold/15 text-mrh-gold-dark'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {testimonial.freigegeben ? 'Freigegeben' : 'Zu prüfen'}
                </span>
              </div>
              <p className="mb-3 whitespace-pre-line text-sm text-slate-700">
                {testimonial.text}
              </p>
              <div className="flex gap-2">
                {!testimonial.freigegeben && (
                  <button
                    onClick={() => setzeFreigabe(testimonial.id, true)}
                    className="rounded-lg bg-mrh-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
                  >
                    Freigeben
                  </button>
                )}
                {testimonial.freigegeben && (
                  <button
                    onClick={() => setzeFreigabe(testimonial.id, false)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    Freigabe zurückziehen
                  </button>
                )}
                <button
                  onClick={() => loeschen(testimonial.id)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
