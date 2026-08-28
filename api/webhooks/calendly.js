import crypto from 'node:crypto'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

// Signaturprüfung braucht den unveränderten Roh-Body (byte-genau), wie
// bei api/webhooks/stripe.js.
export const config = {
  api: {
    bodyParser: false,
  },
}

const SIGNATUR_TOLERANZ_SEKUNDEN = 300

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// Calendly signiert nach demselben Schema wie Stripe:
// "Calendly-Webhook-Signature: t=<Unix-Zeitstempel>,v1=<HMAC-SHA256-Hex>"
// über "<t>.<Roh-Body>" mit dem Signing Secret. Ein Zeitfenster von 5
// Minuten schützt zusätzlich vor Replay eines abgefangenen Requests --
// nicht explizit in der Aufgabenstellung gefordert, aber Teil derselben
// Prüfung, die Calendlys eigene Doku für dieses Schema empfiehlt.
function verifiziereSignatur(rawBody, header, secret) {
  if (!header || !secret) return false

  const teile = Object.fromEntries(
    header.split(',').map((teil) => teil.split('=')),
  )
  const { t: zeitstempel, v1: signatur } = teile
  if (!zeitstempel || !signatur) return false

  if (
    Math.abs(Date.now() / 1000 - Number(zeitstempel)) >
    SIGNATUR_TOLERANZ_SEKUNDEN
  ) {
    return false
  }

  const erwarteteSignatur = crypto
    .createHmac('sha256', secret)
    .update(`${zeitstempel}.${rawBody}`)
    .digest('hex')

  const a = Buffer.from(signatur)
  const b = Buffer.from(erwarteteSignatur)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Calendlys invitee.created-Payload liefert event_type in aller Regel
// nur als API-Ressourcen-URI (https://api.calendly.com/event_types/...),
// nicht die öffentliche Buchungsseite (https://calendly.com/...), die
// wir in programme.calendly_url hinterlegt haben -- das war in der
// Aufgabenstellung so angenommen ("event_type.scheduling_url aus dem
// Payload"), ließ sich in dieser Sandbox aber nicht gegen Calendlys
// Doku verifizieren (Netzwerkzugriff auf alle calendly.com-Domains ist
// hier blockiert). Falls Calendly die scheduling_url doch direkt
// mitschickt, wird sie bevorzugt; sonst holen wir sie einmalig über die
// Calendly-API nach (braucht CALENDLY_PAT).
async function ermittleSchedulingUrl(payload) {
  const direkt =
    payload.scheduled_event?.event_type?.scheduling_url ??
    payload.event_type?.scheduling_url

  if (direkt) return direkt

  const eventTypeUri = payload.scheduled_event?.event_type
  if (typeof eventTypeUri !== 'string' || !process.env.CALENDLY_PAT) {
    return null
  }

  try {
    const response = await fetch(eventTypeUri, {
      headers: { Authorization: `Bearer ${process.env.CALENDLY_PAT}` },
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.resource?.scheduling_url ?? null
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const rawBody = await readRawBody(req)
  const signaturOk = verifiziereSignatur(
    rawBody,
    req.headers['calendly-webhook-signature'],
    process.env.CALENDLY_WEBHOOK_SECRET,
  )

  if (!signaturOk) {
    res.status(401).json({ error: 'Signaturprüfung fehlgeschlagen.' })
    return
  }

  let event
  try {
    event = JSON.parse(rawBody.toString('utf8'))
  } catch {
    res.status(400).json({ error: 'Ungültiges JSON.' })
    return
  }

  // Ab hier immer mit 200 antworten -- Calendly wiederholt die
  // Zustellung sonst endlos (siehe Aufgabenstellung). Alles, was nicht
  // zugeordnet werden kann, wird nur geloggt (für Marcel zur
  // Fehlersuche in den Vercel-Logs), nicht als Fehler an Calendly
  // zurückgemeldet.
  if (event.event !== 'invitee.created') {
    res.status(200).json({ received: true })
    return
  }

  const payload = event.payload ?? {}
  const email = payload.email
  const invitedUri = payload.uri

  if (!email || !invitedUri) {
    console.warn('Calendly-Webhook ohne E-Mail oder Invitee-URI:', payload)
    res.status(200).json({ received: true, matched: false })
    return
  }

  const supabase = getSupabaseAdmin()

  const [{ data: coachie }, schedulingUrl] = await Promise.all([
    supabase.from('coachies').select('id').eq('email', email).maybeSingle(),
    ermittleSchedulingUrl(payload),
  ])

  if (!coachie || !schedulingUrl) {
    console.warn('Calendly-Webhook ohne Coachie- oder Programm-Match:', {
      email,
      schedulingUrl,
    })
    res.status(200).json({ received: true, matched: false })
    return
  }

  const { data: programm } = await supabase
    .from('programme')
    .select('id')
    .eq('calendly_url', schedulingUrl)
    .maybeSingle()

  if (!programm) {
    console.warn('Calendly-Webhook: kein Programm mit dieser calendly_url:', {
      schedulingUrl,
    })
    res.status(200).json({ received: true, matched: false })
    return
  }

  // ignoreDuplicates statt insert+Fehlerbehandlung: bei einer
  // Webhook-Wiederholung mit identischer Invitee-URI (unique
  // Constraint) wird der Eintrag einfach übersprungen, kein Fehler.
  const { error: insertError } = await supabase
    .from('programm_calendly_buchungen')
    .upsert(
      {
        coachie_id: coachie.id,
        programm_id: programm.id,
        calendly_event_uri: invitedUri,
      },
      { onConflict: 'calendly_event_uri', ignoreDuplicates: true },
    )

  if (insertError) {
    console.error('Calendly-Webhook: Buchung konnte nicht gespeichert werden:', insertError)
  }

  res.status(200).json({ received: true, matched: true })
}
