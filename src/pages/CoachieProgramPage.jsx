import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { toYoutubeEmbedUrl } from '../lib/youtube'

const STATUS_OPTIONEN = [
  { value: 'offen', label: 'Offen' },
  { value: 'in_bearbeitung', label: 'In Bearbeitung' },
  { value: 'abgeschlossen', label: 'Abgeschlossen' },
]

function SessionCard({ session, coachieId, status, onStatusChange }) {
  const [auswahl, setAuswahl] = useState(status?.status ?? 'offen')
  const [notiz, setNotiz] = useState(status?.notiz ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const embedUrl = toYoutubeEmbedUrl(session.video_url)

  async function handleSave() {
    setSaving(true)
    setSaved(false)

    const { data, error } = await supabase
      .from('coachie_status')
      .upsert(
        {
          id: status?.id,
          coachie_id: coachieId,
          session_id: session.id,
          status: auswahl,
          notiz,
          aktualisiert_am: new Date().toISOString(),
        },
        { onConflict: 'coachie_id,session_id' },
      )
      .select()
      .single()

    setSaving(false)

    if (!error && data) {
      setSaved(true)
      onStatusChange(session.id, data)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-3 font-semibold text-slate-800">{session.titel}</h3>
      {session.beschreibung && (
        <p className="mb-4 text-sm text-slate-500">{session.beschreibung}</p>
      )}

      {embedUrl && (
        <div className="mb-4 aspect-video overflow-hidden rounded-lg bg-black">
          <iframe
            src={embedUrl}
            title={session.titel}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        {session.workbook_url && (
          <a
            href={session.workbook_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#2563eb] px-3 py-1.5 text-[#2563eb] transition hover:bg-[#2563eb] hover:text-white"
          >
            Workbook öffnen
          </a>
        )}
      </div>

      {session.materialien?.length > 0 && (
        <div className="mb-4">
          <p className="mb-1 text-sm font-medium text-slate-700">Materialien</p>
          <ul className="space-y-1 text-sm">
            {session.materialien.map((material) => (
              <li key={material.id}>
                <a
                  href={material.datei_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#2563eb] hover:underline"
                >
                  {material.titel}
                  {material.typ ? ` (${material.typ})` : ''}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-2 text-sm font-medium text-slate-700">Dein Status</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {STATUS_OPTIONEN.map((option) => (
            <button
              key={option.value}
              onClick={() => setAuswahl(option.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                auswahl === option.value
                  ? 'bg-[#2563eb] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <textarea
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder="Notiz (optional)"
          rows={2}
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#152a45] disabled:opacity-50"
        >
          {saving ? 'Speichert…' : saved ? 'Gespeichert ✓' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

export default function CoachieProgramPage() {
  const { programId } = useParams()
  const { coachie } = useAuth()
  const [programm, setProgramm] = useState(null)
  const [sessions, setSessions] = useState([])
  const [statusMap, setStatusMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!coachie?.id) return

    let cancelled = false

    async function loadProgramm() {
      setLoading(true)
      setError('')

      const { data: programmData, error: programmError } = await supabase
        .from('programme')
        .select('*')
        .eq('id', programId)
        .single()

      if (programmError || !programmData) {
        if (!cancelled) {
          setError('Programm konnte nicht geladen werden.')
          setLoading(false)
        }
        return
      }

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*, session_material(*)')
        .eq('programm_id', programId)
        .order('reihenfolge', { ascending: true })

      if (sessionsError) {
        if (!cancelled) {
          setError('Sessions konnten nicht geladen werden.')
          setLoading(false)
        }
        return
      }

      const sessionIds = (sessionsData ?? []).map((s) => s.id)
      let statusListe = []

      if (sessionIds.length > 0) {
        const { data: statusData } = await supabase
          .from('coachie_status')
          .select('*')
          .eq('coachie_id', coachie.id)
          .in('session_id', sessionIds)

        statusListe = statusData ?? []
      }

      if (!cancelled) {
        setProgramm(programmData)
        setSessions(
          (sessionsData ?? []).map((s) => ({
            ...s,
            materialien: s.session_material,
          })),
        )
        setStatusMap(
          Object.fromEntries(statusListe.map((s) => [s.session_id, s])),
        )
        setLoading(false)
      }
    }

    loadProgramm()

    return () => {
      cancelled = true
    }
  }, [coachie, programId])

  function handleStatusChange(sessionId, newStatus) {
    setStatusMap((prev) => ({ ...prev, [sessionId]: newStatus }))
  }

  if (loading) {
    return <p className="text-slate-500">Lädt…</p>
  }

  if (error) {
    return <p className="text-red-600">{error}</p>
  }

  return (
    <div>
      <Link
        to="/coachie"
        className="mb-4 inline-block text-sm text-[#2563eb] hover:underline"
      >
        ← Zurück zur Übersicht
      </Link>
      <h1 className="mb-1 text-2xl font-semibold text-[#1e3a5f]">
        {programm.titel}
      </h1>
      {programm.beschreibung && (
        <p className="mb-6 text-slate-500">{programm.beschreibung}</p>
      )}

      {sessions.length === 0 ? (
        <p className="text-slate-500">Für dieses Programm sind noch keine Sessions hinterlegt.</p>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              coachieId={coachie.id}
              status={statusMap[session.id]}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
