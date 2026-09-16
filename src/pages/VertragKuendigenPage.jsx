import { useState } from 'react'

function formatDatum(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Kündigungsbutton (§ 312k BGB, Punkt 1): permanent erreichbare,
// eigenständige Seite -- verlinkt von LoginPage.jsx und CoachieLayout.jsx
// -- ausdrücklich ohne Login-Zwang, daher bewusst KEIN CoachieLayout
// (kein Nav, kein FAQ-Chat, kein Mitgliedschafts-Hinweis, keine
// Marken-Links): die Seite soll wie im Auftrag beschrieben ausschließlich
// das Kündigungsformular bzw. danach die Bestätigung zeigen, keine
// weiteren Inhalte oder Alternativangebote.
//
// Generischer Baustein für beide Vertragsarten (Mitgliedschaft und
// Kurszugriff), keine zwei getrennten Lösungen -- siehe
// api/checkout.js?resource=kuendigung.
export default function VertragKuendigenPage() {
  const [schritt, setSchritt] = useState('email')
  const [email, setEmail] = useState('')
  const [vertraege, setVertraege] = useState([])
  const [ladend, setLadend] = useState(false)
  const [fehler, setFehler] = useState('')
  const [bestaetigung, setBestaetigung] = useState(null)

  async function handleSuche(event) {
    event.preventDefault()
    setFehler('')
    setLadend(true)
    try {
      const response = await fetch('/api/checkout?resource=kuendigung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Suche fehlgeschlagen.')
      }

      setVertraege(data.vertraege ?? [])
      setSchritt('liste')
    } catch (err) {
      setFehler(err.message)
    } finally {
      setLadend(false)
    }
  }

  async function handleKuendigen(vertrag) {
    if (
      !window.confirm(
        `"${vertrag.bezeichnung}" jetzt unwiderruflich kündigen?`,
      )
    ) {
      return
    }

    setFehler('')
    setLadend(true)
    try {
      const response = await fetch('/api/checkout?resource=kuendigung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          vertragTyp: vertrag.vertragTyp,
          vertragId: vertrag.vertragId,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Kündigung fehlgeschlagen.')
      }

      setBestaetigung({ bezeichnung: data.bezeichnung, zeitpunkt: data.zeitpunkt })
      setSchritt('bestaetigt')
    } catch (err) {
      setFehler(err.message)
    } finally {
      setLadend(false)
    }
  }

  // Bestätigungsseite: ausschließlich die Kündigungsbestätigung, wie im
  // Auftrag gefordert -- keine weiteren Inhalte, keine Angebote, kein
  // Link zurück ins Formular.
  if (schritt === 'bestaetigt') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mrh-cream px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="mb-3 text-xl font-semibold text-mrh-navy">
            Kündigung bestätigt
          </h1>
          <p className="text-sm text-slate-700">
            &bdquo;{bestaetigung.bezeichnung}&ldquo; wurde am{' '}
            {new Date(bestaetigung.zeitpunkt).toLocaleString('de-DE')} gekündigt.
          </p>
          <p className="mt-3 text-sm text-slate-700">
            Eine Bestätigung wurde an deine E-Mail-Adresse geschickt.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mrh-cream px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-mrh-navy">
          Vertrag kündigen
        </h1>
        <p className="mb-6 text-sm text-mrh-grey">
          Mitgliedschaft oder Kurszugang beenden -- ohne Login.
        </p>

        {schritt === 'email' && (
          <form onSubmit={handleSuche} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                E-Mail-Adresse
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
              />
            </div>
            {fehler && <p className="text-sm text-red-600">{fehler}</p>}
            <button
              type="submit"
              disabled={ladend}
              className="w-full rounded-lg bg-mrh-navy py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
            >
              {ladend ? 'Sucht…' : 'Weiter'}
            </button>
          </form>
        )}

        {schritt === 'liste' && (
          <div className="space-y-3">
            {fehler && <p className="text-sm text-red-600">{fehler}</p>}
            {vertraege.length === 0 ? (
              <p className="text-sm text-slate-600">
                Zu dieser E-Mail-Adresse wurde kein kündbarer Vertrag gefunden.
              </p>
            ) : (
              vertraege.map((vertrag) => (
                <div
                  key={`${vertrag.vertragTyp}-${vertrag.vertragId}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {vertrag.bezeichnung}
                    </p>
                    {vertrag.zugriffBis && (
                      <p className="text-xs text-mrh-grey">
                        Zugriff bis {formatDatum(vertrag.zugriffBis)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleKuendigen(vertrag)}
                    disabled={ladend}
                    className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Kündigen
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
