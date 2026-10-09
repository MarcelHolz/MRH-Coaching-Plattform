import crypto from 'node:crypto'
import { createAdminToken } from '../_lib/adminAuth.js'

// Vergleich über SHA-256-Hashes beider Werte: gleich lange Puffer für
// timingSafeEqual, unabhängig von der Länge der Eingabe.
function passwortStimmt(kandidat, erwartet) {
  if (typeof kandidat !== 'string' || !erwartet) return false
  const a = crypto.createHash('sha256').update(kandidat).digest()
  const b = crypto.createHash('sha256').update(erwartet).digest()
  return crypto.timingSafeEqual(a, b)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const { password } = req.body ?? {}

  if (!passwortStimmt(password, process.env.ADMIN_PASSWORD)) {
    res.status(401).json({ error: 'Falsches Passwort.' })
    return
  }

  const token = createAdminToken()
  res.status(200).json({ token })
}
