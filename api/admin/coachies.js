import crypto from 'node:crypto'
import { requireAdmin } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { sendMail } from '../_lib/mailer.js'
import { ermittleAppUrl } from '../_lib/appUrl.js'
import {
  bestehenderAuthNutzer,
  findeOderErstelleCoachie,
  normalisiereEmail,
} from '../_lib/coachieAnlage.js'

// Konsolidierte Route (Vercel Hobby: max. 12 Serverless Functions).
// ?resource= steuert, welche der drei früher getrennten Dateien
// (coachies.js, coachies-resend.js, assignments.js) angesprochen wird.
// Verhalten je Resource ist unverändert 1:1 aus den Originaldateien
// übernommen.

async function handleCoachies(req, res, supabase) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('coachies')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ coachies: data })
    return
  }

  if (req.method === 'POST') {
    const { name, email } = req.body ?? {}

    if (!name || !email) {
      res.status(400).json({ error: 'name und email sind erforderlich.' })
      return
    }

    const normalisiert = normalisiereEmail(email)
    const { data: bereitsCoachie } = await supabase
      .from('coachies')
      .select('id')
      .eq('email', normalisiert)
      .maybeSingle()

    if (bereitsCoachie) {
      res.status(409).json({ error: 'Zu dieser E-Mail-Adresse gibt es bereits einen Coachie.' })
      return
    }

    // Gemeinsame Anlage wie bei Kauf und Gratis-Anmeldung: neue Adresse
    // bekommt eine Einladung; existiert schon ein Auth-Nutzer (z. B. ein
    // reiner Admin), wird nur die coachies-Zeile mit derselben ID angelegt.
    const { coachieId, error: anlageError } = await findeOderErstelleCoachie({
      email: normalisiert,
      name,
      supabase,
      appUrl: ermittleAppUrl(req),
    })

    if (anlageError) {
      res.status(500).json({ error: anlageError })
      return
    }

    const { data: coachie, error: ladeError } = await supabase
      .from('coachies')
      .select('*')
      .eq('id', coachieId)
      .single()

    if (ladeError) {
      res.status(500).json({ error: ladeError.message })
      return
    }

    res.status(201).json({ coachie })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.query

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    const { error: statusError } = await supabase
      .from('coachie_status')
      .delete()
      .eq('coachie_id', id)

    if (statusError) {
      res.status(500).json({ error: statusError.message })
      return
    }

    const { error: assignmentError } = await supabase
      .from('coachie_programme')
      .delete()
      .eq('coachie_id', id)

    if (assignmentError) {
      res.status(500).json({ error: assignmentError.message })
      return
    }

    const { error: coachieError } = await supabase
      .from('coachies')
      .delete()
      .eq('id', id)

    if (coachieError) {
      res.status(500).json({ error: coachieError.message })
      return
    }

    // Ist dieselbe Person auch Admin, bleibt das Auth-Konto bestehen,
    // sonst wäre der Admin-Zugang mit gelöscht.
    const { data: istAdmin } = await supabase
      .from('admin_benutzer')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (istAdmin) {
      res.status(204).end()
      return
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(id)

    if (authError) {
      res.status(500).json({
        error: `Coachie-Daten gelöscht, Auth-Konto konnte aber nicht entfernt werden: ${authError.message}`,
      })
      return
    }

    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

async function handleResend(req, res, supabase) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const { email } = req.body ?? {}

  if (!email) {
    res.status(400).json({ error: 'email ist erforderlich.' })
    return
  }

  const appUrl =
    process.env.APP_URL ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/passwort-festlegen`,
  })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ ok: true })
}

async function handlePasswortReset(req, res, supabase) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const { email } = req.body ?? {}

  if (!email) {
    res.status(400).json({ error: 'email ist erforderlich.' })
    return
  }

  const appUrl =
    process.env.APP_URL ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/passwort-festlegen`,
  })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ ok: true })
}

// Admin-Übersicht erfolgreicher Empfehlungen (Feature Empfehlungsprogramm)
// -- rein lesend, die Zuordnung/das Tracking passiert in checkout.js
// bzw. webhooks/stripe.js. Belohnungslogik ist bewusst nicht Teil
// dieser Übersicht, siehe README.
async function handleEmpfehlungen(req, res, supabase) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt -- dieser Pfad ist rein lesend.' })
    return
  }

  const { data, error } = await supabase
    .from('empfehlungen')
    .select(
      '*, werber:coachies!werber_coachie_id(name, email), geworbener:coachies!geworbener_coachie_id(name, email), programme(titel)',
    )
    .order('erstellt_am', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ empfehlungen: data })
}

// Admin-Übersicht der Mitgliedschaften (Mitgliederbereich Punkt 1).
// Status/Abrechnung einer echten (bezahlten) Mitgliedschaft werden
// weiterhin ausschließlich über den Stripe-Webhook gepflegt (siehe
// api/webhooks/stripe.js) -- POST/DELETE hier decken ausschließlich den
// Sonderfall ab, dass ein Admin einen Coachie manuell (z. B. als
// Freiplatz/Ehrenmitgliedschaft) als Mitglied hinzufügen bzw. eine so
// manuell angelegte Mitgliedschaft wieder entfernen möchte -- ohne
// jeden Bezug zu Stripe.
async function handleMitgliedschaften(req, res, supabase) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('mitgliedschaften')
      .select('*, coachies(name, email)')
      .order('start_datum', { ascending: false })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ mitgliedschaften: data })
    return
  }

  if (req.method === 'POST') {
    const { coachie_id } = req.body ?? {}

    if (!coachie_id) {
      res.status(400).json({ error: 'coachie_id ist erforderlich.' })
      return
    }

    // stripe_subscription_id ist in der Tabelle not null + unique (siehe
    // mitgliederbereich.sql) -- ein "manual-..."-Präfix statt eines
    // echten Stripe-Werts macht auf einen Blick erkennbar, dass diese
    // Zeile nicht über einen Kauf, sondern manuell entstanden ist, und
    // stellt zugleich die Eindeutigkeit sicher.
    const { data, error } = await supabase
      .from('mitgliedschaften')
      .insert({
        coachie_id,
        status: 'aktiv',
        stripe_subscription_id: `manual-${crypto.randomUUID()}`,
      })
      .select('*, coachies(name, email)')
      .single()

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({
          error: 'Dieser Coachie hat bereits eine Mitgliedschaft (siehe Liste unten).',
        })
        return
      }
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ mitgliedschaft: data })
    return
  }

  if (req.method === 'DELETE') {
    const { id } = req.query

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    // Entfernt ausschließlich die Datenbankzeile. Bei einer echten,
    // über Stripe bezahlten Mitgliedschaft läuft die zugehörige
    // Stripe-Subscription dadurch NICHT mit -- die müsste separat im
    // Stripe-Dashboard gekündigt werden, sonst wird der Coachie
    // weiterbelastet, obwohl die App ihn nicht mehr als Mitglied führt.
    const { error } = await supabase.from('mitgliedschaften').delete().eq('id', id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

async function handleAssignments(req, res, supabase) {
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

  if (req.method === 'PATCH') {
    const { id, zugriff_bis } = req.body ?? {}

    if (!id) {
      res.status(400).json({ error: 'id ist erforderlich.' })
      return
    }

    // zugriff_bis darf explizit auf null gesetzt werden (Kulanz: Ablauf
    // aufheben) -- deshalb Prüfung auf "im Body vorhanden", nicht auf
    // Wahrheitswert.
    if (!('zugriff_bis' in (req.body ?? {}))) {
      res.status(400).json({ error: 'zugriff_bis ist erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('coachie_programme')
      .update({ zugriff_bis })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ assignment: data })
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

// Admin-Übersicht der Widerrufe (Widerrufsbutton § 356a BGB). GET liefert
// alle Erklärungen, für Kurse zusätzlich den Widerrufsverzicht aus
// coachie_programme und für die Mitgliedschaft aus mitgliedschaften,
// damit der Admin prüfen kann, ob das Widerrufsrecht erloschen ist.
// PATCH ändert nur Status und Notiz. Keine automatische Erstattung oder
// Sperre.
const WIDERRUF_STATUS = ['eingegangen', 'erstattet', 'abgelehnt_erloschen', 'manuell_pruefen']

async function handleWiderrufe(req, res, supabase) {
  if (req.method === 'GET') {
    const { data: widerrufe, error } = await supabase
      .from('widerrufserklaerungen')
      .select('*')
      .order('eingegangen_am', { ascending: false })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    const coachieIds = [...new Set(widerrufe.map((w) => w.coachie_id).filter(Boolean))]

    let zuordnungen = []
    let mitgliedschaften = []
    if (coachieIds.length > 0) {
      const [zuordnungenErgebnis, mitgliedschaftenErgebnis] = await Promise.all([
        supabase
          .from('coachie_programme')
          .select('coachie_id, programm_id, zugewiesen_am, widerrufsverzicht_am')
          .in('coachie_id', coachieIds),
        supabase
          .from('mitgliedschaften')
          .select('coachie_id, start_datum, widerrufsverzicht_am')
          .in('coachie_id', coachieIds),
      ])
      if (zuordnungenErgebnis.error || mitgliedschaftenErgebnis.error) {
        res.status(500).json({
          error: (zuordnungenErgebnis.error ?? mitgliedschaftenErgebnis.error).message,
        })
        return
      }
      zuordnungen = zuordnungenErgebnis.data ?? []
      mitgliedschaften = mitgliedschaftenErgebnis.data ?? []
    }

    const ergebnis = widerrufe.map((w) => {
      let vertragsdaten = null
      if (w.coachie_id && w.vertrag_programm_id) {
        const z = zuordnungen.find(
          (eintrag) =>
            eintrag.coachie_id === w.coachie_id && eintrag.programm_id === w.vertrag_programm_id,
        )
        vertragsdaten = z
          ? { art: 'kurs', seit: z.zugewiesen_am, widerrufsverzicht_am: z.widerrufsverzicht_am }
          : { art: 'kurs', nicht_gefunden: true }
      } else if (w.coachie_id && w.vertrag === 'Mitgliedschaft') {
        const m = mitgliedschaften.find((eintrag) => eintrag.coachie_id === w.coachie_id)
        vertragsdaten = m
          ? {
              art: 'mitgliedschaft',
              seit: m.start_datum,
              widerrufsverzicht_am: m.widerrufsverzicht_am,
            }
          : { art: 'mitgliedschaft', nicht_gefunden: true }
      }
      return { ...w, vertragsdaten }
    })

    res.status(200).json({ widerrufe: ergebnis })
    return
  }

  if (req.method === 'PATCH') {
    const { id, status, notiz } = req.body ?? {}

    if (!id || !WIDERRUF_STATUS.includes(status)) {
      res.status(400).json({ error: 'id und ein gültiger status sind erforderlich.' })
      return
    }

    const { data, error } = await supabase
      .from('widerrufserklaerungen')
      .update({
        status,
        notiz: typeof notiz === 'string' && notiz.trim() ? notiz.trim() : null,
        bearbeitet_am: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ widerruf: data })
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

// Admin-Konten (Admin > Admins). GET listet alle Admins und kennzeichnet
// den angemeldeten. POST lädt per E-Mail ein: neuer Auth-Nutzer über
// inviteUserByEmail (Passwort festlegen, danach Login unter /admin/login),
// bestehender Auth-Nutzer (z. B. ein Coachie) behält sein Passwort und
// bekommt eine Hinweis-Mail. Ein Admin wird dadurch NICHT Coachie.
// PATCH aktiviert/deaktiviert. Niemand kann sich selbst deaktivieren, und
// der letzte aktive Admin bleibt aktiv.
async function handleAdmins(req, res, supabase, angemeldet) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('admin_benutzer')
      .select('id, email, name, aktiv, erstellt_am, letzter_login_am')
      .order('erstellt_am', { ascending: true })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({
      admins: data ?? [],
      ich: angemeldet.notfall ? null : angemeldet.id,
      notfall: angemeldet.notfall,
    })
    return
  }

  if (req.method === 'POST') {
    const email = normalisiereEmail(req.body?.email)
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 200) : ''

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' })
      return
    }

    const { data: vorhanden } = await supabase
      .from('admin_benutzer')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (vorhanden) {
      res.status(409).json({ error: 'Diese Adresse ist bereits als Admin eingetragen.' })
      return
    }

    const appUrl = ermittleAppUrl(req)
    let authUserId = null
    let neuEingeladen = true

    const { data: invited, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/passwort-festlegen`,
      })

    if (inviteError) {
      // Auth-Nutzer existiert schon (z. B. als Coachie): dieselbe ID
      // verwenden, Passwort bleibt unverändert.
      const bestehend = await bestehenderAuthNutzer(supabase, email)
      if (!bestehend) {
        res.status(500).json({ error: inviteError.message })
        return
      }
      authUserId = bestehend.id
      neuEingeladen = false
    } else {
      authUserId = invited.user.id
    }

    const { data: admin, error: insertError } = await supabase
      .from('admin_benutzer')
      .insert({ id: authUserId, email, name: name || null })
      .select('id, email, name, aktiv, erstellt_am, letzter_login_am')
      .single()

    if (insertError) {
      // Nur einen gerade frisch eingeladenen Auth-Nutzer wieder entfernen.
      if (neuEingeladen) await supabase.auth.admin.deleteUser(authUserId)
      res.status(500).json({ error: insertError.message })
      return
    }

    if (!neuEingeladen) {
      try {
        await sendMail({
          to: email,
          subject: 'Dein Admin-Zugang zur MRH Coaching-Plattform',
          text: `Hallo${name ? ' ' + name : ''},\n\ndu hast jetzt Zugang zum Admin-Bereich der MRH Coaching-Plattform.\n\nAnmelden: ${appUrl}/admin/login\nDu meldest dich mit deiner E-Mail-Adresse und deinem bestehenden Passwort an. Falls du es nicht mehr weißt, nutze dort „Passwort vergessen?“.\n\nViele Grüße\nMRH Beratung & Coaching`,
        })
      } catch (err) {
        console.error('Hinweis-Mail an neuen Admin nicht versendet:', err.message)
      }
    }

    res.status(201).json({ admin, eingeladen: neuEingeladen })
    return
  }

  if (req.method === 'PATCH') {
    const { id, aktiv } = req.body ?? {}

    if (!id || typeof aktiv !== 'boolean') {
      res.status(400).json({ error: 'id und aktiv sind erforderlich.' })
      return
    }

    if (!aktiv) {
      if (!angemeldet.notfall && id === angemeldet.id) {
        res.status(409).json({ error: 'Du kannst dich nicht selbst deaktivieren.' })
        return
      }

      const { count, error: countError } = await supabase
        .from('admin_benutzer')
        .select('id', { count: 'exact', head: true })
        .eq('aktiv', true)
        .neq('id', id)

      if (countError) {
        res.status(500).json({ error: countError.message })
        return
      }

      if ((count ?? 0) === 0) {
        res.status(409).json({ error: 'Der letzte aktive Admin kann nicht deaktiviert werden.' })
        return
      }
    }

    const { data, error } = await supabase
      .from('admin_benutzer')
      .update({ aktiv })
      .eq('id', id)
      .select('id, email, name, aktiv, erstellt_am, letzter_login_am')
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ admin: data })
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}

export default async function handler(req, res) {
  const angemeldet = await requireAdmin(req, res)
  if (!angemeldet) return

  const supabase = getSupabaseAdmin()
  const { resource } = req.query

  if (resource === 'admins') {
    await handleAdmins(req, res, supabase, angemeldet)
    return
  }

  if (resource === 'resend') {
    await handleResend(req, res, supabase)
    return
  }

  if (resource === 'passwort-reset') {
    await handlePasswortReset(req, res, supabase)
    return
  }

  if (resource === 'assignments') {
    await handleAssignments(req, res, supabase)
    return
  }

  if (resource === 'empfehlungen') {
    await handleEmpfehlungen(req, res, supabase)
    return
  }

  if (resource === 'mitgliedschaften') {
    await handleMitgliedschaften(req, res, supabase)
    return
  }

  if (resource === 'widerrufe') {
    await handleWiderrufe(req, res, supabase)
    return
  }

  await handleCoachies(req, res, supabase)
}
