// Verifiziert das Supabase-Access-Token eines eingeloggten Coachies
// (Authorization: Bearer <access_token>, siehe useAuth().session in
// AuthContext.jsx) serverseitig gegen GoTrue. Anders als requireAdmin
// (statisches Secret) prüft das die echte Nutzeridentität -- nötig für
// api/certificate.js, den ersten coachie-authentifizierten
// Backend-Endpunkt (alle bisherigen Coachie-Schreibzugriffe laufen
// direkt über den Supabase-Client mit RLS, ohne eigene Route).
export async function requireCoachie(req, res, supabase) {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Nicht autorisiert.' })
    return null
  }

  const token = header.slice('Bearer '.length)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data?.user) {
    res.status(401).json({ error: 'Nicht autorisiert.' })
    return null
  }

  return data.user.id
}
