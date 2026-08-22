import { requireAdmin } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

// Konsolidierte Route (Vercel Hobby: max. 12 Serverless Functions).
// ?resource=materials spricht die frühere materials.js an, sonst
// (default) das bisherige Verhalten dieser Datei für Sessions.
// Verhalten je Resource ist unverändert 1:1 aus den Originaldateien
// übernommen.

async function handleSessions(req, res, supabase) {
  if (req.method === 'GET') {
    const { programm_id } = req.query

    let query = supabase
      .from('sessions')
      .select('*')
      .order('reihenfolge', { ascending: true })

    if (programm_id) {
      query = query.eq('programm_id', programm_id)
    }

    const { data, error } = await query

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ sessions: data })
    return
  }

  if (req.method === 'POST') {
    const { programm_id, titel, beschreibung, video_url, bild_url, reihenfolge } =
      req.body ?? {}

    if (!programm_id || !titel) {
      res.status(400).json({ error: 'programm_id und titel sind erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        programm_id,
        titel,
        beschreibung,
        video_url,
        bild_url,
        reihenfolge: reihenfolge ?? 0,
      })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ session: data })
    return
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ session: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.query

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { error } = await supabase.from('sessions').delete().eq('id', id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

async function handleMaterials(req, res, supabase) {
  if (req.method === 'GET') {
    const { session_id } = req.query

    let query = supabase
      .from('session_material')
      .select('*')
      .order('reihenfolge', { ascending: true })

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
    const { session_id, titel, datei_url, typ, reihenfolge } = req.body ?? {}

    if (!session_id || !titel || !datei_url) {
      res
        .status(400)
        .json({ error: 'session_id, titel und datei_url sind erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('session_material')
      .insert({ session_id, titel, datei_url, typ, reihenfolge: reihenfolge ?? 0 })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ material: data })
    return
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('session_material')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ material: data })
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

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return

  const supabase = getSupabaseAdmin()
  const { resource } = req.query

  if (resource === 'materials') {
    await handleMaterials(req, res, supabase)
    return
  }

  await handleSessions(req, res, supabase)
}
