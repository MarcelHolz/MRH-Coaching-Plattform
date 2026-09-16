import crypto from 'node:crypto'
import { requireAdmin } from '../_lib/adminAuth.js'
import { requireCoachie } from '../_lib/coachieAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { sendMail } from '../_lib/mailer.js'

const BILD_BUCKET = 'programm-bilder'

// contentType -> Dateiendung, zugleich die serverseitige Whitelist
// erlaubter Bildformate (siehe auch file_size_limit/allowed_mime_types
// auf dem Bucket selbst, programm_bilder_bucket.sql).
const ERLAUBTE_BILD_TYPEN = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// Für Programm- und Modul-Vorschaubilder gemeinsam genutzt (Admin-
// Formulare in AdminProgrammePage.jsx und ModuleManager.jsx) --
// erzeugt ein Einweg-Upload-Token per service_role, der eigentliche
// Datei-Upload läuft danach direkt vom Browser zu Supabase Storage
// (uploadToSignedUrl), nicht über diese Serverless Function -- so
// bleibt der Function-Body klein, unabhängig von der Bildgröße.
async function handleBildUploadUrl(req, res, supabase) {
  const { contentType } = req.body ?? {}
  const endung = ERLAUBTE_BILD_TYPEN[contentType]

  if (!endung) {
    res
      .status(400)
      .json({ error: 'Nur JPG, PNG oder WEBP sind als Bildformat erlaubt.' })
    return
  }

  const pfad = `${crypto.randomUUID()}.${endung}`

  const { data, error } = await supabase.storage
    .from(BILD_BUCKET)
    .createSignedUploadUrl(pfad)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const { data: publicUrlData } = supabase.storage
    .from(BILD_BUCKET)
    .getPublicUrl(pfad)

  res.status(200).json({
    pfad: data.path,
    token: data.token,
    publicUrl: publicUrlData.publicUrl,
  })
}

// Admin-Sichtung eingereichter Testimonials (Feature 2) -- Coachies
// legen sie per RLS direkt an (siehe testimonials.sql,
// TestimonialFormPage.jsx), hier nur Lesen/Freigeben/Ablehnen mit
// service_role. Keine automatische Freigabe, siehe Aufgabenstellung.
async function handleTestimonials(req, res, supabase) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('testimonials')
      .select('*, coachies(name), programme(titel)')
      .order('erstellt_am', { ascending: false })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ testimonials: data })
    return
  }

  if (req.method === 'PATCH') {
    const { id, freigegeben } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('testimonials')
      .update({ freigegeben })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ testimonial: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { error } = await supabase.from('testimonials').delete().eq('id', id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

// Reine, isoliert testbare Zusammenstellungsfunktion für das Review-
// Interface (Feature 2): verschachtelt Programm-Entwürfe mit ihren
// Modulen/Sessions und hängt an jeden Datensatz seine Änderungshistorie
// (entwurf_historie.sql) für die Vorher/Nachher-Diff-Ansicht. Erwartet
// programme bereits auf aktiv=false gefiltert (macht die DB-Query).
export function baueEntwurfsUebersicht({ programme, module, sessions, historie }) {
  const programmIds = new Set(programme.map((p) => p.id))
  const alleModule = module.filter((m) => programmIds.has(m.programm_id))
  const alleSessions = sessions.filter((s) => programmIds.has(s.programm_id))

  function historieFuer(tabelle, id) {
    return historie.filter((h) => h.tabelle === tabelle && h.datensatz_id === id)
  }

  function sessionZuObjekt(session) {
    return { ...session, historie: historieFuer('sessions', session.id) }
  }

  return programme.map((programm) => ({
    ...programm,
    historie: historieFuer('programme', programm.id),
    module: alleModule
      .filter((m) => m.programm_id === programm.id)
      .map((modul) => ({
        ...modul,
        historie: historieFuer('module', modul.id),
        sessions: alleSessions
          .filter((s) => s.modul_id === modul.id)
          .map(sessionZuObjekt),
      })),
    sessions_ohne_modul: alleSessions
      .filter((s) => s.programm_id === programm.id && !s.modul_id)
      .map(sessionZuObjekt),
  }))
}

// Review-Interface für Agent-Entwürfe (Feature 2): liefert alle noch
// nicht freigegebenen Programm-Entwürfe (aktiv=false) verschachtelt mit
// ihren Modulen/Sessions, plus je Datensatz die Änderungshistorie
// für die Vorher/Nachher-Diff-Ansicht. Bewusst nur GET -- Freigabe
// läuft über den bestehenden PATCH-Zweig unten ({id, aktiv: true}),
// Ablehnen über den bestehenden DELETE-Zweig (der für Entwürfe
// kaskadierend löscht, siehe dort).
async function handleEntwuerfe(req, res, supabase) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt -- dieser Pfad ist rein lesend.' })
    return
  }

  const [programmeResult, modulResult, sessionsResult, historieResult] = await Promise.all([
    supabase
      .from('programme')
      .select('*')
      .eq('aktiv', false)
      .order('erstellt_am', { ascending: false }),
    supabase.from('module').select('*').order('reihenfolge', { ascending: true }),
    supabase.from('sessions').select('*').order('reihenfolge', { ascending: true }),
    supabase
      .from('entwurf_historie')
      .select('*')
      .order('geaendert_am', { ascending: false })
      .limit(500),
  ])

  const fehler = [programmeResult, modulResult, sessionsResult, historieResult].find(
    (result) => result.error,
  )
  if (fehler) {
    res.status(500).json({ error: fehler.error.message })
    return
  }

  const programme = baueEntwurfsUebersicht({
    programme: programmeResult.data ?? [],
    module: modulResult.data ?? [],
    sessions: sessionsResult.data ?? [],
    historie: historieResult.data ?? [],
  })

  res.status(200).json({ programme })
}

// Admin-CRUD der FAQ-Wissensbasis für den Coachie-Chat (Feature "KI-Chat
// für FAQs", faq.sql). Über die Agent-API (?resource=faq in
// api/agent/inhalte.js) angelegte Einträge landen mit aktiv=false als
// Entwurf, bis sie hier freigegeben werden -- gleiches Muster wie
// programme.aktiv.
async function handleFaq(req, res, supabase) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('faq_eintraege')
      .select('*')
      .order('reihenfolge', { ascending: true })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ faq_eintraege: data })
    return
  }

  if (req.method === 'POST') {
    const { frage, antwort, reihenfolge } = req.body ?? {}

    if (!frage || !antwort) {
      res.status(400).json({ error: 'frage und antwort sind erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('faq_eintraege')
      .insert({ frage, antwort, reihenfolge: reihenfolge ?? 0, aktiv: true })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ faq_eintrag: data })
    return
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('faq_eintraege')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ faq_eintrag: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { error } = await supabase.from('faq_eintraege').delete().eq('id', id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

// Admin-CRUD für den Events-Kalender (Live-Calls/Webinare/Gruppen-
// termine, events.sql). programm_id = null -> plattformweit sichtbar,
// sonst nur für Coachies mit einer coachie_programme-Zeile für dieses
// Programm (siehe RLS-Policy in der Migration). Coachies lesen die
// Liste direkt über den Supabase-Client, hier nur die Admin-Pflege.
// E-Mail-Benachrichtigung bei neuem Termin (Punkt 4, bewusst schlank --
// kein Benachrichtigungscenter, nur dieser eine Auslöser). Ermittelt
// die Empfänger nach derselben Filterlogik wie die bestehende
// Coachie-seitige RLS-Policy auf events (programm_id/nur_mitglieder,
// siehe supabase_migrations/events.sql bzw. mitgliederbereich.sql),
// damit niemand eine Mail zu einem Termin bekommt, den er in der
// Termine-Liste ohnehin nicht sehen würde. Best-effort: ein
// Mailversand-Fehler lässt weder die anderen Empfänger noch das
// Anlegen des Termins selbst scheitern. Sequenzielle Versendung ohne
// Warteschlange, bewusst schlank gehalten -- bei einer sehr großen
// Coachie-Anzahl (deutlich über den aktuell üblichen Größenordnungen
// dieser Plattform) müsste das auf einen asynchronen Batch-Versand
// umgestellt werden.
async function benachrichtigeUeberNeuenTermin(event, supabase) {
  let coachieIds = null

  if (event.programm_id) {
    const { data: zuordnungen } = await supabase
      .from('coachie_programme')
      .select('coachie_id')
      .eq('programm_id', event.programm_id)
    coachieIds = new Set((zuordnungen ?? []).map((z) => z.coachie_id))
  }

  if (event.nur_mitglieder) {
    const { data: mitgliedschaften } = await supabase
      .from('mitgliedschaften')
      .select('coachie_id')
      .eq('status', 'aktiv')
    const mitgliederIds = new Set((mitgliedschaften ?? []).map((m) => m.coachie_id))
    coachieIds = coachieIds
      ? new Set([...coachieIds].filter((id) => mitgliederIds.has(id)))
      : mitgliederIds
  }

  if (coachieIds && coachieIds.size === 0) return

  const { data: coachies } = coachieIds
    ? await supabase.from('coachies').select('email').in('id', [...coachieIds])
    : await supabase.from('coachies').select('email')

  const zeitpunkt = new Date(event.start_zeitpunkt).toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  for (const coachie of coachies ?? []) {
    if (!coachie.email) continue
    try {
      await sendMail({
        to: coachie.email,
        subject: `Neuer Termin: ${event.titel}`,
        text: `Hallo,\n\nes gibt einen neuen Termin: "${event.titel}" am ${zeitpunkt}.\n\nDetails findest du unter "Termine" im Coachie-Bereich.\n\nViele Grüße\nMRH Beratung & Coaching`,
      })
    } catch (err) {
      console.error(`Termin-Benachrichtigung an ${coachie.email} fehlgeschlagen:`, err.message)
    }
  }
}

async function handleEvents(req, res, supabase) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('events')
      .select('*, programme(titel)')
      .order('start_zeitpunkt', { ascending: true })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ events: data })
    return
  }

  if (req.method === 'POST') {
    const {
      titel,
      beschreibung,
      start_zeitpunkt,
      ende_zeitpunkt,
      link,
      programm_id,
      nur_mitglieder,
    } = req.body ?? {}

    if (!titel || !start_zeitpunkt) {
      res.status(400).json({ error: 'titel und start_zeitpunkt sind erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        titel,
        beschreibung: beschreibung || null,
        start_zeitpunkt,
        ende_zeitpunkt: ende_zeitpunkt || null,
        link: link || null,
        programm_id: programm_id || null,
        nur_mitglieder: Boolean(nur_mitglieder),
      })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    try {
      await benachrichtigeUeberNeuenTermin(data, supabase)
    } catch (err) {
      console.error('Termin-Benachrichtigungen konnten nicht versendet werden:', err.message)
    }

    res.status(201).json({ event: data })
    return
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ event: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { error } = await supabase.from('events').delete().eq('id', id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

// Admin-Pflege der Mitgliedschafts-Einstellungen (Preis, Stripe-Price-ID,
// Bezahltext, Mitgliederbereich Punkt 1+5) -- Singleton-Zeile
// (mitgliedschaft_einstellungen.id = true), daher rein GET/PATCH ohne
// id im Body. Preis steht laut Auftrag noch nicht fest, deshalb hier
// konfigurierbar statt hart codiert, analog zu programme.preis_cent.
async function handleMitgliedschaftEinstellungen(req, res, supabase) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('mitgliedschaft_einstellungen')
      .select('*')
      .eq('id', true)
      .maybeSingle()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ einstellungen: data })
    return
  }

  if (req.method === 'PATCH') {
    const { titel, beschreibung, preis_cent, stripe_price_id, bezahltext } =
      req.body ?? {}

    const { data, error } = await supabase
      .from('mitgliedschaft_einstellungen')
      .update({
        titel,
        beschreibung: beschreibung || null,
        preis_cent: preis_cent != null ? preis_cent : null,
        stripe_price_id: stripe_price_id || null,
        bezahltext: bezahltext || null,
        aktualisiert_am: new Date().toISOString(),
      })
      .eq('id', true)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ einstellungen: data })
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

// Admin-Pflege des externen Bewertungslinks (Google/Trustpilot), der
// der automatischen Testimonial-Einladungsmail beigefügt wird
// (api/cron/erinnerungen.js) -- Singleton-Muster analog zu
// handleMitgliedschaftEinstellungen.
async function handlePlattformEinstellungen(req, res, supabase) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('plattform_einstellungen')
      .select('*')
      .eq('id', true)
      .maybeSingle()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ einstellungen: data })
    return
  }

  if (req.method === 'PATCH') {
    const { bewertung_link } = req.body ?? {}

    const { data, error } = await supabase
      .from('plattform_einstellungen')
      .update({
        bewertung_link: bewertung_link || null,
        aktualisiert_am: new Date().toISOString(),
      })
      .eq('id', true)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ einstellungen: data })
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

// Admin-CRUD für Mitglieder-Inhalte (Mitgliederbereich Punkt 4) --
// analog zum bestehenden Material-Upload-Muster (siehe
// handleBildUploadUrl/api/admin/sessions.js): der eigentliche
// Datei-Upload läuft per Einweg-Signed-URL direkt vom Browser zum
// privaten Bucket "mitglieder-inhalte", hier nur Metadaten-CRUD plus
// die Erzeugung des Upload-Tokens.
const MITGLIEDER_BUCKET = 'mitglieder-inhalte'

const ERLAUBTE_MITGLIEDER_DATEI_TYPEN = {
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

async function handleMitgliederDateiUpload(req, res, supabase) {
  const { contentType, dateiname } = req.body ?? {}
  const endung = ERLAUBTE_MITGLIEDER_DATEI_TYPEN[contentType]

  if (!endung) {
    res
      .status(400)
      .json({ error: 'Nur PDF, MP3, WAV, JPG oder PNG sind erlaubt.' })
    return
  }

  const sichererDateiname = String(dateiname || `datei.${endung}`).replace(
    /[^a-zA-Z0-9._-]/g,
    '_',
  )
  const pfad = `${Date.now()}-${sichererDateiname}`

  const { data, error } = await supabase.storage
    .from(MITGLIEDER_BUCKET)
    .createSignedUploadUrl(pfad)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ pfad: data.path, token: data.token })
}

async function handleMitgliederInhalte(req, res, supabase) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('mitglieder_inhalte')
      .select('*')
      .order('veroeffentlicht_am', { ascending: false })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ mitglieder_inhalte: data })
    return
  }

  if (req.method === 'POST') {
    const { typ, titel, beschreibung, datei_url, link_url, veroeffentlicht_am } =
      req.body ?? {}

    if (!typ || !titel) {
      res.status(400).json({ error: 'typ und titel sind erforderlich.' })
      return
    }

    if (!datei_url && !link_url) {
      res.status(400).json({ error: 'datei_url oder link_url ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('mitglieder_inhalte')
      .insert({
        typ,
        titel,
        beschreibung: beschreibung || null,
        datei_url: datei_url || null,
        link_url: link_url || null,
        veroeffentlicht_am: veroeffentlicht_am || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ mitglieder_inhalt: data })
    return
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('mitglieder_inhalte')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ mitglieder_inhalt: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { error } = await supabase.from('mitglieder_inhalte').delete().eq('id', id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

export default async function handler(req, res) {
  // Coachie-Selbstbedienung für das eigene Profilbild (Feature 2,
  // EinstellungenPage.jsx) -- bewusst vor dem requireAdmin-Gate, da
  // hier kein Admin, sondern ein eingeloggter Coachie zugreift (per
  // Supabase-Access-Token, siehe requireCoachie/api/certificate.js).
  // Nutzt denselben öffentlichen Bucket "programm-bilder" wie die
  // Admin-Bilder, kein neuer Bucket/keine neue Function nötig.
  if (req.method === 'POST' && req.query.resource === 'avatar-upload') {
    const supabase = getSupabaseAdmin()
    const coachieId = await requireCoachie(req, res, supabase)
    if (!coachieId) return
    await handleBildUploadUrl(req, res, supabase)
    return
  }

  if (!requireAdmin(req, res)) return

  const supabase = getSupabaseAdmin()

  if (req.method === 'POST' && req.query.resource === 'bild-upload') {
    await handleBildUploadUrl(req, res, supabase)
    return
  }

  if (req.query.resource === 'testimonials') {
    await handleTestimonials(req, res, supabase)
    return
  }

  if (req.query.resource === 'entwuerfe') {
    await handleEntwuerfe(req, res, supabase)
    return
  }

  if (req.query.resource === 'faq') {
    await handleFaq(req, res, supabase)
    return
  }

  if (req.query.resource === 'events') {
    await handleEvents(req, res, supabase)
    return
  }

  if (req.query.resource === 'mitgliedschaft-einstellungen') {
    await handleMitgliedschaftEinstellungen(req, res, supabase)
    return
  }

  if (req.query.resource === 'plattform-einstellungen') {
    await handlePlattformEinstellungen(req, res, supabase)
    return
  }

  if (req.method === 'POST' && req.query.resource === 'mitglieder-datei-upload') {
    await handleMitgliederDateiUpload(req, res, supabase)
    return
  }

  if (req.query.resource === 'mitglieder-inhalte') {
    await handleMitgliederInhalte(req, res, supabase)
    return
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('programme')
      .select('*')
      .order('titel', { ascending: true })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ programme: data })
    return
  }

  if (req.method === 'POST') {
    const { titel, beschreibung } = req.body ?? {}

    if (!titel) {
      res.status(400).json({ error: 'Titel ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('programme')
      .insert({ titel, beschreibung, aktiv: true })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ programm: data })
    return
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('programme')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ programm: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data: programm } = await supabase
      .from('programme')
      .select('aktiv')
      .eq('id', id)
      .maybeSingle()

    // Ablehnen eines Agent-Entwurfs (Feature "Review-Interface für
    // Agent-Entwürfe"): ein noch nie veröffentlichtes Programm
    // (aktiv=false) darf inklusive seiner Module/Sessions komplett
    // verworfen werden, ohne den sonst üblichen Abhängigkeits-Schutz
    // unten -- der existiert, um ein LIVE-Programm vor versehentlichem
    // Löschen zu schützen, nicht um das gezielte Verwerfen eines
    // kompletten Entwurfs zu erschweren. module.programm_id hat keine
    // Kaskade (siehe FK), daher hier explizit zuerst gelöscht; sessions
    // (inkl. session_material) und eine eventuelle coachie_programme-
    // Zeile kaskadieren bereits über die DB beim Löschen des Programms.
    if (programm && programm.aktiv === false) {
      const { error: modulError } = await supabase
        .from('module')
        .delete()
        .eq('programm_id', id)

      if (modulError) {
        res.status(500).json({ error: modulError.message })
        return
      }

      const { error: programmError } = await supabase
        .from('programme')
        .delete()
        .eq('id', id)

      if (programmError) {
        res.status(500).json({ error: programmError.message })
        return
      }

      res.status(204).end()
      return
    }

    const [sessions, module, zuordnungen] = await Promise.all([
      supabase.from('sessions').select('id').eq('programm_id', id),
      supabase.from('module').select('id').eq('programm_id', id),
      supabase.from('coachie_programme').select('id').eq('programm_id', id),
    ])

    const firstError = [sessions, module, zuordnungen].find(
      (result) => result.error,
    )

    if (firstError) {
      res.status(500).json({ error: firstError.error.message })
      return
    }

    const abhaengigkeiten = []
    if (sessions.data.length > 0) {
      abhaengigkeiten.push(
        `${sessions.data.length} Session${sessions.data.length === 1 ? '' : 's'}`,
      )
    }
    if (module.data.length > 0) {
      abhaengigkeiten.push(
        `${module.data.length} Modul${module.data.length === 1 ? '' : 'e'}`,
      )
    }
    if (zuordnungen.data.length > 0) {
      abhaengigkeiten.push(
        `${zuordnungen.data.length} Coachie-Zuordnung${zuordnungen.data.length === 1 ? '' : 'en'}`,
      )
    }

    if (abhaengigkeiten.length > 0) {
      res.status(409).json({
        error: `Programm hat noch ${abhaengigkeiten.join(', ')}. Bitte zuerst entfernen.`,
      })
      return
    }

    const { error } = await supabase.from('programme').delete().eq('id', id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}
