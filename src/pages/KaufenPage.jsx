import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { formatPreis } from '../lib/preis'
import { toYoutubeEmbedUrl } from '../lib/youtube'

function formatDatum(isoDatum) {
  if (!isoDatum) return ''
  return new Date(`${isoDatum}T00:00:00`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// Struktur für Kundenstimmen steht bereit und wird von api/checkout.js
// befüllt, sobald es freigegebene Testimonials gibt (siehe testimonials.sql
// und die Admin-Freigabe in AdminTestimonialsPage.jsx) -- bis dahin liefert
// die API ein leeres Array und dieser Abschnitt rendert einfach nichts.
function TestimonialsSection({ testimonials }) {
  if (!testimonials || testimonials.length === 0) return null

  return (
    <div className="mb-10 border-t border-white/10 pt-8">
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-white/50">
        Das sagen andere Coachies
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {testimonials.map((testimonial, index) => (
          <blockquote
            key={index}
            className="rounded-xl bg-white/5 p-4 text-sm italic text-white/80"
          >
            &bdquo;{testimonial.text}&ldquo;
            {testimonial.name && (
              <footer className="mt-2 text-xs not-italic text-white/50">
                {testimonial.name}
              </footer>
            )}
          </blockquote>
        ))}
      </div>
    </div>
  )
}

function ModulUebersicht({ module, gesamtSessionAnzahl }) {
  if (!module || module.length === 0) return null

  return (
    <div className="mb-10">
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-white/50">
        Was dich erwartet{' '}
        {gesamtSessionAnzahl != null &&
          `(${gesamtSessionAnzahl} Session${gesamtSessionAnzahl === 1 ? '' : 's'})`}
      </p>
      <ul className="space-y-2">
        {module.map((modul, index) => (
          <li
            key={index}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3"
          >
            <span className="flex items-center gap-3 text-sm text-white/90">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mrh-gold/20 text-xs font-semibold text-mrh-gold-soft">
                {index + 1}
              </span>
              {modul.titel}
            </span>
            <span className="shrink-0 text-xs text-white/50">
              {modul.sessionAnzahl} Session{modul.sessionAnzahl === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mrh-cream">
        <p className="text-mrh-grey">Lädt…</p>
      </div>
    )
  }

  if (error || !programm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mrh-cream px-4">
        <p className="text-red-600">{error || 'Programm nicht gefunden.'}</p>
      </div>
    )
  }

  const trailerEmbedUrl = toYoutubeEmbedUrl(programm.trailer_video_url)

  const heute = new Date().toISOString().slice(0, 10)
  const einfuehrungspreisAktiv =
    programm.einfuehrungspreis_cent != null &&
    programm.einfuehrungspreis_gueltig_bis &&
    heute <= programm.einfuehrungspreis_gueltig_bis

  return (
    <div className="min-h-screen bg-mrh-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-16">
        {programm.zielgruppe_text && (
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-mrh-gold-soft">
            {programm.zielgruppe_text}
          </p>
        )}
        <h1 className="mb-6 font-serif text-4xl font-semibold">
          {programm.titel}
        </h1>

        {trailerEmbedUrl ? (
          <div className="mb-8 aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe
              src={trailerEmbedUrl}
              title={`Trailer: ${programm.titel}`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          programm.bild_url && (
            <div className="mb-8 overflow-hidden rounded-2xl">
              <img
                src={programm.bild_url}
                alt=""
                className="w-full object-cover"
              />
            </div>
          )
        )}

        {programm.beschreibung && (
          <p className="mb-10 whitespace-pre-line text-white/70">
            {programm.beschreibung}
          </p>
        )}

        {Array.isArray(programm.ablauf_schritte) &&
          programm.ablauf_schritte.length > 0 && (
            <div className="mb-10">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-white/50">
                So läuft es ab
              </p>
              <ol className="space-y-3">
                {programm.ablauf_schritte.map((schritt, index) => (
                  <li key={index} className="flex gap-3 text-white/80">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mrh-gold/20 text-xs font-semibold text-mrh-gold-soft">
                      {index + 1}
                    </span>
                    {schritt}
                  </li>
                ))}
              </ol>
            </div>
          )}

        <ModulUebersicht
          module={programm.modulUebersicht}
          gesamtSessionAnzahl={programm.gesamtSessionAnzahl}
        />

        <TestimonialsSection testimonials={programm.testimonials} />

        <div className="rounded-2xl bg-white/5 p-6">
          {einfuehrungspreisAktiv ? (
            <div className="mb-1">
              {programm.preis_cent != null && (
                <span className="mr-2 text-lg text-white/40 line-through">
                  {formatPreis(programm.preis_cent)}
                </span>
              )}
              <span className="text-3xl font-semibold text-mrh-gold-soft">
                {formatPreis(programm.einfuehrungspreis_cent)}
              </span>
              <p className="mt-1 text-xs text-mrh-gold-soft">
                Einführungspreis gültig bis{' '}
                {formatDatum(programm.einfuehrungspreis_gueltig_bis)}
              </p>
            </div>
          ) : (
            programm.preis_cent != null && (
              <p className="mb-1 text-3xl font-semibold text-mrh-gold-soft">
                {formatPreis(programm.preis_cent)}
              </p>
            )
          )}
          {programm.standard_zugriffsmonate != null && (
            <p className="mb-6 text-xs text-white/60">
              Zugriff für {programm.standard_zugriffsmonate}{' '}
              {programm.standard_zugriffsmonate === 1 ? 'Monat' : 'Monate'}
            </p>
          )}

          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

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
        </div>
      </div>
    </div>
  )
}
