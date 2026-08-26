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
      'id, titel, beschreibung, preis_cent, slug, zielgruppe_text, ablauf_schritte, standard_zugriffsmonate, bild_url, trailer_video_url',
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
      .select('id, titel')
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

async function handleCheckoutSession(req, res, supabase) {
  const { slug } = req.body ?? {}

  if (!slug) {
    res.status(400).json({ error: 'slug ist erforderlich.' })
    return
  }

  const { data: programm, error } = await supabase
    .from('programme')
    .select('id, stripe_price_id')
    .eq('slug', slug)
    .eq('oeffentlich_kaufbar', true)
    .eq('aktiv', true)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  if (!programm || !programm.stripe_price_id) {
    res.status(404).json({ error: 'Programm ist nicht käuflich.' })
    return
  }

  const appUrl =
    process.env.APP_URL ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: programm.stripe_price_id, quantity: 1 }],
    success_url: `${appUrl}/kauf-erfolgreich`,
    cancel_url: `${appUrl}/kaufen/${slug}?abgebrochen=1`,
    metadata: { programm_id: programm.id },
  })

  res.status(200).json({ url: session.url })
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin()

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
