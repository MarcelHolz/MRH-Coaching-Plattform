import { getStripe } from './_lib/stripeClient.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { sendMail } from './_lib/mailer.js'
import { ermittleAppUrl } from './_lib/appUrl.js'
import {
  findeOderErstelleCoachie,
  normalisiereEmail,
} from './_lib/coachieAnlage.js'
import { requireCoachie } from './_lib/coachieAuth.js'
import {
  VERTRAG_LABEL,
  erstelleKuendigungsToken,
  formatZeitpunkt,
  fuehreKuendigungAus,
  normalisiereZeitpunkt,
  pruefeKuendigungsToken,
  zeitpunktText,
} from './_lib/kuendigung.js'

// Konsolidierte Route (Vercel Hobby: max. 12 Serverless Functions), für
// nicht eingeloggte Besucher gedacht, daher ohne requireAdmin:
//   GET  ?slug=                     öffentliche Programm-Vorschau (/kaufen/:slug)
//   POST                            Stripe Checkout Session (Kurskauf)
//   POST ?aktion=gratis             Gratis-Anmeldung (preis_cent = 0)
//   GET/POST ?resource=mitgliedschaft   Vorschau bzw. Checkout Mitgliedschaft
//   POST ?resource=kuendigung[&aktion=bestaetigen|direkt]   Kündigungsbutton

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

// Zustimmung zu AGB und Widerrufsverzicht (§ 356 Abs. 5 BGB) muss vor
// jedem kostenpflichtigen Checkout vorliegen. Der Client schickt die
// Zeitpunkte des Anhakens; akzeptiert werden nur plausible Werte (nicht
// älter als 24 Stunden, nicht in der Zukunft).
const ZUSTIMMUNG_MAX_ALTER_MS = 24 * 60 * 60 * 1000
const ZUSTIMMUNG_MAX_VORLAUF_MS = 5 * 60 * 1000

function pruefeZeitpunkt(wert) {
  if (typeof wert !== 'string') return null
  const zeit = Date.parse(wert)
  if (Number.isNaN(zeit)) return null
  const jetzt = Date.now()
  if (zeit < jetzt - ZUSTIMMUNG_MAX_ALTER_MS || zeit > jetzt + ZUSTIMMUNG_MAX_VORLAUF_MS) {
    return null
  }
  return new Date(zeit).toISOString()
}

function pruefeKaufZustimmung(body) {
  const agbAkzeptiertAm = pruefeZeitpunkt(body?.agbAkzeptiertAm)
  const widerrufsverzichtAm = pruefeZeitpunkt(body?.widerrufsverzichtAm)
  if (!agbAkzeptiertAm || !widerrufsverzichtAm) {
    return {
      error:
        'Bitte bestätige die AGB und den Hinweis zum Widerrufsrecht, bevor du zur Bezahlung gehst.',
    }
  }
  return { agbAkzeptiertAm, widerrufsverzichtAm }
}

const WIDERRUFSVERZICHT_HINWEIS =
  'Du hast verlangt, dass wir vor Ablauf der Widerrufsfrist mit der Bereitstellung der digitalen Inhalte beginnen. Mit Beginn der Bereitstellung erlischt dein Widerrufsrecht.'

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
  const zustimmung = pruefeKaufZustimmung(req.body)
  if (zustimmung.error) {
    res.status(400).json({ error: zustimmung.error })
    return
  }

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
    custom_text: { submit: { message: WIDERRUFSVERZICHT_HINWEIS } },
    metadata: {
      typ: 'mitgliedschaft',
      agb_akzeptiert_am: zustimmung.agbAkzeptiertAm,
      widerrufsverzicht_am: zustimmung.widerrufsverzichtAm,
    },
  })

  res.status(200).json({ url: session.url })
}

// Kündigungsbutton (§ 312k BGB). Drei Wege über dieselbe Route:
//
// 1. Öffentliches Formular (POST ?resource=kuendigung): nimmt die
//    Kündigungserklärung entgegen, protokolliert sie und bestätigt den
//    Eingang per Mail. Gibt KEINE Vertragsdaten zurück und antwortet
//    immer gleich, damit niemand über eine fremde Adresse Buchungen
//    einsehen oder beenden kann. Gehört die Adresse einem Coachie,
//    enthält die Mail einen signierten Bestätigungslink.
// 2. Bestätigungslink (POST ?resource=kuendigung&aktion=bestaetigen):
//    führt die protokollierte Kündigung erst nach Klick aus.
// 3. Eingeloggte Coachies (POST ?resource=kuendigung&aktion=direkt,
//    Bearer-Token): sofortige Ausführung ohne Mailbestätigung.
//
// Mitgliedschaften enden zum Ende der bezahlten Periode
// (cancel_at_period_end), nicht sofort.
const KUENDIGUNG_EINGANG = {
  status: 'eingegangen',
  meldung: 'Deine Kündigung ist eingegangen. Du erhältst eine Bestätigung per E-Mail.',
}
const KUENDIGUNG_LIMIT_PRO_TAG = 5

function adminAdresse() {
  return process.env.ADMIN_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER
}

async function sendeOhneAbbruch(mail) {
  try {
    await sendMail(mail)
    return true
  } catch (err) {
    console.error(`Mail an ${mail.to} nicht versendet:`, err.message)
    return false
  }
}

function erklaerungsText({ name, email, vertrag, angaben, zeitpunkt, erstelltAm }) {
  return [
    `Eingegangen am: ${formatZeitpunkt(erstelltAm)}`,
    `Name: ${name}`,
    `E-Mail: ${email}`,
    `Vertrag: ${VERTRAG_LABEL[vertrag] ?? vertrag}`,
    ...(angaben ? [`Angaben: ${angaben}`] : []),
    `Gewünschter Zeitpunkt: ${zeitpunktText(zeitpunkt)}`,
  ].join('\n')
}

async function handleKuendigungErklaerung(req, res, supabase) {
  const { name, email, vertrag, angaben, zeitpunkt, website } = req.body ?? {}

  if (website) {
    res.status(200).json(KUENDIGUNG_EINGANG)
    return
  }

  const normalisiert = normalisiereEmail(email)
  const nameSauber = typeof name === 'string' ? name.trim().slice(0, 200) : ''
  const vertragSauber = VERTRAG_LABEL[vertrag] ? vertrag : 'alle'
  const angabenSauber = typeof angaben === 'string' ? angaben.trim().slice(0, 1000) : ''
  const zeitpunktSauber = normalisiereZeitpunkt(zeitpunkt)

  if (!nameSauber || !EMAIL_MUSTER.test(normalisiert)) {
    res.status(400).json({ error: 'Bitte Name und eine gültige E-Mail-Adresse angeben.' })
    return
  }
  if (!zeitpunktSauber) {
    res.status(400).json({ error: 'Bitte ein gültiges Datum in der Zukunft wählen.' })
    return
  }

  const seit = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('kuendigungserklaerungen')
    .select('id', { count: 'exact', head: true })
    .eq('email', normalisiert)
    .gte('erstellt_am', seit)

  if ((count ?? 0) >= KUENDIGUNG_LIMIT_PRO_TAG) {
    res.status(429).json({
      error: 'Zu viele Kündigungen mit dieser Adresse. Bitte versuche es morgen erneut.',
    })
    return
  }

  const { data: coachie } = await supabase
    .from('coachies')
    .select('id')
    .eq('email', normalisiert)
    .maybeSingle()

  const { data: erklaerung, error: insertError } = await supabase
    .from('kuendigungserklaerungen')
    .insert({
      name: nameSauber,
      email: normalisiert,
      vertrag: vertragSauber,
      angaben: angabenSauber || null,
      zeitpunkt: zeitpunktSauber,
      quelle: 'formular',
      coachie_id: coachie?.id ?? null,
      status: coachie ? 'eingegangen' : 'manuell_pruefen',
    })
    .select('id, erstellt_am')
    .single()

  if (insertError) {
    res.status(500).json({ error: insertError.message })
    return
  }

  const inhalt = erklaerungsText({
    name: nameSauber,
    email: normalisiert,
    vertrag: vertragSauber,
    angaben: angabenSauber,
    zeitpunkt: zeitpunktSauber,
    erstelltAm: erklaerung.erstellt_am,
  })

  const link = coachie
    ? `${ermittleAppUrl(req)}/vertrag-kuendigen?token=${encodeURIComponent(
        erstelleKuendigungsToken(erklaerung.id),
      )}`
    : null

  await sendeOhneAbbruch({
    to: normalisiert,
    subject: 'Eingangsbestätigung deiner Kündigung',
    text: `Hallo ${nameSauber},\n\nwir bestätigen den Eingang deiner Kündigungserklärung mit folgendem Inhalt:\n\n${inhalt}\n\n${
      link
        ? `Bitte bestätige die Kündigung über diesen Link (gültig 7 Tage):\n${link}\n\nErst nach der Bestätigung wird die Kündigung ausgeführt. Damit stellen wir sicher, dass niemand ohne dein Wissen in deinem Namen kündigt.`
        : 'Wir prüfen deine Kündigung und melden uns kurzfristig bei dir.'
    }\n\nFalls du diese Kündigung nicht abgeschickt hast, kannst du diese E-Mail ignorieren.\n\nViele Grüße\nMRH Beratung & Coaching`,
  })

  await sendeOhneAbbruch({
    to: adminAdresse(),
    subject: 'Kündigungserklärung eingegangen',
    text: `Über /vertrag-kuendigen ist eine Kündigung eingegangen.\n\n${inhalt}\n\n${
      coachie
        ? 'Die Adresse gehört zu einem Coachie. Ausführung nach Klick auf den Bestätigungslink.'
        : 'Kein Coachie mit dieser Adresse gefunden. Bitte manuell prüfen.'
    }`,
    replyTo: normalisiert,
  })

  res.status(200).json(KUENDIGUNG_EINGANG)
}

async function schliesseKuendigungAb(req, res, supabase, erklaerung, coachie) {
  let ergebnis
  try {
    ergebnis = await fuehreKuendigungAus(supabase, {
      coachieId: erklaerung.coachie_id,
      vertrag: erklaerung.vertrag,
      vertragId: erklaerung.vertrag_id,
      zeitpunkt: erklaerung.zeitpunkt,
    })
  } catch (err) {
    console.error('Kündigung konnte nicht ausgeführt werden:', err)
    await sendeOhneAbbruch({
      to: adminAdresse(),
      subject: 'Kündigung konnte nicht ausgeführt werden',
      text: `Kündigungserklärung ${erklaerung.id} (${erklaerung.email}) ist fehlgeschlagen: ${err.message}\nBitte manuell ausführen.`,
    })
    await supabase
      .from('kuendigungserklaerungen')
      .update({ status: 'fehler', ergebnis: err.message })
      .eq('id', erklaerung.id)
    res.status(500).json({
      error:
        'Die Kündigung ist bei uns eingegangen, konnte aber nicht automatisch ausgeführt werden. Wir kümmern uns darum und melden uns.',
    })
    return
  }

  const jetzt = new Date().toISOString()
  await supabase
    .from('kuendigungserklaerungen')
    .update({ status: 'ausgefuehrt', ausgefuehrt_am: jetzt, ergebnis: ergebnis.join('\n') })
    .eq('id', erklaerung.id)

  const text = `Hallo ${coachie?.name || erklaerung.name},\n\nwir bestätigen deine Kündigung vom ${formatZeitpunkt(
    erklaerung.erstellt_am,
  )}.\n\n${ergebnis.join('\n')}\n\nViele Grüße\nMRH Beratung & Coaching`

  await sendeOhneAbbruch({
    to: erklaerung.email,
    subject: 'Bestätigung deiner Kündigung',
    text,
  })
  await sendeOhneAbbruch({
    to: adminAdresse(),
    subject: 'Kündigung ausgeführt',
    text: `Kopie der Kündigungsbestätigung an ${erklaerung.email}:\n\n${text}`,
  })

  res.status(200).json({ status: 'ausgefuehrt', ergebnis })
}

async function handleKuendigungBestaetigen(req, res, supabase) {
  const erklaerungId = pruefeKuendigungsToken(req.body?.token)
  if (!erklaerungId) {
    res.status(400).json({
      error: 'Der Link ist ungültig oder abgelaufen. Bitte sende die Kündigung erneut ab.',
    })
    return
  }

  const { data: erklaerung, error } = await supabase
    .from('kuendigungserklaerungen')
    .select('*')
    .eq('id', erklaerungId)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  if (!erklaerung?.coachie_id) {
    res.status(404).json({ error: 'Kündigung nicht gefunden.' })
    return
  }
  if (erklaerung.status === 'ausgefuehrt') {
    res.status(200).json({ status: 'bereits_ausgefuehrt' })
    return
  }

  const { data: coachie } = await supabase
    .from('coachies')
    .select('name')
    .eq('id', erklaerung.coachie_id)
    .maybeSingle()

  await schliesseKuendigungAb(req, res, supabase, erklaerung, coachie)
}

async function handleKuendigungDirekt(req, res, supabase) {
  const coachieId = await requireCoachie(req, res, supabase)
  if (!coachieId) return

  const { vertrag, vertragId, zeitpunkt } = req.body ?? {}
  const vertragSauber = VERTRAG_LABEL[vertrag] ? vertrag : null
  const zeitpunktSauber = normalisiereZeitpunkt(zeitpunkt)

  if (!vertragSauber || !zeitpunktSauber) {
    res.status(400).json({ error: 'Ungültige Angaben zur Kündigung.' })
    return
  }

  const { data: coachie, error: coachieError } = await supabase
    .from('coachies')
    .select('name, email')
    .eq('id', coachieId)
    .single()

  if (coachieError) {
    res.status(500).json({ error: coachieError.message })
    return
  }

  const { data: erklaerung, error: insertError } = await supabase
    .from('kuendigungserklaerungen')
    .insert({
      name: coachie.name || coachie.email,
      email: coachie.email,
      vertrag: vertragSauber,
      vertrag_id: typeof vertragId === 'string' ? vertragId : null,
      zeitpunkt: zeitpunktSauber,
      quelle: 'eingeloggt',
      coachie_id: coachieId,
      status: 'eingegangen',
    })
    .select('*')
    .single()

  if (insertError) {
    res.status(500).json({ error: insertError.message })
    return
  }

  await schliesseKuendigungAb(req, res, supabase, erklaerung, coachie)
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

  const zustimmung = pruefeKaufZustimmung(req.body)
  if (zustimmung.error) {
    res.status(400).json({ error: zustimmung.error })
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
    custom_text: { submit: { message: WIDERRUFSVERZICHT_HINWEIS } },
    metadata: {
      programm_id: programm.id,
      agb_akzeptiert_am: zustimmung.agbAkzeptiertAm,
      widerrufsverzicht_am: zustimmung.widerrufsverzichtAm,
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
    if (req.query.aktion === 'bestaetigen') {
      await handleKuendigungBestaetigen(req, res, supabase)
    } else if (req.query.aktion === 'direkt') {
      await handleKuendigungDirekt(req, res, supabase)
    } else {
      await handleKuendigungErklaerung(req, res, supabase)
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
