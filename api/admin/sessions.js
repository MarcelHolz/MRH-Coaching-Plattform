import { requireAdmin } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

// Konsolidierte Route (Vercel Hobby: max. 12 Serverless Functions).
// ?resource=materials spricht die frühere materials.js an, ?resource=module
// verwaltet die neue Modul-Ebene zwischen Programm und Session,
// ?resource=material-upload erzeugt Upload-Tokens für den privaten Bucket
// "Programme" (siehe storage_policy_pro_programm.sql), sonst (default) das
// bisherige Verhalten dieser Datei für Sessions.

const MATERIAL_BUCKET = 'Programme'

// contentType -> Dateiendung, zugleich serverseitige Whitelist erlaubter
// Materialformate (Workbooks/Skripte als PDF, Bilder, Audio-Aufzeichnungen).
const ERLAUBTE_MATERIAL_TYPEN = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}

// Einweg-Upload-Token für Session-Materialien, analog zu
// handleBildUploadUrl in api/admin/programme.js, aber gegen den privaten
// Bucket "Programme" statt den öffentlichen "programm-bilder". Der Pfad
// beginnt mit der programm_id als oberstem Ordner, da die Storage-Policy
// darüber den Lese-Zugriff der Coachies steuert.
async function handleMaterialUploadUrl(req, res, supabase) {
  const { programm_id, contentType, dateiname } = req.body ?? {}

  if (!programm_id) {
    res.status(400).json({ error: 'programm_id ist erforderlich.' })
    return
  }

  const endung = ERLAUBTE_MATERIAL_TYPEN[contentType]
  if (!endung) {
    res
      .status(400)
      .json({ error: 'Nur PDF, JPG, PNG, MP3 oder WAV sind erlaubt.' })
    return
  }

  const sichererDateiname = String(dateiname || `datei.${endung}`).replace(
    /[^a-zA-Z0-9._-]/g,
    '_',
  )
  const pfad = `${programm_id}/materialien/${Date.now()}-${sichererDateiname}`

  const { data, error } = await supabase.storage
    .from(MATERIAL_BUCKET)
    .createSignedUploadUrl(pfad)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ pfad: data.path, token: data.token })
}

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
    const {
      programm_id,
      titel,
      beschreibung,
      video_url,
      bild_url,
      modul_id,
      reihenfolge,
    } = req.body ?? {}

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
        modul_id: modul_id || null,
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

async function handleModule(req, res, supabase) {
  if (req.method === 'GET') {
    const { programm_id } = req.query

    let query = supabase
      .from('module')
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

    res.status(200).json({ module: data })
    return
  }

  if (req.method === 'POST') {
    const { programm_id, titel, beschreibung, bild_url, reihenfolge } =
      req.body ?? {}

    if (!programm_id || !titel) {
      res.status(400).json({ error: 'programm_id und titel sind erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('module')
      .insert({
        programm_id,
        titel,
        beschreibung,
        bild_url,
        reihenfolge: reihenfolge ?? 0,
      })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ modul: data })
    return
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('module')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ modul: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.query

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { error } = await supabase.from('module').delete().eq('id', id)

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

  if (resource === 'module') {
    await handleModule(req, res, supabase)
    return
  }

  if (resource === 'material-upload' && req.method === 'POST') {
    await handleMaterialUploadUrl(req, res, supabase)
    return
  }

  await handleSessions(req, res, supabase)
}
