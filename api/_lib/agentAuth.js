import crypto from 'node:crypto'

function stimmtUeberein(kandidat, secret) {
  if (typeof kandidat !== 'string') return false

  const kandidatBuffer = Buffer.from(kandidat)
  const secretBuffer = Buffer.from(secret)

  return (
    kandidatBuffer.length === secretBuffer.length &&
    crypto.timingSafeEqual(kandidatBuffer, secretBuffer)
  )
}

// Analog zu adminAuth.js, aber ohne Login-Flow: der Produktagent
// authentifiziert sich mit einem einzigen, selbst vergebenen Secret im
// Header (kein Supabase-JWT, keine eigene Postgres-Rolle -- siehe
// README-Abschnitt "Produktagent" für die Begründung).
export function requireAgent(req, res) {
  const secret = process.env.AGENT_CONTENT_SECRET

  if (!secret || !stimmtUeberein(req.headers['x-agent-secret'], secret)) {
    res.status(401).json({ error: 'Nicht autorisiert.' })
    return false
  }

  return true
}
