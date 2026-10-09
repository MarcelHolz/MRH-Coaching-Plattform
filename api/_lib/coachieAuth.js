// Verifiziert das Supabase-Access-Token eines eingeloggten Coachies
// (Authorization: Bearer <access_token>, siehe useAuth().session in
// AuthContext.jsx) serverseitig gegen GoTrue. Anders als requireAdmin
// (statisches Secret) prüft das die echte Nutzeridentität.
//
// Zusätzlich muss eine Zeile in coachies existieren: ein gültiges Token
// allein reicht nicht (z. B. bei Selbstregistrierung über die
// Supabase-Auth-API ohne Kauf oder Zuordnung).
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

  const { data: coachie, error: coachieError } = await supabase
    .from('coachies')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (coachieError) {
    res.status(500).json({ error: coachieError.message })
    return null
  }

  if (!coachie) {
    res.status(403).json({ error: 'Kein Coachie-Konto.' })
    return null
  }

  return coachie.id
}
