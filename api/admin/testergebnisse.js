import { requireAdmin } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return

  const supabase = getSupabaseAdmin()

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

    const profilQuizUrl = process.env.PROFIL_QUIZ_URL
    const token = process.env.PROFIL_QUIZ_READER_TOKEN

    if (!profilQuizUrl || !token) {
      res.status(500).json({
        error: 'PROFIL_QUIZ_URL und PROFIL_QUIZ_READER_TOKEN müssen serverseitig gesetzt sein.',
      })
      return
    }

    const detailResponse = await fetch(
      `${profilQuizUrl}/rest/v1/rpc/testergebnis_abrufen`,
      {
        method: 'POST',
        headers: {
          apikey: token,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ such_test_typ: testTyp, such_id: quellId }),
      },
    )

    if (!detailResponse.ok) {
      const detail = await detailResponse.text().catch(() => '')
      res.status(502).json({
        error: `Profil-Quiz-Anfrage fehlgeschlagen (${detailResponse.status}): ${detail}`,
      })
      return
    }

    const ergebnisDaten = await detailResponse.json()

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
