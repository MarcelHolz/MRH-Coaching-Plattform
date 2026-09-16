import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Dezenter Hinweis für Nicht-Mitglieder (Mitgliederbereich Punkt 5) --
// bewusst zurückhaltend (schmale Zeile statt Banner/Modal, kein
// automatisches Popup), rendert einfach nichts für bereits aktive
// Mitglieder oder solange der Status noch lädt.
export default function MitgliedschaftHinweis() {
  const { coachie } = useAuth()
  const [istAktivesMitglied, setIstAktivesMitglied] = useState(null)

  useEffect(() => {
    if (!coachie?.id) return
    let cancelled = false

    supabase
      .from('mitgliedschaften')
      .select('status')
      .eq('coachie_id', coachie.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIstAktivesMitglied(data?.status === 'aktiv')
      })

    return () => {
      cancelled = true
    }
  }, [coachie])

  if (istAktivesMitglied !== false) return null

  return (
    <p className="text-xs text-mrh-grey">
      Übrigens: Mit der{' '}
      <Link to="/mitgliedschaft" className="text-mrh-navy underline">
        MRH Community-Mitgliedschaft
      </Link>{' '}
      bekommst du exklusive Inhalte und Live-Sitzungen dazu.
    </p>
  )
}
