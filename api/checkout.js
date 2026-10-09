import { getStripe } from './_lib/stripeClient.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { sendMail } from './_lib/mailer.js'
import { ermittleAppUrl } from './_lib/appUrl.js'
import {
  findeOderErstelleCoachie,
  normalisiereEmail,
} from './_lib/coachieAnlage.js'

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
    .select('titel, beschreibung, preis_cent, bezahltext, mitgliedschaft_aktiv')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  // Schalter aus (Default): keine Inhalte ausliefern, die Seite zeigt
  // dann nur "startet in Kürze". Auch der Coachie-Bereich fragt hier ab,
  // ob Hinweise auf die Mitgliedschaft angezeigt werden dürfen.
  if (!data?.mitgliedschaft_aktiv) {
    res.status(200).json({ mitgliedschaft: { aktiv: false } })
    return
  }

  res.status(200).json({
    mitgliedschaft: {
      titel: data.titel,
      beschreibung: data.beschreibung,
      preis_cent: data.preis_cent,
      bezahltext: data.bezahltext,
      aktiv: true,
    },
  })
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
    .select('titel, preis_cent, mitgliedschaft_aktiv')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  if (!einstellungen?.mitgliedschaft_aktiv || !einstellungen?.preis_cent) {
    res.status(404).json({ error: 'Mitgliedschaft ist aktuell nicht buchbar.' })
    return
  }

  const appUrl = ermittleAppUrl(req)

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

// Gratis-Anmeldung für Programme mit preis_cent = 0 (z. B. die
// Standortbestimmung): kein Stripe, direkt Coachie anlegen bzw. finden
// und zuordnen. Alle Bedingungen werden serverseitig geprüft, nie dem
// Client geglaubt. Die Antwort ist immer dieselbe, unabhängig davon, ob
// die Adresse schon existiert (keine Enumeration).
const GRATIS_LIMIT_PRO_TAG = 5
const GRATIS_ERFOLG = { status: 'ok' }
const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function handleGratisAnmeldung(req, res, supabase) {
  const { slug, name, email, website } = req.body ?? {}

  // Honeypot: echte Besucher sehen das Feld nicht. Still verwerfen, mit
  // derselben Erfolgsantwort, damit Bots nichts lernen.
  if (website) {
    res.status(200).json(GRATIS_ERFOLG)
    return
  }

  const normalisiert = normalisiereEmail(email)
  const vorname = typeof name === 'string' ? name.trim().slice(0, 100) : ''

  if (!slug || !vorname || !EMAIL_MUSTER.test(normalisiert) || normalisiert.length > 254) {
    res.status(400).json({ error: 'Bitte Vorname und eine gültige E-Mail-Adresse angeben.' })
    return
  }

  const { data: programm, error: programmError } = await supabase
    .from('programme')
    .select('id, titel, preis_cent, standard_zugriffsmonate')
    .eq('slug', slug)
    .eq('oeffentlich_kaufbar', true)
    .eq('aktiv', true)
    .maybeSingle()

  if (programmError) {
    res.status(500).json({ error: programmError.message })
    return
  }

  if (!programm || programm.preis_cent !== 0) {
    res.status(404).json({ error: 'Programm ist nicht kostenlos verfügbar.' })
    return
  }

  // Missbrauchsbremse: höchstens 5 Anmeldungen pro Adresse in 24 Stunden.
  const seit = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await supabase
    .from('gratis_anmeldungen')
    .select('id', { count: 'exact', head: true })
    .eq('email', normalisiert)
    .gte('erstellt_am', seit)

  if (countError) {
    res.status(500).json({ error: countError.message })
    return
  }

  if ((count ?? 0) >= GRATIS_LIMIT_PRO_TAG) {
    res.status(429).json({
      error: 'Zu viele Anmeldungen mit dieser Adresse. Bitte versuche es morgen erneut.',
    })
    return
  }

  const { error: logError } = await supabase
    .from('gratis_anmeldungen')
    .insert({ email: normalisiert, programm_id: programm.id })

  if (logError) {
    res.status(500).json({ error: logError.message })
    return
  }

  const appUrl = ermittleAppUrl(req)
  const { coachieId, neu, error: coachieError } = await findeOderErstelleCoachie({
    email: normalisiert,
    name: vorname,
    supabase,
    appUrl,
  })

  if (coachieError) {
    console.error('Gratis-Anmeldung: Coachie konnte nicht angelegt werden:', coachieError)
    res.status(500).json({ error: 'Die Anmeldung konnte gerade nicht abgeschlossen werden.' })
    return
  }

  const { data: zuordnung, error: zuordnungError } = await supabase
    .from('coachie_programme')
    .select('id')
    .eq('coachie_id', coachieId)
    .eq('programm_id', programm.id)
    .maybeSingle()

  if (zuordnungError) {
    res.status(500).json({ error: zuordnungError.message })
    return
  }

  if (!zuordnung) {
    let zugriffBis = null
    if (programm.standard_zugriffsmonate) {
      const datum = new Date()
      datum.setMonth(datum.getMonth() + programm.standard_zugriffsmonate)
      zugriffBis = datum.toISOString()
    }

    const { error: insertError } = await supabase.from('coachie_programme').insert({
      coachie_id: coachieId,
      programm_id: programm.id,
      zugewiesen_am: new Date().toISOString(),
      zugriff_bis: zugriffBis,
    })

    // 23505: parallel angelegt, Ergebnis ist dasselbe.
    if (insertError && insertError.code !== '23505') {
      res.status(500).json({ error: insertError.message })
      return
    }
  }

  // Neu eingeladene Coachies haben die Supabase-Einladung bereits im
  // Postfach. Bestehende bekommen stattdessen einen kurzen Hinweis.
  if (!neu) {
    try {
      await sendMail({
        to: normalisiert,
        subject: 'Dein Kurs ist freigeschaltet',
        text: `Hallo ${vorname},\n\n„${programm.titel}“ ist in deinem Bereich der MRH Coaching-Plattform freigeschaltet.\n\nHier meldest du dich an: ${appUrl}/login\n\nFalls du noch kein Passwort festgelegt hast, nutze auf der Login-Seite „Passwort vergessen“.\n\nViele Grüße\nMarcel Holz\nMRH Beratung & Coaching`,
      })
    } catch (err) {
      console.error('Freischaltungsmail konnte nicht versendet werden:', err.message)
    }
  }

  res.status(200).json(GRATIS_ERFOLG)
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

  const appUrl = ermittleAppUrl(req)

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

  if (req.method === 'POST' && req.query.aktion === 'gratis') {
    await handleGratisAnmeldung(req, res, supabase)
    return
  }

  if (req.method === 'POST') {
    await handleCheckoutSession(req, res, supabase)
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}
