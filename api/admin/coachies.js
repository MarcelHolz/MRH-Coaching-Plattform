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
