import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminFetch } from '../lib/adminFetch'
import MaterialManager from './MaterialManager'

export default function AdminProgramDetailPage() {
  const { programId } = useParams()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [titel, setTitel] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [workbookUrl, setWorkbookUrl] = useState('')
  const [expandedId, setExpandedId] = useState(null)

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

  useEffect(() => {
    loadSessions()
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
          workbook_url: workbookUrl,
          reihenfolge: sessions.length,
        }),
      })
      setTitel('')
      setBeschreibung('')
      setVideoUrl('')
      setWorkbookUrl('')
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
        className="mb-4 inline-block text-sm text-[#2563eb] hover:underline"
      >
        ← Zurück zu Programme
      </Link>
      <h1 className="mb-6 text-2xl font-semibold text-[#1e3a5f]">
        Sessions verwalten
      </h1>

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
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
        />
        <input
          type="text"
          placeholder="Beschreibung"
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
        />
        <input
          type="url"
          placeholder="Video-URL (YouTube)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
        />
        <input
          type="url"
          placeholder="Workbook-URL"
          value={workbookUrl}
          onChange={(e) => setWorkbookUrl(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
        />
        <button
          type="submit"
          className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1e4fc4] sm:col-span-2"
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

              {expandedId === session.id && (
                <MaterialManager sessionId={session.id} />
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
