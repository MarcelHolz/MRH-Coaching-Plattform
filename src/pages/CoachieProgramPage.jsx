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

function StatusIcon({ status }) {
  if (status === 'abgeschlossen') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mrh-orange text-white">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    )
  }

  if (status === 'in_bearbeitung') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-mrh-navy">
        <span className="h-2 w-2 rounded-full bg-mrh-navy" />
      </span>
    )
  }

  return <span className="h-6 w-6 shrink-0 rounded-full border-2 border-slate-300" />
}

function formatDatum(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function SessionRow({ session, coachieId, status, onStatusChange, open, onToggle }) {
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
    <div className="rounded-xl bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <StatusIcon status={status?.status ?? 'offen'} />
        <span className="flex-1 font-medium text-slate-800">{session.titel}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-mrh-grey transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M5.2 7.2a1 1 0 0 1 1.4 0L10 10.6l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 8.6a1 1 0 0 1 0-1.4Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4">
          {session.beschreibung && (
            <p className="mb-4 text-sm text-mrh-grey">{session.beschreibung}</p>
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
                className="rounded-lg border border-mrh-navy px-3 py-1.5 text-mrh-navy transition hover:bg-mrh-navy hover:text-white"
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
                      className="text-mrh-navy hover:underline"
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
                      ? option.value === 'abgeschlossen'
                        ? 'bg-mrh-orange text-white'
                        : 'bg-mrh-navy text-white'
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
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
            >
              {saving ? 'Speichert…' : saved ? 'Gespeichert ✓' : 'Speichern'}
            </button>
          </div>
        </div>
      )}
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
  const [openId, setOpenId] = useState(null)

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
        .maybeSingle()

      if (programmError || !programmData) {
        if (!cancelled) {
          const { data: zuordnung } = await supabase
            .from('coachie_programme')
            .select('zugriff_bis')
            .eq('coachie_id', coachie.id)
            .eq('programm_id', programId)
            .maybeSingle()

          const abgelaufen =
            zuordnung?.zugriff_bis && new Date(zuordnung.zugriff_bis) < new Date()

          setError(
            abgelaufen
              ? 'Der Zugriff auf dieses Programm ist abgelaufen. Melde dich bei Marcel für eine Verlängerung.'
              : 'Programm konnte nicht geladen werden.',
          )
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
    return <p className="text-mrh-grey">Lädt…</p>
  }

  if (error) {
    return <p className="text-red-600">{error}</p>
  }

  const abgeschlossen = sessions.filter(
    (s) => statusMap[s.id]?.status === 'abgeschlossen',
  ).length
  const prozent =
    sessions.length > 0 ? Math.round((abgeschlossen / sessions.length) * 100) : 0
  const begonnen = Object.keys(statusMap).length > 0
  const letzteAktivitaetText = formatDatum(
    Object.values(statusMap)
      .map((s) => s.aktualisiert_am)
      .filter(Boolean)
      .sort()
      .at(-1),
  )
  const naechsteSession = sessions.find(
    (s) => statusMap[s.id]?.status !== 'abgeschlossen',
  )

  return (
    <div>
      <Link
        to="/coachie"
        className="mb-4 inline-block text-sm text-mrh-navy hover:underline"
      >
        ← Zurück zur Übersicht
      </Link>

      <div className="rounded-2xl bg-mrh-navy px-8 py-10 text-white">
        <h1 className="text-2xl font-semibold">{programm.titel}</h1>
        {programm.beschreibung && (
          <p className="mt-2 text-sm text-white/70">{programm.beschreibung}</p>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="mt-6 text-mrh-grey">Noch keine Sessions hinterlegt.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-6 mt-6">
              {letzteAktivitaetText && (
                <p className="text-xs text-mrh-grey">
                  Letzte Aktivität {letzteAktivitaetText}
                </p>
              )}
              <p className="mt-1 text-sm font-semibold text-mrh-navy">
                {prozent}% abgeschlossen
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-mrh-orange transition-all"
                  style={{ width: `${prozent}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  coachieId={coachie.id}
                  status={statusMap[session.id]}
                  onStatusChange={handleStatusChange}
                  open={openId === session.id}
                  onToggle={() =>
                    setOpenId(openId === session.id ? null : session.id)
                  }
                />
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="-mt-24 overflow-hidden rounded-xl bg-white shadow-lg">
              <img
                src="/brand/marcel-hemd.webp"
                alt=""
                className="h-40 w-full object-cover"
              />
              <div className="p-5">
                <span
                  className={`mb-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    begonnen
                      ? 'bg-mrh-orange/15 text-mrh-orange-dark'
                      : 'bg-mrh-navy/10 text-mrh-navy'
                  }`}
                >
                  {begonnen ? 'Begonnen' : 'Programm starten'}
                </span>
                {naechsteSession && (
                  <button
                    onClick={() => setOpenId(naechsteSession.id)}
                    className="block w-full rounded-lg bg-mrh-navy py-2 text-center text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
                  >
                    Fortsetzen
                  </button>
                )}
                <p className="mt-4 text-xs font-medium uppercase tracking-wide text-mrh-grey">
                  Kursinhalt
                </p>
                <p className="text-sm text-slate-700">{sessions.length} Sessions</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
