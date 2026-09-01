import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'
import { TEST_TYP_LABEL } from '../lib/testergebnisse'
import TestergebnisChart from '../components/TestergebnisChart'

// Gleiche Punkte-Extraktion wie in CoachieAuswertungenPage.jsx -- die
// Werte stecken in ergebnis_daten (JSON aus dem Profil-Quiz), nicht in
// einem eigenen Punkte-Feld auf der Zeile selbst.
function ergebnisPunkte(ergebnis) {
  const daten = ergebnis.ergebnis_daten ?? {}
  const punkte = {
    dominant: daten.punkte_dominant,
    kreativ: daten.punkte_kreativ,
    sachlich: daten.punkte_sachlich,
    harmonisch: daten.punkte_harmonisch,
  }
  return Object.values(punkte).some((v) => v != null) ? punkte : null
}

function formatDatum(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function ErgebnisZeile({ ergebnis, onVerknuepfen, verknuepfend }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span>
        <span className="font-medium text-slate-700">
          {TEST_TYP_LABEL[ergebnis.test_typ] ?? ergebnis.test_typ}
        </span>{' '}
        <span className="text-slate-500">
          — {ergebnis.name} ({ergebnis.email}), {formatDatum(ergebnis.erstellt_am)}
          {ergebnis.hauptausprägung ? `, ${ergebnis.hauptausprägung}` : ''}
        </span>
      </span>
      <button
        onClick={() => onVerknuepfen(ergebnis)}
        disabled={verknuepfend}
        className="shrink-0 rounded-lg border border-mrh-navy px-3 py-1 text-xs text-mrh-navy transition hover:bg-mrh-navy hover:text-white disabled:opacity-50"
      >
        {verknuepfend ? 'Verknüpft…' : 'Verknüpfen'}
      </button>
    </li>
  )
}

export default function TestergebnisseManager({ coachieId, coachieEmail }) {
  const [verknuepft, setVerknuepft] = useState([])
  const [vorschlaege, setVorschlaege] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [suchbegriff, setSuchbegriff] = useState('')
  const [sucheLaeuft, setSucheLaeuft] = useState(false)
  const [sucheErgebnisse, setSucheErgebnisse] = useState(null)

  const [verknuepfendId, setVerknuepfendId] = useState(null)
  const [aufgeklapptId, setAufgeklapptId] = useState(null)

  async function laden() {
    setLoading(true)
    setError('')
    try {
      const [verknuepftData, vorschlagData] = await Promise.all([
        adminFetch(`/api/admin/testergebnisse?coachie_id=${coachieId}`),
        adminFetch(
          `/api/admin/testergebnisse?resource=suche&such_email=${encodeURIComponent(coachieEmail)}`,
        ),
      ])
      setVerknuepft(verknuepftData.testergebnisse ?? [])
      setVorschlaege(vorschlagData.ergebnisse ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    laden()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachieId])

  async function handleSuchen(event) {
    event.preventDefault()
    if (!suchbegriff.trim()) return

    setError('')
    setSucheLaeuft(true)
    try {
      const query = encodeURIComponent(suchbegriff.trim())
      const data = await adminFetch(
        `/api/admin/testergebnisse?resource=suche&such_email=${query}&such_name=${query}`,
      )
      setSucheErgebnisse(data.ergebnisse ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSucheLaeuft(false)
    }
  }

  async function handleVerknuepfen(ergebnis) {
    setError('')
    setVerknuepfendId(ergebnis.id)
    try {
      await adminFetch('/api/admin/testergebnisse', {
        method: 'POST',
        body: JSON.stringify({
          coachie_id: coachieId,
          test_typ: ergebnis.test_typ,
          quell_id: ergebnis.id,
        }),
      })
      setSucheErgebnisse(null)
      setSuchbegriff('')
      await laden()
    } catch (err) {
      setError(err.message)
    } finally {
      setVerknuepfendId(null)
    }
  }

  const verknuepfteQuellIds = new Set(verknuepft.map((v) => v.quell_id))
  const offeneVorschlaege = vorschlaege.filter(
    (v) => !verknuepfteQuellIds.has(v.id),
  )

  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Testergebnisse
      </p>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Lädt…</p>
      ) : (
        <>
          {verknuepft.length > 0 && (
            <ul className="mb-3 space-y-1">
              {verknuepft.map((v) => {
                const punkte = ergebnisPunkte(v)
                const offen = aufgeklapptId === v.id

                return (
                  <li key={v.id} className="text-sm text-slate-700">
                    <div
                      role={punkte ? 'button' : undefined}
                      tabIndex={punkte ? 0 : undefined}
                      onClick={() =>
                        punkte && setAufgeklapptId(offen ? null : v.id)
                      }
                      className={`flex items-center justify-between gap-2 ${
                        punkte ? 'cursor-pointer select-none' : ''
                      }`}
                    >
                      <span>
                        ✓ {TEST_TYP_LABEL[v.test_typ] ?? v.test_typ} —{' '}
                        {formatDatum(v.verknuepft_am)}
                      </span>
                      {punkte && (
                        <span className="shrink-0 text-xs text-slate-400">
                          {offen ? '▾' : '▸'}
                        </span>
                      )}
                    </div>

                    {offen && punkte && (
                      <div className="mt-2 rounded-lg bg-white p-3">
                        <TestergebnisChart punkte={punkte} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {offeneVorschlaege.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-slate-500">
                {offeneVorschlaege.length === 1
                  ? '1 passendes Testergebnis gefunden — jetzt verknüpfen?'
                  : `${offeneVorschlaege.length} passende Testergebnisse gefunden — jetzt verknüpfen?`}
              </p>
              <ul className="space-y-1">
                {offeneVorschlaege.map((ergebnis) => (
                  <ErgebnisZeile
                    key={ergebnis.id}
                    ergebnis={ergebnis}
                    onVerknuepfen={handleVerknuepfen}
                    verknuepfend={verknuepfendId === ergebnis.id}
                  />
                ))}
              </ul>
            </div>
          )}

          {verknuepft.length === 0 && offeneVorschlaege.length === 0 && (
            <p className="mb-3 text-sm text-slate-400">
              Keine Testergebnisse mit dieser E-Mail-Adresse gefunden.
            </p>
          )}

          <form onSubmit={handleSuchen} className="flex gap-2">
            <input
              type="text"
              placeholder="Manuelle Suche: Name oder andere E-Mail-Adresse"
              value={suchbegriff}
              onChange={(e) => setSuchbegriff(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
            />
            <button
              type="submit"
              disabled={sucheLaeuft}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-white disabled:opacity-50"
            >
              {sucheLaeuft ? 'Sucht…' : 'Suchen'}
            </button>
          </form>

          {sucheErgebnisse !== null && (
            <ul className="mt-2 space-y-1">
              {sucheErgebnisse.length === 0 && (
                <li className="text-sm text-slate-400">Keine Treffer.</li>
              )}
              {sucheErgebnisse
                .filter((e) => !verknuepfteQuellIds.has(e.id))
                .map((ergebnis) => (
                  <ErgebnisZeile
                    key={ergebnis.id}
                    ergebnis={ergebnis}
                    onVerknuepfen={handleVerknuepfen}
                    verknuepfend={verknuepfendId === ergebnis.id}
                  />
                ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
