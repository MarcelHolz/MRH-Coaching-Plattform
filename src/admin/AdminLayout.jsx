import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdminAuth } from './AdminAuthContext'

// Gruppierte Navigation statt einer flachen Tab-Reihe -- macht Platz für
// künftige Bereiche (Agent-Entwürfe, Vollständigkeits-Check, ...), ohne
// dass die Leiste überläuft: dafür einfach eine weitere Gruppe/Zeile
// ergänzen. "Übersicht" ist bewusst ungruppiert und immer zuerst, als
// fester Startpunkt.
const NAV_GROUPS = [
  { items: [{ to: '/admin', label: 'Übersicht', end: true }] },
  { label: 'Kurse', items: [{ to: '/admin/programme', label: 'Programme' }] },
  {
    label: 'Coachies',
    items: [
      { to: '/admin/coachies', label: 'Coachies' },
      { to: '/admin/fortschritt', label: 'Fortschritt' },
      { to: '/admin/empfehlungen', label: 'Empfehlungen' },
    ],
  },
  {
    label: 'Qualität',
    items: [
      { to: '/admin/testimonials', label: 'Testimonials' },
      { to: '/admin/vollstaendigkeit', label: 'Vollständigkeit' },
    ],
  },
]

function NavLinks({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-4">
      {NAV_GROUPS.map((gruppe, index) => (
        <div key={gruppe.label ?? `gruppe-${index}`}>
          {gruppe.label && (
            <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-white/40">
              {gruppe.label}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {gruppe.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-mrh-cream text-mrh-navy'
                      : 'text-slate-200 hover:bg-white/10'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

export default function AdminLayout() {
  const { logout } = useAdminAuth()
  const navigate = useNavigate()
  const [menuOffen, setMenuOffen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-mrh-cream md:flex">
      <header className="flex items-center justify-between border-b border-slate-200 bg-mrh-navy px-4 py-4 text-white md:hidden">
        <span className="text-lg font-semibold">MRH Beratung &amp; Coaching</span>
        <button
          onClick={() => setMenuOffen((prev) => !prev)}
          aria-label={menuOffen ? 'Navigation schließen' : 'Navigation öffnen'}
          aria-expanded={menuOffen}
          className="rounded-lg border border-white/30 p-1.5 transition hover:bg-white/10"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </header>

      <aside
        className={`shrink-0 bg-mrh-navy text-white md:block md:w-56 ${
          menuOffen ? 'block' : 'hidden'
        }`}
      >
        <div className="hidden border-b border-white/10 px-4 py-4 md:block">
          <span className="text-lg font-semibold">MRH Beratung &amp; Coaching</span>
        </div>
        <div className="px-3 py-4">
          <NavLinks onNavigate={() => setMenuOffen(false)} />
        </div>
        <div className="border-t border-white/10 px-3 py-3">
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-white/30 px-3 py-1.5 text-sm transition hover:bg-white/10"
          >
            Abmelden
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
