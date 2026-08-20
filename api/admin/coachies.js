import { requireAdmin } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return

  const supabase = getSupabaseAdmin()

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

    const { data: invited, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(
        email,
        process.env.APP_URL
          ? { redirectTo: `${process.env.APP_URL}/passwort-festlegen` }
          : undefined,
      )

    if (inviteError) {
      res.status(500).json({ error: inviteError.message })
      return
    }

    const { data: coachie, error: insertError } = await supabase
      .from('coachies')
      .insert({ id: invited.user.id, name, email })
      .select()
      .single()

    if (insertError) {
      await supabase.auth.admin.deleteUser(invited.user.id)
      res.status(500).json({ error: insertError.message })
      return
    }

    res.status(201).json({ coachie })
    return
  }

  res.status(405).json({ error: 'Methode nicht erlaubt.' })
}
