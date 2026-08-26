import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminFetch } from '../lib/adminFetch'
import MaterialManager from './MaterialManager'
import MarkdownFeld from './MarkdownFeld'
import ModuleManager from './ModuleManager'

export default function AdminProgramDetailPage() {
  const { programId } = useParams()
  const [sessions, setSessions] = useState([])
  const [module, setModule] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [titel, setTitel] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [bildUrl, setBildUrl] = useState('')
  const [dauerMinuten, setDauerMinuten] = useState('')
  const [modulId, setModulId] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [editTitel, setEditTitel] = useState('')
  const [editBeschreibung, setEditBeschreibung] = useState('')
  const [editVideoUrl, setEditVideoUrl] = useState('')
  const [editBildUrl, setEditBildUrl] = useState('')
  const [editDauerMinuten, setEditDauerMinuten] = useState('')
  const [editModulId, setEditModulId] = useState('')
  const [editReihenfolge, setEditReihenfolge] = useState(0)
  const [editSubmitting, setEditSubmitting] = useState(false)

  async function loadSessions() {
    setLoading(true)
    setError('')
    try {
      const data = await adminFetch(
        `/api/admin/sessions?programm_id=${programId}`,
      )
      setSessions(
        (data.sessions ?? []).sort((a, b) => a.reihenfolge - b.reihenfolge),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadModule() {
    try {
      const data = await adminFetch(
        `/api/admin/sessions?resource=module&programm_id=${programId}`,
      )
      setModule(
        (data.module ?? []).sort((a, b) => a.reihenfolge - b.reihenfolge),
      )
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadSessions()
    loadModule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId])

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    try {
      await adminFetch('/api/admin/sessions', {
        method: 'POST',
        body: JSON.stringify({
          programm_id: programId,
          titel,
          beschreibung,
          video_url: videoUrl,
          bild_url: bildUrl,
          dauer_minuten: dauerMinuten ? Math.round(Number(dauerMinuten)) : null,
          modul_id: modulId || null,
          reihenfolge: sessions.length,
        }),
      })
      setTitel('')
      setBeschreibung('')
      setVideoUrl('')
      setBildUrl('')
      setDauerMinuten('')
      setModulId('')
      await loadSessions()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    setError('')
    try {
      await adminFetch(`/api/admin/sessions?id=${id}`, { method: 'DELETE' })
      await loadSessions()
    } catch (err) {
      setError(err.message)
    }
  }

  function startEdit(session) {
    setExpandedId(null)
    setEditingId(session.id)
    setEditTitel(session.titel)
    setEditBeschreibung(session.beschreibung ?? '')
    setEditVideoUrl(session.video_url ?? '')
    setEditBildUrl(session.bild_url ?? '')
    setEditDauerMinuten(
      session.dauer_minuten != null ? String(session.dauer_minuten) : '',
    )
    setEditModulId(session.modul_id ?? '')
    setEditReihenfolge(session.reihenfolge)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleUpdate(event) {
    event.preventDefault()
    setError('')
    setEditSubmitting(true)
    try {
      await adminFetch('/api/admin/sessions', {
        method: 'PATCH',
        body: JSON.stringify({
          id: editingId,
          titel: editTitel,
          beschreibung: editBeschreibung,
          video_url: editVideoUrl,
          bild_url: editBildUrl,
          dauer_minuten: editDauerMinuten
            ? Math.round(Number(editDauerMinuten))
            : null,
          modul_id: editModulId || null,
          reihenfolge: Number(editReihenfolge),
        }),
      })
      setEditingId(null)
      await loadSessions()
    } catch (err) {
      setError(err.message)
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleMove(index, direction) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= sessions.length) return

    const a = sessions[index]
    const b = sessions[targetIndex]

    setError('')
    try {
      await Promise.all([
        adminFetch('/api/admin/sessions', {
          method: 'PATCH',
          body: JSON.stringify({ id: a.id, reihenfolge: b.reihenfolge }),
        }),
        adminFetch('/api/admin/sessions', {
          method: 'PATCH',
          body: JSON.stringify({ id: b.id, reihenfolge: a.reihenfolge }),
        }),
      ])
      await loadSessions()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <Link
        to="/admin/programme"
        className="mb-4 inline-block text-sm text-mrh-navy hover:underline"
      >
        ← Zurück zu Programme
      </Link>
      <h1 className="mb-6 text-2xl font-semibold text-mrh-navy">
        Sessions verwalten
      </h1>

      <ModuleManager programId={programId} module={module} onChange={loadModule} />

      <form
        onSubmit={handleCreate}
        className="mb-8 grid gap-3 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <input
          type="text"
          placeholder="Titel"
          required
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
        />
        <div className="sm:col-span-2">
          <MarkdownFeld
            value={beschreibung}
            onChange={setBeschreibung}
            placeholder="Beschreibung (optional, mit **fett**, # Überschrift, - Liste)"
            rows={3}
          />
        </div>
        <input
          type="url"
          placeholder="Video-URL (YouTube)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
        />
        <input
          type="url"
          placeholder="Bild-URL"
          value={bildUrl}
          onChange={(e) => setBildUrl(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
        />
        <input
          type="number"
          min="0"
          placeholder="Dauer in Minuten (optional)"
          value={dauerMinuten}
          onChange={(e) => setDauerMinuten(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
        />
        <select
          value={modulId}
          onChange={(e) => setModulId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy sm:col-span-2"
        >
          <option value="">Kein Modul (direkt unter dem Programm)</option>
          {module.map((modul) => (
            <option key={modul.id} value={modul.id}>
              {modul.titel}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark sm:col-span-2"
        >
          Session anlegen
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-slate-500">Lädt…</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, index) => (
            <div key={session.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-800">
                    {session.titel}
                  </h2>
                  {session.modul_id && (
                    <p className="text-xs text-mrh-gold-dark">
                      Modul:{' '}
                      {module.find((m) => m.id === session.modul_id)?.titel ??
                        '–'}
                    </p>
                  )}
                  {session.beschreibung && (
                    <p className="text-sm text-slate-500">
                      {session.beschreibung}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm transition hover:bg-slate-50 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMove(index, 1)}
                    disabled={index === sessions.length - 1}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm transition hover:bg-slate-50 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() =>
                      editingId === session.id ? cancelEdit() : startEdit(session)
                    }
                    className="rounded-lg border border-slate-300 px-3 py-1 text-sm transition hover:bg-slate-50"
                  >
                    {editingId === session.id ? 'Abbrechen' : 'Bearbeiten'}
                  </button>
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === session.id ? null : session.id)
                    }
                    className="rounded-lg border border-slate-300 px-3 py-1 text-sm transition hover:bg-slate-50"
                  >
                    {expandedId === session.id ? 'Schließen' : 'Materialien'}
                  </button>
                  <button
                    onClick={() => handleDelete(session.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Löschen
                  </button>
                </div>
              </div>

              {editingId === session.id && (
                <form
                  onSubmit={handleUpdate}
                  className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2"
                >
                  <input
                    type="text"
                    placeholder="Titel"
                    required
                    value={editTitel}
                    onChange={(e) => setEditTitel(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                  />
                  <input
                    type="number"
                    placeholder="Reihenfolge"
                    required
                    value={editReihenfolge}
                    onChange={(e) => setEditReihenfolge(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                  />
                  <div className="sm:col-span-2">
                    <MarkdownFeld
                      value={editBeschreibung}
                      onChange={setEditBeschreibung}
                      placeholder="Beschreibung (optional, mit **fett**, # Überschrift, - Liste)"
                      rows={3}
                    />
                  </div>
                  <input
                    type="url"
                    placeholder="Video-URL (YouTube)"
                    value={editVideoUrl}
                    onChange={(e) => setEditVideoUrl(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                  />
                  <input
                    type="url"
                    placeholder="Bild-URL"
                    value={editBildUrl}
                    onChange={(e) => setEditBildUrl(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Dauer in Minuten (optional)"
                    value={editDauerMinuten}
                    onChange={(e) => setEditDauerMinuten(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                  />
                  <select
                    value={editModulId}
                    onChange={(e) => setEditModulId(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy sm:col-span-2"
                  >
                    <option value="">Kein Modul (direkt unter dem Programm)</option>
                    {module.map((modul) => (
                      <option key={modul.id} value={modul.id}>
                        {modul.titel}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50 sm:col-span-2"
                  >
                    {editSubmitting ? 'Speichert…' : 'Änderungen speichern'}
                  </button>
                </form>
              )}

              {expandedId === session.id && (
                <MaterialManager sessionId={session.id} programmId={programId} />
              )}
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-slate-500">Noch keine Sessions angelegt.</p>
          )}
        </div>
      )}
    </div>
  )
}
