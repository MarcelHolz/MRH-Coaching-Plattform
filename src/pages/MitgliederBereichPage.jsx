import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getSignedMitgliederDateiUrl } from '../lib/storage'

const TYP_LABEL = {
  kpi_handbuch: 'KPI-Handbuch',
  audio: 'Audio',
  tipp: 'Tipp',
  sonstiges: 'Sonstiges',
}

function formatDatum(iso) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function InhaltKarte({ inhalt }) {
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState('')

  async function oeffnen() {
    if (inhalt.link_url) {
      window.open(inhalt.link_url, '_blank', 'noreferrer')
      return
    }

    setLaedt(true)
    setFehler('')
    try {
      const url = await getSignedMitgliederDateiUrl(inhalt.datei_url)
      window.open(url, '_blank', 'noreferrer')
    } catch (err) {
      setFehler(err.message)
    } finally {
      setLaedt(false)
    }
  }

  return (
    <li className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-mrh-gold/15 px-2 py-0.5 text-xs font-medium text-mrh-gold-dark">
          {TYP_LABEL[inhalt.typ] ?? inhalt.typ}
        </span>
        <span className="text-xs text-mrh-grey">
          {formatDatum(inhalt.veroeffentlicht_am)}
        </span>
      </div>
      <p className="mb-1 font-semibold text-slate-800">{inhalt.titel}</p>
      {inhalt.beschreibung && (
        <p className="mb-3 text-sm text-slate-600">{inhalt.beschreibung}</p>
      )}
      {fehler && <p className="mb-2 text-xs text-red-600">{fehler}</p>}
      <button
        onClick={oeffnen}
        disabled={laedt}
        className="rounded-lg bg-mrh-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
      >
        {laedt ? 'Lädt…' : inhalt.link_url ? 'Öffnen' : 'Herunterladen'}
      </button>
    </li>
  )
}

// Coachie-seitige Ansicht des Mitgliederbereichs (Punkt 4): nur bei
// aktiver Mitgliedschaft sichtbar, sonst kompakter Upsell-Hinweis auf
// derselben Seite statt eines Fehlers -- wirkt einladender als ein
// blockierter Zugriff. Die eigentliche Absicherung läuft über RLS
// (mitgliedschaften/mitglieder_inhalte), diese Prüfung hier ist nur
// für die richtige UI-Darstellung.
export default function MitgliederBereichPage() {
  const { coachie } = useAuth()
  const [mitgliedschaft, setMitgliedschaft] = useState(null)
  const [inhalte, setInhalte] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!coachie?.id) return
    let cancelled = false

    async function laden() {
      const { data: eigeneMitgliedschaft } = await supabase
        .from('mitgliedschaften')
        .select('status')
        .eq('coachie_id', coachie.id)
        .maybeSingle()

      if (cancelled) return
      setMitgliedschaft(eigeneMitgliedschaft)

      if (eigeneMitgliedschaft?.status === 'aktiv') {
        const { data } = await supabase
          .from('mitglieder_inhalte')
          .select('*')
          .order('veroeffentlicht_am', { ascending: false })

        if (!cancelled) setInhalte(data ?? [])
      }

      if (!cancelled) setLoading(false)
    }

    laden()
    return () => {
      cancelled = true
    }
  }, [coachie])

  if (loading) return null

  const istAktiv = mitgliedschaft?.status === 'aktiv'

  if (!istAktiv) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-mrh-navy">
            Mitgliederbereich
          </h1>
          <p className="mb-4 text-sm text-mrh-grey">
            {mitgliedschaft?.status === 'gekuendigt'
              ? 'Deine Mitgliedschaft ist beendet.'
              : mitgliedschaft?.status === 'zahlung_fehlgeschlagen'
                ? 'Bei deiner letzten Zahlung gab es ein Problem -- bitte prüfe dein Zahlungsmittel.'
                : 'Exklusive Inhalte und Live-Sitzungen für Mitglieder der MRH Community.'}
          </p>
          <Link
            to="/mitgliedschaft"
            className="inline-block rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark"
          >
            Mehr erfahren
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-mrh-navy">Mitgliederbereich</h1>
        <p className="mt-1 text-sm text-mrh-grey">
          Live-Sitzungen findest du unter{' '}
          <Link to="/coachie/termine" className="text-mrh-navy underline">
            Termine
          </Link>
          .
        </p>
      </div>

      {inhalte.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-mrh-grey shadow-sm">
          Aktuell keine Inhalte -- schau später nochmal vorbei.
        </p>
      ) : (
        <ul className="space-y-3">
          {inhalte.map((inhalt) => (
            <InhaltKarte key={inhalt.id} inhalt={inhalt} />
          ))}
        </ul>
      )}
    </div>
  )
}
