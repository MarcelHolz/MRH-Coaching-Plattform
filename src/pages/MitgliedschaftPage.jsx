import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatPreis } from '../lib/preis'

// Eigenständige Verkaufsseite für die Mitgliedschaft (Mitgliederbereich
// Punkt 5) -- analog zu KaufenPage.jsx, aber ohne :slug (die
// Mitgliedschaft ist ein einzelnes, eigenständiges Produkt statt eines
// von mehreren Programmen) und ohne vorherigen Kurskauf erreichbar.
// Preis/Bezahltext kommen aus mitgliedschaft_einstellungen
// (api/checkout.js?resource=mitgliedschaft), nicht hart codiert --
// Betrag steht laut Auftrag noch nicht fest.
export default function MitgliedschaftPage() {
  const [searchParams] = useSearchParams()
  const [mitgliedschaft, setMitgliedschaft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kaufLaeuft, setKaufLaeuft] = useState(false)

  const abgebrochen = searchParams.get('abgebrochen') === '1'

  useEffect(() => {
    let cancelled = false

    async function laden() {
      setLoading(true)
      try {
        const response = await fetch('/api/checkout?resource=mitgliedschaft')
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(data?.error || 'Mitgliedschaft konnte nicht geladen werden.')
        }

        if (!cancelled) setMitgliedschaft(data.mitgliedschaft)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    laden()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleBeitreten() {
    setError('')
    setKaufLaeuft(true)
    try {
      const response = await fetch('/api/checkout?resource=mitgliedschaft', {
        method: 'POST',
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

  return (
    <div className="min-h-screen bg-mrh-black text-white">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="mb-2 font-serif text-4xl font-semibold">
          {mitgliedschaft?.titel || 'MRH Community-Mitgliedschaft'}
        </h1>

        {mitgliedschaft?.beschreibung && (
          <p className="mb-10 whitespace-pre-line text-white/70">
            {mitgliedschaft.beschreibung}
          </p>
        )}

        <div className="rounded-2xl bg-white/5 p-6">
          {mitgliedschaft?.preis_cent != null ? (
            <p className="mb-1 text-3xl font-semibold text-mrh-gold-soft">
              {formatPreis(mitgliedschaft.preis_cent)}{' '}
              <span className="text-base font-normal text-white/50">/ Monat</span>
            </p>
          ) : (
            <p className="mb-4 text-sm text-white/60">
              Die Mitgliedschaft ist aktuell noch nicht buchbar.
            </p>
          )}

          {mitgliedschaft?.bezahltext && (
            <p className="mb-6 text-sm text-white/60">{mitgliedschaft.bezahltext}</p>
          )}

          {abgebrochen && (
            <p className="mb-4 text-sm text-white/60">
              Vorgang abgebrochen -- du kannst es jederzeit erneut versuchen.
            </p>
          )}
          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

          <button
            onClick={handleBeitreten}
            disabled={kaufLaeuft || mitgliedschaft?.preis_cent == null}
            className="w-full rounded-full bg-gradient-to-br from-mrh-gold to-mrh-gold-dark py-3 text-sm font-semibold text-white shadow-lg shadow-mrh-gold-dark/40 transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {kaufLaeuft ? 'Weiterleitung…' : 'Jetzt Mitglied werden'}
          </button>
          <p className="mt-4 text-xs text-white/60">
            Weiterleitung zur sicheren Bezahlung über Stripe. Monatlich kündbar. Nach
            erfolgreichem Beitritt erhältst du eine E-Mail zum Festlegen deines
            Passworts.
          </p>
        </div>
      </div>
    </div>
  )
}
