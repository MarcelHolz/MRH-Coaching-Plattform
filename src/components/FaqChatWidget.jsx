import { useState } from 'react'

// Schwebendes FAQ-Chat-Widget im Coachie-Bereich (api/certificate.js
// ?resource=faq-chat) -- antwortet ausschließlich aus der festen
// FAQ-Wissensbasis, siehe Erklärung im System-Prompt serverseitig.
// Bewusst zustandslos zwischen Nachrichten (kein mehrstufiger Verlauf,
// der ans Backend geschickt wird): jede Frage ist ein eigenständiger
// Request, passend zu "FAQ-Chat", nicht zu einer freien Unterhaltung.
export default function FaqChatWidget({ accessToken }) {
  const [offen, setOffen] = useState(false)
  const [verlauf, setVerlauf] = useState([])
  const [frage, setFrage] = useState('')
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState('')

  async function handleSenden(event) {
    event.preventDefault()
    const gestellteFrage = frage.trim()
    if (!gestellteFrage || laedt) return

    setLaedt(true)
    setFehler('')
    setVerlauf((prev) => [...prev, { rolle: 'coachie', text: gestellteFrage }])
    setFrage('')

    try {
      const response = await fetch('/api/certificate?resource=faq-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ frage: gestellteFrage }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Antwort konnte nicht geladen werden.')
      }

      setVerlauf((prev) => [...prev, { rolle: 'assistent', text: data.antwort }])
    } catch (err) {
      setFehler(err.message)
    } finally {
      setLaedt(false)
    }
  }

  return (
    // bottom/right nutzen zusätzlich env(safe-area-inset-*): ohne den
    // Abstand landet der Button auf Handys mit Home-Indikator/Wisch-Geste
    // genau in der System-Gesten-Zone und ist dort nicht anklickbar.
    <div className="fixed z-40 bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))]">
      {offen && (
        <div className="mb-3 flex h-96 w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between bg-mrh-navy px-4 py-3 text-white">
            <span className="text-sm font-semibold">Fragen &amp; Antworten</span>
            <button
              onClick={() => setOffen(false)}
              aria-label="Chat schließen"
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {verlauf.length === 0 && (
              <p className="text-xs text-mrh-grey">
                Stell mir eine Frage zur Plattform oder zu den Kursinhalten.
                Zu deinem persönlichen Lernfortschritt kann ich leider keine
                Auskunft geben -- dafür wende dich an deinen Coach.
              </p>
            )}
            {verlauf.map((eintrag, index) => (
              <div
                key={index}
                className={`rounded-lg p-2 text-sm ${
                  eintrag.rolle === 'coachie'
                    ? 'ml-6 bg-mrh-cream text-mrh-navy'
                    : 'mr-6 bg-slate-100 text-slate-700'
                }`}
              >
                {eintrag.text}
              </div>
            ))}
            {laedt && <p className="text-xs text-mrh-grey">Antwortet…</p>}
            {fehler && <p className="text-xs text-red-600">{fehler}</p>}
          </div>

          <form onSubmit={handleSenden} className="flex gap-2 border-t border-slate-200 p-2">
            <input
              type="text"
              value={frage}
              onChange={(event) => setFrage(event.target.value)}
              placeholder="Deine Frage…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-mrh-gold focus:outline-none"
            />
            <button
              type="submit"
              disabled={laedt || !frage.trim()}
              className="rounded-lg bg-mrh-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
            >
              Senden
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOffen((prev) => !prev)}
        aria-label={offen ? 'Chat schließen' : 'Fragen & Antworten öffnen'}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-mrh-navy text-white shadow-lg transition hover:bg-mrh-navy-dark"
      >
        {offen ? '✕' : '?'}
      </button>
    </div>
  )
}
