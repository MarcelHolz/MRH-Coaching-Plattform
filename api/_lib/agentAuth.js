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

// Nur für den reinen Lese-Endpoint (?resource=lesen): akzeptiert das
// Secret zusätzlich als Query-Parameter (?secret=...), zusätzlich zum
// Header, den requireAgent oben verlangt -- der Header bleibt der
// primäre Weg (z. B. für Copilot Studio). Bewusst nicht für die
// Schreib-Ressourcen (Programme/Module/Sessions) verfügbar: ein Secret
// in der URL landet in Server-/Proxy-Logs und im Browser-Verlauf, was
// für einen reinen Lesezugriff vertretbar ist, für Schreibzugriff aber
// ein unnötiges zusätzliches Risiko wäre.
export function requireAgentLesen(req, res) {
  const secret = process.env.AGENT_CONTENT_SECRET
  const kandidat = req.headers['x-agent-secret'] ?? req.query.secret

  if (!secret || !stimmtUeberein(kandidat, secret)) {
    res.status(401).json({ error: 'Nicht autorisiert.' })
    return false
  }

  return true
}
