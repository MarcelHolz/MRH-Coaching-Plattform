import { requireAdmin } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const { email } = req.body ?? {}

  if (!email) {
    res.status(400).json({ error: 'email ist erforderlich.' })
    return
  }

  const supabase = getSupabaseAdmin()

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
