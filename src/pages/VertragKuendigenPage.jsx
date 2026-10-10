import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import RechtsFooter from '../components/RechtsFooter'

// Kündigungsbutton (§ 312k BGB): permanent erreichbar, ohne Login,
// bewusst ohne CoachieLayout (keine Navigation, keine Angebote). Die
// Seite gibt keine Vertragsdaten preis: Sie nimmt die Erklärung entgegen,
// der Server bestätigt den Eingang per Mail und schickt Coachies einen
// Bestätigungslink (?token=...). Erst dieser Klick führt die Kündigung
// aus. Siehe api/checkout.js?resource=kuendigung.

const feldKlassen =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy'

function Rahmen({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-mrh-cream px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">{children}</div>
      <RechtsFooter />
    </div>
  )
}

function TokenBestaetigung({ token }) {
  const [status, setStatus] = useState('bereit')
  const [ergebnis, setErgebnis] = useState([])
  const [fehler, setFehler] = useState('')

  async function handleBestaetigen() {
    setFehler('')
    setStatus('laeuft')
    try {
      const response = await fetch('/api/checkout?resource=kuendigung&aktion=bestaetigen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Bestätigung fehlgeschlagen.')
      setErgebnis(data.ergebnis ?? [])
      setStatus(data.status === 'bereits_ausgefuehrt' ? 'bereits' : 'fertig')
    } catch (err) {
      setFehler(err.message)
      setStatus('bereit')
    }
  }

  if (status === 'fertig' || status === 'bereits') {
    return (
      <Rahmen>
        <h1 className="mb-3 text-xl font-semibold text-mrh-navy">Kündigung bestätigt</h1>
        {status === 'bereits' ? (
          <p className="text-sm text-slate-700">
            Diese Kündigung wurde bereits ausgeführt. Die Bestätigung findest du in
            deinem Postfach.
          </p>
        ) : (
          <>
            <ul className="mb-3 space-y-2 text-sm text-slate-700">
              {ergebnis.map((zeile) => (
                <li key={zeile}>{zeile}</li>
              ))}
            </ul>
            <p className="text-sm text-slate-700">
              Eine Bestätigung wurde an deine E-Mail-Adresse geschickt.
            </p>
          </>
        )}
      </Rahmen>
    )
  }

  return (
    <Rahmen>
      <h1 className="mb-1 text-xl font-semibold text-mrh-navy">Kündigung bestätigen</h1>
      <p className="mb-6 text-sm text-mrh-grey">
        Mit dem Klick führen wir die Kündigung aus, die du über das Formular
        abgeschickt hast.
      </p>
      {fehler && <p className="mb-4 text-sm text-red-600">{fehler}</p>}
      <button
        onClick={handleBestaetigen}
        disabled={status === 'laeuft'}
        className="w-full rounded-lg bg-mrh-navy py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
      >
        {status === 'laeuft' ? 'Wird ausgeführt…' : 'Jetzt kündigen'}
      </button>
    </Rahmen>
  )
}

function KuendigungsFormular() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [vertrag, setVertrag] = useState('alle')
  const [angaben, setAngaben] = useState('')
  const [zeitpunktArt, setZeitpunktArt] = useState('naechstmoeglich')
  const [datum, setDatum] = useState('')
  const [website, setWebsite] = useState('')
  const [ladend, setLadend] = useState(false)
  const [fehler, setFehler] = useState('')
  const [meldung, setMeldung] = useState('')

  const heute = new Date().toISOString().slice(0, 10)

  async function handleSubmit(event) {
    event.preventDefault()
    setFehler('')
    setLadend(true)
    try {
      const response = await fetch('/api/checkout?resource=kuendigung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          vertrag,
          angaben,
          zeitpunkt: zeitpunktArt === 'datum' ? datum : 'naechstmoeglich',
          website,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Kündigung fehlgeschlagen.')
      setMeldung(data.meldung)
    } catch (err) {
      setFehler(err.message)
    } finally {
      setLadend(false)
    }
  }

  // Bestätigungsseite: ausschließlich die Eingangsbestätigung, keine
  // weiteren Inhalte oder Angebote.
  if (meldung) {
    return (
      <Rahmen>
        <h1 className="mb-3 text-xl font-semibold text-mrh-navy">Kündigung eingegangen</h1>
        <p className="text-sm text-slate-700">{meldung}</p>
        <p className="mt-3 text-xs text-mrh-grey">
          Eingegangen am {new Date().toLocaleString('de-DE')}.
        </p>
      </Rahmen>
    )
  }

  return (
    <Rahmen>
      <h1 className="mb-1 text-xl font-semibold text-mrh-navy">Verträge hier kündigen</h1>
      <p className="mb-6 text-sm text-mrh-grey">
        Mitgliedschaft oder Kurszugang beenden, ohne Login.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="k-name" className="mb-1 block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="k-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={feldKlassen}
          />
        </div>
        <div>
          <label htmlFor="k-email" className="mb-1 block text-sm font-medium text-slate-700">
            E-Mail-Adresse
          </label>
          <input
            id="k-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={feldKlassen}
          />
          <p className="mt-1 text-xs text-mrh-grey">
            Die Adresse, mit der du gebucht hast.
          </p>
        </div>
        <div>
          <label htmlFor="k-vertrag" className="mb-1 block text-sm font-medium text-slate-700">
            Welcher Vertrag?
          </label>
          <select
            id="k-vertrag"
            value={vertrag}
            onChange={(e) => setVertrag(e.target.value)}
            className={feldKlassen}
          >
            <option value="alle">Alle Verträge</option>
            <option value="mitgliedschaft">Mitgliedschaft</option>
            <option value="kurs">Kurs</option>
          </select>
        </div>
        <div>
          <label htmlFor="k-angaben" className="mb-1 block text-sm font-medium text-slate-700">
            Angaben zum Vertrag (optional)
          </label>
          <textarea
            id="k-angaben"
            rows={2}
            value={angaben}
            onChange={(e) => setAngaben(e.target.value)}
            placeholder="z. B. Name des Kurses oder Rechnungsnummer"
            className={feldKlassen}
          />
        </div>
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-slate-700">
            Kündigen zum
          </legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="zeitpunkt"
              checked={zeitpunktArt === 'naechstmoeglich'}
              onChange={() => setZeitpunktArt('naechstmoeglich')}
              className="accent-mrh-navy"
            />
            nächstmöglichen Zeitpunkt
          </label>
          <label className="mt-1 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="zeitpunkt"
              checked={zeitpunktArt === 'datum'}
              onChange={() => setZeitpunktArt('datum')}
              className="accent-mrh-navy"
            />
            Datum:
            <input
              type="date"
              min={heute}
              value={datum}
              required={zeitpunktArt === 'datum'}
              disabled={zeitpunktArt !== 'datum'}
              onChange={(e) => setDatum(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
            />
          </label>
        </fieldset>
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label htmlFor="k-website">Website</label>
          <input
            id="k-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {fehler && <p className="text-sm text-red-600">{fehler}</p>}
        <button
          type="submit"
          disabled={ladend}
          className="w-full rounded-lg bg-mrh-navy py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
        >
          {ladend ? 'Wird gesendet…' : 'Jetzt kündigen'}
        </button>
      </form>
    </Rahmen>
  )
}

export default function VertragKuendigenPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  return token ? <TokenBestaetigung token={token} /> : <KuendigungsFormular />
}
