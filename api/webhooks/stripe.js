import { getStripe } from '../_lib/stripeClient.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { findeOderErstelleCoachie } from '../_lib/coachieAnlage.js'
import { ermittleAppUrl } from '../_lib/appUrl.js'
import { sendMail } from '../_lib/mailer.js'
import { AGB_URL, WIDERRUF_URL } from '../../src/lib/rechtliches.js'

// Stripe-Signaturprüfung braucht den unveränderten Roh-Body (byte-genau),
// nicht das von Vercel automatisch geparste JSON-Objekt.
export const config = {
  api: {
    bodyParser: false,
  },
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// Speichert die Stripe-Customer-ID einmalig je Coachie (Rechnungs-
// Download, Punkt 2) -- unabhängig davon, ob sie aus einem Kurskauf
// oder der Mitgliedschaft stammt. Überschreibt einen bereits
// gesetzten Wert bewusst nicht (derselbe Coachie sollte über
// dieselbe E-Mail immer denselben Stripe-Customer bekommen, ein
// erneutes Setzen wäre ein Hinweis auf einen Sonderfall, den wir
// lieber unangetastet lassen als stillschweigend zu überschreiben).
async function speichereStripeCustomerId(coachieId, stripeCustomerId, supabase) {
  if (!stripeCustomerId) return
  await supabase
    .from('coachies')
    .update({ stripe_customer_id: stripeCustomerId })
    .eq('id', coachieId)
    .is('stripe_customer_id', null)
}

// Liest den Abrechnungszeitraum robust gegen die Stripe-API-Umstellung,
// bei der current_period_end von der Subscription auf die einzelnen
// Subscription-Items gewandert ist (mehrere Preise pro Abo möglich) --
// bei genau einem Preis pro Mitgliedschaft (hier der Fall) liegt der
// Wert entweder direkt auf der Subscription (ältere API-Version) oder
// auf items.data[0] (neuere API-Version). Nicht gegen einen echten
// Stripe-Account in dieser Sandbox verifiziert -- vor dem ersten
// Live-Abo einmal gegenprüfen.
function ermittleNaechsteAbrechnung(subscription) {
  const ende =
    subscription.items?.data?.[0]?.current_period_end ??
    subscription.current_period_end
  return ende ? new Date(ende * 1000).toISOString() : null
}

// Bildet den Stripe-Subscription-Status auf mitgliedschaften.status ab.
// 'canceled' wird zusätzlich explizit über customer.subscription.deleted
// erzwungen (siehe Aufrufer), falls Stripe dort einen anderen Status im
// Objekt mitschickt.
function ermittleMitgliedschaftsStatus(subscriptionStatus) {
  if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
    return 'aktiv'
  }
  if (subscriptionStatus === 'canceled') return 'gekuendigt'
  return 'zahlung_fehlgeschlagen'
}

// checkout.session.completed mit mode === 'subscription' (Mitgliedschaft,
// Punkt 1+2) -- getrennt vom bestehenden Kurs-Kauf-Zweig, da hier keine
// programm_id existiert und stattdessen mitgliedschaften statt
// coachie_programme befüllt wird. Der sonstige Kurszugriff des Coachies
// bleibt dabei unberührt (andere Tabelle).
async function handleMitgliedschaftCheckoutAbgeschlossen(session, supabase, req) {
  const { coachieId, error: coachieError } = await findeOderErstelleCoachie({
    email: session.customer_details?.email,
    name: session.customer_details?.name,
    supabase,
    appUrl: ermittleAppUrl(req),
  })
  if (coachieError) return { error: coachieError }

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(session.subscription)

  const { error } = await supabase.from('mitgliedschaften').upsert(
    {
      coachie_id: coachieId,
      status: ermittleMitgliedschaftsStatus(subscription.status),
      stripe_subscription_id: session.subscription,
      stripe_customer_id: session.customer,
      start_datum: new Date().toISOString(),
      naechste_abrechnung: ermittleNaechsteAbrechnung(subscription),
      aktualisiert_am: new Date().toISOString(),
      ...zustimmungAusSession(session),
    },
    { onConflict: 'coachie_id' },
  )

  if (error) return { error: error.message }

  await speichereStripeCustomerId(coachieId, session.customer, supabase)

  const email = session.customer_details?.email
  const naechste = ermittleNaechsteAbrechnung(subscription)
  if (email) {
    await sendeBestaetigung({
      to: email,
      subject: 'Bestätigung deiner MRH Community-Mitgliedschaft',
      text: `Hallo${session.customer_details?.name ? ' ' + session.customer_details.name : ''},

vielen Dank. Hiermit bestätigen wir den Abschluss deiner Mitgliedschaft.

Mitgliedschaft: MRH Community-Mitgliedschaft
Preis: ${formatBetrag(session.amount_total, session.currency)} pro Monat
${naechste ? `Nächste Abrechnung: ${formatDatum(naechste)}\n` : ''}Laufzeit: monatlich, kündbar zum Ende des jeweiligen Abrechnungszeitraums

${verzichtAbsatz(session)}

AGB: ${AGB_URL}
Widerrufsbelehrung: ${WIDERRUF_URL}
Kündigen: ${ermittleAppUrl(req)}/vertrag-kuendigen

Viele Grüße
Marcel Holz
MRH Beratung & Coaching`,
    })
  }

  return {}
}

// customer.subscription.updated / .deleted (Punkt 2, Lifecycle-Events):
// aktualisiert ausschließlich status/naechste_abrechnung der bereits
// bestehenden Zeile -- kein Insert hier, die Zeile entsteht immer zuerst
// über checkout.session.completed.
async function handleSubscriptionLifecycle(subscription, eventType, supabase) {
  const status =
    eventType === 'customer.subscription.deleted'
      ? 'gekuendigt'
      : ermittleMitgliedschaftsStatus(subscription.status)

  const { error } = await supabase
    .from('mitgliedschaften')
    .update({
      status,
      naechste_abrechnung: ermittleNaechsteAbrechnung(subscription),
      aktualisiert_am: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) return { error: error.message }
  return {}
}

// invoice.payment_failed (Punkt 2): zusätzliches, unmittelbareres Signal
// als das oft erst später eintreffende customer.subscription.updated mit
// status "past_due" -- setzt den Coachie schneller auf
// "zahlung_fehlgeschlagen" und damit ohne Verzögerung raus aus den
// Mitglieder-Inhalten/-Terminen.
async function handleInvoicePaymentFailed(invoice, supabase) {
  const subscriptionId =
    invoice.subscription ?? invoice.parent?.subscription_details?.subscription

  if (!subscriptionId) return {}

  const { error } = await supabase
    .from('mitgliedschaften')
    .update({ status: 'zahlung_fehlgeschlagen', aktualisiert_am: new Date().toISOString() })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) return { error: error.message }
  return {}
}

// Zustimmung zu AGB und Widerrufsverzicht aus den Session-Metadaten
// (gesetzt in api/checkout.js). Nur gültige Zeitpunkte übernehmen.
function zustimmungAusSession(session) {
  const felder = {}
  for (const [meta, spalte] of [
    ['agb_akzeptiert_am', 'agb_akzeptiert_am'],
    ['widerrufsverzicht_am', 'widerrufsverzicht_am'],
  ]) {
    const wert = session.metadata?.[meta]
    if (wert && !Number.isNaN(Date.parse(wert))) felder[spalte] = wert
  }
  return felder
}

function formatZeitpunkt(iso) {
  return new Date(iso).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'long',
    timeStyle: 'short',
  })
}

function formatDatum(iso) {
  return new Date(iso).toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'long',
  })
}

function formatBetrag(cent, waehrung) {
  if (cent == null) return 'siehe Rechnung'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: (waehrung || 'eur').toUpperCase(),
  }).format(cent / 100)
}

// Vertragsbestätigung auf dauerhaftem Datenträger (§ 312f BGB). Ein
// Fehlversand blockiert die bereits erfolgte Freischaltung nicht, wird
// aber protokolliert und dem Admin gemeldet.
async function sendeBestaetigung({ to, subject, text }) {
  try {
    await sendMail({ to, subject, text })
  } catch (err) {
    console.error(`Bestätigungsmail an ${to} nicht versendet:`, err.message)
    if (process.env.ADMIN_EMAIL) {
      try {
        await sendMail({
          to: process.env.ADMIN_EMAIL,
          subject: 'Kaufbestätigung konnte nicht versendet werden',
          text: `Die Vertragsbestätigung an ${to} ist fehlgeschlagen (${err.message}). Bitte manuell nachsenden.\n\n${text}`,
        })
      } catch {
        // Bereits protokolliert.
      }
    }
  }
}

function verzichtAbsatz(session) {
  const verzichtAm = session.metadata?.widerrufsverzicht_am
  const agbAm = session.metadata?.agb_akzeptiert_am
  const zeilen = []
  if (agbAm) zeilen.push(`AGB akzeptiert am: ${formatZeitpunkt(agbAm)}`)
  if (verzichtAm) {
    zeilen.push(
      `Du hast am ${formatZeitpunkt(verzichtAm)} ausdrücklich verlangt, dass wir vor Ablauf der Widerrufsfrist mit der Bereitstellung der digitalen Inhalte beginnen, und bestätigt, dass dein Widerrufsrecht mit Beginn der Bereitstellung erlischt.`,
    )
  }
  return zeilen.join('\n')
}

// Kurskauf (mode 'payment'): Coachie finden/anlegen und dem Programm
// zuordnen. Mehrfach ausführbar (upsert auf coachie_id,programm_id),
// damit eine erneute Stripe-Zustellung nach einem Fehler den Kauf
// sicher abschließen kann.
async function handleKursCheckoutAbgeschlossen(session, supabase, req) {
  const email = session.customer_details?.email
  const programmId = session.metadata?.programm_id

  if (!email || !programmId) {
    console.error(
      `Stripe-Session ${session.id}: E-Mail oder Programm-ID fehlt, keine Freischaltung möglich.`,
    )
    return { warning: 'E-Mail oder Programm-ID fehlt im Event.' }
  }

  const { coachieId, error: coachieError } = await findeOderErstelleCoachie({
    email,
    name: session.customer_details?.name,
    supabase,
    appUrl: ermittleAppUrl(req),
  })
  if (coachieError) return { error: coachieError }

  const { data: programm, error: programmError } = await supabase
    .from('programme')
    .select('titel, standard_zugriffsmonate')
    .eq('id', programmId)
    .maybeSingle()

  if (programmError) return { error: programmError.message }

  let zugriffBis = null
  if (programm?.standard_zugriffsmonate) {
    const datum = new Date()
    datum.setMonth(datum.getMonth() + programm.standard_zugriffsmonate)
    zugriffBis = datum.toISOString()
  }

  // Nur für Tests der Wiederholungslogik (A2): simuliert einen Fehler bei
  // der Zuordnung. Wirkt nie in Production.
  if (
    process.env.STRIPE_WEBHOOK_TESTFEHLER === '1' &&
    process.env.VERCEL_ENV !== 'production'
  ) {
    return { error: 'Simulierter Fehler bei der Zuordnung (STRIPE_WEBHOOK_TESTFEHLER).' }
  }

  const { error: assignmentError } = await supabase.from('coachie_programme').upsert(
    {
      coachie_id: coachieId,
      programm_id: programmId,
      zugewiesen_am: new Date().toISOString(),
      zugriff_bis: zugriffBis,
      // Erneuter Kauf nach einer Kündigung: der neue Vertrag ist ungekündigt.
      gekuendigt_am: null,
      ...zustimmungAusSession(session),
    },
    { onConflict: 'coachie_id,programm_id' },
  )

  if (assignmentError) return { error: assignmentError.message }

  await speichereStripeCustomerId(coachieId, session.customer, supabase)

  // Empfehlungsprogramm: nur protokollieren, nicht den Webhook
  // scheitern lassen -- der Kauf selbst ist bereits abgeschlossen.
  // unique(geworbener_coachie_id, programm_id) in empfehlungen.sql
  // macht das idempotent gegen Stripe-Retry-Zustellungen des gleichen
  // Events; ein Selbst-Verweis (Coachie kauft mit eigenem Code) wird
  // ignoriert.
  const werberCoachieId = session.metadata?.werber_coachie_id
  if (werberCoachieId && werberCoachieId !== coachieId) {
    const { error: empfehlungError } = await supabase.from('empfehlungen').insert({
      werber_coachie_id: werberCoachieId,
      geworbener_coachie_id: coachieId,
      programm_id: programmId,
    })

    if (empfehlungError && empfehlungError.code !== '23505') {
      console.error('Empfehlung konnte nicht protokolliert werden:', empfehlungError.message)
    }
  }

  const appUrl = ermittleAppUrl(req)
  const titel = programm?.titel ?? 'Programm'
  await sendeBestaetigung({
    to: email,
    subject: `Bestätigung deines Kaufs: ${titel}`,
    text: `Hallo${session.customer_details?.name ? ' ' + session.customer_details.name : ''},

vielen Dank für deinen Kauf. Hiermit bestätigen wir den Vertragsschluss.

Programm: ${titel}
Preis: ${formatBetrag(session.amount_total, session.currency)}
Zugriff: ${zugriffBis ? `bis ${formatDatum(zugriffBis)}` : 'unbefristet'}

${verzichtAbsatz(session)}

AGB: ${AGB_URL}
Widerrufsbelehrung: ${WIDERRUF_URL}

Deine Rechnung erhältst du separat von Stripe. Zum Login: ${appUrl}/login
Falls du noch kein Passwort festgelegt hast, nutze die Einladungsmail oder auf der Login-Seite „Passwort vergessen“.

Viele Grüße
Marcel Holz
MRH Beratung & Coaching`,
  })

  return { coachieId, programmId, zugriffBis }
}

// Gemeinsamer Freischaltungspfad für checkout.session.completed (sofort
// bezahlt) und checkout.session.async_payment_succeeded (z. B. SEPA,
// Klarna: Zahlung erst später bestätigt).
async function schalteFrei(session, supabase, req) {
  if (session.mode === 'subscription') {
    return handleMitgliedschaftCheckoutAbgeschlossen(session, supabase, req)
  }
  return handleKursCheckoutAbgeschlossen(session, supabase, req)
}

async function meldeFehlgeschlageneZahlung(session) {
  const email = session.customer_details?.email ?? 'unbekannt'
  console.warn(
    `Stripe-Session ${session.id}: asynchrone Zahlung fehlgeschlagen (${email}). Keine Freischaltung.`,
  )

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return
  try {
    await sendMail({
      to: adminEmail,
      subject: 'Zahlung fehlgeschlagen (Stripe)',
      text: `Eine verzögerte Zahlung ist fehlgeschlagen. Es wurde kein Zugang freigeschaltet.\n\nStripe-Session: ${session.id}\nE-Mail: ${email}\nModus: ${session.mode}\nProgramm-ID: ${session.metadata?.programm_id ?? 'keine'}`,
    })
  } catch (err) {
    console.error('Admin-Hinweis zur fehlgeschlagenen Zahlung nicht versendet:', err.message)
  }
}

async function verarbeiteEvent(event, supabase, req) {
  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return handleSubscriptionLifecycle(event.data.object, event.type, supabase)

    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(event.data.object, supabase)

    case 'checkout.session.completed': {
      const session = event.data.object
      // Nur bei tatsächlich eingegangener Zahlung freischalten. Bei
      // verzögerten Zahlarten (SEPA, teils Klarna) ist payment_status
      // hier noch 'unpaid'; die Freischaltung folgt dann über
      // checkout.session.async_payment_succeeded.
      if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        console.info(
          `Stripe-Session ${session.id}: payment_status=${session.payment_status}, warte auf async_payment_succeeded.`,
        )
        return { info: 'Zahlung noch nicht abgeschlossen.' }
      }
      return schalteFrei(session, supabase, req)
    }

    case 'checkout.session.async_payment_succeeded':
      return schalteFrei(event.data.object, supabase, req)

    case 'checkout.session.async_payment_failed':
      await meldeFehlgeschlageneZahlung(event.data.object)
      return {}

    default:
      return {}
  }
}

// Idempotenz: Das Event wird zuerst mit verarbeitet = false eingetragen
// und erst NACH erfolgreicher Verarbeitung auf true gesetzt. Eine erneute
// Zustellung trifft also nur dann auf "already_processed", wenn der
// vorherige Durchlauf wirklich fertig war. Scheiterte er (Fehler, Timeout,
// Absturz der Function), bleibt verarbeitet = false und die nächste
// Zustellung verarbeitet erneut. Alle Verarbeitungsschritte sind dafür
// wiederholbar (upsert bzw. Unique-Constraints).
async function beanspruche(eventId, supabase) {
  const { error } = await supabase
    .from('stripe_events')
    .insert({ id: eventId, verarbeitet: false })

  if (!error) return { weiter: true }
  if (error.code !== '23505') return { error: error.message }

  const { data, error: lookupError } = await supabase
    .from('stripe_events')
    .select('verarbeitet')
    .eq('id', eventId)
    .maybeSingle()

  if (lookupError) return { error: lookupError.message }
  return { weiter: !data?.verarbeitet }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const stripe = getStripe()
  const signature = req.headers['stripe-signature']
  const rawBody = await readRawBody(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    res.status(400).json({ error: `Signaturprüfung fehlgeschlagen: ${err.message}` })
    return
  }

  const supabase = getSupabaseAdmin()

  const anspruch = await beanspruche(event.id, supabase)
  if (anspruch.error) {
    res.status(500).json({ error: anspruch.error })
    return
  }
  if (!anspruch.weiter) {
    res.status(200).json({ received: true, already_processed: true })
    return
  }

  let ergebnis
  try {
    ergebnis = await verarbeiteEvent(event, supabase, req)
  } catch (err) {
    console.error(`Stripe-Event ${event.id} (${event.type}) fehlgeschlagen:`, err)
    res.status(500).json({ error: err.message })
    return
  }

  if (ergebnis?.error) {
    console.error(`Stripe-Event ${event.id} (${event.type}) fehlgeschlagen:`, ergebnis.error)
    res.status(500).json({ error: ergebnis.error })
    return
  }

  const { error: markError } = await supabase
    .from('stripe_events')
    .update({ verarbeitet: true, verarbeitet_am: new Date().toISOString() })
    .eq('id', event.id)

  if (markError) {
    // Verarbeitung war erfolgreich; schlimmstenfalls wird das Event bei
    // einer erneuten Zustellung noch einmal (idempotent) verarbeitet.
    console.error(`Stripe-Event ${event.id} konnte nicht als verarbeitet markiert werden:`, markError.message)
  }

  res.status(200).json({ received: true, ...(ergebnis?.warning ? { warning: ergebnis.warning } : {}) })
}
