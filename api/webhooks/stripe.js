import { getStripe } from '../_lib/stripeClient.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

// Stripe-Signaturprüfung braucht den unveränderten Roh-Body (byte-genau),
// nicht das von Vercel automatisch geparste JSON-Objekt.
export const config = {
  api: {
    bodyParser: false,
  },
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const stripe = getStripe()
  const signature = req.headers['stripe-signature']
  const rawBody = await readRawBody(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    res.status(400).json({ error: `Signaturprüfung fehlgeschlagen: ${err.message}` })
    return
  }

  const supabase = getSupabaseAdmin()

  // Idempotenz nach dem Insert-first-Prinzip: Bei Unique-Violation wurde
  // dieses Event bereits verarbeitet (z. B. Stripe-Retry-Zustellung) --
  // dann ohne erneute Verarbeitung mit 200 antworten, damit Stripe nicht
  // weiter retried.
  const { error: insertEventError } = await supabase
    .from('stripe_events')
    .insert({ id: event.id })

  if (insertEventError) {
    if (insertEventError.code === '23505') {
      res.status(200).json({ received: true, already_processed: true })
      return
    }
    res.status(500).json({ error: insertEventError.message })
    return
  }

  if (event.type !== 'checkout.session.completed') {
    res.status(200).json({ received: true })
    return
  }

  const session = event.data.object
  const email = session.customer_details?.email
  const programmId = session.metadata?.programm_id

  if (!email || !programmId) {
    res
      .status(200)
      .json({ received: true, warning: 'E-Mail oder Programm-ID fehlt im Event.' })
    return
  }

  const { data: bestehenderCoachie, error: lookupError } = await supabase
    .from('coachies')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (lookupError) {
    res.status(500).json({ error: lookupError.message })
    return
  }

  let coachieId = bestehenderCoachie?.id

  if (!coachieId) {
    // Neuer Coachie: Account anlegen und dieselbe Einladungs-E-Mail wie
    // beim manuellen Einladen durch Marcel auslösen (Passwort-Setzen-Flow
    // aus Phase 1). Ein bereits bestehender Coachie bekommt hier bewusst
    // KEINE erneute Einladung -- er hat schon ein Passwort und wird nur
    // dem neuen Programm zugeordnet.
    const appUrl =
      process.env.APP_URL ||
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

    const { data: invited, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/passwort-festlegen`,
      })

    if (inviteError) {
      res.status(500).json({ error: inviteError.message })
      return
    }

    const { data: neuerCoachie, error: insertCoachieError } = await supabase
      .from('coachies')
      .insert({
        id: invited.user.id,
        name: session.customer_details?.name || email,
        email,
      })
      .select()
      .single()

    if (insertCoachieError) {
      await supabase.auth.admin.deleteUser(invited.user.id)
      res.status(500).json({ error: insertCoachieError.message })
      return
    }

    coachieId = neuerCoachie.id
  }

  const { data: programm, error: programmError } = await supabase
    .from('programme')
    .select('standard_zugriffsmonate')
    .eq('id', programmId)
    .maybeSingle()

  if (programmError) {
    res.status(500).json({ error: programmError.message })
    return
  }

  let zugriffBis = null
  if (programm?.standard_zugriffsmonate) {
    const datum = new Date()
    datum.setMonth(datum.getMonth() + programm.standard_zugriffsmonate)
    zugriffBis = datum.toISOString()
  }

  const { error: assignmentError } = await supabase.from('coachie_programme').upsert(
    {
      coachie_id: coachieId,
      programm_id: programmId,
      zugewiesen_am: new Date().toISOString(),
      zugriff_bis: zugriffBis,
    },
    { onConflict: 'coachie_id,programm_id' },
  )

  if (assignmentError) {
    res.status(500).json({ error: assignmentError.message })
    return
  }

  res.status(200).json({ received: true })
}
