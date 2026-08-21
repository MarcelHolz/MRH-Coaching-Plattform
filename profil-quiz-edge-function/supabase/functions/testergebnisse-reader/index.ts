// Wird NICHT in dieses Repo/Projekt deployed, sondern separat in das
// Profil-Quiz-Supabase-Projekt (rbfsfcetdzdsyoffglwi) -- siehe
// README-Abschnitt "Testergebnisse" für den Deploy-Ablauf.
//
// Ersetzt den früheren Zugriffsweg aus supabase_migrations/
// profil_quiz_reader.sql (Custom-Postgres-Rolle + selbst gemintetes
// JWT): Statt eines Supabase-JWTs prüft diese Function ein eigenes,
// selbst vergebenes Secret im Header "x-reader-secret" (siehe
// READER_SECRET unten). Deshalb verify_jwt = false in
// supabase/config.toml -- ohne das würde die Supabase-Plattform jede
// Anfrage schon vor diesem Code ablehnen, weil kein gültiges
// Supabase-Auth-JWT mitgeschickt wird.
//
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY sind von Supabase
// automatisch in jede Edge Function injiziert -- kein manuelles Secret
// dafür nötig. Der Service-Role-Key verlässt damit nie dieses Projekt.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const READER_SECRET = Deno.env.get('READER_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Methode nicht erlaubt.' }, 405)
  }

  if (!READER_SECRET || req.headers.get('x-reader-secret') !== READER_SECRET) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const body = await req.json().catch(() => ({}))
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  if (body.action === 'suchen') {
    const { data, error } = await supabase.rpc('testergebnisse_suchen', {
      such_email: body.such_email || null,
      such_name: body.such_name || null,
    })

    if (error) {
      return jsonResponse({ error: error.message }, 500)
    }

    return jsonResponse({ ergebnisse: data }, 200)
  }

  if (body.action === 'abrufen') {
    const { data, error } = await supabase.rpc('testergebnis_abrufen', {
      such_test_typ: body.such_test_typ,
      such_id: body.such_id,
    })

    if (error) {
      return jsonResponse({ error: error.message }, 500)
    }

    return jsonResponse({ ergebnis: data }, 200)
  }

  return jsonResponse({ error: 'Unbekannte action.' }, 400)
})
