import { requireAgent, requireAgentLesen } from '../_lib/agentAuth.js'
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
// beiden Tabellen, ?resource=lesen liefert den kompletten Ist-Stand
// der Plattform verschachtelt (Programm -> Modul -> Session) in einem
// Call, sonst (default) Programme -- Vercel Hobby: max. 12 Serverless
// Functions, ein Dispatch-File statt vier.

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

// Protokolliert eine PATCH-Änderung an einem Entwurf für die Vorher/
// Nachher-Diff-Ansicht im Review-Interface (AdminEntwuerfePage.jsx,
// siehe entwurf_historie.sql). Best-effort: ein Fehler beim Schreiben
// des Protokolls darf die eigentliche, bereits erfolgreich
// durchgeführte Änderung nicht rückgängig machen oder dem Agenten als
// Fehler gemeldet werden -- daher nur geloggt, nicht geworfen.
async function protokolliereAenderung(supabase, tabelle, datensatzId, vorher, nachher) {
  const { error } = await supabase
    .from('entwurf_historie')
    .insert({ tabelle, datensatz_id: datensatzId, vorher, nachher })

  if (error) {
    console.error('entwurf_historie konnte nicht geschrieben werden:', error.message)
  }
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

    const { data: vorher } = await supabase
      .from('programme')
      .select('*')
      .eq('id', id)
      .maybeSingle()

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

    await protokolliereAenderung(supabase, 'programme', id, vorher, data)

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

    const { data: vorher } = await supabase
      .from('module')
      .select('*')
      .eq('id', id)
      .maybeSingle()

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

    await protokolliereAenderung(supabase, 'module', id, vorher, data)

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

    const { data: vorher } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

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

    await protokolliereAenderung(supabase, 'sessions', id, vorher, data)

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

const MATERIAL_BUCKET = 'Programme'

// Länger als die 60 Sekunden des Klick-Downloads in src/lib/storage.js
// (getSignedMaterialUrl) -- dieser Endpoint liefert die URLs in einer
// JSON-Antwort, die ein Agent typischerweise über eine ganze
// Review-Sitzung hinweg abruft, nicht für einen einzelnen sofortigen
// Klick.
const MATERIAL_URL_ABLAUF_SEKUNDEN = 3600

// Erzeugt für alle übergebenen Storage-Pfade in einem einzigen Aufruf
// signierte URLs (statt einem Call pro Material -- bei ~230 Materialien
// sonst 230 sequenzielle Storage-Requests). Liefert eine Pfad->URL-Map;
// fehlgeschlagene einzelne Pfade (z. B. Datei zwischenzeitlich
// gelöscht) werden übersprungen, nicht der ganze Request abgebrochen.
async function signierteMaterialUrls(supabase, pfade) {
  if (pfade.length === 0) return new Map()

  const { data, error } = await supabase.storage
    .from(MATERIAL_BUCKET)
    .createSignedUrls(pfade, MATERIAL_URL_ABLAUF_SEKUNDEN)

  if (error || !data) return new Map()

  const zuordnung = new Map()
  data.forEach((eintrag) => {
    if (eintrag.signedUrl && eintrag.path) {
      zuordnung.set(eintrag.path, eintrag.signedUrl)
    }
  })
  return zuordnung
}

// Lese-Pendant zu handleProgramme/handleModule/handleSessions: liefert
// die komplette Plattform in einem Call, verschachtelt statt als drei
// flache Listen, für einen externen Agenten, der den Gesamtzustand
// analysieren soll (nicht nur eigene Entwürfe verwalten). Bewusst nur
// GET -- diese Resource kennt kein POST/PATCH/DELETE, damit über
// diesen Pfad unter keinen Umständen geschrieben werden kann, auch
// wenn handleProgramme/-Modul/-Sessions weiterhin Schreibzugriff für
// den Entwurfs-Workflow bieten.
//
// Optionaler Filter ?programm_id=<uuid>: reduziert Response-Größe und
// die Anzahl signierter Material-URLs, wenn die volle Antwort (voller
// Sessiontext + Materialien für alle Programme) zu groß wird oder nur
// ein Programm inhaltlich geprüft werden soll.
async function handleLesen(req, res, supabase) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt -- dieser Pfad ist rein lesend.' })
    return
  }

  const { programm_id: programmIdFilter } = req.query

  let programmeQuery = supabase
    .from('programme')
    // aktiv bewusst nicht gefiltert -- Entwürfe (aktiv=false) sollen
    // laut Auftrag mit sichtbar sein, aktiv selbst dient als Flag dafür.
    .select(
      'id, titel, beschreibung, aktiv, teaser_aktiv, preis_anzeigen, preis_cent, standard_zugriffsmonate, bild_url',
    )
    .order('erstellt_am', { ascending: false })
  let modulQuery = supabase
    .from('module')
    .select('id, titel, beschreibung, bild_url, programm_id')
    .order('reihenfolge', { ascending: true })
  let sessionsQuery = supabase
    .from('sessions')
    .select('id, titel, beschreibung, video_url, workbook_url, programm_id, modul_id')
    .order('reihenfolge', { ascending: true })

  if (programmIdFilter) {
    programmeQuery = programmeQuery.eq('id', programmIdFilter)
    modulQuery = modulQuery.eq('programm_id', programmIdFilter)
    sessionsQuery = sessionsQuery.eq('programm_id', programmIdFilter)
  }

  const [programmeResult, modulResult, sessionsResult] = await Promise.all([
    programmeQuery,
    modulQuery,
    sessionsQuery,
  ])

  const fehler = [programmeResult, modulResult, sessionsResult].find(
    (result) => result.error,
  )
  if (fehler) {
    res.status(500).json({ error: fehler.error.message })
    return
  }

  const alleModule = modulResult.data ?? []
  const alleSessions = sessionsResult.data ?? []

  // Materialien (Workbooks, Impulskarten als Bild-Typ, ...) hängen an
  // sessions.id, nicht an programm_id -- daher separat über die IDs der
  // (ggf. bereits per programm_id gefilterten) Sessions geladen.
  const sessionIds = alleSessions.map((session) => session.id)
  const materialResult =
    sessionIds.length > 0
      ? await supabase
          .from('session_material')
          .select('id, session_id, titel, datei_url, typ')
          .in('session_id', sessionIds)
          .order('reihenfolge', { ascending: true })
      : { data: [], error: null }

  if (materialResult.error) {
    res.status(500).json({ error: materialResult.error.message })
    return
  }

  const alleMaterialien = materialResult.data ?? []
  const materialUrls = await signierteMaterialUrls(
    supabase,
    alleMaterialien.map((material) => material.datei_url),
  )

  function sessionZuObjekt(session) {
    return {
      id: session.id,
      titel: session.titel,
      beschreibung: session.beschreibung,
      video_url: session.video_url,
      workbook_url: session.workbook_url,
      // Echte Materialanhänge aus session_material (Workbooks,
      // Impulskarten als typ "bild", ...) -- ersetzt das frühere
      // immer-null-Platzhalterfeld copy_paste_master_url, das in
      // keiner Tabelle existierte. "Impulskarten" haben laut
      // Datenbestand kein eigenes Feld/keinen eigenen Materialtyp,
      // sondern sind normale session_material-Einträge mit typ="bild"
      // und einer Titel-Konvention wie "P1_Impulskarte_01" -- damit
      // hier automatisch mit erfasst, kein Extra-Feld nötig.
      material: alleMaterialien
        .filter((material) => material.session_id === session.id)
        .map((material) => ({
          typ: material.typ,
          // "dateiname" wie angefragt, in der DB aber der frei
          // vergebene Anzeigetitel (session_material.titel), keine
          // erzwungene Dateisystem-Endung.
          dateiname: material.titel,
          // Signierte URL (siehe MATERIAL_URL_ABLAUF_SEKUNDEN) --
          // datei_url in der DB ist nur ein Pfad im privaten Bucket,
          // keine direkt aufrufbare URL. null, falls das Signieren für
          // dieses eine Material fehlschlug (z. B. Datei gelöscht).
          url: materialUrls.get(material.datei_url) ?? null,
        })),
    }
  }

  const programme = (programmeResult.data ?? []).map((programm) => {
    const programmModule = alleModule
      .filter((modul) => modul.programm_id === programm.id)
      .map((modul) => ({
        id: modul.id,
        titel: modul.titel,
        beschreibung: modul.beschreibung,
        bild_url: modul.bild_url,
        sessions: alleSessions
          .filter((session) => session.modul_id === modul.id)
          .map(sessionZuObjekt),
      }))

    // Sessions ohne modul_id (direkt unter dem Programm) landen -- wie
    // im Coachie- und Admin-Bereich bereits üblich (z. B.
    // AdminProgramDetailPage.jsx) -- in einer synthetischen "Kein
    // Modul"-Gruppe, damit die vorgegebene strikte Programm->Modul->
    // Session-Verschachtelung keine Sessions verschluckt.
    const moduleloseSessions = alleSessions
      .filter(
        (session) => session.programm_id === programm.id && !session.modul_id,
      )
      .map(sessionZuObjekt)

    return {
      id: programm.id,
      titel: programm.titel,
      beschreibung: programm.beschreibung,
      aktiv: programm.aktiv,
      teaser_aktiv: programm.teaser_aktiv,
      preis_anzeigen: programm.preis_anzeigen,
      // In Cent, wie programme.preis_cent in der DB -- bewusst keine
      // Euro-Umrechnung, um Rundungsfehler zu vermeiden.
      preis: programm.preis_cent,
      standard_zugriffsmonate: programm.standard_zugriffsmonate,
      bild_url: programm.bild_url,
      module: [
        ...programmModule,
        ...(moduleloseSessions.length > 0
          ? [
              {
                id: null,
                titel: 'Kein Modul',
                beschreibung: null,
                bild_url: null,
                sessions: moduleloseSessions,
              },
            ]
          : []),
      ],
    }
  })

  res.status(200).json({ programme })
}

// Rohe session_material-Liste, ungefiltert und ohne Verschachtelung --
// für Werkzeuge, die selbst gruppieren wollen (z. B. das lokale
// Export-Skript export-nach-sharepoint.js, das Programme/Module/
// Sessions/Materialien getrennt abruft statt der zusammengesetzten
// ?resource=lesen-Antwort). Analog zum GET-Zweig von handleModule/
// handleSessions, aber bewusst nur GET -- diese Resource kennt kein
// POST/PATCH/DELETE, Schreibzugriff auf Materialien bleibt
// api/admin/sessions.js (?resource=materials) vorbehalten.
async function handleMaterials(req, res, supabase) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt -- dieser Pfad ist rein lesend.' })
    return
  }

  const { data, error } = await supabase.from('session_material').select('*')

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ materialien: data })
}

// Signierte URL für einen einzelnen Storage-Pfad im privaten Bucket
// "Programme" -- fürs lokale Export-Skript, das jede Datei einzeln
// herunterlädt (anders als ?resource=lesen, das für ~230 Materialien
// bereits im selben Call batch-signiert). Bewusst nur GET.
async function handleMaterialSignedUrl(req, res, supabase) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt -- dieser Pfad ist rein lesend.' })
    return
  }

  const { pfad } = req.query

  if (!pfad || typeof pfad !== 'string') {
    res.status(400).json({ error: 'pfad ist erforderlich.' })
    return
  }

  const { data, error } = await supabase.storage
    .from(MATERIAL_BUCKET)
    .createSignedUrl(pfad, MATERIAL_URL_ABLAUF_SEKUNDEN)

  if (error || !data?.signedUrl) {
    res.status(404).json({ error: 'Datei konnte nicht signiert werden.' })
    return
  }

  res.status(200).json({ url: data.signedUrl })
}

// Agent-Pendant zu handleFaq (api/admin/programme.js?resource=faq):
// erlaubt dem Produktagenten, neue FAQ-Einträge für den Coachie-Chat
// vorzuschlagen -- landet zwingend mit aktiv=false als Entwurf, bis ein
// Admin sie freigibt (siehe faq.sql). PATCH/DELETE nur auf noch nicht
// freigegebene Entwürfe, analog zum 409-Muster von handleProgramme.
async function handleFaqEntwuerfe(req, res, supabase) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('faq_eintraege')
      .select('*')
      .order('reihenfolge', { ascending: true })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ faq_eintraege: data })
    return
  }

  if (req.method === 'POST') {
    const { frage, antwort, reihenfolge } = req.body ?? {}

    if (!frage || !antwort) {
      res.status(400).json({ error: 'frage und antwort sind erforderlich.' })
      return
    }

    // aktiv bewusst nicht aus dem Body übernommen -- landet immer als
    // Entwurf, unabhängig davon, was der Agent schickt.
    const { data, error } = await supabase
      .from('faq_eintraege')
      .insert({ frage, antwort, reihenfolge: reihenfolge ?? 0, aktiv: false })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ faq_eintrag: data })
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
      .from('faq_eintraege')
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
          'FAQ-Eintrag nicht gefunden oder bereits veröffentlicht -- der Agent darf veröffentlichte Einträge nicht mehr bearbeiten.',
      })
      return
    }

    res.status(200).json({ faq_eintrag: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.query

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('faq_eintraege')
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
          'FAQ-Eintrag nicht gefunden oder bereits veröffentlicht -- der Agent darf veröffentlichte Einträge nicht löschen.',
      })
      return
    }

    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

export default async function handler(req, res) {
  const { resource } = req.query

  // ?resource=lesen erlaubt das Secret zusätzlich als Query-Parameter
  // (siehe requireAgentLesen) -- alle anderen (schreibenden) Ressourcen
  // bleiben bei der reinen Header-Prüfung.
  const autorisiert =
    resource === 'lesen' ? requireAgentLesen(req, res) : requireAgent(req, res)
  if (!autorisiert) return

  const supabase = getSupabaseAdmin()

  if (resource === 'module') {
    await handleModule(req, res, supabase)
    return
  }

  if (resource === 'sessions') {
    await handleSessions(req, res, supabase)
    return
  }

  if (resource === 'lesen') {
    await handleLesen(req, res, supabase)
    return
  }

  if (resource === 'materials') {
    await handleMaterials(req, res, supabase)
    return
  }

  if (resource === 'material-signed-url') {
    await handleMaterialSignedUrl(req, res, supabase)
    return
  }

  if (resource === 'faq') {
    await handleFaqEntwuerfe(req, res, supabase)
    return
  }

  await handleProgramme(req, res, supabase)
}
