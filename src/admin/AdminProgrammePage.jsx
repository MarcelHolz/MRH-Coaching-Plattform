import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminFetch } from '../lib/adminFetch'

export default function AdminProgrammePage() {
  const [programme, setProgramme] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [titel, setTitel] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function loadProgramme() {
    setLoading(true)
    setError('')
    try {
      const data = await adminFetch('/api/admin/programme')
      setProgramme(data.programme ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProgramme()
  }, [])

  async function handleCreate(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await adminFetch('/api/admin/programme', {
        method: 'POST',
        body: JSON.stringify({ titel, beschreibung }),
      })
      setTitel('')
      setBeschreibung('')
      await loadProgramme()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleAktiv(programm) {
    setError('')
    try {
      await adminFetch('/api/admin/programme', {
        method: 'PATCH',
        body: JSON.stringify({ id: programm.id, aktiv: !programm.aktiv }),
      })
      await loadProgramme()
    } catch (err) {
      setError(err.message)
    }
  }

  const [editingId, setEditingId] = useState(null)
  const [editPreis, setEditPreis] = useState('')
  const [editStripePriceId, setEditStripePriceId] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editKaufbar, setEditKaufbar] = useState(false)
  const [editTeaser, setEditTeaser] = useState(false)
  const [editPreisAnzeigen, setEditPreisAnzeigen] = useState(true)
  const [editZugriffsmonate, setEditZugriffsmonate] = useState('')
  const [editZielgruppeText, setEditZielgruppeText] = useState('')
  const [editAblaufSchritte, setEditAblaufSchritte] = useState(['', '', ''])
  const [editSubmitting, setEditSubmitting] = useState(false)

  function startEdit(programm) {
    setEditingId(programm.id)
    setEditPreis(
      programm.preis_cent != null ? String(programm.preis_cent / 100) : '',
    )
    setEditStripePriceId(programm.stripe_price_id ?? '')
    setEditSlug(programm.slug ?? '')
    setEditKaufbar(programm.oeffentlich_kaufbar ?? false)
    setEditTeaser(programm.teaser_aktiv ?? false)
    setEditPreisAnzeigen(programm.preis_anzeigen ?? true)
    setEditZugriffsmonate(
      programm.standard_zugriffsmonate != null
        ? String(programm.standard_zugriffsmonate)
        : '',
    )
    setEditZielgruppeText(programm.zielgruppe_text ?? '')
    const schritte = Array.isArray(programm.ablauf_schritte)
      ? programm.ablauf_schritte
      : []
    setEditAblaufSchritte([
      schritte[0] ?? '',
      schritte[1] ?? '',
      schritte[2] ?? '',
    ])
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleUpdateVerkauf(event) {
    event.preventDefault()
    setError('')
    setEditSubmitting(true)
    try {
      const ablaufSchritte = editAblaufSchritte
        .map((schritt) => schritt.trim())
        .filter(Boolean)

      await adminFetch('/api/admin/programme', {
        method: 'PATCH',
        body: JSON.stringify({
          id: editingId,
          preis_cent: editPreis ? Math.round(Number(editPreis) * 100) : null,
          stripe_price_id: editStripePriceId || null,
          slug: editSlug || null,
          oeffentlich_kaufbar: editKaufbar,
          teaser_aktiv: editTeaser,
          preis_anzeigen: editPreisAnzeigen,
          standard_zugriffsmonate: editZugriffsmonate
            ? Math.round(Number(editZugriffsmonate))
            : null,
          zielgruppe_text: editZielgruppeText.trim() || null,
          ablauf_schritte: ablaufSchritte.length > 0 ? ablaufSchritte : null,
        }),
      })
      setEditingId(null)
      await loadProgramme()
    } catch (err) {
      setError(err.message)
    } finally {
      setEditSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-mrh-navy">Programme</h1>

      <form
        onSubmit={handleCreate}
        className="mb-8 grid gap-3 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-[1fr_2fr_auto]"
      >
        <input
          type="text"
          placeholder="Titel"
          required
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
        />
        <input
          type="text"
          placeholder="Beschreibung"
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
        >
          Anlegen
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-slate-500">Lädt…</p>
      ) : (
        <div className="space-y-3">
          {programme.map((programm) => (
            <div key={programm.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-800">
                      {programm.titel}
                    </h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        programm.aktiv
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {programm.aktiv ? 'Aktiv' : 'Inaktiv'}
                    </span>
                    {programm.oeffentlich_kaufbar && (
                      <span className="rounded-full bg-mrh-gold/15 px-2 py-0.5 text-xs font-medium text-mrh-gold-dark">
                        Öffentlich kaufbar
                      </span>
                    )}
                    {programm.teaser_aktiv && (
                      <span className="rounded-full bg-mrh-navy/10 px-2 py-0.5 text-xs font-medium text-mrh-navy">
                        Teaser
                      </span>
                    )}
                  </div>
                  {programm.beschreibung && (
                    <p className="text-sm text-slate-500">
                      {programm.beschreibung}
                    </p>
                  )}
                  {programm.oeffentlich_kaufbar && programm.slug && (
                    <a
                      href={`/kaufen/${programm.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-mrh-navy hover:underline"
                    >
                      /kaufen/{programm.slug} ansehen ↗
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    to={`/admin/programme/${programm.id}`}
                    className="text-sm text-mrh-navy hover:underline"
                  >
                    Sessions verwalten
                  </Link>
                  <button
                    onClick={() =>
                      editingId === programm.id
                        ? cancelEdit()
                        : startEdit(programm)
                    }
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-50"
                  >
                    {editingId === programm.id ? 'Abbrechen' : 'Verkauf einrichten'}
                  </button>
                  <button
                    onClick={() => handleToggleAktiv(programm)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-50"
                  >
                    {programm.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                </div>
              </div>

              {editingId === programm.id && (
                <form
                  onSubmit={handleUpdateVerkauf}
                  className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2"
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Preis in Euro
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="z. B. 199.00"
                      value={editPreis}
                      onChange={(e) => setEditPreis(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Stripe Price ID
                    </label>
                    <input
                      type="text"
                      placeholder="price_..."
                      value={editStripePriceId}
                      onChange={(e) => setEditStripePriceId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Slug (für /kaufen/…)
                    </label>
                    <input
                      type="text"
                      placeholder="z. B. keynote-intensiv"
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Standardzugriff (Monate)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="leer = unbegrenzt"
                      value={editZugriffsmonate}
                      onChange={(e) => setEditZugriffsmonate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Gilt nur für automatische Käufe über /kaufen/…; manuell
                      zugeordnete Programme bleiben unbegrenzt.
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Zielgruppen-Satz (&bdquo;Für wen ist das&ldquo;)
                    </label>
                    <input
                      type="text"
                      placeholder="z. B. Für Unternehmer, die klare Entscheidungen wollen"
                      value={editZielgruppeText}
                      onChange={(e) => setEditZielgruppeText(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      So läuft es ab (bis zu drei Schritte)
                    </label>
                    <div className="space-y-2">
                      {editAblaufSchritte.map((schritt, index) => (
                        <input
                          key={index}
                          type="text"
                          placeholder={`Schritt ${index + 1} (optional)`}
                          value={schritt}
                          onChange={(e) => {
                            const naechsteSchritte = [...editAblaufSchritte]
                            naechsteSchritte[index] = e.target.value
                            setEditAblaufSchritte(naechsteSchritte)
                          }}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                        />
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={editKaufbar}
                      onChange={(e) => setEditKaufbar(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Öffentlich kaufbar (Kaufseite unter /kaufen/… erreichbar)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={editTeaser}
                      onChange={(e) => setEditTeaser(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Als Teaser zeigen (nicht zugeordneten Coachies als Vorschau)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={editPreisAnzeigen}
                      onChange={(e) => setEditPreisAnzeigen(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Preis anzeigen (sonst &bdquo;Preis auf Anfrage&ldquo; im Teaser)
                  </label>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50 sm:col-span-2"
                  >
                    {editSubmitting ? 'Speichert…' : 'Verkaufsdaten speichern'}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
