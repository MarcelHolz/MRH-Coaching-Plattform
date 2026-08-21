import { requireAdmin } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

// Konsolidierte Route (Vercel Hobby: max. 12 Serverless Functions).
// ?resource=suche spricht die frühere testergebnisse-suche.js an,
// sonst (default) das bisherige Verhalten dieser Datei (Liste/
// Verknüpfen). Verhalten je Resource ist unverändert 1:1 aus den
// Originaldateien übernommen.
//
// Zugriff auf das Profil-Quiz-Projekt läuft über eine dort deployte
// Edge Function (profil-quiz-edge-function/, ruft intern mit
// service_role auf), geschützt durch PROFIL_QUIZ_READER_SECRET --
// siehe README-Abschnitt "Testergebnisse".

async function callProfilQuizReader(action, payload, res) {
  const profilQuizUrl = process.env.PROFIL_QUIZ_URL
  const readerSecret = process.env.PROFIL_QUIZ_READER_SECRET

  if (!profilQuizUrl || !readerSecret) {
    res.status(500).json({
      error: 'PROFIL_QUIZ_URL und PROFIL_QUIZ_READER_SECRET müssen serverseitig gesetzt sein.',
    })
    return null
  }

  const response = await fetch(`${profilQuizUrl}/functions/v1/testergebnisse-reader`, {
    method: 'POST',
    headers: {
      'x-reader-secret': readerSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...payload }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    res.status(502).json({
      error: `Profil-Quiz-Anfrage fehlgeschlagen (${response.status}): ${detail}`,
    })
    return null
  }

  return response.json()
}

async function handleSuche(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const { such_email: suchEmail, such_name: suchName } = req.query

  if (!suchEmail && !suchName) {
    res.status(400).json({ error: 'such_email oder such_name ist erforderlich.' })
    return
  }

  const result = await callProfilQuizReader(
    'suchen',
    { such_email: suchEmail || null, such_name: suchName || null },
    res,
  )
  if (result === null) return

  res.status(200).json({ ergebnisse: result.ergebnisse })
}

async function handleLink(req, res, supabase) {
  if (req.method === 'GET') {
    const { coachie_id: coachieId } = req.query

    if (!coachieId) {
      res.status(400).json({ error: 'coachie_id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('coachie_testergebnisse')
      .select('*')
      .eq('coachie_id', coachieId)
      .order('verknuepft_am', { ascending: false })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ testergebnisse: data })
    return
  }

  if (req.method === 'POST') {
    const { coachie_id: coachieId, test_typ: testTyp, quell_id: quellId } =
      req.body ?? {}

    if (!coachieId || !testTyp || !quellId) {
      res
        .status(400)
        .json({ error: 'coachie_id, test_typ und quell_id sind erforderlich.' })
      return
    }

    const detailResult = await callProfilQuizReader(
      'abrufen',
      { such_test_typ: testTyp, such_id: quellId },
      res,
    )
    if (detailResult === null) return

    const ergebnisDaten = detailResult.ergebnis

    if (!ergebnisDaten) {
      res.status(404).json({ error: 'Testergebnis wurde im Profil-Quiz nicht gefunden.' })
      return
    }

    const quellEmail =
      testTyp === 'kurztest_24' ? ergebnisDaten.kunde_email : ergebnisDaten.email

    const { data, error } = await supabase
      .from('coachie_testergebnisse')
      .insert({
        coachie_id: coachieId,
        test_typ: testTyp,
        quell_email: quellEmail,
        quell_id: quellId,
        ergebnis_daten: ergebnisDaten,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'Dieses Testergebnis ist bereits verknüpft.' })
        return
      }
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ testergebnis: data })
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return

  const { resource } = req.query

  if (resource === 'suche') {
    await handleSuche(req, res)
    return
  }

  const supabase = getSupabaseAdmin()
  await handleLink(req, res, supabase)
}
