import crypto from 'node:crypto'
import { getStripe } from './stripeClient.js'

// Signierter, zeitlich begrenzter Bestätigungslink für Kündigungen über
// das öffentliche Formular (/vertrag-kuendigen). Gleiches Muster wie
// adminAuth.js (HMAC-SHA256, base64url), eigenes Secret.
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

function secret() {
  const wert = process.env.KUENDIGUNG_TOKEN_SECRET || process.env.ADMIN_TOKEN_SECRET
  if (!wert) throw new Error('KUENDIGUNG_TOKEN_SECRET ist nicht gesetzt.')
  return wert
}

function signiere(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function erstelleKuendigungsToken(erklaerungId) {
  const payload = Buffer.from(
    JSON.stringify({ id: erklaerungId, exp: Date.now() + TOKEN_TTL_MS }),
  ).toString('base64url')
  return `${payload}.${signiere(payload)}`
}

// Liefert die Erklärungs-ID oder null (ungültig oder abgelaufen).
export function pruefeKuendigungsToken(token) {
  if (typeof token !== 'string') return null
  const [payload, signatur] = token.split('.')
  if (!payload || !signatur) return null

  const erwartet = Buffer.from(signiere(payload))
  const erhalten = Buffer.from(signatur)
  if (erwartet.length !== erhalten.length || !crypto.timingSafeEqual(erwartet, erhalten)) {
    return null
  }

  try {
    const { id, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof id !== 'string' || typeof exp !== 'number' || exp < Date.now()) return null
    return id
  } catch {
    return null
  }
}

export const VERTRAG_LABEL = {
  alle: 'Alle Verträge',
  mitgliedschaft: 'Mitgliedschaft',
  kurs: 'Kurs',
}

export function formatDatum(iso) {
  return new Date(iso).toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'long',
  })
}

export function formatZeitpunkt(iso) {
  return new Date(iso).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'long',
    timeStyle: 'short',
  })
}

// "naechstmoeglich" oder ein Datum YYYY-MM-DD (nicht in der Vergangenheit).
export function normalisiereZeitpunkt(wert) {
  if (!wert || wert === 'naechstmoeglich') return 'naechstmoeglich'
  if (typeof wert !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return null
  const heute = new Date().toISOString().slice(0, 10)
  return wert < heute ? null : wert
}

export function zeitpunktText(zeitpunkt) {
  return zeitpunkt === 'naechstmoeglich'
    ? 'zum nächstmöglichen Zeitpunkt'
    : `zum ${formatDatum(`${zeitpunkt}T12:00:00Z`)}`
}

async function kuendigeMitgliedschaft(supabase, coachieId, zeitpunkt) {
  const { data: mitgliedschaft, error } = await supabase
    .from('mitgliedschaften')
    .select('id, status, stripe_subscription_id')
    .eq('coachie_id', coachieId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!mitgliedschaft || mitgliedschaft.status === 'gekuendigt') {
    return 'Mitgliedschaft: keine laufende Mitgliedschaft gefunden.'
  }

  // Manuell angelegte Freiplätze haben kein Stripe-Abo, es wird nichts
  // abgebucht. Sie enden sofort.
  if (!mitgliedschaft.stripe_subscription_id?.startsWith('sub_')) {
    const { error: updateError } = await supabase
      .from('mitgliedschaften')
      .update({ status: 'gekuendigt', aktualisiert_am: new Date().toISOString() })
      .eq('id', mitgliedschaft.id)
    if (updateError) throw new Error(updateError.message)
    return 'Mitgliedschaft (ohne Zahlung): beendet.'
  }

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(
    mitgliedschaft.stripe_subscription_id,
  )
  const periodenEnde =
    subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end

  // Wunschdatum nach dem Ende der laufenden Periode: Abo läuft bis dahin
  // weiter. Sonst Ende der bereits bezahlten Periode (nicht sofort).
  const wunsch =
    zeitpunkt !== 'naechstmoeglich'
      ? Math.floor(Date.parse(`${zeitpunkt}T23:59:59Z`) / 1000)
      : null

  let aktualisiert
  if (wunsch && periodenEnde && wunsch > periodenEnde) {
    aktualisiert = await stripe.subscriptions.update(subscription.id, {
      cancel_at: wunsch,
      proration_behavior: 'none',
    })
  } else {
    aktualisiert = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    })
  }

  const ende = aktualisiert.cancel_at ?? periodenEnde
  return ende
    ? `Mitgliedschaft: gekündigt, endet am ${formatDatum(ende * 1000)}. Bis dahin bleibt der Zugang bestehen.`
    : 'Mitgliedschaft: gekündigt zum Ende des laufenden Abrechnungszeitraums.'
}

async function kuendigeKurse(supabase, coachieId, vertragId) {
  let abfrage = supabase
    .from('coachie_programme')
    .select('id, zugriff_bis, programme(titel)')
    .eq('coachie_id', coachieId)
    .is('gekuendigt_am', null)
  if (vertragId) abfrage = abfrage.eq('id', vertragId)

  const { data: zuordnungen, error } = await abfrage
  if (error) throw new Error(error.message)
  if (!zuordnungen?.length) return ['Kurse: kein laufender Kurszugang gefunden.']

  const { error: updateError } = await supabase
    .from('coachie_programme')
    .update({ gekuendigt_am: new Date().toISOString() })
    .in(
      'id',
      zuordnungen.map((z) => z.id),
    )
  if (updateError) throw new Error(updateError.message)

  return zuordnungen.map(
    (z) =>
      `Kurs „${z.programme?.titel ?? 'Programm'}“: gekündigt. Es entstehen keine weiteren Kosten. ${
        z.zugriff_bis
          ? `Der bezahlte Zugriff bleibt bis ${formatDatum(z.zugriff_bis)} bestehen.`
          : 'Der bezahlte Zugriff bleibt bestehen.'
      }`,
  )
}

// Führt eine Kündigung für einen identifizierten Coachie aus und liefert
// die Ergebniszeilen für Bestätigungsmail und Protokoll.
export async function fuehreKuendigungAus(supabase, { coachieId, vertrag, vertragId, zeitpunkt }) {
  const zeilen = []
  if (vertrag === 'mitgliedschaft' || vertrag === 'alle') {
    zeilen.push(await kuendigeMitgliedschaft(supabase, coachieId, zeitpunkt))
  }
  if (vertrag === 'kurs' || vertrag === 'alle') {
    zeilen.push(...(await kuendigeKurse(supabase, coachieId, vertragId)))
  }
  return zeilen
}
