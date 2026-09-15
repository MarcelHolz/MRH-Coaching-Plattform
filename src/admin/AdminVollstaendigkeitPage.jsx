import { useState } from 'react'
import { adminFetch } from '../lib/adminFetch'

// Bekannte Bild-Endungen -- wenn ein Material als typ="pdf" gepflegt ist,
// aber die Datei tatsächlich auf eine dieser Endungen läuft (z. B. eine
// Impulskarte als PNG), ist das ein starkes Indiz für einen falsch
// gepflegten Typ.
const BILD_ENDUNGEN = ['png', 'jpg', 'jpeg', 'gif', 'webp']

function dateiendung(datei_url) {
  const basisname = datei_url.split('/').pop() ?? ''
  const punktIndex = basisname.lastIndexOf('.')
  return punktIndex === -1 ? '' : basisname.slice(punktIndex + 1).toLowerCase()
}

// Extrahiert eine Session-Nummer aus einem Text nach dem in dieser
// Plattform üblichen Muster ("...Session_02...", "2. Die Emotionskette",
// "Session 2"). Liefert null, wenn kein Muster gefunden wird -- der
// Verlinkungs-Check greift nur, wenn auf beiden Seiten (Material UND
// Session) eine Nummer erkennbar ist, um falsche Treffer zu vermeiden.
function sessionNummerAus(text) {
  if (!text) return null
  const sessionMuster = text.match(/session[_\s-]?(\d+)/i)
  if (sessionMuster) return Number(sessionMuster[1])
  const fuehrendeNummer = text.match(/^(\d+)[.)]\s/)
  if (fuehrendeNummer) return Number(fuehrendeNummer[1])
  return null
}

// Reine, isoliert testbare Analysefunktion -- prüft ausschließlich auf
// Basis bereits geladener Daten, keine eigenen Netzwerkaufrufe. Liefert
// eine flache Liste von Befunden, jeder mit eindeutigem typ, damit die
// Seite sie gruppiert darstellen kann. Rein aufdeckend: verändert nichts.
export function pruefeVollstaendigkeit({ programme, module, sessions, materialien }) {
  const befunde = []

  function kontext(session) {
    const programm = programme.find((p) => p.id === session.programm_id)
    const modul = module.find((m) => m.id === session.modul_id)
    return {
      programmTitel: programm?.titel ?? '(unbekanntes Programm)',
      modulTitel: modul?.titel ?? 'Kein Modul',
      sessionTitel: session.titel,
      sessionId: session.id,
    }
  }

  for (const session of sessions) {
    const sessionMaterialien = materialien.filter(
      (m) => m.session_id === session.id,
    )

    if (!sessionMaterialien.some((m) => m.typ === 'pdf')) {
      befunde.push({
        typ: 'fehlendes_workbook',
        ...kontext(session),
        hinweis: 'Kein Material vom Typ "pdf" vorhanden.',
      })
    }

    for (const material of sessionMaterialien) {
      if (material.typ === 'pdf') {
        const endung = dateiendung(material.datei_url)
        const wirktWieImpulskarte = /impulskarte/i.test(material.titel)
        if (BILD_ENDUNGEN.includes(endung) || wirktWieImpulskarte) {
          befunde.push({
            typ: 'pdf_zeigt_auf_bild',
            ...kontext(session),
            hinweis: `Material "${material.titel}" ist als "pdf" markiert, die Datei sieht aber nach einem Bild aus (${endung ? `.${endung}` : 'Titel deutet auf Impulskarte hin'}).`,
          })
        }
      }

      const nummerImMaterial =
        sessionNummerAus(material.titel) ?? sessionNummerAus(material.datei_url)
      const nummerInSession = sessionNummerAus(session.titel)

      if (
        nummerImMaterial != null &&
        nummerInSession != null &&
        nummerImMaterial !== nummerInSession
      ) {
        befunde.push({
          typ: 'moegliche_falsche_verlinkung',
          ...kontext(session),
          hinweis: `Material "${material.titel}" nennt Session ${nummerImMaterial}, hängt aber an Session ${nummerInSession} ("${session.titel}").`,
        })
      }
    }
  }

  return befunde
}

const BEFUND_LABEL = {
  fehlendes_workbook: 'Fehlendes Workbook-PDF',
  pdf_zeigt_auf_bild: 'PDF-Typ zeigt auf Bild',
  moegliche_falsche_verlinkung: 'Mögliche falsche Verlinkung',
}

export default function AdminVollstaendigkeitPage() {
  const [befunde, setBefunde] = useState(null)
  const [laeuft, setLaeuft] = useState(false)
  const [error, setError] = useState('')
  const [geprueftAm, setGeprueftAm] = useState(null)

  async function handlePruefen() {
    setLaeuft(true)
    setError('')
    try {
      const [programmeData, modulData, sessionsData, materialienData] =
        await Promise.all([
          adminFetch('/api/admin/programme'),
          adminFetch('/api/admin/sessions?resource=module'),
          adminFetch('/api/admin/sessions'),
          adminFetch('/api/admin/sessions?resource=materials'),
        ])

      const ergebnis = pruefeVollstaendigkeit({
        programme: programmeData.programme ?? [],
        module: modulData.module ?? [],
        sessions: sessionsData.sessions ?? [],
        materialien: materialienData.materialien ?? [],
      })

      setBefunde(ergebnis)
      setGeprueftAm(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLaeuft(false)
    }
  }

  const gruppen = befunde
    ? Object.entries(BEFUND_LABEL).map(([typ, label]) => ({
        typ,
        label,
        eintraege: befunde.filter((b) => b.typ === typ),
      }))
    : []

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-mrh-navy">
        Vollständigkeits-Check
      </h1>
      <p className="mb-6 text-sm text-mrh-grey">
        Prüft alle Sessions plattformweit auf typische Materiallücken --
        rein lesend, nichts wird automatisch verändert.
      </p>

      <button
        onClick={handlePruefen}
        disabled={laeuft}
        className="mb-6 rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
      >
        {laeuft ? 'Prüft…' : 'Jetzt prüfen'}
      </button>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {befunde && (
        <>
          <p className="mb-4 text-xs text-slate-400">
            {befunde.length === 0
              ? 'Keine Auffälligkeiten gefunden.'
              : `${befunde.length} Auffälligkeit${befunde.length === 1 ? '' : 'en'} gefunden`}{' '}
            · geprüft um {geprueftAm?.toLocaleTimeString('de-DE')}
          </p>

          <div className="space-y-6">
            {gruppen
              .filter((gruppe) => gruppe.eintraege.length > 0)
              .map((gruppe) => (
                <div key={gruppe.typ}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {gruppe.label} ({gruppe.eintraege.length})
                  </p>
                  <ul className="space-y-2">
                    {gruppe.eintraege.map((eintrag, index) => (
                      <li
                        key={index}
                        className="rounded-lg bg-white p-3 text-sm shadow-sm"
                      >
                        <p className="text-xs text-mrh-grey">
                          {eintrag.programmTitel} → {eintrag.modulTitel} →{' '}
                          {eintrag.sessionTitel}
                        </p>
                        <p className="mt-1 text-slate-700">{eintrag.hinweis}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
