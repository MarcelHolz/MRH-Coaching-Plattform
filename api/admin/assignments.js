import { requireAdmin } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return

  const supabase = getSupabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('coachie_programme').select('*')

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ assignments: data })
    return
  }

  if (req.method === 'POST') {
    const { coachie_id, programm_id } = req.body ?? {}

    if (!coachie_id || !programm_id) {
      res
        .status(400)
        .json({ error: 'coachie_id und programm_id sind erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('coachie_programme')
      .insert({
        coachie_id,
        programm_id,
        zugewiesen_am: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ assignment: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.query

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { error } = await supabase
      .from('coachie_programme')
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
