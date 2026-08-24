import { requireAgent } from '../_lib/agentAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

// Schnittstelle für den externen Produktagenten: darf Kurse (Programm/
// Modul/Session) eigenständig als Entwurf anlegen, bearbeiten und
// löschen. Die Freigabe bleibt exklusiv dem Admin-Bereich vorbehalten
// (dort weiterhin per "Aktivieren"-Button, programme.aktiv = true).
//
// Diese Route nutzt intern service_role (wie alle api/admin/*-Routen)
// und erzwingt die Entwurfs-Grenze daher im Code statt per Postgres-
// Rolle/RLS: jeder Insert landet zwingend mit aktiv=false, jedes
// Update/Delete wird vorher gegen den aktuellen aktiv-Status des
// (zugehörigen) Programms geprüft -- unabhängig davon, was der Agent
// selbst im Request-Body schickt. Auth über ein selbst vergebenes
// Secret im Header (x-agent-secret), kein Supabase-JWT nötig -- siehe
// README-Abschnitt "Produktagent" zur Begründung.
//
// ?resource=module bzw. ?resource=sessions dispatchen auf die anderen
// beiden Tabellen, sonst (default) Programme -- Vercel Hobby: max. 12
// Serverless Functions, ein Dispatch-File statt drei.

async function ladeProgramm(supabase, programmId) {
  const { data } = await supabase
    .from('programme')
    .select('id, aktiv')
    .eq('id', programmId)
    .maybeSingle()

  return data ?? null
}

async function ladeProgrammIdVon(supabase, tabelle, id) {
  const { data } = await supabase
    .from(tabelle)
    .select('programm_id')
    .eq('id', id)
    .maybeSingle()

  return data?.programm_id ?? null
}

async function handleProgramme(req, res, supabase) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('programme')
      .select('*')
      .order('erstellt_am', { ascending: false })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ programme: data })
    return
  }

  if (req.method === 'POST') {
    const { titel, beschreibung, bild_url } = req.body ?? {}

    if (!titel) {
      res.status(400).json({ error: 'titel ist erforderlich.' })
      return
    }

    // aktiv bewusst nicht aus dem Body übernommen -- landet immer als
    // Entwurf, unabhängig davon, was der Agent schickt.
    const { data, error } = await supabase
      .from('programme')
      .insert({ titel, beschreibung, bild_url, aktiv: false })
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
    delete updates.aktiv // Freigabe bleibt exklusiv dem Admin-Bereich vorbehalten

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('programme')
      .update(updates)
      .eq('id', id)
      .eq('aktiv', false)
      .select()
      .maybeSingle()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!data) {
      res.status(409).json({
        error:
          'Programm nicht gefunden oder bereits veröffentlicht -- der Agent darf veröffentlichte Programme nicht mehr bearbeiten.',
      })
      return
    }

    res.status(200).json({ programm: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.query

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('programme')
      .delete()
      .eq('id', id)
      .eq('aktiv', false)
      .select()
      .maybeSingle()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!data) {
      res.status(409).json({
        error:
          'Programm nicht gefunden oder bereits veröffentlicht -- der Agent darf veröffentlichte Programme nicht löschen.',
      })
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

    if (programm_id) query = query.eq('programm_id', programm_id)

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
      res
        .status(400)
        .json({ error: 'programm_id und titel sind erforderlich.' })
      return
    }

    const programm = await ladeProgramm(supabase, programm_id)
    if (!programm || programm.aktiv) {
      res
        .status(409)
        .json({ error: 'Programm nicht gefunden oder bereits veröffentlicht.' })
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

    const programmId = await ladeProgrammIdVon(supabase, 'module', id)
    const programm = programmId ? await ladeProgramm(supabase, programmId) : null

    if (!programm || programm.aktiv) {
      res.status(409).json({
        error: 'Modul nicht gefunden oder zugehöriges Programm bereits veröffentlicht.',
      })
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

    const programmId = await ladeProgrammIdVon(supabase, 'module', id)
    const programm = programmId ? await ladeProgramm(supabase, programmId) : null

    if (!programm || programm.aktiv) {
      res.status(409).json({
        error: 'Modul nicht gefunden oder zugehöriges Programm bereits veröffentlicht.',
      })
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

async function handleSessions(req, res, supabase) {
  if (req.method === 'GET') {
    const { programm_id } = req.query
    let query = supabase
      .from('sessions')
      .select('*')
      .order('reihenfolge', { ascending: true })

    if (programm_id) query = query.eq('programm_id', programm_id)

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
      modul_id,
      titel,
      beschreibung,
      video_url,
      bild_url,
      reihenfolge,
    } = req.body ?? {}

    if (!programm_id || !titel) {
      res
        .status(400)
        .json({ error: 'programm_id und titel sind erforderlich.' })
      return
    }

    const programm = await ladeProgramm(supabase, programm_id)
    if (!programm || programm.aktiv) {
      res
        .status(409)
        .json({ error: 'Programm nicht gefunden oder bereits veröffentlicht.' })
      return
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        programm_id,
        modul_id: modul_id || null,
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

    const programmId = await ladeProgrammIdVon(supabase, 'sessions', id)
    const programm = programmId ? await ladeProgramm(supabase, programmId) : null

    if (!programm || programm.aktiv) {
      res.status(409).json({
        error:
          'Session nicht gefunden oder zugehöriges Programm bereits veröffentlicht.',
      })
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

    const programmId = await ladeProgrammIdVon(supabase, 'sessions', id)
    const programm = programmId ? await ladeProgramm(supabase, programmId) : null

    if (!programm || programm.aktiv) {
      res.status(409).json({
        error:
          'Session nicht gefunden oder zugehöriges Programm bereits veröffentlicht.',
      })
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

export default async function handler(req, res) {
  if (!requireAgent(req, res)) return

  const supabase = getSupabaseAdmin()
  const { resource } = req.query

  if (resource === 'module') {
    await handleModule(req, res, supabase)
    return
  }

  if (resource === 'sessions') {
    await handleSessions(req, res, supabase)
    return
  }

  await handleProgramme(req, res, supabase)
}
