import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { toYoutubeEmbedUrl } from '../lib/youtube'
import { getSignedMaterialUrl } from '../lib/storage'
import { renderMarkdown } from '../lib/markdown'

const STATUS_OPTIONEN = [
  { value: 'offen', label: 'Offen' },
  { value: 'in_bearbeitung', label: 'In Bearbeitung' },
  { value: 'abgeschlossen', label: 'Abgeschlossen' },
]

function StatusIcon({ status }) {
  if (status === 'abgeschlossen') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mrh-gold text-white">
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

// Kanonische Reihenfolge für "nächste offene Session"-Logik (Fortsetzen-
// Button, Auto-Start bei ?start=1): erst modullose Sessions, danach die
// Module in ihrer Reihenfolge -- exakt dieselbe Regel wie für die
// Anzeige, damit "nächste Session" nicht die rohe, programmweite
// reihenfolge-Spalte nutzt, die Modul-Zugehörigkeit ignoriert.
function ordneSessionsNachModul(sessions, module) {
  const modulLose = sessions.filter((s) => !s.modul_id)
  const inModulen = module.flatMap((modul) =>
    sessions.filter((s) => s.modul_id === modul.id),
  )
  return [...modulLose, ...inModulen]
}

function formatDatum(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function MaterialZeile({ material }) {
  const [ladend, setLadend] = useState(false)
  const [fehler, setFehler] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)

  async function signierteUrlOeffnen() {
    setFehler(false)
    setLadend(true)
    try {
      const url = await getSignedMaterialUrl(material.datei_url)
      window.open(url, '_blank', 'noopener')
    } catch {
      setFehler(true)
    } finally {
      setLadend(false)
    }
  }

  async function audioLaden() {
    setFehler(false)
    setLadend(true)
    try {
      const url = await getSignedMaterialUrl(material.datei_url)
      setAudioUrl(url)
    } catch {
      setFehler(true)
    } finally {
      setLadend(false)
    }
  }

  if (material.typ === 'audio') {
    return (
      <li>
        {audioUrl ? (
          <audio controls autoPlay src={audioUrl} className="w-full" />
        ) : (
          <button
            type="button"
            onClick={audioLaden}
            disabled={ladend}
            className="text-mrh-navy hover:underline disabled:opacity-50"
          >
            {ladend ? 'Lädt…' : `${material.titel} abspielen`}
          </button>
        )}
        {fehler && (
          <p className="text-xs text-red-600">Datei konnte nicht geladen werden.</p>
        )}
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        onClick={signierteUrlOeffnen}
        disabled={ladend}
        className="text-mrh-navy hover:underline disabled:opacity-50"
      >
        {ladend ? 'Lädt…' : material.titel}
        {material.typ ? ` (${material.typ})` : ''}
      </button>
      {fehler && (
        <p className="text-xs text-red-600">Datei konnte nicht geladen werden.</p>
      )}
    </li>
  )
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
            <div
              className="markdown-inhalt mb-4 text-sm text-mrh-grey"
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(session.beschreibung),
              }}
            />
          )}

          {!embedUrl && session.bild_url && (
            <div className="mb-4 overflow-hidden rounded-lg">
              <img
                src={session.bild_url}
                alt=""
                className="w-full object-cover"
              />
            </div>
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
                  <MaterialZeile key={material.id} material={material} />
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
                        ? 'bg-mrh-gold text-white'
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

function ModulKarte({
  modul,
  sessions,
  statusMap,
  coachieId,
  onStatusChange,
  open,
  onToggle,
  openSessionId,
  onToggleSession,
}) {
  const abgeschlossen = sessions.filter(
    (s) => statusMap[s.id]?.status === 'abgeschlossen',
  ).length
  const prozent =
    sessions.length > 0 ? Math.round((abgeschlossen / sessions.length) * 100) : 0
  const begonnen = sessions.some((s) => statusMap[s.id])

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-5 py-4 text-left"
      >
        {modul.bild_url && (
          <img
            src={modul.bild_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <span
            className={`mb-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              prozent === 100
                ? 'bg-mrh-gold text-white'
                : begonnen
                  ? 'bg-mrh-gold/15 text-mrh-gold-dark'
                  : 'bg-mrh-navy/10 text-mrh-navy'
            }`}
          >
            {prozent === 100
              ? 'Abgeschlossen'
              : begonnen
                ? 'Begonnen'
                : 'Noch nicht begonnen'}
          </span>
          <p className="font-semibold text-slate-800">{modul.titel}</p>
          {modul.beschreibung && (
            <p
              className={`mt-1 text-sm text-mrh-grey ${open ? '' : 'line-clamp-2'}`}
            >
              {modul.beschreibung}
            </p>
          )}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-mrh-gold transition-all"
              style={{ width: `${prozent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-mrh-grey">
            {abgeschlossen} von {sessions.length} Sessions abgeschlossen
          </p>
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`mt-1 h-4 w-4 shrink-0 text-mrh-grey transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M5.2 7.2a1 1 0 0 1 1.4 0L10 10.6l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 8.6a1 1 0 0 1 0-1.4Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-100 p-5">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              coachieId={coachieId}
              status={statusMap[session.id]}
              onStatusChange={onStatusChange}
              open={openSessionId === session.id}
              onToggle={() => onToggleSession(session.id)}
            />
          ))}
          {sessions.length === 0 && (
            <p className="text-sm text-mrh-grey">
              Noch keine Sessions in diesem Modul.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function CoachieProgramPage() {
  const { programId } = useParams()
  const { coachie } = useAuth()
  const [searchParams] = useSearchParams()
  const [programm, setProgramm] = useState(null)
  const [sessions, setSessions] = useState([])
  const [module, setModule] = useState([])
  const [statusMap, setStatusMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [offenesModulId, setOffenesModulId] = useState(null)
  const [autoStartErledigt, setAutoStartErledigt] = useState(false)
  const [zielText, setZielText] = useState(null)
  const [zielPromptAusgeblendet, setZielPromptAusgeblendet] = useState(false)
  const [zielEingabe, setZielEingabe] = useState('')
  const [zielSpeichert, setZielSpeichert] = useState(false)
  const [erfolgAnzeigen, setErfolgAnzeigen] = useState(false)

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
        .order('reihenfolge', {
          ascending: true,
          referencedTable: 'session_material',
        })

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

      const { data: zuordnungData } = await supabase
        .from('coachie_programme')
        .select('ziel_text')
        .eq('coachie_id', coachie.id)
        .eq('programm_id', programId)
        .maybeSingle()

      const { data: modulData } = await supabase
        .from('module')
        .select('*')
        .eq('programm_id', programId)
        .order('reihenfolge', { ascending: true })

      if (!cancelled) {
        setProgramm(programmData)
        setSessions(
          (sessionsData ?? []).map((s) => ({
            ...s,
            materialien: s.session_material,
          })),
        )
        setModule(modulData ?? [])
        setStatusMap(
          Object.fromEntries(statusListe.map((s) => [s.session_id, s])),
        )
        setZielText(zuordnungData?.ziel_text ?? null)
        setLoading(false)
      }
    }

    loadProgramm()

    return () => {
      cancelled = true
    }
  }, [coachie, programId])

  useEffect(() => {
    // Aktives Onboarding (Punkt 1): direkter Sprung in die erste offene
    // Session, wenn von der Dashboard-Weiterleitung mit ?start=1 verlinkt.
    if (autoStartErledigt || loading) return
    if (searchParams.get('start') !== '1') return
    if (sessions.length === 0) return

    const geordnet = ordneSessionsNachModul(sessions, module)
    const ziel =
      geordnet.find((s) => statusMap[s.id]?.status !== 'abgeschlossen') ??
      geordnet[0]
    setOpenId(ziel.id)
    if (ziel.modul_id) setOffenesModulId(ziel.modul_id)
    setAutoStartErledigt(true)
  }, [autoStartErledigt, loading, sessions, module, statusMap, searchParams])

  function handleStatusChange(sessionId, newStatus) {
    setStatusMap((prev) => {
      const updated = { ...prev, [sessionId]: newStatus }

      // Abschluss-Moment (Punkt 5): Trigger ist ausschließlich der
      // Übergang von <100% auf 100% Fortschritt in diesem Moment, kein
      // eigenes DB-Feld -- ein bereits vorher abgeschlossenes Programm
      // löst beim erneuten Öffnen die Ansicht daher nicht erneut aus.
      if (sessions.length > 0) {
        const vorher = sessions.filter(
          (s) => prev[s.id]?.status === 'abgeschlossen',
        ).length
        const nachher = sessions.filter(
          (s) => updated[s.id]?.status === 'abgeschlossen',
        ).length
        if (vorher < sessions.length && nachher === sessions.length) {
          setErfolgAnzeigen(true)
        }
      }

      return updated
    })
  }

  async function handleZielSpeichern(event) {
    event.preventDefault()
    const wert = zielEingabe.trim()
    setZielSpeichert(true)

    const { error: zielError } = await supabase
      .from('coachie_programme')
      .update({ ziel_text: wert || null })
      .eq('coachie_id', coachie.id)
      .eq('programm_id', programId)

    setZielSpeichert(false)

    if (!zielError) {
      setZielText(wert || null)
      setZielPromptAusgeblendet(true)
    }
  }

  function handleZielUeberspringen() {
    setZielPromptAusgeblendet(true)
  }

  if (loading) {
    return <p className="text-mrh-grey">Lädt…</p>
  }

  if (error) {
    return <p className="text-red-600">{error}</p>
  }

  if (erfolgAnzeigen) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-mrh-gold text-white">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8">
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <h1 className="mb-3 font-serif text-3xl font-semibold text-mrh-navy">
          Geschafft{coachie?.name ? `, ${coachie.name}` : ''}!
        </h1>
        <p className="mb-6 text-mrh-grey">
          Du hast {programm?.titel} vollständig abgeschlossen -- herzlichen
          Glückwunsch.
        </p>
        {zielText && (
          <div className="mb-8 rounded-xl bg-mrh-navy/5 p-5 text-left">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-mrh-grey">
              Dein Ziel war
            </p>
            <p className="font-serif italic text-mrh-navy">&bdquo;{zielText}&ldquo;</p>
          </div>
        )}
        <Link
          to="/coachie"
          className="inline-block rounded-lg bg-mrh-navy px-6 py-3 text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
        >
          Zurück zum Dashboard
        </Link>
      </div>
    )
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
  // Anzeige- und Fortsetzen-Reihenfolge: erst modullose Sessions in ihrer
  // Reihenfolge, danach die Module in ihrer Reihenfolge mit ihren
  // Sessions darunter (ordneSessionsNachModul). Fortschritt/Prozent oben
  // bleiben unverändert auf Basis aller Sessions, unabhängig von dieser
  // Gruppierung.
  const naechsteSession = ordneSessionsNachModul(sessions, module).find(
    (s) => statusMap[s.id]?.status !== 'abgeschlossen',
  )
  const zielPromptSichtbar = !begonnen && !zielText && !zielPromptAusgeblendet

  const modulLoseSessions = sessions.filter((s) => !s.modul_id)
  const moduleMitSessions = module.map((modul) => ({
    ...modul,
    sessions: sessions.filter((s) => s.modul_id === modul.id),
  }))

  return (
    <div>
      <Link
        to="/coachie"
        className="mb-4 inline-block text-sm text-mrh-navy hover:underline"
      >
        ← Zurück zur Übersicht
      </Link>

      <div className="rounded-2xl bg-mrh-navy px-8 py-10 text-white">
        <h1 className="font-serif text-2xl font-semibold">{programm.titel}</h1>
        {programm.beschreibung && (
          <div
            className="markdown-inhalt mt-2 text-sm text-white/70"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(programm.beschreibung),
            }}
          />
        )}
      </div>

      {zielPromptSichtbar && (
        <form
          onSubmit={handleZielSpeichern}
          className="mt-6 rounded-xl border border-mrh-gold/30 bg-mrh-gold/10 p-5"
        >
          <p className="mb-2 font-serif text-lg font-semibold text-mrh-navy">
            Was soll sich für dich verändert haben, wenn du hier fertig bist?
          </p>
          <p className="mb-3 text-sm text-mrh-grey">
            Ganz kurz reicht. Optional -- du kannst auch ohne Antwort starten.
          </p>
          <textarea
            value={zielEingabe}
            onChange={(e) => setZielEingabe(e.target.value)}
            placeholder="Dein Ziel (optional)"
            rows={2}
            className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={zielSpeichert}
              className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
            >
              {zielSpeichert ? 'Speichert…' : 'Ziel speichern & starten'}
            </button>
            <button
              type="button"
              onClick={handleZielUeberspringen}
              className="text-sm text-mrh-grey hover:underline"
            >
              Überspringen
            </button>
          </div>
        </form>
      )}

      {sessions.length === 0 ? (
        <p className="mt-6 text-mrh-grey">Noch keine Sessions hinterlegt.</p>
      ) : (
        // Eigene Grid-Items statt der früheren -mt-24-Überlappung: die
        // Foto-/"Fortsetzen"-Karte steht am Desktop in einer eigenen
        // Spalte (definierter gap-6-Abstand, keine Überlappung mehr
        // möglich, unabhängig von der Länge des Einleitungstexts oben) und
        // erscheint am Mobile dank order-* direkt nach Titel/
        // Fortschrittsbalken, vor der Session-Liste.
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start">
          <div className="order-1 lg:col-span-2">
            <div className="mt-6">
              {zielText && (
                <p className="mb-2 text-sm italic text-mrh-grey">
                  Dein Ziel: {zielText}
                </p>
              )}
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
                  className="h-full rounded-full bg-mrh-gold transition-all"
                  style={{ width: `${prozent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="order-2 lg:col-span-1 lg:row-span-2">
            <div className="overflow-hidden rounded-xl bg-white shadow-lg">
              <img
                src="/brand/marcel-hemd.webp"
                alt=""
                className="h-40 w-full object-cover object-top"
              />
              <div className="p-5">
                <span
                  className={`mb-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    prozent === 100
                      ? 'bg-mrh-gold text-white'
                      : begonnen
                        ? 'bg-mrh-gold/15 text-mrh-gold-dark'
                        : 'bg-mrh-navy/10 text-mrh-navy'
                  }`}
                >
                  {prozent === 100
                    ? 'Abgeschlossen'
                    : begonnen
                      ? 'Begonnen'
                      : 'Programm starten'}
                </span>
                {naechsteSession && (
                  <button
                    onClick={() => {
                      setOpenId(naechsteSession.id)
                      if (naechsteSession.modul_id) {
                        setOffenesModulId(naechsteSession.modul_id)
                      }
                    }}
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

          <div className="order-3 lg:col-span-2">
            <div className="space-y-3">
              {modulLoseSessions.map((session) => (
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
              {moduleMitSessions.map((modul) => (
                <ModulKarte
                  key={modul.id}
                  modul={modul}
                  sessions={modul.sessions}
                  statusMap={statusMap}
                  coachieId={coachie.id}
                  onStatusChange={handleStatusChange}
                  open={offenesModulId === modul.id}
                  onToggle={() =>
                    setOffenesModulId(offenesModulId === modul.id ? null : modul.id)
                  }
                  openSessionId={openId}
                  onToggleSession={(id) =>
                    setOpenId(openId === id ? null : id)
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
