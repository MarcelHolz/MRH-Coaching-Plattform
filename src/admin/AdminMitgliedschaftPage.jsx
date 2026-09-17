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
  const [coachies, setCoachies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [speichert, setSpeichert] = useState(false)
  const [gespeichert, setGespeichert] = useState(false)

  const [titel, setTitel] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [preis, setPreis] = useState('')
  const [bezahltext, setBezahltext] = useState('')

  const [ausgewaehlterCoachie, setAusgewaehlterCoachie] = useState('')
  const [hinzufuegen, setHinzufuegen] = useState(false)
  const [entfernenId, setEntfernenId] = useState(null)

  async function laden() {
    setLoading(true)
    setError('')
    try {
      const [einstellungenData, mitgliedschaftenData, coachiesData] = await Promise.all([
        adminFetch('/api/admin/programme?resource=mitgliedschaft-einstellungen'),
        adminFetch('/api/admin/coachies?resource=mitgliedschaften'),
        adminFetch('/api/admin/coachies'),
      ])
      const e = einstellungenData.einstellungen
      setEinstellungen(e)
      setTitel(e?.titel ?? '')
      setBeschreibung(e?.beschreibung ?? '')
      setPreis(e?.preis_cent != null ? String(e.preis_cent / 100) : '')
      setBezahltext(e?.bezahltext ?? '')
      setMitgliedschaften(mitgliedschaftenData.mitgliedschaften ?? [])
      setCoachies(coachiesData.coachies ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    laden()
  }, [])

  // Coachies, die noch keine Mitgliedschafts-Zeile haben (egal welchen
  // Status) -- coachie_id ist in mitgliedschaften unique, ein Coachie
  // mit bestehender (auch gekündigter) Zeile kann hier also nicht
  // erneut manuell hinzugefügt werden.
  const coachiesOhneMitgliedschaft = coachies.filter(
    (c) => !mitgliedschaften.some((m) => m.coachie_id === c.id),
  )

  async function handleHinzufuegen(event) {
    event.preventDefault()
    if (!ausgewaehlterCoachie) return

    setHinzufuegen(true)
    setError('')
    try {
      await adminFetch('/api/admin/coachies?resource=mitgliedschaften', {
        method: 'POST',
        body: JSON.stringify({ coachie_id: ausgewaehlterCoachie }),
      })
      setAusgewaehlterCoachie('')
      await laden()
    } catch (err) {
      setError(err.message)
    } finally {
      setHinzufuegen(false)
    }
  }

  async function handleEntfernen(id) {
    if (!window.confirm('Mitgliedschaft wirklich entfernen?')) return

    setEntfernenId(id)
    setError('')
    try {
      await adminFetch(`/api/admin/coachies?resource=mitgliedschaften&id=${id}`, {
        method: 'DELETE',
      })
      await laden()
    } catch (err) {
      setError(err.message)
    } finally {
      setEntfernenId(null)
    }
  }

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
          <p className="mt-1 text-xs text-mrh-grey">
            Der Stripe-Preis wird beim Checkout automatisch aus diesem Betrag
            erzeugt -- kein eigener Price in Stripe nötig.
          </p>
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
            Ohne Preis ist die Mitgliedschaft auf der Verkaufsseite sichtbar,
            aber nicht buchbar.
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

      <form
        onSubmit={handleHinzufuegen}
        className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-white p-4 shadow-sm"
      >
        <div className="min-w-[14rem] flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Coachie manuell als Mitglied hinzufügen
          </label>
          <select
            value={ausgewaehlterCoachie}
            onChange={(e) => setAusgewaehlterCoachie(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-gold focus:outline-none"
          >
            <option value="">Coachie wählen…</option>
            {coachiesOhneMitgliedschaft.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!ausgewaehlterCoachie || hinzufuegen}
          className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
        >
          {hinzufuegen ? 'Fügt hinzu…' : 'Hinzufügen'}
        </button>
      </form>
      {coachiesOhneMitgliedschaft.length === 0 && coachies.length > 0 && (
        <p className="mb-4 text-xs text-mrh-grey">
          Alle Coachies haben bereits eine Mitgliedschaft.
        </p>
      )}
      <p className="mb-4 text-xs text-mrh-grey">
        Manuell hinzugefügte Mitglieder (z. B. Freiplätze) laufen ohne
        Stripe-Abo -- es findet keine Abbuchung statt und &bdquo;Nächste
        Abrechnung&ldquo; bleibt leer.
      </p>

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
                <button
                  onClick={() => handleEntfernen(m.id)}
                  disabled={entfernenId === m.id}
                  className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {entfernenId === m.id ? 'Entfernt…' : 'Entfernen'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
