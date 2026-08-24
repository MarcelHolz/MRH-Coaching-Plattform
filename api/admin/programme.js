import crypto from 'node:crypto'
import { requireAdmin } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

const BILD_BUCKET = 'programm-bilder'

// contentType -> Dateiendung, zugleich die serverseitige Whitelist
// erlaubter Bildformate (siehe auch file_size_limit/allowed_mime_types
// auf dem Bucket selbst, programm_bilder_bucket.sql).
const ERLAUBTE_BILD_TYPEN = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// Für Programm- und Modul-Vorschaubilder gemeinsam genutzt (Admin-
// Formulare in AdminProgrammePage.jsx und ModuleManager.jsx) --
// erzeugt ein Einweg-Upload-Token per service_role, der eigentliche
// Datei-Upload läuft danach direkt vom Browser zu Supabase Storage
// (uploadToSignedUrl), nicht über diese Serverless Function -- so
// bleibt der Function-Body klein, unabhängig von der Bildgröße.
async function handleBildUploadUrl(req, res, supabase) {
  const { contentType } = req.body ?? {}
  const endung = ERLAUBTE_BILD_TYPEN[contentType]

  if (!endung) {
    res
      .status(400)
      .json({ error: 'Nur JPG, PNG oder WEBP sind als Bildformat erlaubt.' })
    return
  }

  const pfad = `${crypto.randomUUID()}.${endung}`

  const { data, error } = await supabase.storage
    .from(BILD_BUCKET)
    .createSignedUploadUrl(pfad)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const { data: publicUrlData } = supabase.storage
    .from(BILD_BUCKET)
    .getPublicUrl(pfad)

  res.status(200).json({
    pfad: data.path,
    token: data.token,
    publicUrl: publicUrlData.publicUrl,
  })
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return

  const supabase = getSupabaseAdmin()

  if (req.method === 'POST' && req.query.resource === 'bild-upload') {
    await handleBildUploadUrl(req, res, supabase)
    return
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('programme')
      .select('*')
      .order('titel', { ascending: true })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ programme: data })
    return
  }

  if (req.method === 'POST') {
    const { titel, beschreibung } = req.body ?? {}

    if (!titel) {
      res.status(400).json({ error: 'Titel ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('programme')
      .insert({ titel, beschreibung, aktiv: true })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ programm: data })
    return
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('programme')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ programm: data })
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}
