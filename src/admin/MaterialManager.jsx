import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'

export default function MaterialManager({ sessionId }) {
  const [materialien, setMaterialien] = useState([])
  const [loading, setLoading] = useState(true)
  const [titel, setTitel] = useState('')
  const [dateiUrl, setDateiUrl] = useState('')
  const [typ, setTyp] = useState('')
  const [error, setError] = useState('')

  async function loadMaterialien() {
    setLoading(true)
    try {
      const data = await adminFetch(
        `/api/admin/materials?session_id=${sessionId}`,
      )
      setMaterialien(data.materialien ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMaterialien()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function handleAdd(event) {
    event.preventDefault()
    setError('')
    try {
      await adminFetch('/api/admin/materials', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          titel,
          datei_url: dateiUrl,
          typ,
        }),
      })
      setTitel('')
      setDateiUrl('')
      setTyp('')
      await loadMaterialien()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    setError('')
    try {
      await adminFetch(`/api/admin/materials?id=${id}`, { method: 'DELETE' })
      await loadMaterialien()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Materialien
      </p>

      {loading ? (
        <p className="text-sm text-slate-400">Lädt…</p>
      ) : (
        <ul className="mb-3 space-y-1">
          {materialien.map((material) => (
            <li
              key={material.id}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {material.titel}
                {material.typ ? ` (${material.typ})` : ''}
              </span>
              <button
                onClick={() => handleDelete(material.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Entfernen
              </button>
            </li>
          ))}
          {materialien.length === 0 && (
            <li className="text-sm text-slate-400">Keine Materialien.</li>
          )}
        </ul>
      )}

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      <form onSubmit={handleAdd} className="grid gap-2 sm:grid-cols-4">
        <input
          type="text"
          placeholder="Titel"
          required
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
        />
        <input
          type="url"
          placeholder="Datei-URL"
          required
          value={dateiUrl}
          onChange={(e) => setDateiUrl(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] sm:col-span-2"
        />
        <input
          type="text"
          placeholder="Typ (z. B. PDF)"
          value={typ}
          onChange={(e) => setTyp(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
        />
        <button
          type="submit"
          className="rounded-lg bg-[#2563eb] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#1e4fc4] sm:col-span-4"
        >
          Material hinzufügen
        </button>
      </form>
    </div>
  )
}
