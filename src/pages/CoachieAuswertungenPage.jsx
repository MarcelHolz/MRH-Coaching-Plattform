import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { TEST_TYP_LABEL } from '../lib/testergebnisse'

function formatDatum(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function CoachieAuswertungenPage() {
  const { coachie } = useAuth()
  const [ergebnisse, setErgebnisse] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!coachie?.id) return

    let cancelled = false

    async function laden() {
      setLoading(true)
      setError('')

      const { data, error: ladeFehler } = await supabase
        .from('coachie_testergebnisse')
        .select('*')
        .eq('coachie_id', coachie.id)
        .order('verknuepft_am', { ascending: false })

      if (!cancelled) {
        if (ladeFehler) {
          setError('Auswertungen konnten nicht geladen werden.')
        } else {
          setErgebnisse(data ?? [])
        }
        setLoading(false)
      }
    }

    laden()

    return () => {
      cancelled = true
    }
  }, [coachie])

  if (loading) {
    return <p className="text-mrh-grey">Lädt…</p>
  }

  if (error) {
    return <p className="text-red-600">{error}</p>
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-mrh-navy">
        Meine Auswertungen
      </h1>

      {ergebnisse.length === 0 ? (
        <p className="text-mrh-grey">
          Noch keine Testergebnisse verknüpft. Melde dich bei Marcel.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {ergebnisse.map((ergebnis) => {
            const daten = ergebnis.ergebnis_daten ?? {}
            return (
              <div key={ergebnis.id} className="rounded-xl bg-white p-5 shadow-sm">
                <h3 className="mb-1 font-semibold text-slate-800">
                  {TEST_TYP_LABEL[ergebnis.test_typ] ?? ergebnis.test_typ}
                </h3>
                <p className="mb-3 text-xs text-mrh-grey">
                  {formatDatum(ergebnis.verknuepft_am)}
                </p>
                {daten.hauptausprägung && (
                  <p className="mb-1 text-sm text-slate-700">
                    Dominanter Typ:{' '}
                    <span className="font-medium">{daten.hauptausprägung}</span>
                    {daten.ist_mischtyp && daten.zweittyp
                      ? ` (Mischtyp mit ${daten.zweittyp})`
                      : ''}
                  </p>
                )}
                {ergebnis.pdf_url && (
                  <a
                    href={ergebnis.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm text-mrh-navy hover:underline"
                  >
                    Vollständigen Bericht öffnen ↗
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
