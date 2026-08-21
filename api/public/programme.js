import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const { slug } = req.query

  if (!slug) {
    res.status(400).json({ error: 'slug ist erforderlich.' })
    return
  }

  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('programme')
    .select('titel, beschreibung, preis_cent, slug')
    .eq('slug', slug)
    .eq('oeffentlich_kaufbar', true)
    .eq('aktiv', true)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  if (!data) {
    res.status(404).json({ error: 'Programm nicht gefunden.' })
    return
  }

  res.status(200).json({ programm: data })
}
