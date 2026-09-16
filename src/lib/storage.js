import { supabase } from './supabaseClient'

const PROGRAMME_BUCKET = 'Programme'
const MITGLIEDER_BUCKET = 'mitglieder-inhalte'

// Kurze Ablaufzeit bewusst: der Link wird nur für den unmittelbaren
// Download-/Abspiel-Klick gebraucht, nicht zum Teilen oder Cachen.
const SIGNIERTE_URL_ABLAUF_SEKUNDEN = 60

export async function getSignedMaterialUrl(pfad) {
  const { data, error } = await supabase.storage
    .from(PROGRAMME_BUCKET)
    .createSignedUrl(pfad, SIGNIERTE_URL_ABLAUF_SEKUNDEN)

  if (error || !data?.signedUrl) {
    throw new Error('Datei konnte nicht geladen werden.')
  }

  return data.signedUrl
}

// Analog zu getSignedMaterialUrl, aber gegen den privaten Bucket
// "mitglieder-inhalte" (Mitgliederbereich) -- die Storage-Policy dort
// prüft eine aktive Mitgliedschaft statt einer coachie_programme-
// Zuordnung (siehe supabase_migrations/mitgliederbereich.sql).
export async function getSignedMitgliederDateiUrl(pfad) {
  const { data, error } = await supabase.storage
    .from(MITGLIEDER_BUCKET)
    .createSignedUrl(pfad, SIGNIERTE_URL_ABLAUF_SEKUNDEN)

  if (error || !data?.signedUrl) {
    throw new Error('Datei konnte nicht geladen werden.')
  }

  return data.signedUrl
}
