import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { formatPreis } from '../lib/preis'

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
        const response = await fetch(`/api/public/programme?slug=${slug}`)
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
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        {loading && <p className="text-mrh-grey">Lädt…</p>}

        {!loading && error && <p className="text-red-600">{error}</p>}

        {!loading && !error && programm && (
          <>
            <h1 className="mb-2 text-2xl font-semibold text-mrh-navy">
              {programm.titel}
            </h1>
            {programm.beschreibung && (
              <p className="mb-6 text-sm text-mrh-grey">{programm.beschreibung}</p>
            )}
            {programm.preis_cent != null && (
              <p className="mb-6 text-3xl font-semibold text-mrh-navy">
                {formatPreis(programm.preis_cent)}
              </p>
            )}
            <button
              onClick={handleKaufen}
              disabled={kaufLaeuft}
              className="w-full rounded-lg bg-mrh-orange py-3 text-sm font-semibold text-white transition hover:bg-mrh-orange-dark disabled:opacity-50"
            >
              {kaufLaeuft ? 'Weiterleitung…' : 'Jetzt kaufen'}
            </button>
            <p className="mt-4 text-xs text-mrh-grey">
              Weiterleitung zur sicheren Bezahlung über Stripe. Nach erfolgreicher
              Zahlung erhältst du eine E-Mail zum Festlegen deines Passworts.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
