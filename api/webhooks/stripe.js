import { getStripe } from '../_lib/stripeClient.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

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

// Sucht einen Coachie per E-Mail oder legt ihn neu an (inkl. Einladungs-
// mail, Passwort-Setzen-Flow aus Phase 1) -- gemeinsam für den
// bestehenden Kurs-Kauf-Flow und den neuen Mitgliedschafts-Flow, damit
// beide exakt dasselbe Verhalten für "neuer vs. bestehender Coachie"
// haben. Ein bereits bestehender Coachie bekommt bewusst KEINE erneute
// Einladung.
async function findeOderErstelleCoachie(session, supabase, req) {
  const email = session.customer_details?.email
  if (!email) return { error: 'E-Mail fehlt im Event.' }

  const { data: bestehenderCoachie, error: lookupError } = await supabase
    .from('coachies')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (lookupError) return { error: lookupError.message }
  if (bestehenderCoachie?.id) return { coachieId: bestehenderCoachie.id }

  const appUrl =
    process.env.APP_URL ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

  const { data: invited, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/passwort-festlegen`,
    })

  if (inviteError) return { error: inviteError.message }

  const { data: neuerCoachie, error: insertCoachieError } = await supabase
    .from('coachies')
    .insert({
      id: invited.user.id,
      name: session.customer_details?.name || email,
      email,
    })
    .select()
    .single()

  if (insertCoachieError) {
    await supabase.auth.admin.deleteUser(invited.user.id)
    return { error: insertCoachieError.message }
  }

  return { coachieId: neuerCoachie.id }
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
  const { coachieId, error: coachieError } = await findeOderErstelleCoachie(
    session,
    supabase,
    req,
  )
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
    },
    { onConflict: 'coachie_id' },
  )

  if (error) return { error: error.message }
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

  // Idempotenz nach dem Insert-first-Prinzip: Bei Unique-Violation wurde
  // dieses Event bereits verarbeitet (z. B. Stripe-Retry-Zustellung) --
  // dann ohne erneute Verarbeitung mit 200 antworten, damit Stripe nicht
  // weiter retried.
  const { error: insertEventError } = await supabase
    .from('stripe_events')
    .insert({ id: event.id })

  if (insertEventError) {
    if (insertEventError.code === '23505') {
      res.status(200).json({ received: true, already_processed: true })
      return
    }
    res.status(500).json({ error: insertEventError.message })
    return
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const { error } = await handleSubscriptionLifecycle(event.data.object, event.type, supabase)
    if (error) {
      res.status(500).json({ error })
      return
    }
    res.status(200).json({ received: true })
    return
  }

  if (event.type === 'invoice.payment_failed') {
    const { error } = await handleInvoicePaymentFailed(event.data.object, supabase)
    if (error) {
      res.status(500).json({ error })
      return
    }
    res.status(200).json({ received: true })
    return
  }

  if (event.type !== 'checkout.session.completed') {
    res.status(200).json({ received: true })
    return
  }

  const session = event.data.object

  if (session.mode === 'subscription') {
    const { error } = await handleMitgliedschaftCheckoutAbgeschlossen(session, supabase, req)
    if (error) {
      res.status(500).json({ error })
      return
    }
    res.status(200).json({ received: true })
    return
  }

  const email = session.customer_details?.email
  const programmId = session.metadata?.programm_id

  if (!email || !programmId) {
    res
      .status(200)
      .json({ received: true, warning: 'E-Mail oder Programm-ID fehlt im Event.' })
    return
  }

  const { coachieId, error: coachieError } = await findeOderErstelleCoachie(
    session,
    supabase,
    req,
  )

  if (coachieError) {
    res.status(500).json({ error: coachieError })
    return
  }

  const { data: programm, error: programmError } = await supabase
    .from('programme')
    .select('standard_zugriffsmonate')
    .eq('id', programmId)
    .maybeSingle()

  if (programmError) {
    res.status(500).json({ error: programmError.message })
    return
  }

  let zugriffBis = null
  if (programm?.standard_zugriffsmonate) {
    const datum = new Date()
    datum.setMonth(datum.getMonth() + programm.standard_zugriffsmonate)
    zugriffBis = datum.toISOString()
  }

  const { error: assignmentError } = await supabase.from('coachie_programme').upsert(
    {
      coachie_id: coachieId,
      programm_id: programmId,
      zugewiesen_am: new Date().toISOString(),
      zugriff_bis: zugriffBis,
    },
    { onConflict: 'coachie_id,programm_id' },
  )

  if (assignmentError) {
    res.status(500).json({ error: assignmentError.message })
    return
  }

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

  res.status(200).json({ received: true })
}
