import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'

export default function AdminCoachiesPage() {
  const [coachies, setCoachies] = useState([])
  const [programme, setProgramme] = useState([])
  const [zuordnungen, setZuordnungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [einladen, setEinladen] = useState(false)

  const [selectedCoachie, setSelectedCoachie] = useState('')
  const [selectedProgramm, setSelectedProgramm] = useState('')
  const [zuordnen, setZuordnen] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [coachiesData, programmeData, assignmentsData] = await Promise.all([
        adminFetch('/api/admin/coachies'),
        adminFetch('/api/admin/programme'),
        adminFetch('/api/admin/assignments'),
      ])
      setCoachies(coachiesData.coachies ?? [])
      setProgramme(programmeData.programme ?? [])
      setZuordnungen(assignmentsData.assignments ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function handleInvite(event) {
    event.preventDefault()
    setError('')
    setEinladen(true)
    try {
      await adminFetch('/api/admin/coachies', {
        method: 'POST',
        body: JSON.stringify({ name, email }),
      })
      setName('')
      setEmail('')
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setEinladen(false)
    }
  }

  async function handleAssign(event) {
    event.preventDefault()
    if (!selectedCoachie || !selectedProgramm) return
    setError('')
    setZuordnen(true)
    try {
      await adminFetch('/api/admin/assignments', {
        method: 'POST',
        body: JSON.stringify({
          coachie_id: selectedCoachie,
          programm_id: selectedProgramm,
        }),
      })
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setZuordnen(false)
    }
  }

  async function handleUnassign(id) {
    setError('')
    try {
      await adminFetch(`/api/admin/assignments?id=${id}`, { method: 'DELETE' })
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-[#1e3a5f]">Coachies</h1>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleInvite} className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Coachie einladen</h2>
          <div className="mb-3">
            <input
              type="text"
              placeholder="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>
          <div className="mb-3">
            <input
              type="email"
              placeholder="E-Mail"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>
          <button
            type="submit"
            disabled={einladen}
            className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1e4fc4] disabled:opacity-50"
          >
            {einladen ? 'Lädt ein…' : 'Einladen'}
          </button>
        </form>

        <form onSubmit={handleAssign} className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">
            Programm zuordnen
          </h2>
          <div className="mb-3">
            <select
              required
              value={selectedCoachie}
              onChange={(e) => setSelectedCoachie(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            >
              <option value="">Coachie wählen…</option>
              {coachies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <select
              required
              value={selectedProgramm}
              onChange={(e) => setSelectedProgramm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            >
              <option value="">Programm wählen…</option>
              {programme.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titel}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={zuordnen}
            className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#152a45] disabled:opacity-50"
          >
            {zuordnen ? 'Ordnet zu…' : 'Zuordnen'}
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-slate-500">Lädt…</p>
      ) : (
        <div className="space-y-3">
          {coachies.map((coachie) => {
            const eigeneZuordnungen = zuordnungen.filter(
              (z) => z.coachie_id === coachie.id,
            )
            return (
              <div
                key={coachie.id}
                className="rounded-xl bg-white p-4 shadow-sm"
              >
                <h3 className="font-semibold text-slate-800">
                  {coachie.name}
                </h3>
                <p className="mb-2 text-sm text-slate-500">{coachie.email}</p>
                <div className="flex flex-wrap gap-2">
                  {eigeneZuordnungen.map((z) => {
                    const programm = programme.find(
                      (p) => p.id === z.programm_id,
                    )
                    return (
                      <span
                        key={z.id}
                        className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                      >
                        {programm?.titel ?? 'Unbekannt'}
                        <button
                          onClick={() => handleUnassign(z.id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                  {eigeneZuordnungen.length === 0 && (
                    <span className="text-xs text-slate-400">
                      Keine Programme zugeordnet
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
