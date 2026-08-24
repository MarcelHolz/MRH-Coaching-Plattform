import crypto from 'node:crypto'

// Analog zu adminAuth.js, aber ohne Login-Flow: der Produktagent
// authentifiziert sich mit einem einzigen, selbst vergebenen Secret im
// Header (kein Supabase-JWT, keine eigene Postgres-Rolle -- siehe
// README-Abschnitt "Produktagent" für die Begründung).
export function requireAgent(req, res) {
  const secret = process.env.AGENT_CONTENT_SECRET
  const header = req.headers['x-agent-secret']

  if (!secret || typeof header !== 'string') {
    res.status(401).json({ error: 'Nicht autorisiert.' })
    return false
  }

  const headerBuffer = Buffer.from(header)
  const secretBuffer = Buffer.from(secret)

  if (
    headerBuffer.length !== secretBuffer.length ||
    !crypto.timingSafeEqual(headerBuffer, secretBuffer)
  ) {
    res.status(401).json({ error: 'Nicht autorisiert.' })
    return false
  }

  return true
}
