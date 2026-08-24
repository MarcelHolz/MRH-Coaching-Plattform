import { useState } from 'react'
import { adminFetch } from '../lib/adminFetch'
import BildUpload from './BildUpload'

export default function ModuleManager({ programId, module, onChange }) {
  const [titel, setTitel] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [bildUrl, setBildUrl] = useState('')
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editTitel, setEditTitel] = useState('')
  const [editBeschreibung, setEditBeschreibung] = useState('')
  const [editBildUrl, setEditBildUrl] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    try {
      await adminFetch('/api/admin/sessions?resource=module', {
        method: 'POST',
        body: JSON.stringify({
          programm_id: programId,
          titel,
          beschreibung,
          bild_url: bildUrl,
          reihenfolge: module.length,
        }),
      })
      setTitel('')
      setBeschreibung('')
      setBildUrl('')
      await onChange()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    setError('')
    try {
      await adminFetch(`/api/admin/sessions?resource=module&id=${id}`, {
        method: 'DELETE',
      })
      await onChange()
    } catch (err) {
      setError(err.message)
    }
  }

  function startEdit(modul) {
    setEditingId(modul.id)
    setEditTitel(modul.titel)
    setEditBeschreibung(modul.beschreibung ?? '')
    setEditBildUrl(modul.bild_url ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleUpdate(event) {
    event.preventDefault()
    setError('')
    setEditSubmitting(true)
    try {
      await adminFetch('/api/admin/sessions?resource=module', {
        method: 'PATCH',
        body: JSON.stringify({
          id: editingId,
          titel: editTitel,
          beschreibung: editBeschreibung,
          bild_url: editBildUrl,
        }),
      })
      setEditingId(null)
      await onChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleMove(index, direction) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= module.length) return

    const a = module[index]
    const b = module[targetIndex]

    setError('')
    try {
      await Promise.all([
        adminFetch('/api/admin/sessions?resource=module', {
          method: 'PATCH',
          body: JSON.stringify({ id: a.id, reihenfolge: b.reihenfolge }),
        }),
        adminFetch('/api/admin/sessions?resource=module', {
          method: 'PATCH',
          body: JSON.stringify({ id: b.id, reihenfolge: a.reihenfolge }),
        }),
      ])
      await onChange()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="mb-8 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-mrh-navy">Module</h2>
      <p className="mb-4 text-sm text-slate-500">
        Optionale Gruppierungsebene zwischen Programm und Session. Sessions
        ohne Modul erscheinen weiterhin direkt unter dem Programm.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="mb-4 space-y-2">
        {module.map((modul, index) => (
          <div key={modul.id} className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-800">{modul.titel}</p>
                {modul.beschreibung && (
                  <p className="text-sm text-slate-500">{modul.beschreibung}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm transition hover:bg-slate-100 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleMove(index, 1)}
                  disabled={index === module.length - 1}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm transition hover:bg-slate-100 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() =>
                    editingId === modul.id ? cancelEdit() : startEdit(modul)
                  }
                  className="rounded-lg border border-slate-300 px-3 py-1 text-sm transition hover:bg-slate-100"
                >
                  {editingId === modul.id ? 'Abbrechen' : 'Bearbeiten'}
                </button>
                <button
                  onClick={() => handleDelete(modul.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Löschen
                </button>
              </div>
            </div>

            {editingId === modul.id && (
              <form
                onSubmit={handleUpdate}
                className="mt-3 grid gap-2 rounded-lg bg-white p-3 sm:grid-cols-2"
              >
                <input
                  type="text"
                  placeholder="Titel"
                  required
                  value={editTitel}
                  onChange={(e) => setEditTitel(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="url"
                    placeholder="Bild-URL (oder Bild hochladen)"
                    value={editBildUrl}
                    onChange={(e) => setEditBildUrl(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                  />
                  <BildUpload onUploaded={setEditBildUrl} />
                </div>
                <input
                  type="text"
                  placeholder="Beschreibung"
                  value={editBeschreibung}
                  onChange={(e) => setEditBeschreibung(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy sm:col-span-2"
                />
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50 sm:col-span-2"
                >
                  {editSubmitting ? 'Speichert…' : 'Änderungen speichern'}
                </button>
              </form>
            )}
          </div>
        ))}
        {module.length === 0 && (
          <p className="text-sm text-slate-400">Noch keine Module angelegt.</p>
        )}
      </div>

      <form onSubmit={handleCreate} className="grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Titel"
          required
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="url"
            placeholder="Bild-URL (optional, oder Bild hochladen)"
            value={bildUrl}
            onChange={(e) => setBildUrl(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
          />
          <BildUpload onUploaded={setBildUrl} />
        </div>
        <input
          type="text"
          placeholder="Beschreibung (optional)"
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy sm:col-span-2"
        />
        <button
          type="submit"
          className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark sm:col-span-2"
        >
          Modul anlegen
        </button>
      </form>
    </div>
  )
}
