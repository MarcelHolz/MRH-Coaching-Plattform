import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'
import MaterialUpload from './MaterialUpload'

const TYP_OPTIONEN = [
  { value: '', label: 'Typ wählen' },
  { value: 'pdf', label: 'PDF' },
  { value: 'bild', label: 'Bild (PNG/JPEG)' },
  { value: 'text', label: 'Text' },
  { value: 'audio', label: 'Audio' },
  { value: 'datei', label: 'Sonstiges' },
]

export default function MaterialManager({ sessionId, programmId }) {
  const [materialien, setMaterialien] = useState([])
  const [loading, setLoading] = useState(true)
  const [titel, setTitel] = useState('')
  const [dateiUrl, setDateiUrl] = useState('')
  const [typ, setTyp] = useState('')
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editTitel, setEditTitel] = useState('')
  const [editDateiUrl, setEditDateiUrl] = useState('')
  const [editTyp, setEditTyp] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  async function loadMaterialien() {
    setLoading(true)
    try {
      const data = await adminFetch(
        `/api/admin/sessions?resource=materials&session_id=${sessionId}`,
      )
      setMaterialien(
        (data.materialien ?? []).sort((a, b) => a.reihenfolge - b.reihenfolge),
      )
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
      await adminFetch('/api/admin/sessions?resource=materials', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          titel,
          datei_url: dateiUrl,
          typ: typ || null,
          reihenfolge: materialien.length,
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
      await adminFetch(`/api/admin/sessions?resource=materials&id=${id}`, {
        method: 'DELETE',
      })
      await loadMaterialien()
    } catch (err) {
      setError(err.message)
    }
  }

  function startEdit(material) {
    setEditingId(material.id)
    setEditTitel(material.titel)
    setEditDateiUrl(material.datei_url)
    setEditTyp(material.typ ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleUpdate(event) {
    event.preventDefault()
    setError('')
    setEditSubmitting(true)
    try {
      await adminFetch('/api/admin/sessions?resource=materials', {
        method: 'PATCH',
        body: JSON.stringify({
          id: editingId,
          titel: editTitel,
          datei_url: editDateiUrl,
          typ: editTyp || null,
        }),
      })
      setEditingId(null)
      await loadMaterialien()
    } catch (err) {
      setError(err.message)
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleMove(index, direction) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= materialien.length) return

    const a = materialien[index]
    const b = materialien[targetIndex]

    setError('')
    try {
      await Promise.all([
        adminFetch('/api/admin/sessions?resource=materials', {
          method: 'PATCH',
          body: JSON.stringify({ id: a.id, reihenfolge: b.reihenfolge }),
        }),
        adminFetch('/api/admin/sessions?resource=materials', {
          method: 'PATCH',
          body: JSON.stringify({ id: b.id, reihenfolge: a.reihenfolge }),
        }),
      ])
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
          {materialien.map((material, index) => (
            <li key={material.id} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>
                  {material.titel}
                  {material.typ ? ` (${material.typ})` : ''}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-xs transition hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMove(index, 1)}
                    disabled={index === materialien.length - 1}
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-xs transition hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() =>
                      editingId === material.id ? cancelEdit() : startEdit(material)
                    }
                    className="text-xs text-mrh-navy hover:underline"
                  >
                    {editingId === material.id ? 'Abbrechen' : 'Bearbeiten'}
                  </button>
                  <button
                    onClick={() => handleDelete(material.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Entfernen
                  </button>
                </div>
              </div>

              {editingId === material.id && (
                <form
                  onSubmit={handleUpdate}
                  className="mt-2 grid gap-2 rounded-lg bg-white p-2 sm:grid-cols-4"
                >
                  <input
                    type="text"
                    placeholder="Titel"
                    required
                    value={editTitel}
                    onChange={(e) => setEditTitel(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                  />
                  <input
                    type="text"
                    placeholder="Storage-Pfad"
                    required
                    value={editDateiUrl}
                    onChange={(e) => setEditDateiUrl(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy sm:col-span-2"
                  />
                  <select
                    value={editTyp}
                    onChange={(e) => setEditTyp(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                  >
                    {TYP_OPTIONEN.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="rounded-lg bg-mrh-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50 sm:col-span-4"
                  >
                    {editSubmitting ? 'Speichert…' : 'Änderungen speichern'}
                  </button>
                </form>
              )}
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
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
        />
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            type="text"
            placeholder="Storage-Pfad (z. B. <programm-id>/03.01/Workbook.pdf)"
            required
            value={dateiUrl}
            onChange={(e) => setDateiUrl(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
          />
          <MaterialUpload programmId={programmId} onUploaded={setDateiUrl} />
        </div>
        <select
          value={typ}
          onChange={(e) => setTyp(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
        >
          {TYP_OPTIONEN.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400 sm:col-span-4">
          Pfad relativ zum privaten Bucket „Programme“, oberster Ordner muss
          exakt der programm_id (UUID) entsprechen, z. B.
          f47ac10b-58cc-4372-a567-0e02b2c3d479/03.01/F1_Workbook.pdf -- kein
          volles http(s)-Link mehr.
        </p>
        <button
          type="submit"
          className="rounded-lg bg-mrh-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark sm:col-span-4"
        >
          Material hinzufügen
        </button>
      </form>
    </div>
  )
}
