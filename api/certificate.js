import crypto from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { requireCoachie } from './_lib/coachieAuth.js'
import { sendMail } from './_lib/mailer.js'

// Serverseitige PDF-Erzeugung mit pdf-lib (leichtgewichtig, kein
// Headless-Browser nötig). Kein Bild-Logo eingebunden -- es liegt
// aktuell keine Logo-Datei im Repo (siehe public/brand/README.md),
// stattdessen ein schlichter goldener Rahmen plus Textmarke im
// Corporate Design als Branding.
const MRH_NAVY = rgb(0x1f / 255, 0x2a / 255, 0x44 / 255)
const MRH_GOLD = rgb(0xb9 / 255, 0x91 / 255, 0x3f / 255)

function dateiname(titel) {
  const sicher = titel.replace(/[^a-zA-Z0-9äöüÄÖÜß]+/g, '-').replace(/^-|-$/g, '')
  return `Zertifikat-${sicher || 'Programm'}.pdf`
}

// Vergibt einen neuen, eindeutigen Empfehlungscode für einen Coachie
// (Feature Empfehlungsprogramm) -- lazy statt beim Anlegen des
// Coachies, damit auch bereits bestehende Coachies ohne Backfill-
// Migration einen Code bekommen, sobald sie ihn zum ersten Mal
// abrufen. Retry bei einer (extrem unwahrscheinlichen) Kollision mit
// dem unique-Constraint auf coachies.empfehlungscode.
async function vergebeEmpfehlungscode(supabase, coachieId, versuch = 0) {
  if (versuch >= 5) return null

  const code = crypto.randomBytes(5).toString('hex').toUpperCase()

  const { data, error } = await supabase
    .from('coachies')
    .update({ empfehlungscode: code })
    .eq('id', coachieId)
    .select('empfehlungscode')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return vergebeEmpfehlungscode(supabase, coachieId, versuch + 1)
    }
    return null
  }

  return data?.empfehlungscode ?? null
}

async function handleEmpfehlung(req, res, supabase) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const coachieId = await requireCoachie(req, res, supabase)
  if (!coachieId) return

  const { data: coachie, error: coachieError } = await supabase
    .from('coachies')
    .select('empfehlungscode')
    .eq('id', coachieId)
    .maybeSingle()

  if (coachieError) {
    res.status(500).json({ error: coachieError.message })
    return
  }

  const code = coachie?.empfehlungscode || (await vergebeEmpfehlungscode(supabase, coachieId))

  if (!code) {
    res.status(500).json({ error: 'Empfehlungscode konnte nicht erzeugt werden.' })
    return
  }

  // Ein Beispielprogramm für einen fertigen Beispiellink -- der Code
  // selbst ist universell (funktioniert an jedem /kaufen/:slug), dieses
  // Beispiel macht den Link im UI direkt kopierbar, statt den Coachie
  // eine Slug selbst einsetzen zu lassen.
  const { data: beispielProgramm } = await supabase
    .from('programme')
    .select('slug, titel')
    .eq('oeffentlich_kaufbar', true)
    .eq('aktiv', true)
    .order('erstellt_am', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Eigene erfolgreiche Empfehlungen, wie im Auftrag beschrieben
  // ("wen er bereits erfolgreich geworben hat") -- Name des geworbenen
  // Coachies plus Programm und Datum.
  const { data: empfehlungen, error: empfehlungenError } = await supabase
    .from('empfehlungen')
    .select('id, erstellt_am, geworbener:coachies!geworbener_coachie_id(name), programme(titel)')
    .eq('werber_coachie_id', coachieId)
    .order('erstellt_am', { ascending: false })

  if (empfehlungenError) {
    res.status(500).json({ error: empfehlungenError.message })
    return
  }

  res.status(200).json({
    code,
    beispielProgramm: beispielProgramm ?? null,
    empfehlungen: empfehlungen ?? [],
  })
}

// FAQ-Chat im Coachie-Bereich (Feature "KI-Chat für FAQs"): rein auf
// api/certificate.js untergebracht statt einer eigenen Function-Datei,
// da hier bereits der einzige coachie-token-authentifizierte Endpunkt
// existiert (requireCoachie) und Vercel Hobby aktuell 12 von 12
// Functions belegt.
//
// FernUSG-Abgrenzung (siehe Aufgabenstellung): der Chat darf sich NICHT
// auf individuelle Eingaben/Abgaben eines Coachies zu dessen
// persönlichem Lernfortschritt beziehen und keine personalisierte
// Rückmeldung dazu geben. Deshalb bekommt der System-Prompt
// ausschließlich die feste FAQ-Wissensbasis (faq_eintraege, aktiv=true)
// als Kontext -- niemals coachie_status, Testergebnisse oder andere
// individuellen Fortschrittsdaten -- und wird explizit angewiesen,
// Fragen zum persönlichen Fortschritt abzulehnen statt zu beantworten.
const FAQ_CHAT_MAX_FRAGE_LAENGE = 2000

function baueFaqSystemPrompt(faqEintraege) {
  const wissensbasis = faqEintraege
    .map((eintrag) => `F: ${eintrag.frage}\nA: ${eintrag.antwort}`)
    .join('\n\n')

  return `Du bist der FAQ-Assistent von MRH Beratung & Coaching im Coachie-Bereich der Plattform.

Deine Wissensbasis besteht ausschließlich aus den folgenden freigegebenen FAQ-Einträgen:

${wissensbasis || '(aktuell keine FAQ-Einträge vorhanden)'}

Regeln, die du unter keinen Umständen brichst:
- Beantworte Fragen ausschließlich auf Basis der obigen Wissensbasis (allgemeine Plattform- und Kursinhalte). Wenn die Antwort dort nicht enthalten ist, sag das ehrlich und verweise auf den Support, statt zu spekulieren.
- Du hast keinen Zugriff auf individuelle Fortschritts-, Bearbeitungs- oder Abgabedaten einzelner Coachies und darfst dazu auch keine Vermutungen äußern. Fragen nach dem persönlichen Lernfortschritt, einzelnen Bearbeitungen oder einer individuellen Rückmeldung zu Kursinhalten lehnst du höflich ab und verweist an den zuständigen Coach.
- Gib keine personalisierte inhaltliche Bewertung von Kursaufgaben oder -abgaben ab.
- Antworte auf Deutsch, freundlich und knapp.`
}

async function handleFaqChat(req, res, supabase) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const coachieId = await requireCoachie(req, res, supabase)
  if (!coachieId) return

  const { frage } = req.body ?? {}

  if (!frage || typeof frage !== 'string' || !frage.trim()) {
    res.status(400).json({ error: 'frage ist erforderlich.' })
    return
  }

  if (frage.length > FAQ_CHAT_MAX_FRAGE_LAENGE) {
    res.status(400).json({ error: 'frage ist zu lang.' })
    return
  }

  const { data: faqEintraege, error: faqError } = await supabase
    .from('faq_eintraege')
    .select('frage, antwort')
    .eq('aktiv', true)
    .order('reihenfolge', { ascending: true })

  if (faqError) {
    res.status(500).json({ error: faqError.message })
    return
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system: baueFaqSystemPrompt(faqEintraege ?? []),
      messages: [{ role: 'user', content: frage }],
    })

    const antwortText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim()

    if (!antwortText) {
      res.status(502).json({ error: 'Der Chat konnte keine Antwort erzeugen.' })
      return
    }

    res.status(200).json({ antwort: antwortText })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      res.status(500).json({ error: 'Chat ist aktuell nicht konfiguriert.' })
      return
    }
    if (error instanceof Anthropic.RateLimitError) {
      res
        .status(429)
        .json({ error: 'Der Chat ist gerade stark ausgelastet. Bitte kurz erneut versuchen.' })
      return
    }
    if (error instanceof Anthropic.APIError) {
      res.status(502).json({ error: 'Der Chat ist aktuell nicht erreichbar.' })
      return
    }
    throw error
  }
}

// "Interesse zeigen" in der Peer Group (Feature Peer Group): löst eine
// E-Mail an den Zielcoachie aus, statt Kontaktdaten direkt im UI
// preiszugeben -- der Zielcoachie entscheidet selbst, ob er antwortet
// (Reply-To zeigt auf den Absender). RLS auf peer_profile erlaubt zwar
// bereits nur reziprok sichtbare, programmgleiche Profile zu lesen,
// aber der eigentliche Mailversand braucht service_role (Zugriff auf
// coachies.email) und prüft die Bedingungen serverseitig deshalb noch
// einmal explizit nach -- RLS gilt nur für den anon/authenticated-Weg,
// nicht für getSupabaseAdmin().
const PEER_INTERESSE_SPERRFRIST_TAGE = 14

async function handlePeerInteresse(req, res, supabase) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const coachieId = await requireCoachie(req, res, supabase)
  if (!coachieId) return

  const { zielCoachieId } = req.body ?? {}
  if (!zielCoachieId || typeof zielCoachieId !== 'string') {
    res.status(400).json({ error: 'zielCoachieId ist erforderlich.' })
    return
  }

  if (zielCoachieId === coachieId) {
    res.status(400).json({ error: 'Kein Interesse am eigenen Profil möglich.' })
    return
  }

  const [{ data: ich }, { data: ziel }] = await Promise.all([
    supabase
      .from('peer_profile')
      .select('sichtbar, vorname')
      .eq('coachie_id', coachieId)
      .maybeSingle(),
    supabase
      .from('peer_profile')
      .select('sichtbar')
      .eq('coachie_id', zielCoachieId)
      .maybeSingle(),
  ])

  if (!ich?.sichtbar || !ziel?.sichtbar) {
    res.status(403).json({ error: 'Peer Group ist für dich oder das Zielprofil nicht aktiv.' })
    return
  }

  const [{ data: meineProgramme }, { data: zielProgramme }] = await Promise.all([
    supabase.from('coachie_programme').select('programm_id').eq('coachie_id', coachieId),
    supabase.from('coachie_programme').select('programm_id').eq('coachie_id', zielCoachieId),
  ])

  const zielProgrammIds = new Set((zielProgramme ?? []).map((p) => p.programm_id))
  const gemeinsam = (meineProgramme ?? []).some((p) => zielProgrammIds.has(p.programm_id))

  if (!gemeinsam) {
    res.status(403).json({ error: 'Kein gemeinsames Programm mit diesem Profil.' })
    return
  }

  const sperrfristGrenze = new Date(
    Date.now() - PEER_INTERESSE_SPERRFRIST_TAGE * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data: kuerzlich } = await supabase
    .from('peer_interesse')
    .select('id')
    .eq('von_coachie_id', coachieId)
    .eq('zu_coachie_id', zielCoachieId)
    .gte('erstellt_am', sperrfristGrenze)
    .limit(1)
    .maybeSingle()

  if (kuerzlich) {
    res.status(200).json({ status: 'bereits_gesendet' })
    return
  }

  const [{ data: absender }, { data: empfaenger }] = await Promise.all([
    supabase.from('coachies').select('email').eq('id', coachieId).maybeSingle(),
    supabase.from('coachies').select('email').eq('id', zielCoachieId).maybeSingle(),
  ])

  if (!absender?.email || !empfaenger?.email) {
    res.status(500).json({ error: 'E-Mail-Adresse konnte nicht ermittelt werden.' })
    return
  }

  const absenderName = ich.vorname?.trim() || 'Ein anderer Coachie aus deiner Peer Group'

  try {
    await sendMail({
      to: empfaenger.email,
      subject: 'Jemand aus deiner Peer Group möchte sich austauschen',
      text: `Hallo,\n\n${absenderName} hat in deiner Peer Group Interesse an einem Austausch gezeigt.\n\nDu kannst einfach auf diese E-Mail antworten, wenn du magst -- ansonsten musst du nichts weiter tun.\n\nViele Grüße\nMRH Beratung & Coaching`,
      replyTo: absender.email,
    })
  } catch {
    res.status(500).json({ error: 'Nachricht konnte nicht versendet werden.' })
    return
  }

  const { error: logError } = await supabase
    .from('peer_interesse')
    .insert({ von_coachie_id: coachieId, zu_coachie_id: zielCoachieId })

  if (logError) {
    res.status(500).json({ error: logError.message })
    return
  }

  res.status(200).json({ status: 'gesendet' })
}

async function handleZertifikat(req, res, supabase) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const coachieId = await requireCoachie(req, res, supabase)
  if (!coachieId) return

  const { programm_id: programmId } = req.query
  if (!programmId) {
    res.status(400).json({ error: 'programm_id ist erforderlich.' })
    return
  }

  const [{ data: coachie }, { data: programm }, { data: sessions }, { data: zuordnung }] =
    await Promise.all([
      supabase.from('coachies').select('name').eq('id', coachieId).maybeSingle(),
      supabase.from('programme').select('titel').eq('id', programmId).maybeSingle(),
      supabase.from('sessions').select('id').eq('programm_id', programmId),
      supabase
        .from('coachie_programme')
        .select('id')
        .eq('coachie_id', coachieId)
        .eq('programm_id', programmId)
        .maybeSingle(),
    ])

  if (!programm) {
    res.status(404).json({ error: 'Programm nicht gefunden.' })
    return
  }

  // coachie_status wird nur über coachie_id = auth.uid() geschützt, nicht
  // über eine Zuordnung zum Programm -- ohne diese Prüfung könnte ein
  // Coachie mit direkt (z. B. per REST-Aufruf) gesetzten Status-Einträgen
  // für fremde session_ids ein Zertifikat für ein Programm erschleichen,
  // dem er nie zugeordnet war. Freemium-Vorschauen (siehe
  // freemium_programme.sql) haben ebenfalls keine coachie_programme-Zeile
  // und fallen damit korrekt hier raus.
  if (!zuordnung) {
    res.status(403).json({ error: 'Keine Zuordnung zu diesem Programm.' })
    return
  }

  const sessionIds = (sessions ?? []).map((s) => s.id)
  if (sessionIds.length === 0) {
    res.status(409).json({ error: 'Programm hat keine Sessions.' })
    return
  }

  const { data: statusListe, error: statusError } = await supabase
    .from('coachie_status')
    .select('status')
    .eq('coachie_id', coachieId)
    .in('session_id', sessionIds)

  if (statusError) {
    res.status(500).json({ error: statusError.message })
    return
  }

  const abgeschlossen = (statusListe ?? []).filter(
    (s) => s.status === 'abgeschlossen',
  ).length

  if (abgeschlossen < sessionIds.length) {
    res
      .status(409)
      .json({ error: 'Programm ist noch nicht zu 100% abgeschlossen.' })
    return
  }

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([842, 595]) // A4 quer
  const { width, height } = page.getSize()

  const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
  const serif = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const sans = await pdfDoc.embedFont(StandardFonts.Helvetica)

  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: MRH_GOLD,
    borderWidth: 3,
  })

  page.drawText('MRH BERATUNG & COACHING', {
    x: 60,
    y: height - 80,
    size: 14,
    font: sans,
    color: MRH_NAVY,
  })

  const titelText = 'Teilnahmezertifikat'
  page.drawText(titelText, {
    x: width / 2 - serifBold.widthOfTextAtSize(titelText, 28) / 2,
    y: height - 190,
    size: 28,
    font: serifBold,
    color: MRH_NAVY,
  })

  const name = coachie?.name || 'Teilnehmer:in'
  page.drawText(name, {
    x: width / 2 - serifBold.widthOfTextAtSize(name, 22) / 2,
    y: height - 270,
    size: 22,
    font: serifBold,
    color: MRH_GOLD,
  })

  const satz = `hat das Programm "${programm.titel}" erfolgreich abgeschlossen.`
  page.drawText(satz, {
    x: width / 2 - serif.widthOfTextAtSize(satz, 14) / 2,
    y: height - 310,
    size: 14,
    font: serif,
    color: MRH_NAVY,
  })

  const datum = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  page.drawText(datum, {
    x: 60,
    y: 70,
    size: 11,
    font: sans,
    color: MRH_NAVY,
  })

  const unterschrift = 'Marcel Holz'
  page.drawText(unterschrift, {
    x: width - 60 - sans.widthOfTextAtSize(unterschrift, 11),
    y: 70,
    size: 11,
    font: sans,
    color: MRH_NAVY,
  })

  const pdfBytes = await pdfDoc.save()

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${dateiname(programm.titel)}"`,
  )
  res.status(200).end(Buffer.from(pdfBytes))
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin()

  if (req.query.resource === 'empfehlung') {
    await handleEmpfehlung(req, res, supabase)
    return
  }

  if (req.query.resource === 'faq-chat') {
    await handleFaqChat(req, res, supabase)
    return
  }

  if (req.query.resource === 'peer-interesse') {
    await handlePeerInteresse(req, res, supabase)
    return
  }

  await handleZertifikat(req, res, supabase)
}
