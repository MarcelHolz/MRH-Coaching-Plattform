import crypto from 'node:crypto'

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000

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

export function createAdminToken() {
  const secret = process.env.ADMIN_TOKEN_SECRET
  if (!secret) {
    throw new Error('ADMIN_TOKEN_SECRET ist nicht gesetzt.')
  }

  const payload = base64UrlEncode(
    JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS }),
  )
  const signature = sign(payload)
  return `${payload}.${signature}`
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return false

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false

  const expectedSignature = sign(payload)

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return false
  }

  try {
    const { exp } = JSON.parse(base64UrlDecode(payload))
    return typeof exp === 'number' && exp > Date.now()
  } catch {
    return false
  }
}

export function requireAdmin(req, res) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Nicht autorisiert.' })
    return false
  }

  return true
}
