import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { requireCoachie } from './_lib/coachieAuth.js'

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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const supabase = getSupabaseAdmin()
  const coachieId = await requireCoachie(req, res, supabase)
  if (!coachieId) return

  const { programm_id: programmId } = req.query
  if (!programmId) {
    res.status(400).json({ error: 'programm_id ist erforderlich.' })
    return
  }

  const [{ data: coachie }, { data: programm }, { data: sessions }] =
    await Promise.all([
      supabase.from('coachies').select('name').eq('id', coachieId).maybeSingle(),
      supabase.from('programme').select('titel').eq('id', programmId).maybeSingle(),
      supabase.from('sessions').select('id').eq('programm_id', programmId),
    ])

  if (!programm) {
    res.status(404).json({ error: 'Programm nicht gefunden.' })
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
