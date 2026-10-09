import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { formatPreis, UST_HINWEIS } from '../lib/preis'
import { toYoutubeEmbedUrl } from '../lib/youtube'
import { DATENSCHUTZ_URL } from '../lib/rechtliches'
import RechtsFooter from '../components/RechtsFooter'
import KaufZustimmung from '../components/KaufZustimmung'

// Empfehlungsprogramm: ?ref=<Code> wird in sessionStorage gemerkt, damit
// der Code auch dann noch beim Checkout mitgeschickt wird, wenn der
// Besuch die Seite zwischenzeitlich neu lädt (z. B. nach einem
// abgebrochenen Kaufversuch, cancel_url landet wieder auf /kaufen/:slug
// ohne den Query-Parameter erneut mitzuschicken).
const EMPFEHLUNGSCODE_STORAGE_KEY = 'mrh_empfehlungscode'

function formatDatum(isoDatum) {
  if (!isoDatum) return ''
  return new Date(`${isoDatum}T00:00:00`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// Struktur für Kundenstimmen steht bereit und wird von api/checkout.js
// befüllt, sobald es freigegebene Testimonials gibt (siehe testimonials.sql
// und die Admin-Freigabe in AdminTestimonialsPage.jsx) -- bis dahin liefert
// die API ein leeres Array und dieser Abschnitt rendert einfach nichts.
function TestimonialsSection({ testimonials }) {
  if (!testimonials || testimonials.length === 0) return null

  return (
    <div className="mb-10 border-t border-white/10 pt-8">
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-white/50">
        Das sagen andere Coachies
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {testimonials.map((testimonial, index) => (
          <blockquote
            key={index}
            className="rounded-xl bg-white/5 p-4 text-sm italic text-white/80"
          >
            &bdquo;{testimonial.text}&ldquo;
            {testimonial.name && (
              <footer className="mt-2 text-xs not-italic text-white/50">
                {testimonial.name}
              </footer>
            )}
          </blockquote>
        ))}
      </div>
    </div>
  )
}

function ModulUebersicht({ module, gesamtSessionAnzahl }) {
  if (!module || module.length === 0) return null

  return (
    <div className="mb-10">
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-white/50">
        Was dich erwartet{' '}
        {gesamtSessionAnzahl != null &&
          `(${gesamtSessionAnzahl} Session${gesamtSessionAnzahl === 1 ? '' : 's'})`}
      </p>
      <ul className="space-y-2">
        {module.map((modul, index) => (
          <li
            key={index}
            className="flex items-start justify-between gap-3 rounded-xl bg-white/5 px-4 py-3"
          >
            <div className="flex items-start gap-3 text-sm text-white/90">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mrh-gold/20 text-xs font-semibold text-mrh-gold-soft">
                {index + 1}
              </span>
              <div>
                <p>{modul.titel}</p>
                {modul.beschreibung && (
                  <p className="mt-1 text-xs text-white/60">
                    {modul.beschreibung}
                  </p>
                )}
              </div>
            </div>
            <span className="shrink-0 text-xs text-white/50">
              {modul.sessionAnzahl} Session{modul.sessionAnzahl === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// "Was Du bekommst" -- gleicher visueller Stil wie die ablauf_schritte-
// Liste (nummerierte Gold-Kreise), da beides positive, werbende Listen
// sind.
function LeistungenSection({ leistungenText }) {
  const punkte = (leistungenText ?? '')
    .split('\n')
    .map((zeile) => zeile.trim())
    .filter(Boolean)

  if (punkte.length === 0) return null

  return (
    <div className="mb-10">
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-white/50">
        Was Du bekommst
      </p>
      <ul className="space-y-3">
        {punkte.map((punkt, index) => (
          <li key={index} className="flex gap-3 text-white/80">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mrh-gold/20 text-xs font-semibold text-mrh-gold-soft">
              {index + 1}
            </span>
            {punkt}
          </li>
        ))}
      </ul>
    </div>
  )
}

// "Was das hier nicht ist" -- bewusst zurückhaltender als die positiven
// Listen (Minus-Symbol statt Nummerierung, gedämpftere Farbe), um die
// Abgrenzung optisch abzuheben statt sie wie ein weiteres Verkaufs-
// argument aussehen zu lassen.
function AbgrenzungSection({ abgrenzungText }) {
  const punkte = (abgrenzungText ?? '')
    .split('\n')
    .map((zeile) => zeile.trim())
    .filter(Boolean)

  if (punkte.length === 0) return null

  return (
    <div className="mb-10">
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-white/50">
        Was das hier nicht ist
      </p>
      <ul className="space-y-2">
        {punkte.map((punkt, index) => (
          <li key={index} className="flex gap-3 text-sm text-white/50">
            <span className="shrink-0">–</span>
            {punkt}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Trailer als Zwei-Klick-Lösung: Vor dem Klick wird nichts von YouTube
// geladen (auch kein Vorschaubild). Erst "Abspielen" lädt das iframe von
// youtube-nocookie.com. Vorschau ist das Programmbild oder eine
// neutrale Fläche.
function TrailerZweiKlick({ embedUrl, titel, bildUrl }) {
  const [aktiv, setAktiv] = useState(false)

  if (aktiv) {
    return (
      <div className="mb-8 aspect-video overflow-hidden rounded-2xl bg-black">
        <iframe
          src={`${embedUrl}?autoplay=1&rel=0`}
          title={`Trailer: ${titel}`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setAktiv(true)}
      className="group relative mb-8 block aspect-video w-full overflow-hidden rounded-2xl bg-mrh-navy text-left"
    >
      {bildUrl && (
        <img src={bildUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      )}
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mrh-gold text-white shadow-lg transition group-hover:scale-105">
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-7 w-7" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span className="text-sm font-semibold text-white">Trailer abspielen</span>
        <span className="max-w-sm text-xs text-white/80">
          Beim Abspielen werden Daten an YouTube übertragen.
        </span>
      </span>
    </button>
  )
}

// Gratis-Anmeldung für Programme mit preis_cent = 0 (z. B. die
// Standortbestimmung): statt Stripe ein kurzes Formular, das
// api/checkout.js?aktion=gratis aufruft. Das Feld "website" ist ein
// Honeypot, für Menschen unsichtbar.
function GratisAnmeldung({ slug }) {
  const [vorname, setVorname] = useState('')
  const [email, setEmail] = useState('')
  const [datenschutz, setDatenschutz] = useState(false)
  const [website, setWebsite] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [erfolg, setErfolg] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setFehler('')
    setLaeuft(true)
    try {
      const response = await fetch('/api/checkout?aktion=gratis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name: vorname, email, website }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || 'Anmeldung fehlgeschlagen.')
      }
      setErfolg(true)
    } catch (err) {
      setFehler(err.message)
    } finally {
      setLaeuft(false)
    }
  }

  if (erfolg) {
    return (
      <p className="rounded-xl bg-mrh-gold/15 p-4 text-sm text-white">
        Prüfe dein Postfach. Wir haben dir den Zugang geschickt.
      </p>
    )
  }

  const feldKlassen =
    'w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-mrh-gold focus:outline-none'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="gratis-vorname" className="mb-1 block text-xs text-white/60">
          Vorname
        </label>
        <input
          id="gratis-vorname"
          type="text"
          required
          autoComplete="given-name"
          value={vorname}
          onChange={(e) => setVorname(e.target.value)}
          className={feldKlassen}
        />
      </div>
      <div>
        <label htmlFor="gratis-email" className="mb-1 block text-xs text-white/60">
          E-Mail-Adresse
        </label>
        <input
          id="gratis-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={feldKlassen}
        />
      </div>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="gratis-website">Website</label>
        <input
          id="gratis-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <label className="flex items-start gap-2 text-xs text-white/70">
        <input
          type="checkbox"
          required
          checked={datenschutz}
          onChange={(e) => setDatenschutz(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-mrh-gold"
        />
        <span>
          Ich habe die{' '}
          <a
            href={DATENSCHUTZ_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            Datenschutzerklärung
          </a>{' '}
          gelesen und bin mit der Verarbeitung meiner Angaben zur Bereitstellung
          des Zugangs einverstanden.
        </span>
      </label>
      {fehler && <p className="text-sm text-red-400">{fehler}</p>}
      <button
        type="submit"
        disabled={laeuft || !datenschutz}
        className="w-full rounded-full bg-gradient-to-br from-mrh-gold to-mrh-gold-dark py-3 text-sm font-semibold text-white shadow-lg shadow-mrh-gold-dark/40 transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {laeuft ? 'Wird gesendet…' : 'Kostenlos starten'}
      </button>
      <p className="text-xs text-white/60">
        Du erhältst eine E-Mail mit deinem Zugang. Hast du bereits ein Konto, ist
        das Programm danach direkt in deinem Bereich verfügbar.
      </p>
    </form>
  )
}

export default function KaufenPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const [programm, setProgramm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kaufLaeuft, setKaufLaeuft] = useState(false)
  const [zustimmung, setZustimmung] = useState({
    agbAkzeptiertAm: null,
    widerrufsverzichtAm: null,
  })

  useEffect(() => {
    const refAusUrl = searchParams.get('ref')
    if (refAusUrl) {
      try {
        sessionStorage.setItem(EMPFEHLUNGSCODE_STORAGE_KEY, refAusUrl)
      } catch {
        // sessionStorage nicht verfügbar -- der Kauf funktioniert auch
        // ohne Empfehlungscode, kein Blocker.
      }
    }
  }, [searchParams])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/checkout?slug=${slug}`)
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(data?.error || 'Programm nicht gefunden.')
        }

        if (!cancelled) setProgramm(data.programm)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [slug])

  async function handleKaufen() {
    setError('')
    setKaufLaeuft(true)
    try {
      let ref = null
      try {
        ref = sessionStorage.getItem(EMPFEHLUNGSCODE_STORAGE_KEY)
      } catch {
        // sessionStorage nicht verfügbar -- Kauf läuft dann ohne
        // Empfehlungszuordnung weiter.
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          ...(ref ? { ref } : {}),
          agbAkzeptiertAm: zustimmung.agbAkzeptiertAm,
          widerrufsverzichtAm: zustimmung.widerrufsverzichtAm,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Checkout konnte nicht gestartet werden.')
      }

      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setKaufLaeuft(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mrh-cream">
        <p className="text-mrh-grey">Lädt…</p>
      </div>
    )
  }

  if (error || !programm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mrh-cream px-4">
        <p className="text-red-600">{error || 'Programm nicht gefunden.'}</p>
      </div>
    )
  }

  const trailerEmbedUrl = toYoutubeEmbedUrl(programm.trailer_video_url)

  const istGratis = programm.preis_cent === 0

  const heute = new Date().toISOString().slice(0, 10)
  const einfuehrungspreisAktiv =
    programm.einfuehrungspreis_cent != null &&
    programm.einfuehrungspreis_gueltig_bis &&
    heute <= programm.einfuehrungspreis_gueltig_bis

  return (
    <div className="min-h-screen bg-mrh-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-16">
        {programm.zielgruppe_text && (
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-mrh-gold-soft">
            {programm.zielgruppe_text}
          </p>
        )}
        <h1 className="mb-2 font-serif text-4xl font-semibold">
          {programm.titel}
        </h1>

        {programm.subline && (
          <p className="mb-6 text-base text-white/50">{programm.subline}</p>
        )}

        {trailerEmbedUrl ? (
          <TrailerZweiKlick
            embedUrl={trailerEmbedUrl}
            titel={programm.titel}
            bildUrl={programm.bild_url}
          />
        ) : (
          programm.bild_url && (
            <div className="mb-8 overflow-hidden rounded-2xl">
              <img
                src={programm.bild_url}
                alt=""
                className="w-full object-cover"
              />
            </div>
          )
        )}

        {programm.beschreibung && (
          <p className="mb-10 whitespace-pre-line text-white/70">
            {programm.beschreibung}
          </p>
        )}

        {Array.isArray(programm.ablauf_schritte) &&
          programm.ablauf_schritte.length > 0 && (
            <div className="mb-10">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-white/50">
                So läuft es ab
              </p>
              <ol className="space-y-3">
                {programm.ablauf_schritte.map((schritt, index) => (
                  <li key={index} className="flex gap-3 text-white/80">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mrh-gold/20 text-xs font-semibold text-mrh-gold-soft">
                      {index + 1}
                    </span>
                    {schritt}
                  </li>
                ))}
              </ol>
            </div>
          )}

        <ModulUebersicht
          module={programm.modulUebersicht}
          gesamtSessionAnzahl={programm.gesamtSessionAnzahl}
        />

        <LeistungenSection leistungenText={programm.leistungen_text} />

        <AbgrenzungSection abgrenzungText={programm.abgrenzung_text} />

        {programm.zielgruppe_text && (
          <div className="mb-10">
            <p className="mb-4 text-xs font-medium uppercase tracking-wide text-white/50">
              Für wen
            </p>
            <p className="text-white/80">{programm.zielgruppe_text}</p>
          </div>
        )}

        <TestimonialsSection testimonials={programm.testimonials} />

        <div className="rounded-2xl bg-white/5 p-6">
          {istGratis ? (
            <p className="mb-1 text-3xl font-semibold text-mrh-gold-soft">Kostenlos</p>
          ) : einfuehrungspreisAktiv ? (
            <div className="mb-1">
              {programm.preis_cent != null && (
                <span className="mr-2 text-lg text-white/40 line-through">
                  {formatPreis(programm.preis_cent)}
                </span>
              )}
              <span className="text-3xl font-semibold text-mrh-gold-soft">
                {formatPreis(programm.einfuehrungspreis_cent)}
              </span>
              <p className="mt-1 text-xs text-mrh-gold-soft">
                Einführungspreis gültig bis{' '}
                {formatDatum(programm.einfuehrungspreis_gueltig_bis)}
              </p>
            </div>
          ) : (
            programm.preis_cent != null && (
              <p className="mb-1 text-3xl font-semibold text-mrh-gold-soft">
                {formatPreis(programm.preis_cent)}
              </p>
            )
          )}
          {!istGratis && programm.preis_cent != null && (
            <p className="mb-1 text-xs text-white/50">{UST_HINWEIS}</p>
          )}
          {programm.standard_zugriffsmonate != null && (
            <p className="mb-6 text-xs text-white/60">
              Zugriff für {programm.standard_zugriffsmonate}{' '}
              {programm.standard_zugriffsmonate === 1 ? 'Monat' : 'Monate'}
            </p>
          )}

          {istGratis ? (
            <GratisAnmeldung slug={slug} />
          ) : (
            <>
              <KaufZustimmung zustimmung={zustimmung} onChange={setZustimmung} />

              {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

              <button
                onClick={handleKaufen}
                disabled={
                  kaufLaeuft ||
                  !zustimmung.agbAkzeptiertAm ||
                  !zustimmung.widerrufsverzichtAm
                }
                className="w-full rounded-full bg-gradient-to-br from-mrh-gold to-mrh-gold-dark py-3 text-sm font-semibold text-white shadow-lg shadow-mrh-gold-dark/40 transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {kaufLaeuft ? 'Weiterleitung…' : programm.cta_text || 'Jetzt kaufen'}
              </button>
              <p className="mt-4 text-xs text-white/60">
                Weiterleitung zur sicheren Bezahlung über Stripe. Nach erfolgreicher
                Zahlung erhältst du eine E-Mail zum Festlegen deines Passworts.
              </p>
            </>
          )}
        </div>
        <RechtsFooter dunkel className="mt-12" />
      </div>
    </div>
  )
}
