import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'

const STATUS_LABEL = {
  aktiv: 'Aktiv',
  gekuendigt: 'Gekündigt',
  zahlung_fehlgeschlagen: 'Zahlung fehlgeschlagen',
}

const STATUS_FARBE = {
  aktiv: 'bg-green-100 text-green-700',
  gekuendigt: 'bg-slate-100 text-slate-500',
  zahlung_fehlgeschlagen: 'bg-red-100 text-red-700',
}

function formatDatum(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Admin-Pflege der Mitgliedschafts-Einstellungen (Preis, Stripe-Price-ID,
// Bezahltext -- Mitgliederbereich Punkt 1+5) plus eine rein lesende
// Übersicht bestehender Mitgliedschaften. Preis/Betrag steht laut
// Auftrag noch nicht fest, deshalb hier konfigurierbar statt hart
// codiert, analog zum Preisfeld bei Programmen.
export default function AdminMitgliedschaftPage() {
  const [einstellungen, setEinstellungen] = useState(null)
  const [mitgliedschaften, setMitgliedschaften] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [speichert, setSpeichert] = useState(false)
  const [gespeichert, setGespeichert] = useState(false)

  const [titel, setTitel] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [preis, setPreis] = useState('')
  const [stripePriceId, setStripePriceId] = useState('')
  const [bezahltext, setBezahltext] = useState('')

  async function laden() {
    setLoading(true)
    setError('')
    try {
      const [einstellungenData, mitgliedschaftenData] = await Promise.all([
        adminFetch('/api/admin/programme?resource=mitgliedschaft-einstellungen'),
        adminFetch('/api/admin/coachies?resource=mitgliedschaften'),
      ])
      const e = einstellungenData.einstellungen
      setEinstellungen(e)
      setTitel(e?.titel ?? '')
      setBeschreibung(e?.beschreibung ?? '')
      setPreis(e?.preis_cent != null ? String(e.preis_cent / 100) : '')
      setStripePriceId(e?.stripe_price_id ?? '')
      setBezahltext(e?.bezahltext ?? '')
      setMitgliedschaften(mitgliedschaftenData.mitgliedschaften ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    laden()
  }, [])

  async function handleSpeichern(event) {
    event.preventDefault()
    setSpeichert(true)
    setError('')
    setGespeichert(false)
    try {
      await adminFetch('/api/admin/programme?resource=mitgliedschaft-einstellungen', {
        method: 'PATCH',
        body: JSON.stringify({
          titel,
          beschreibung: beschreibung.trim() || null,
          preis_cent: preis ? Math.round(Number(preis) * 100) : null,
          stripe_price_id: stripePriceId.trim() || null,
          bezahltext: bezahltext.trim() || null,
        }),
      })
      setGespeichert(true)
      setTimeout(() => setGespeichert(false), 2000)
      await laden()
    } catch (err) {
      setError(err.message)
    } finally {
      setSpeichert(false)
    }
  }

  if (loading) return <p className="text-slate-500">Lädt…</p>

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-mrh-navy">Mitgliedschaft</h1>
      <p className="mb-6 text-sm text-mrh-grey">
        Einstellungen für die Community-Mitgliedschaft (Verkaufsseite{' '}
        <code className="rounded bg-slate-100 px-1">/mitgliedschaft</code>).
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form
        onSubmit={handleSpeichern}
        className="mb-8 space-y-3 rounded-xl bg-white p-5 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Titel
          </label>
          <input
            type="text"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Beschreibung
          </label>
          <textarea
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Preis pro Monat (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={preis}
              onChange={(e) => setPreis(e.target.value)}
              placeholder="noch nicht festgelegt"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Stripe Price ID
            </label>
            <input
              type="text"
              value={stripePriceId}
              onChange={(e) => setStripePriceId(e.target.value)}
              placeholder="price_..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Bezahltext (unter dem Preis auf der Verkaufsseite)
          </label>
          <textarea
            value={bezahltext}
            onChange={(e) => setBezahltext(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
          />
        </div>

        {!einstellungen?.preis_cent && (
          <p className="text-xs text-amber-700">
            Ohne Preis und Stripe Price ID ist die Mitgliedschaft auf der
            Verkaufsseite sichtbar, aber nicht buchbar.
          </p>
        )}

        {gespeichert && <p className="text-sm text-mrh-gold-dark">Gespeichert.</p>}

        <button
          type="submit"
          disabled={speichert}
          className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
        >
          {speichert ? 'Speichert…' : 'Speichern'}
        </button>
      </form>

      <h2 className="mb-3 font-semibold text-slate-800">Mitglieder</h2>
      {mitgliedschaften.length === 0 ? (
        <p className="text-sm text-slate-400">Noch keine Mitgliedschaften.</p>
      ) : (
        <div className="space-y-2">
          {mitgliedschaften.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-medium text-slate-800">
                  {m.coachies?.name ?? 'Unbekannt'}
                </p>
                <p className="text-xs text-mrh-grey">{m.coachies?.email}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-mrh-grey">
                <span>Start {formatDatum(m.start_datum)}</span>
                <span>Nächste Abrechnung {formatDatum(m.naechste_abrechnung)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${STATUS_FARBE[m.status] ?? 'bg-slate-100 text-slate-500'}`}
                >
                  {STATUS_LABEL[m.status] ?? m.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
