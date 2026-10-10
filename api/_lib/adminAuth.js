import crypto from 'node:crypto'
import { getSupabaseAdmin } from './supabaseAdmin.js'

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000
// Typ-Claim: nur Tokens mit typ 'admin' gelten als Admin-Session.
const TOKEN_TYP = 'admin'

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url')
}

function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(payload) {
  const secret = process.env.ADMIN_TOKEN_SECRET
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

// Zwei Arten von Admin-Tokens:
// - { sub: <admin_benutzer.id> } nach Login mit E-Mail und Passwort
// - { notfall: true } nach Login mit ADMIN_PASSWORD (Übergangs- und
//   Notfallzugang, gilt nur, solange ADMIN_PASSWORD gesetzt ist)
export function createAdminToken({ adminId = null, notfall = false } = {}) {
  const secret = process.env.ADMIN_TOKEN_SECRET
  if (!secret) {
    throw new Error('ADMIN_TOKEN_SECRET ist nicht gesetzt.')
  }
  if (!adminId && !notfall) {
    throw new Error('Admin-Token braucht eine Admin-ID oder den Notfallzugang.')
  }

  const payload = base64UrlEncode(
    JSON.stringify({
      typ: TOKEN_TYP,
      ...(notfall ? { notfall: true } : { sub: adminId }),
      exp: Date.now() + TOKEN_TTL_MS,
    }),
  )
  const signature = sign(payload)
  return `${payload}.${signature}`
}

// Prüft nur Signatur, Typ und Ablauf. Liefert die Claims oder null.
export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !process.env.ADMIN_TOKEN_SECRET) return null

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  const expectedSignature = sign(payload)

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null
  }

  try {
    const claims = JSON.parse(base64UrlDecode(payload))
    if (claims.typ !== TOKEN_TYP || typeof claims.exp !== 'number' || claims.exp <= Date.now()) {
      return null
    }
    if (claims.notfall === true || typeof claims.sub === 'string') return claims
    return null
  } catch {
    return null
  }
}

// Prüft das Admin-Token UND bei jedem Aufruf, ob der Admin noch aktiv ist
// (Deaktivieren wirkt sofort). Notfall-Tokens gelten nur, solange
// ADMIN_PASSWORD gesetzt ist. Liefert { id, notfall } oder null (dann ist
// die Antwort bereits gesendet). Aufruf immer mit await.
export async function requireAdmin(req, res) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const claims = verifyAdminToken(token)

  if (!claims) {
    res.status(401).json({ error: 'Nicht autorisiert.' })
    return null
  }

  if (claims.notfall) {
    if (!process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: 'Nicht autorisiert.' })
      return null
    }
    return { id: null, notfall: true }
  }

  const { data, error } = await getSupabaseAdmin()
    .from('admin_benutzer')
    .select('id, aktiv')
    .eq('id', claims.sub)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return null
  }

  if (!data?.aktiv) {
    res.status(401).json({ error: 'Nicht autorisiert.' })
    return null
  }

  return { id: data.id, notfall: false }
}
