import { requireAdmin } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return

  const supabase = getSupabaseAdmin()

  if (req.method === 'GET') {
    const { session_id } = req.query

    let query = supabase.from('session_material').select('*')

    if (session_id) {
      query = query.eq('session_id', session_id)
    }

    const { data, error } = await query

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ materialien: data })
    return
  }

  if (req.method === 'POST') {
    const { session_id, titel, datei_url, typ } = req.body ?? {}

    if (!session_id || !titel || !datei_url) {
      res
        .status(400)
        .json({ error: 'session_id, titel und datei_url sind erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('session_material')
      .insert({ session_id, titel, datei_url, typ })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ material: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.query

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { error } = await supabase
      .from('session_material')
      .delete()
      .eq('id', id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}
