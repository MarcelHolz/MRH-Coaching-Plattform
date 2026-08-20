import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminFetch } from '../lib/adminFetch'

export default function AdminProgrammePage() {
  const [programme, setProgramme] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [titel, setTitel] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function loadProgramme() {
    setLoading(true)
    setError('')
    try {
      const data = await adminFetch('/api/admin/programme')
      setProgramme(data.programme ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProgramme()
  }, [])

  async function handleCreate(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await adminFetch('/api/admin/programme', {
        method: 'POST',
        body: JSON.stringify({ titel, beschreibung }),
      })
      setTitel('')
      setBeschreibung('')
      await loadProgramme()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleAktiv(programm) {
    setError('')
    try {
      await adminFetch('/api/admin/programme', {
        method: 'PATCH',
        body: JSON.stringify({ id: programm.id, aktiv: !programm.aktiv }),
      })
      await loadProgramme()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-mrh-navy">Programme</h1>

      <form
        onSubmit={handleCreate}
        className="mb-8 grid gap-3 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-[1fr_2fr_auto]"
      >
        <input
          type="text"
          placeholder="Titel"
          required
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
        />
        <input
          type="text"
          placeholder="Beschreibung"
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
        >
          Anlegen
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-slate-500">Lädt…</p>
      ) : (
        <div className="space-y-3">
          {programme.map((programm) => (
            <div
              key={programm.id}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-800">
                    {programm.titel}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      programm.aktiv
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {programm.aktiv ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
                {programm.beschreibung && (
                  <p className="text-sm text-slate-500">
                    {programm.beschreibung}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to={`/admin/programme/${programm.id}`}
                  className="text-sm text-mrh-navy hover:underline"
                >
                  Sessions verwalten
                </Link>
                <button
                  onClick={() => handleToggleAktiv(programm)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-50"
                >
                  {programm.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
