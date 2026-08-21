import { requireAdmin } from '../_lib/adminAuth.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const { such_email: suchEmail, such_name: suchName } = req.query

  if (!suchEmail && !suchName) {
    res.status(400).json({ error: 'such_email oder such_name ist erforderlich.' })
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

  const response = await fetch(`${profilQuizUrl}/rest/v1/rpc/testergebnisse_suchen`, {
    method: 'POST',
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      such_email: suchEmail || null,
      such_name: suchName || null,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    res.status(502).json({
      error: `Profil-Quiz-Anfrage fehlgeschlagen (${response.status}): ${detail}`,
    })
    return
  }

  const ergebnisse = await response.json()
  res.status(200).json({ ergebnisse })
}
