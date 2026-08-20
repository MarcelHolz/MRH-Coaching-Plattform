import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdminAuth } from './AdminAuthContext'

const NAV_ITEMS = [
  { to: '/admin/programme', label: 'Programme' },
  { to: '/admin/coachies', label: 'Coachies' },
  { to: '/admin/fortschritt', label: 'Fortschritt' },
]

export default function AdminLayout() {
  const { logout } = useAdminAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-[#1e3a5f] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="text-lg font-semibold">MRH Admin</span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/30 px-3 py-1.5 text-sm transition hover:bg-white/10"
          >
            Abmelden
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-slate-50 text-[#1e3a5f]'
                    : 'text-slate-200 hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
