// Erzeugt ein langlebiges JWT für die Rolle "coaching_plattform_reader"
// im Profil-Quiz-Supabase-Projekt (rbfsfcetdzdsyoffglwi).
//
// NUR LOKAL ausführen. Das JWT-Secret ist ein Master-Credential für das
// gesamte Profil-Quiz-Projekt -- es darf niemals in einen Chat, ein Repo
// oder sonst irgendwohin außerhalb dieses einen Befehls gelangen.
//
// Voraussetzung: supabase_migrations/profil_quiz_reader.sql wurde bereits
// im SQL Editor des Profil-Quiz-Projekts ausgeführt (legt die Rolle und
// die beiden Funktionen an).
//
// Nutzung:
//   PROFIL_QUIZ_JWT_SECRET="..." node scripts/mint-profil-quiz-token.mjs
//
// Das Secret: Supabase Dashboard -> Profil-Quiz-Projekt -> Project
// Settings -> API -> JWT Settings -> "JWT Secret".
//
// Die Ausgabe ist der fertige Token -- in Vercel (Coaching-Plattform-
// Projekt) als PROFIL_QUIZ_READER_TOKEN eintragen (server-only, alle
// drei Umgebungen). Das Skript selbst speichert nichts und sendet
// nichts -- reine lokale Berechnung.

import crypto from 'node:crypto'

const secret = process.env.PROFIL_QUIZ_JWT_SECRET

if (!secret) {
  console.error('Bitte PROFIL_QUIZ_JWT_SECRET als Umgebungsvariable setzen.')
  process.exit(1)
}

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

const header = { alg: 'HS256', typ: 'JWT' }
const payload = {
  role: 'coaching_plattform_reader',
  iss: 'supabase',
  iat: Math.floor(Date.now() / 1000),
  // Bewusst kein "exp" -- das Token läuft nicht automatisch ab. Zum
  // Rotieren einfach das Skript erneut ausführen und den neuen Wert in
  // Vercel eintragen; das alte Token bleibt bis dahin gültig.
}

const encodedHeader = base64url(JSON.stringify(header))
const encodedPayload = base64url(JSON.stringify(payload))
const signature = crypto
  .createHmac('sha256', secret)
  .update(`${encodedHeader}.${encodedPayload}`)
  .digest('base64url')

console.log(`${encodedHeader}.${encodedPayload}.${signature}`)
