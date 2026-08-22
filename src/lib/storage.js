import { supabase } from './supabaseClient'

const PROGRAMME_BUCKET = 'Programme'

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
