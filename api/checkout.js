import { getStripe } from './_lib/stripeClient.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'

// Konsolidierte Route (Vercel Hobby: max. 12 Serverless Functions).
// GET ?slug= übernimmt die frühere api/public/programme.js (öffentliche
// Programm-Vorschau für /kaufen/:slug, kein Admin-Auth), POST erstellt
// wie bisher die Stripe Checkout Session. Beide Zweige sind bewusst
// ohne requireAdmin -- diese Route ist für nicht eingeloggte Besucher
// der Kaufseite gedacht.

async function handleVorschau(req, res, supabase) {
  const { slug } = req.query

  if (!slug) {
    res.status(400).json({ error: 'slug ist erforderlich.' })
    return
  }

  const { data, error } = await supabase
    .from('programme')
    .select(
      'id, titel, beschreibung, preis_cent, slug, zielgruppe_text, ablauf_schritte, standard_zugriffsmonate, bild_url, trailer_video_url, einfuehrungspreis_cent, einfuehrungspreis_gueltig_bis, subline, leistungen_text, abgrenzung_text, cta_text',
    )
    .eq('slug', slug)
    .eq('oeffentlich_kaufbar', true)
    .eq('aktiv', true)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  if (!data) {
    res.status(404).json({ error: 'Programm nicht gefunden.' })
    return
  }

  // Modulübersicht (Titel + Anzahl Sessions je Modul) für die
  // großzügigere Verkaufsseite -- rein informativ, keine Inhalte.
  const [module, sessions, testimonials] = await Promise.all([
    supabase
      .from('module')
      .select('id, titel, beschreibung')
      .eq('programm_id', data.id)
      .order('reihenfolge', { ascending: true }),
    supabase.from('sessions').select('id, modul_id').eq('programm_id', data.id),
    // Nur freigegebene Testimonials, ohne Coachie-Namen -- eine echte
    // Namensnennung braucht zusätzliche, hier bewusst nicht vorhandene
    // Einwilligung und wird bislang manuell mit dem Coachie geklärt
    // (siehe TestimonialFormPage.jsx), nicht automatisch angezeigt.
    supabase
      .from('testimonials')
      .select('text')
      .eq('programm_id', data.id)
      .eq('freigegeben', true)
      .order('erstellt_am', { ascending: false }),
  ])

  const modulUebersicht = (module.data ?? []).map((modul) => ({
    titel: modul.titel,
    beschreibung: modul.beschreibung,
    sessionAnzahl: (sessions.data ?? []).filter((s) => s.modul_id === modul.id)
      .length,
  }))

  res.status(200).json({
    programm: {
      ...data,
      modulUebersicht,
      gesamtSessionAnzahl: (sessions.data ?? []).length,
      testimonials: testimonials.data ?? [],
    },
  })
}

// Öffentliche Vorschau der Mitgliedschafts-Einstellungen (Titel, Preis,
// Bezahltext) für die eigenständige Verkaufsseite (Punkt 5) -- analog
// zu handleVorschau, aber gegen die Singleton-Tabelle
// mitgliedschaft_einstellungen statt gegen ein einzelnes Programm.
async function handleMitgliedschaftVorschau(req, res, supabase) {
  const { data, error } = await supabase
    .from('mitgliedschaft_einstellungen')
    .select('titel, beschreibung, preis_cent, bezahltext')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ mitgliedschaft: data })
}

// Erstellt eine Stripe-Subscription-Checkout-Session (mode: 'subscription'
// statt 'payment') -- eigenständig buchbar, unabhängig von jedem
// Kurskauf. Der eigentliche Mitgliedschafts-Datensatz wird erst im
// Webhook (checkout.session.completed mit session.mode ===
// 'subscription') angelegt, wie beim bestehenden Kurs-Kauf-Flow.
async function handleMitgliedschaftCheckoutSession(req, res, supabase) {
  const { data: einstellungen, error } = await supabase
    .from('mitgliedschaft_einstellungen')
    .select('stripe_price_id')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  if (!einstellungen?.stripe_price_id) {
    res.status(404).json({ error: 'Mitgliedschaft ist aktuell nicht buchbar.' })
    return
  }

  const appUrl =
    process.env.APP_URL ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: einstellungen.stripe_price_id, quantity: 1 }],
    success_url: `${appUrl}/kauf-erfolgreich`,
    cancel_url: `${appUrl}/mitgliedschaft?abgebrochen=1`,
    metadata: { typ: 'mitgliedschaft' },
  })

  res.status(200).json({ url: session.url })
}

async function handleCheckoutSession(req, res, supabase) {
  const { slug, ref } = req.body ?? {}

  if (!slug) {
    res.status(400).json({ error: 'slug ist erforderlich.' })
    return
  }

  // Empfehlungsprogramm: ref ist der persönliche Empfehlungscode eines
  // werbenden Coachies (siehe api/certificate.js?resource=empfehlung).
  // Ein unbekannter/ungültiger Code blockiert den Kauf nicht -- er wird
  // einfach nicht zugeordnet, siehe webhooks/stripe.js.
  let werberCoachieId = null
  if (ref) {
    const { data: werber } = await supabase
      .from('coachies')
      .select('id')
      .eq('empfehlungscode', ref)
      .maybeSingle()
    werberCoachieId = werber?.id ?? null
  }

  const { data: programm, error } = await supabase
    .from('programme')
    .select(
      'id, stripe_price_id, stripe_price_id_einfuehrung, einfuehrungspreis_gueltig_bis',
    )
    .eq('slug', slug)
    .eq('oeffentlich_kaufbar', true)
    .eq('aktiv', true)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  // Serverseitig geprüft, niemals ein vom Client mitgeschicktes Datum
  // vertrauen (siehe einfuehrungspreis.sql) -- Datumsvergleich als
  // ISO-Datumsstring (YYYY-MM-DD), da einfuehrungspreis_gueltig_bis eine
  // reine date-Spalte ohne Uhrzeit ist.
  const heute = new Date().toISOString().slice(0, 10)
  const einfuehrungAktiv =
    programm?.stripe_price_id_einfuehrung &&
    programm?.einfuehrungspreis_gueltig_bis &&
    heute <= programm.einfuehrungspreis_gueltig_bis

  const priceId = einfuehrungAktiv
    ? programm.stripe_price_id_einfuehrung
    : programm?.stripe_price_id

  if (!programm || !priceId) {
    res.status(404).json({ error: 'Programm ist nicht käuflich.' })
    return
  }

  const appUrl =
    process.env.APP_URL ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/kauf-erfolgreich`,
    cancel_url: `${appUrl}/kaufen/${slug}?abgebrochen=1`,
    // Bewusst KEIN explizites payment_method_types: ['card', 'klarna']
    // -- ohne diesen Parameter zeigt Checkout automatisch alle im
    // Stripe-Dashboard aktivierten, für Betrag/Währung/Land
    // geeigneten Zahlungsarten an, Klarna eingeschlossen, sobald sie
    // dort aktiviert ist. billing_address_collection/
    // phone_number_collection sind bei vielen alternativen
    // Zahlungsarten (u. a. Klarna) Voraussetzung, unabhängig davon,
    // welche davon im Dashboard aktiv sind.
    billing_address_collection: 'required',
    phone_number_collection: { enabled: true },
    metadata: {
      programm_id: programm.id,
      ...(werberCoachieId ? { werber_coachie_id: werberCoachieId } : {}),
    },
  })

  res.status(200).json({ url: session.url })
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin()

  if (req.query.resource === 'mitgliedschaft') {
    if (req.method === 'GET') {
      await handleMitgliedschaftVorschau(req, res, supabase)
      return
    }
    if (req.method === 'POST') {
      await handleMitgliedschaftCheckoutSession(req, res, supabase)
      return
    }
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  if (req.method === 'GET') {
    await handleVorschau(req, res, supabase)
    return
  }

  if (req.method === 'POST') {
    await handleCheckoutSession(req, res, supabase)
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}
