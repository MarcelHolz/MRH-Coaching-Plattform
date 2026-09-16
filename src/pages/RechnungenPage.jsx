import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { formatPreis } from '../lib/preis'

function formatDatum(iso) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const STATUS_LABEL = {
  paid: 'Bezahlt',
  open: 'Offen',
  void: 'Storniert',
  uncollectible: 'Uneinbringlich',
  draft: 'Entwurf',
}

// Rechnungs-Download (Punkt 2): keine eigene Rechnungserzeugung --
// listet nur, was Stripe für den Coachie bereits automatisch als
// Invoice angelegt hat (Mitgliedschaft immer, Kurskäufe seit der
// invoice_creation-Ergänzung im Checkout), und verlinkt direkt auf
// Stripes eigene PDFs/Hosted-Invoice-Seiten.
export default function RechnungenPage() {
  const { session } = useAuth()
  const [rechnungen, setRechnungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    if (!session?.access_token) return
    let cancelled = false

    async function laden() {
      try {
        const response = await fetch('/api/certificate?resource=rechnungen', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(data?.error || 'Rechnungen konnten nicht geladen werden.')
        }

        if (!cancelled) setRechnungen(data.rechnungen ?? [])
      } catch (err) {
        if (!cancelled) setFehler(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    laden()
    return () => {
      cancelled = true
    }
  }, [session])

  if (loading) return null

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-mrh-navy">Rechnungen</h1>
        <p className="mt-1 text-sm text-mrh-grey">
          Deine Zahlungshistorie, direkt von Stripe.
        </p>
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      {rechnungen.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-mrh-grey shadow-sm">
          Noch keine Rechnungen vorhanden.
        </p>
      ) : (
        <ul className="space-y-3">
          {rechnungen.map((rechnung) => (
            <li
              key={rechnung.nummer}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-medium text-slate-800">
                  {rechnung.nummer ?? 'Rechnung'}
                </p>
                <p className="text-xs text-mrh-grey">
                  {formatDatum(rechnung.datum)} ·{' '}
                  {formatPreis(rechnung.betragCent)} ·{' '}
                  {STATUS_LABEL[rechnung.status] ?? rechnung.status}
                </p>
              </div>
              <div className="flex gap-2">
                {rechnung.hostedInvoiceUrl && (
                  <a
                    href={rechnung.hostedInvoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    Ansehen
                  </a>
                )}
                {rechnung.invoicePdf && (
                  <a
                    href={rechnung.invoicePdf}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-mrh-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
                  >
                    PDF
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
