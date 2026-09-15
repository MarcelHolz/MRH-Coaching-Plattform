import crypto from 'node:crypto'
import { requireAdmin } from '../_lib/adminAuth.js'
import { requireCoachie } from '../_lib/coachieAuth.js'
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

// Admin-Sichtung eingereichter Testimonials (Feature 2) -- Coachies
// legen sie per RLS direkt an (siehe testimonials.sql,
// TestimonialFormPage.jsx), hier nur Lesen/Freigeben/Ablehnen mit
// service_role. Keine automatische Freigabe, siehe Aufgabenstellung.
async function handleTestimonials(req, res, supabase) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('testimonials')
      .select('*, coachies(name), programme(titel)')
      .order('erstellt_am', { ascending: false })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ testimonials: data })
    return
  }

  if (req.method === 'PATCH') {
    const { id, freigegeben } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('testimonials')
      .update({ freigegeben })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ testimonial: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { error } = await supabase.from('testimonials').delete().eq('id', id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

// Reine, isoliert testbare Zusammenstellungsfunktion für das Review-
// Interface (Feature 2): verschachtelt Programm-Entwürfe mit ihren
// Modulen/Sessions und hängt an jeden Datensatz seine Änderungshistorie
// (entwurf_historie.sql) für die Vorher/Nachher-Diff-Ansicht. Erwartet
// programme bereits auf aktiv=false gefiltert (macht die DB-Query).
export function baueEntwurfsUebersicht({ programme, module, sessions, historie }) {
  const programmIds = new Set(programme.map((p) => p.id))
  const alleModule = module.filter((m) => programmIds.has(m.programm_id))
  const alleSessions = sessions.filter((s) => programmIds.has(s.programm_id))

  function historieFuer(tabelle, id) {
    return historie.filter((h) => h.tabelle === tabelle && h.datensatz_id === id)
  }

  function sessionZuObjekt(session) {
    return { ...session, historie: historieFuer('sessions', session.id) }
  }

  return programme.map((programm) => ({
    ...programm,
    historie: historieFuer('programme', programm.id),
    module: alleModule
      .filter((m) => m.programm_id === programm.id)
      .map((modul) => ({
        ...modul,
        historie: historieFuer('module', modul.id),
        sessions: alleSessions
          .filter((s) => s.modul_id === modul.id)
          .map(sessionZuObjekt),
      })),
    sessions_ohne_modul: alleSessions
      .filter((s) => s.programm_id === programm.id && !s.modul_id)
      .map(sessionZuObjekt),
  }))
}

// Review-Interface für Agent-Entwürfe (Feature 2): liefert alle noch
// nicht freigegebenen Programm-Entwürfe (aktiv=false) verschachtelt mit
// ihren Modulen/Sessions, plus je Datensatz die Änderungshistorie
// für die Vorher/Nachher-Diff-Ansicht. Bewusst nur GET -- Freigabe
// läuft über den bestehenden PATCH-Zweig unten ({id, aktiv: true}),
// Ablehnen über den bestehenden DELETE-Zweig (der für Entwürfe
// kaskadierend löscht, siehe dort).
async function handleEntwuerfe(req, res, supabase) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt -- dieser Pfad ist rein lesend.' })
    return
  }

  const [programmeResult, modulResult, sessionsResult, historieResult] = await Promise.all([
    supabase
      .from('programme')
      .select('*')
      .eq('aktiv', false)
      .order('erstellt_am', { ascending: false }),
    supabase.from('module').select('*').order('reihenfolge', { ascending: true }),
    supabase.from('sessions').select('*').order('reihenfolge', { ascending: true }),
    supabase
      .from('entwurf_historie')
      .select('*')
      .order('geaendert_am', { ascending: false })
      .limit(500),
  ])

  const fehler = [programmeResult, modulResult, sessionsResult, historieResult].find(
    (result) => result.error,
  )
  if (fehler) {
    res.status(500).json({ error: fehler.error.message })
    return
  }

  const programme = baueEntwurfsUebersicht({
    programme: programmeResult.data ?? [],
    module: modulResult.data ?? [],
    sessions: sessionsResult.data ?? [],
    historie: historieResult.data ?? [],
  })

  res.status(200).json({ programme })
}

export default async function handler(req, res) {
  // Coachie-Selbstbedienung für das eigene Profilbild (Feature 2,
  // EinstellungenPage.jsx) -- bewusst vor dem requireAdmin-Gate, da
  // hier kein Admin, sondern ein eingeloggter Coachie zugreift (per
  // Supabase-Access-Token, siehe requireCoachie/api/certificate.js).
  // Nutzt denselben öffentlichen Bucket "programm-bilder" wie die
  // Admin-Bilder, kein neuer Bucket/keine neue Function nötig.
  if (req.method === 'POST' && req.query.resource === 'avatar-upload') {
    const supabase = getSupabaseAdmin()
    const coachieId = await requireCoachie(req, res, supabase)
    if (!coachieId) return
    await handleBildUploadUrl(req, res, supabase)
    return
  }

  if (!requireAdmin(req, res)) return

  const supabase = getSupabaseAdmin()

  if (req.method === 'POST' && req.query.resource === 'bild-upload') {
    await handleBildUploadUrl(req, res, supabase)
    return
  }

  if (req.query.resource === 'testimonials') {
    await handleTestimonials(req, res, supabase)
    return
  }

  if (req.query.resource === 'entwuerfe') {
    await handleEntwuerfe(req, res, supabase)
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

  if (req.method === 'DELETE') {
    const { id } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data: programm } = await supabase
      .from('programme')
      .select('aktiv')
      .eq('id', id)
      .maybeSingle()

    // Ablehnen eines Agent-Entwurfs (Feature "Review-Interface für
    // Agent-Entwürfe"): ein noch nie veröffentlichtes Programm
    // (aktiv=false) darf inklusive seiner Module/Sessions komplett
    // verworfen werden, ohne den sonst üblichen Abhängigkeits-Schutz
    // unten -- der existiert, um ein LIVE-Programm vor versehentlichem
    // Löschen zu schützen, nicht um das gezielte Verwerfen eines
    // kompletten Entwurfs zu erschweren. module.programm_id hat keine
    // Kaskade (siehe FK), daher hier explizit zuerst gelöscht; sessions
    // (inkl. session_material) und eine eventuelle coachie_programme-
    // Zeile kaskadieren bereits über die DB beim Löschen des Programms.
    if (programm && programm.aktiv === false) {
      const { error: modulError } = await supabase
        .from('module')
        .delete()
        .eq('programm_id', id)

      if (modulError) {
        res.status(500).json({ error: modulError.message })
        return
      }

      const { error: programmError } = await supabase
        .from('programme')
        .delete()
        .eq('id', id)

      if (programmError) {
        res.status(500).json({ error: programmError.message })
        return
      }

      res.status(204).end()
      return
    }

    const [sessions, module, zuordnungen] = await Promise.all([
      supabase.from('sessions').select('id').eq('programm_id', id),
      supabase.from('module').select('id').eq('programm_id', id),
      supabase.from('coachie_programme').select('id').eq('programm_id', id),
    ])

    const firstError = [sessions, module, zuordnungen].find(
      (result) => result.error,
    )

    if (firstError) {
      res.status(500).json({ error: firstError.error.message })
      return
    }

    const abhaengigkeiten = []
    if (sessions.data.length > 0) {
      abhaengigkeiten.push(
        `${sessions.data.length} Session${sessions.data.length === 1 ? '' : 's'}`,
      )
    }
    if (module.data.length > 0) {
      abhaengigkeiten.push(
        `${module.data.length} Modul${module.data.length === 1 ? '' : 'e'}`,
      )
    }
    if (zuordnungen.data.length > 0) {
      abhaengigkeiten.push(
        `${zuordnungen.data.length} Coachie-Zuordnung${zuordnungen.data.length === 1 ? '' : 'en'}`,
      )
    }

    if (abhaengigkeiten.length > 0) {
      res.status(409).json({
        error: `Programm hat noch ${abhaengigkeiten.join(', ')}. Bitte zuerst entfernen.`,
      })
      return
    }

    const { error } = await supabase.from('programme').delete().eq('id', id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}
