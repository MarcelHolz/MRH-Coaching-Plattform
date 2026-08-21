import { getStripe } from './_lib/stripeClient.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const { slug } = req.body ?? {}

  if (!slug) {
    res.status(400).json({ error: 'slug ist erforderlich.' })
    return
  }

  const supabase = getSupabaseAdmin()

  const { data: programm, error } = await supabase
    .from('programme')
    .select('id, stripe_price_id')
    .eq('slug', slug)
    .eq('oeffentlich_kaufbar', true)
    .eq('aktiv', true)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  if (!programm || !programm.stripe_price_id) {
    res.status(404).json({ error: 'Programm ist nicht käuflich.' })
    return
  }

  const appUrl =
    process.env.APP_URL ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: programm.stripe_price_id, quantity: 1 }],
    success_url: `${appUrl}/kaufen/${slug}?erfolg=1`,
    cancel_url: `${appUrl}/kaufen/${slug}?abgebrochen=1`,
    metadata: { programm_id: programm.id },
  })

  res.status(200).json({ url: session.url })
}
