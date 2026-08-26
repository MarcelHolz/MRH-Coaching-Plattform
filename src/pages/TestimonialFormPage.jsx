import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Einfaches Formular hinter dem Link aus der automatischen
// Testimonial-Einladungsmail (api/cron/erinnerungen.js, nach 100%
// Programmabschluss). Schreibt direkt per RLS in die Tabelle
// testimonials ("coachie legt eigenes Testimonial an", siehe
// testimonials.sql) -- kein eigener Backend-Endpunkt nötig. Landet mit
// freigegeben=false, ein Admin muss es im Admin-Bereich manuell
// freigeben, bevor es auf der Verkaufsseite erscheint.
export default function TestimonialFormPage() {
  const { programmId } = useParams()
  const { coachie } = useAuth()
  const [programmTitel, setProgrammTitel] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [gesendet, setGesendet] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    supabase
      .from('programme')
      .select('titel')
      .eq('id', programmId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setProgrammTitel(data?.titel ?? '')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [programmId])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!coachie?.id || !text.trim()) return

    setSubmitting(true)
    setError('')

    const { error: insertError } = await supabase.from('testimonials').insert({
      coachie_id: coachie.id,
      programm_id: programmId,
      text: text.trim(),
    })

    setSubmitting(false)

    if (insertError) {
      setError('Konnte nicht gespeichert werden. Bitte versuch es noch einmal.')
      return
    }

    setGesendet(true)
  }

  if (loading) return <p className="text-mrh-grey">Lädt…</p>

  return (
    <div className="mx-auto max-w-xl">
      <Link
        to="/coachie"
        className="mb-4 inline-block text-sm text-mrh-navy hover:underline"
      >
        ← Zurück zur Übersicht
      </Link>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="mb-1 font-serif text-xl font-semibold text-mrh-navy">
          Danke, dass du dabei warst{programmTitel ? ` bei "${programmTitel}"` : ''}!
        </h1>

        {gesendet ? (
          <p className="mt-4 text-sm text-mrh-grey">
            Danke für dein Feedback! Wir schauen es uns in Ruhe an -- wenn du
            einverstanden bist, dass wir es (anonymisiert oder mit Namen)
            zeigen, meldet sich Marcel bei dir.
          </p>
        ) : (
          <>
            <p className="mt-2 mb-4 text-sm text-mrh-grey">
              Magst du kurz teilen, wie das Programm für dich war? Das hilft
              anderen bei der Entscheidung -- ganz ohne Verpflichtung, und wir
              prüfen jeden Text, bevor er irgendwo erscheint.
            </p>
            <form onSubmit={handleSubmit}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Was hat sich für dich verändert?"
                rows={5}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
              />
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="mt-4 rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
              >
                {submitting ? 'Sendet…' : 'Absenden'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
