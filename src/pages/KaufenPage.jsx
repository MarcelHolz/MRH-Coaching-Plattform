import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { formatPreis } from '../lib/preis'

// Struktur für Kundenstimmen steht bereit, ist aber bewusst leer, bis
// echte, mit Erlaubnis geteilte Testimonials vorliegen (siehe
// strategische Analyse Teil 10/15) -- daher zunächst kein Datenfeld,
// keine erfundenen Platzhalterinhalte.
const TESTIMONIALS = []

function TestimonialsSection() {
  if (TESTIMONIALS.length === 0) return null

  return (
    <div className="mb-6 space-y-3 border-t border-white/10 pt-6">
      {TESTIMONIALS.map((testimonial, index) => (
        <blockquote key={index} className="text-sm italic text-white/80">
          &bdquo;{testimonial.text}&ldquo;
          <footer className="mt-1 text-xs not-italic text-white/50">
            {testimonial.name}
          </footer>
        </blockquote>
      ))}
    </div>
  )
}

export default function KaufenPage() {
  const { slug } = useParams()
  const [programm, setProgramm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kaufLaeuft, setKaufLaeuft] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/checkout?slug=${slug}`)
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(data?.error || 'Programm nicht gefunden.')
        }

        if (!cancelled) setProgramm(data.programm)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [slug])

  async function handleKaufen() {
    setError('')
    setKaufLaeuft(true)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Checkout konnte nicht gestartet werden.')
      }

      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setKaufLaeuft(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mrh-cream px-4">
      <div className="w-full max-w-md rounded-2xl bg-mrh-black p-8 text-white shadow-xl">
        {loading && <p className="text-white/60">Lädt…</p>}

        {!loading && error && <p className="text-red-400">{error}</p>}

        {!loading && !error && programm && (
          <>
            <h1 className="mb-1 font-serif text-2xl font-semibold">
              {programm.titel}
            </h1>
            {programm.zielgruppe_text && (
              <p className="mb-3 text-sm text-mrh-gold-soft">
                {programm.zielgruppe_text}
              </p>
            )}
            {programm.beschreibung && (
              <p className="mb-6 text-sm text-white/70">{programm.beschreibung}</p>
            )}
            {programm.preis_cent != null && (
              <p className="mb-1 text-3xl font-semibold text-mrh-gold-soft">
                {formatPreis(programm.preis_cent)}
              </p>
            )}
            {programm.standard_zugriffsmonate != null && (
              <p className="mb-6 text-xs text-white/60">
                Zugriff für {programm.standard_zugriffsmonate}{' '}
                {programm.standard_zugriffsmonate === 1 ? 'Monat' : 'Monate'}
              </p>
            )}

            {Array.isArray(programm.ablauf_schritte) &&
              programm.ablauf_schritte.length > 0 && (
                <div className="mb-6">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">
                    So läuft es ab
                  </p>
                  <ol className="space-y-2">
                    {programm.ablauf_schritte.map((schritt, index) => (
                      <li key={index} className="flex gap-3 text-sm text-white/80">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mrh-gold/20 text-xs font-semibold text-mrh-gold-soft">
                          {index + 1}
                        </span>
                        {schritt}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

            <TestimonialsSection />

            <button
              onClick={handleKaufen}
              disabled={kaufLaeuft}
              className="w-full rounded-full bg-gradient-to-br from-mrh-gold to-mrh-gold-dark py-3 text-sm font-semibold text-white shadow-lg shadow-mrh-gold-dark/40 transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {kaufLaeuft ? 'Weiterleitung…' : 'Jetzt kaufen'}
            </button>
            <p className="mt-4 text-xs text-white/60">
              Weiterleitung zur sicheren Bezahlung über Stripe. Nach erfolgreicher
              Zahlung erhältst du eine E-Mail zum Festlegen deines Passworts.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
