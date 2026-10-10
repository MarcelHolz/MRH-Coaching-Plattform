import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import RechtsFooter from '../components/RechtsFooter'
import { WIDERRUF_PFAD } from '../lib/rechtliches'

// Widerrufsbutton (§ 356a BGB): öffentlich, ohne Login. Zweistufig:
// 1. Formular, 2. Zusammenfassung mit "Widerruf bestätigen". Erst dieser
// Klick übermittelt den Widerruf (api/checkout.js?aktion=widerruf).
// Eingeloggte Coachies bekommen Name und E-Mail vorbefüllt.
const feldKlassen =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy'

function Rahmen({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-mrh-cream px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">{children}</div>
      <RechtsFooter />
    </div>
  )
}

function Zeile({ label, wert }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-mrh-grey">{label}</dt>
      <dd className="whitespace-pre-line text-sm text-slate-800">{wert || 'keine Angabe'}</dd>
    </div>
  )
}

export default function VertragWiderrufenPage() {
  const { coachie } = useAuth()
  const [programme, setProgramme] = useState([])
  const [schritt, setSchritt] = useState('formular')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [vertrag, setVertrag] = useState('')
  const [kaufangabe, setKaufangabe] = useState('')
  const [anmerkung, setAnmerkung] = useState('')
  const [website, setWebsite] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [meldung, setMeldung] = useState('')
  const [vorbefuellt, setVorbefuellt] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/checkout?resource=uebersicht')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setProgramme(data?.programme ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Eingeloggte Coachies: Name und E-Mail einmalig vorbefüllen, bleiben
  // änderbar.
  useEffect(() => {
    if (!coachie || vorbefuellt) return
    setName((aktuell) => aktuell || coachie.name || '')
    setEmail((aktuell) => aktuell || coachie.email || '')
    setVorbefuellt(true)
  }, [coachie, vorbefuellt])

  const vertragLabel =
    vertrag === 'mitgliedschaft'
      ? 'Mitgliedschaft'
      : vertrag === 'anderer'
        ? 'Anderer Vertrag'
        : (programme.find((p) => `programm:${p.slug}` === vertrag)?.titel ?? '')

  function handleWeiter(event) {
    event.preventDefault()
    setFehler('')
    setSchritt('pruefen')
  }

  async function handleBestaetigen() {
    setFehler('')
    setLaeuft(true)
    try {
      const response = await fetch('/api/checkout?aktion=widerruf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          vertrag,
          kaufdatumOderBestellnr: kaufangabe,
          anmerkung,
          website,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Widerruf konnte nicht übermittelt werden.')
      setMeldung(data.meldung)
      setSchritt('fertig')
    } catch (err) {
      setFehler(err.message)
    } finally {
      setLaeuft(false)
    }
  }

  if (schritt === 'fertig') {
    return (
      <Rahmen>
        <h1 className="mb-3 text-xl font-semibold text-mrh-navy">Widerruf eingegangen</h1>
        <p className="text-sm text-slate-700">{meldung}</p>
        <p className="mt-3 text-xs text-mrh-grey">
          Übermittelt am {new Date().toLocaleString('de-DE')}.
        </p>
      </Rahmen>
    )
  }

  if (schritt === 'pruefen') {
    return (
      <Rahmen>
        <h1 className="mb-1 text-xl font-semibold text-mrh-navy">Angaben prüfen</h1>
        <p className="mb-5 text-sm text-mrh-grey">
          Bitte prüfe deine Angaben. Erst mit „Widerruf bestätigen“ wird dein
          Widerruf übermittelt.
        </p>
        <dl className="mb-6 space-y-3 rounded-lg bg-mrh-cream p-4">
          <Zeile label="Name" wert={name} />
          <Zeile label="E-Mail für die Bestätigung" wert={email} />
          <Zeile label="Vertrag" wert={vertragLabel} />
          <Zeile label="Kaufdatum oder Bestellnummer" wert={kaufangabe} />
          <Zeile label="Anmerkung" wert={anmerkung} />
        </dl>
        {fehler && <p className="mb-4 text-sm text-red-600">{fehler}</p>}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleBestaetigen}
            disabled={laeuft}
            className="w-full rounded-lg bg-mrh-navy py-2.5 text-sm font-semibold text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
          >
            {laeuft ? 'Wird übermittelt…' : 'Widerruf bestätigen'}
          </button>
          <button
            type="button"
            onClick={() => setSchritt('formular')}
            disabled={laeuft}
            className="text-sm text-mrh-grey hover:underline"
          >
            Angaben ändern
          </button>
        </div>
      </Rahmen>
    )
  }

  return (
    <Rahmen>
      <h1 className="mb-1 text-xl font-semibold text-mrh-navy">Vertrag widerrufen</h1>
      <p className="mb-6 text-sm text-mrh-grey">
        Hier erklärst du den Widerruf eines Vertrags, ohne Login. Einzelheiten
        stehen in der{' '}
        <Link to={WIDERRUF_PFAD} className="text-mrh-navy underline">
          Widerrufsbelehrung
        </Link>
        .
      </p>

      <form onSubmit={handleWeiter} className="space-y-4">
        <div>
          <label htmlFor="w-name" className="mb-1 block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="w-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={feldKlassen}
          />
        </div>
        <div>
          <label htmlFor="w-email" className="mb-1 block text-sm font-medium text-slate-700">
            E-Mail-Adresse für die Bestätigung
          </label>
          <input
            id="w-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={feldKlassen}
          />
        </div>
        <div>
          <label htmlFor="w-vertrag" className="mb-1 block text-sm font-medium text-slate-700">
            Welcher Vertrag?
          </label>
          <select
            id="w-vertrag"
            required
            value={vertrag}
            onChange={(e) => setVertrag(e.target.value)}
            className={feldKlassen}
          >
            <option value="" disabled>
              Bitte wählen
            </option>
            {programme.map((programm) => (
              <option key={programm.slug} value={`programm:${programm.slug}`}>
                {programm.titel}
              </option>
            ))}
            <option value="mitgliedschaft">Mitgliedschaft</option>
            <option value="anderer">Anderer Vertrag</option>
          </select>
        </div>
        <div>
          <label htmlFor="w-kauf" className="mb-1 block text-sm font-medium text-slate-700">
            Kaufdatum oder Bestellnummer{' '}
            <span className="font-normal text-mrh-grey">(freiwillig)</span>
          </label>
          <input
            id="w-kauf"
            type="text"
            value={kaufangabe}
            onChange={(e) => setKaufangabe(e.target.value)}
            className={feldKlassen}
          />
        </div>
        <div>
          <label htmlFor="w-anmerkung" className="mb-1 block text-sm font-medium text-slate-700">
            Anmerkung <span className="font-normal text-mrh-grey">(freiwillig)</span>
          </label>
          <textarea
            id="w-anmerkung"
            rows={3}
            value={anmerkung}
            onChange={(e) => setAnmerkung(e.target.value)}
            className={feldKlassen}
          />
          <p className="mt-1 text-xs text-mrh-grey">Eine Begründung ist nicht nötig.</p>
        </div>
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label htmlFor="w-website">Website</label>
          <input
            id="w-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-mrh-navy py-2.5 text-sm font-semibold text-white transition hover:bg-mrh-navy-dark"
        >
          Weiter zur Zusammenfassung
        </button>
      </form>
    </Rahmen>
  )
}
