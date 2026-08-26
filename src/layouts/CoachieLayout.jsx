import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/coachie', label: 'Programme', end: true },
  { to: '/coachie/auswertungen', label: 'Meine Auswertungen' },
  { to: '/coachie/suche', label: 'Suche' },
]

export default function CoachieLayout() {
  const { coachie, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-mrh-cream">
      <header className="border-b border-slate-200 bg-mrh-navy text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/coachie" className="text-lg font-semibold">
            MRH Beratung &amp; Coaching
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {coachie?.name && <span className="text-slate-200">{coachie.name}</span>}
            <button
              onClick={handleLogout}
              className="rounded-lg border border-white/30 px-3 py-1.5 transition hover:bg-white/10"
            >
              Abmelden
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-mrh-cream text-mrh-navy'
                    : 'text-slate-200 hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
