import { getStripe } from './_lib/stripeClient.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { sendMail } from './_lib/mailer.js'

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
//
// Bugfix: line_items[].price verlangt zwingend die ID eines
// bestehenden Stripe-Price-Objekts, niemals einen rohen Betrag --
// das vorher hier verwendete stripe_price_id-Feld setzte voraus, dass
// vorab manuell ein echter Price in Stripe angelegt und seine ID
// admin-seitig eingetragen wird. Fehlte dieser Schritt oder wurde
// versehentlich der Betrag statt einer price_...-ID eingetragen, schlug
// JEDER Checkout mit "The price parameter should be the ID of a price
// object, rather than the literal numerical price." fehl. price_data
// erzeugt den Price stattdessen bei jedem Checkout automatisch inline
// aus dem ohnehin admin-pflegbaren preis_cent -- kein manueller
// Stripe-Dashboard-Schritt mehr nötig, und derselbe Wert steuert damit
// sowohl die öffentliche Vorschau (handleMitgliedschaftVorschau) als
// auch den tatsächlichen Checkout-Preis.
async function handleMitgliedschaftCheckoutSession(req, res, supabase) {
  const { data: einstellungen, error } = await supabase
    .from('mitgliedschaft_einstellungen')
    .select('titel, preis_cent')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  if (!einstellungen?.preis_cent) {
    res.status(404).json({ error: 'Mitgliedschaft ist aktuell nicht buchbar.' })
    return
  }

  const appUrl =
    process.env.APP_URL ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'eur',
          unit_amount: einstellungen.preis_cent,
          recurring: { interval: 'month' },
          product_data: { name: einstellungen.titel || 'MRH Community-Mitgliedschaft' },
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/kauf-erfolgreich`,
    cancel_url: `${appUrl}/mitgliedschaft?abgebrochen=1`,
    metadata: { typ: 'mitgliedschaft' },
  })

  res.status(200).json({ url: session.url })
}

// Kündigungsbutton (§ 312k BGB, Punkt 1): öffentlich, ohne Login --
// bewusst ein generischer Baustein für beide Vertragsarten
// (Mitgliedschaft = Stripe Subscription, Kurszugriff = Einmalzahlung
// mit Laufzeit), keine zwei getrennten Lösungen. Zwei Schritte über
// denselben POST-Zweig, unterschieden am Body: {email} sucht die
// kündbaren Verträge, {email, vertragTyp, vertragId} führt die
// Kündigung aus. Absichtlich KEIN Login-Zwang -- die E-Mail-Adresse
// dient der Identifikation, wie im Auftrag beschrieben.
//
// Hinweis (kein Ersatz für rechtliche Prüfung): Diese Umsetzung folgt
// der im Auftrag beschriebenen Rechtslage (u. a. eine im Juli 2026
// genannte BGH-Entscheidung), die sich in dieser Sandbox nicht
// unabhängig verifizieren lässt (kein Zugriff auf eine juristische
// Datenbank). Vor dem Live-Einsatz bitte juristisch gegenprüfen lassen,
// insbesondere ob eine sofortige Kündigung der Mitgliedschaft (statt
// zum Ende der bezahlten Periode) hier tatsächlich zutreffend ist.
async function handleKuendigungSuche(req, res, supabase) {
  const { email } = req.body ?? {}

  if (!email) {
    res.status(400).json({ error: 'email ist erforderlich.' })
    return
  }

  const { data: coachie, error: coachieError } = await supabase
    .from('coachies')
    .select('id, name')
    .eq('email', email)
    .maybeSingle()

  if (coachieError) {
    res.status(500).json({ error: coachieError.message })
    return
  }

  // Bewusst kein 404/Fehler bei unbekannter E-Mail -- liefert einfach
  // eine leere Vertragsliste, analog zum bestehenden
  // Passwort-vergessen-Muster (LoginPage.jsx), das ebenfalls nicht
  // verrät, ob eine E-Mail-Adresse als Coachie existiert.
  if (!coachie) {
    res.status(200).json({ vertraege: [] })
    return
  }

  const [{ data: mitgliedschaft }, { data: kursZuordnungen }] = await Promise.all([
    supabase
      .from('mitgliedschaften')
      .select('id, status')
      .eq('coachie_id', coachie.id)
      .eq('status', 'aktiv')
      .maybeSingle(),
    supabase
      .from('coachie_programme')
      .select('id, zugriff_bis, gekuendigt_am, programme(titel)')
      .eq('coachie_id', coachie.id)
      .is('gekuendigt_am', null),
  ])

  const vertraege = []

  if (mitgliedschaft) {
    vertraege.push({
      vertragTyp: 'mitgliedschaft',
      vertragId: mitgliedschaft.id,
      bezeichnung: 'MRH Community-Mitgliedschaft',
    })
  }

  for (const zuordnung of kursZuordnungen ?? []) {
    vertraege.push({
      vertragTyp: 'kurs',
      vertragId: zuordnung.id,
      bezeichnung: zuordnung.programme?.titel ?? 'Programm',
      zugriffBis: zuordnung.zugriff_bis,
    })
  }

  res.status(200).json({ vertraege })
}

async function handleKuendigungBestaetigen(req, res, supabase) {
  const { email, vertragTyp, vertragId } = req.body ?? {}

  if (!email || !vertragTyp || !vertragId) {
    res
      .status(400)
      .json({ error: 'email, vertragTyp und vertragId sind erforderlich.' })
    return
  }

  const { data: coachie, error: coachieError } = await supabase
    .from('coachies')
    .select('id, name, email')
    .eq('email', email)
    .maybeSingle()

  if (coachieError) {
    res.status(500).json({ error: coachieError.message })
    return
  }

  if (!coachie) {
    res.status(404).json({ error: 'Kein Vertrag zu dieser E-Mail-Adresse gefunden.' })
    return
  }

  let bezeichnung = ''

  if (vertragTyp === 'mitgliedschaft') {
    const { data: mitgliedschaft, error: mitgliedschaftError } = await supabase
      .from('mitgliedschaften')
      .select('id, stripe_subscription_id, status')
      .eq('id', vertragId)
      .eq('coachie_id', coachie.id)
      .maybeSingle()

    if (mitgliedschaftError) {
      res.status(500).json({ error: mitgliedschaftError.message })
      return
    }
    if (!mitgliedschaft || mitgliedschaft.status !== 'aktiv') {
      res.status(404).json({ error: 'Mitgliedschaft nicht gefunden oder bereits gekündigt.' })
      return
    }

    try {
      const stripe = getStripe()
      await stripe.subscriptions.cancel(mitgliedschaft.stripe_subscription_id)
    } catch (err) {
      res.status(500).json({ error: `Stripe-Kündigung fehlgeschlagen: ${err.message}` })
      return
    }

    const { error: updateError } = await supabase
      .from('mitgliedschaften')
      .update({ status: 'gekuendigt', aktualisiert_am: new Date().toISOString() })
      .eq('id', vertragId)

    if (updateError) {
      res.status(500).json({ error: updateError.message })
      return
    }

    bezeichnung = 'MRH Community-Mitgliedschaft'
  } else if (vertragTyp === 'kurs') {
    const { data: zuordnung, error: zuordnungError } = await supabase
      .from('coachie_programme')
      .select('id, gekuendigt_am, zugriff_bis, programme(titel)')
      .eq('id', vertragId)
      .eq('coachie_id', coachie.id)
      .maybeSingle()

    if (zuordnungError) {
      res.status(500).json({ error: zuordnungError.message })
      return
    }
    if (!zuordnung || zuordnung.gekuendigt_am) {
      res.status(404).json({ error: 'Zugang nicht gefunden oder bereits gekündigt.' })
      return
    }

    const { error: updateError } = await supabase
      .from('coachie_programme')
      .update({ gekuendigt_am: new Date().toISOString() })
      .eq('id', vertragId)

    if (updateError) {
      res.status(500).json({ error: updateError.message })
      return
    }

    bezeichnung = zuordnung.programme?.titel ?? 'Programm'
  } else {
    res.status(400).json({ error: 'Unbekannter vertragTyp.' })
    return
  }

  const jetzt = new Date()

  const { error: logError } = await supabase.from('kuendigungen').insert({
    coachie_id: coachie.id,
    vertrag_typ: vertragTyp,
    vertrag_referenz_id: vertragId,
    email: coachie.email,
    erstellt_am: jetzt.toISOString(),
  })

  if (logError) {
    res.status(500).json({ error: logError.message })
    return
  }

  // Bestätigungsmail als Nachweis für den Zugang der Erklärung -- rein
  // informativ, ein Fehlversand blockiert die bereits ausgeführte
  // Kündigung nicht mehr.
  try {
    await sendMail({
      to: coachie.email,
      subject: 'Bestätigung deiner Kündigung',
      text: `Hallo,\n\nwir bestätigen den Eingang deiner Kündigung vom ${jetzt.toLocaleString('de-DE')} für: ${bezeichnung}.\n\n${
        vertragTyp === 'mitgliedschaft'
          ? 'Deine Mitgliedschaft ist damit beendet.'
          : 'Dein bereits bezahlter Zugriff bleibt bis zum Ende der Laufzeit bestehen, verlängert sich aber nicht automatisch weiter.'
      }\n\nViele Grüße\nMRH Beratung & Coaching`,
    })
  } catch (err) {
    console.error('Kündigungsbestätigung konnte nicht versendet werden:', err.message)
  }

  res.status(200).json({ bezeichnung, zeitpunkt: jetzt.toISOString() })
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
    // customer_creation: Payment-Mode-Sessions legen sonst nicht
    // zuverlässig einen Stripe-Customer an -- ohne den gibt es später
    // keine stripe_customer_id für den Rechnungs-Download (Punkt 2).
    // invoice_creation: Payment-Mode-Sessions erzeugen sonst KEIN
    // Stripe-Invoice-Objekt (das passiert automatisch nur bei
    // Subscriptions) -- ohne das keine hosted_invoice_url/invoice_pdf.
    // Gilt nur für ab jetzt neu erstellte Sessions, nicht rückwirkend.
    customer_creation: 'always',
    invoice_creation: { enabled: true },
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

  if (req.query.resource === 'kuendigung') {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Methode nicht erlaubt.' })
      return
    }
    if (req.body?.vertragTyp) {
      await handleKuendigungBestaetigen(req, res, supabase)
    } else {
      await handleKuendigungSuche(req, res, supabase)
    }
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
