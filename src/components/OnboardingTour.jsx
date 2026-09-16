import { useState } from 'react'

const SCHRITTE = [
  {
    titel: 'Willkommen bei MRH!',
    text: 'Kurz der Reihe nach, wo du dich zurechtfindest -- danach kann es direkt losgehen.',
  },
  {
    titel: 'Dein Programm',
    text: 'Auf der Startseite siehst du dein aktuelles Programm und machst dort direkt weiter, wo du aufgehört hast.',
  },
  {
    titel: 'Deine Auswertungen',
    text: '"Meine Auswertungen" zeigt deinen Fortschritt und deine Testergebnisse auf einen Blick.',
  },
  {
    titel: 'Fragen? Der FAQ-Chat hilft',
    text: 'Der runde "?"-Button unten rechts beantwortet Fragen zur Plattform und den Kursinhalten -- rund um die Uhr.',
  },
  {
    titel: 'Lesezeichen setzen',
    text: 'In jeder Session kannst du dir mit dem Lesezeichen-Symbol wichtige Stellen merken, um sie schnell wiederzufinden.',
  },
]

// Aktives Onboarding (Feature "Automatisierte Onboarding-Sequenz"):
// einmaliges Overlay direkt nach dem ersten Login, das kurz auf die
// wichtigsten Bereiche hinweist. Danach jederzeit über den
// "Rundgang"-Button im Header manuell erneut aufrufbar (siehe
// CoachieLayout.jsx) -- ganz bewusst rein clientseitiger State ohne
// eigene Migration: das "einmalig automatisch zeigen" nutzt das
// bereits bestehende erster_login_am/istErsterLogin aus
// AuthContext.jsx (Feature "Aktives Onboarding nach Login"), das
// erneute manuelle Aufrufen braucht keine Persistenz.
export default function OnboardingTour({ offen, onClose }) {
  const [schrittIndex, setSchrittIndex] = useState(0)

  if (!offen) return null

  const schritt = SCHRITTE[schrittIndex]
  const istLetzterSchritt = schrittIndex === SCHRITTE.length - 1

  function schliessenUndZuruecksetzen() {
    setSchrittIndex(0)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex justify-center gap-1.5">
          {SCHRITTE.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 w-6 rounded-full ${
                index === schrittIndex ? 'bg-mrh-gold' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <h2 className="mb-2 text-lg font-semibold text-mrh-navy">{schritt.titel}</h2>
        <p className="mb-6 text-sm text-slate-600">{schritt.text}</p>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={schliessenUndZuruecksetzen}
            className="text-sm text-mrh-grey hover:text-slate-700"
          >
            Überspringen
          </button>
          <div className="flex gap-2">
            {schrittIndex > 0 && (
              <button
                onClick={() => setSchrittIndex((i) => i - 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Zurück
              </button>
            )}
            {istLetzterSchritt ? (
              <button
                onClick={schliessenUndZuruecksetzen}
                className="rounded-lg bg-mrh-navy px-4 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
              >
                Los geht&apos;s
              </button>
            ) : (
              <button
                onClick={() => setSchrittIndex((i) => i + 1)}
                className="rounded-lg bg-mrh-navy px-4 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
              >
                Weiter
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
