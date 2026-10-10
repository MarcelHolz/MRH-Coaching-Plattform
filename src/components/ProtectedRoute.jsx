import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { pendingPasswordSetup } from '../lib/supabaseClient'

// Eine Supabase-Session allein reicht für den Coachie-Bereich nicht: es
// muss eine Zeile in coachies geben. Ein reines Admin-Konto gilt so nicht
// als Coachie (Admins melden sich unter /admin/login an). Für
// /passwort-festlegen ist coachiePflicht aus, damit auch eingeladene
// Admins dort ihr Passwort setzen können.
function KeinCoachieKonto() {
  const { logout } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-mrh-cream px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-mrh-navy">Kein Coachie-Konto</h1>
        <p className="mb-5 text-sm text-slate-700">
          Zu dieser Anmeldung gibt es keinen Coachie-Zugang. Admins melden sich im
          Admin-Bereich an.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            to="/admin/login"
            onClick={() => logout()}
            className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
          >
            Zum Admin-Login
          </Link>
          <button onClick={() => logout()} className="text-sm text-mrh-grey hover:underline">
            Abmelden
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children, coachiePflicht = true }) {
  const { isAuthenticated, loading, coachie } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Lädt…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (pendingPasswordSetup.active && location.pathname !== '/passwort-festlegen') {
    return <Navigate to="/passwort-festlegen" replace />
  }

  if (coachiePflicht && !coachie) {
    return <KeinCoachieKonto />
  }

  return children
}
