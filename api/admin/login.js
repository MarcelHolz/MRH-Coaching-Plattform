import { createAdminToken } from '../_lib/adminAuth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const { password } = req.body ?? {}

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Falsches Passwort.' })
    return
  }

  const token = createAdminToken()
  res.status(200).json({ token })
}
