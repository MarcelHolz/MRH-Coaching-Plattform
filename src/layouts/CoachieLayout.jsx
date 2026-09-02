import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { initialen } from '../lib/initialen'

const NAV_ITEMS = [
  { to: '/coachie', label: 'Programme', end: true },
  { to: '/coachie/auswertungen', label: 'Meine Auswertungen' },
  { to: '/coachie/suche', label: 'Suche' },
  { to: '/coachie/zertifikate', label: 'Meine Abschlüsse' },
  { to: '/coachie/einstellungen', label: 'Einstellungen' },
]

// Feste, im Code hinterlegte Links zu anderen MRH-Marken (Feature 4) --
// ändert sich selten genug für einen festen Codeblock, kein CMS-Feld.
const MARKEN_LINKS = [
  { label: 'MRH Beratung & Coaching', href: 'https://mrh-beratung.de' },
  { label: 'Cashmor', href: 'https://www.cashmor.de' },
  { label: 'ExecutiveDeepDive', href: 'https://www.executivedeepdive.com' },
  { label: 'THA One', href: 'https://tha-one.com' },
]

export default function CoachieLayout() {
  const { coachie, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOffen, setMenuOffen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-mrh-cream">
      <header className="border-b border-slate-200 bg-mrh-navy text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/coachie" className="text-lg font-semibold">
            MRH Beratung &amp; Coaching
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {coachie?.avatar_url ? (
              <img
                src={coachie.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              coachie && (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                  {initialen(coachie.name)}
                </span>
              )
            )}
            {coachie?.name && (
              <span className="hidden text-slate-200 sm:inline">
                {coachie.name}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="rounded-lg border border-white/30 px-3 py-1.5 transition hover:bg-white/10"
            >
              Abmelden
            </button>
            <button
              onClick={() => setMenuOffen((prev) => !prev)}
              aria-label={menuOffen ? 'Navigation schließen' : 'Navigation öffnen'}
              aria-expanded={menuOffen}
              className="rounded-lg border border-white/30 p-1.5 transition hover:bg-white/10 md:hidden"
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
          </div>
        </div>
        <nav className="mx-auto hidden max-w-5xl gap-1 px-4 md:flex">
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
        {menuOffen && (
          <nav className="mx-auto flex max-w-5xl flex-col gap-1 px-4 pb-4 md:hidden">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOffen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm font-medium transition ${
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
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto max-w-5xl px-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-mrh-grey">
            Mehr von MRH
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            {MARKEN_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-mrh-navy hover:underline"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
