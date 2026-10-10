import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createAdminToken } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { normalisiereEmail } from '../_lib/coachieAnlage.js'

const FEHLER = 'Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.'

// Vergleich über SHA-256-Hashes beider Werte: gleich lange Puffer für
// timingSafeEqual, unabhängig von der Länge der Eingabe.
function passwortStimmt(kandidat, erwartet) {
  if (typeof kandidat !== 'string' || !erwartet) return false
  const a = crypto.createHash('sha256').update(kandidat).digest()
  const b = crypto.createHash('sha256').update(erwartet).digest()
  return crypto.timingSafeEqual(a, b)
}

// Eigener, kurzlebiger Client nur für die Passwortprüfung. Der gemeinsame
// service_role-Client (getSupabaseAdmin) darf sich NIE anmelden: danach
// liefe jede weitere Abfrage dieser Function-Instanz mit dem Token des
// Admins statt mit service_role.
function pruefClient() {
  const schluessel =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  return createClient(process.env.SUPABASE_URL, schluessel, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

// Login mit E-Mail und Passwort (Supabase Auth). Zugang nur mit aktivem
// Eintrag in admin_benutzer. Ein Coachie-Konto allein reicht nicht.
async function loginMitKonto(email, password, res) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await pruefClient().auth.signInWithPassword({
    email: normalisiereEmail(email),
    password,
  })

  if (error || !data?.user) {
    res.status(401).json({ error: FEHLER })
    return
  }

  // Die beim Prüfen entstandene Supabase-Session sofort wieder beenden.
  // scope 'local' beendet nur diese Session, nicht eine parallel
  // laufende Coachie-Anmeldung derselben Person.
  if (data.session?.access_token) {
    await supabase.auth.admin.signOut(data.session.access_token, 'local').catch(() => {})
  }

  const { data: admin, error: adminError } = await supabase
    .from('admin_benutzer')
    .select('id, aktiv')
    .eq('id', data.user.id)
    .maybeSingle()

  if (adminError) {
    res.status(500).json({ error: adminError.message })
    return
  }

  // Gleiche Meldung wie bei falschem Passwort: verrät nicht, ob es zur
  // Adresse ein Konto gibt.
  if (!admin?.aktiv) {
    res.status(401).json({ error: FEHLER })
    return
  }

  await supabase
    .from('admin_benutzer')
    .update({ letzter_login_am: new Date().toISOString() })
    .eq('id', admin.id)

  res.status(200).json({ token: createAdminToken({ adminId: admin.id }) })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const { email, password } = req.body ?? {}

  if (typeof password !== 'string' || !password) {
    res.status(400).json({ error: FEHLER })
    return
  }

  if (typeof email === 'string' && email.trim()) {
    await loginMitKonto(email, password, res)
    return
  }

  // Notfallzugang ohne E-Mail: gemeinsames ADMIN_PASSWORD. Funktioniert,
  // bis ADMIN_PASSWORD in Vercel entfernt wird; danach sind auch bereits
  // ausgestellte Notfall-Tokens ungültig (siehe requireAdmin).
  if (!passwortStimmt(password, process.env.ADMIN_PASSWORD)) {
    res.status(401).json({ error: 'Falsches Notfall-Passwort.' })
    return
  }

  res.status(200).json({ token: createAdminToken({ notfall: true }) })
}
