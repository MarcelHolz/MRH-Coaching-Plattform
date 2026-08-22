import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY müssen gesetzt sein (.env.local).',
  )
}

// Supabase-Einladungs- UND Passwort-Reset-Links liefern die Session als
// #access_token=...&type=invite bzw. &type=recovery im URL-Hash aus. Wir
// merken uns das vor der Initialisierung des Clients, damit ProtectedRoute
// den Coachie in beiden Fällen unabhängig von der Landing-Page zur
// Passwort-festlegen-Seite schickt, statt direkt ins Dashboard.
export const pendingPasswordSetup = {
  active: /type=(invite|recovery)/.test(window.location.hash),
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
