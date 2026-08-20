import { requireAdmin } from '../_lib/adminAuth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt.' })
    return
  }

  const supabase = getSupabaseAdmin()

  const [coachies, programme, assignments, sessions, status] =
    await Promise.all([
      supabase.from('coachies').select('*').order('name', { ascending: true }),
      supabase.from('programme').select('*'),
      supabase.from('coachie_programme').select('*'),
      supabase.from('sessions').select('*'),
      supabase.from('coachie_status').select('*'),
    ])

  const firstError = [coachies, programme, assignments, sessions, status].find(
    (result) => result.error,
  )

  if (firstError) {
    res.status(500).json({ error: firstError.error.message })
    return
  }

  res.status(200).json({
    coachies: coachies.data,
    programme: programme.data,
    assignments: assignments.data,
    sessions: sessions.data,
    status: status.data,
  })
}
