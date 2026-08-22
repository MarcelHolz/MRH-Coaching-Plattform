import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'
import TestergebnisseManager from './TestergebnisseManager'

export default function AdminCoachiesPage() {
  const [coachies, setCoachies] = useState([])
  const [programme, setProgramme] = useState([])
  const [zuordnungen, setZuordnungen] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [einladen, setEinladen] = useState(false)

  const [selectedCoachie, setSelectedCoachie] = useState('')
  const [selectedProgramm, setSelectedProgramm] = useState('')
  const [zuordnen, setZuordnen] = useState(false)

  const [resendingId, setResendingId] = useState(null)
  const [resendMessage, setResendMessage] = useState('')
  const [resetSendingId, setResetSendingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const [editingZugriffId, setEditingZugriffId] = useState(null)
  const [editingZugriffValue, setEditingZugriffValue] = useState('')
  const [zugriffSpeichertId, setZugriffSpeichertId] = useState(null)

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [coachiesData, programmeData, assignmentsData] = await Promise.all([
        adminFetch('/api/admin/coachies'),
        adminFetch('/api/admin/programme'),
        adminFetch('/api/admin/coachies?resource=assignments'),
      ])
      setCoachies(coachiesData.coachies ?? [])
      setProgramme(programmeData.programme ?? [])
      setZuordnungen(assignmentsData.assignments ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function handleInvite(event) {
    event.preventDefault()
    setError('')
    setEinladen(true)
    try {
      await adminFetch('/api/admin/coachies', {
        method: 'POST',
        body: JSON.stringify({ name, email }),
      })
      setName('')
      setEmail('')
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setEinladen(false)
    }
  }

  async function handleAssign(event) {
    event.preventDefault()
    if (!selectedCoachie || !selectedProgramm) return
    setError('')
    setZuordnen(true)
    try {
      await adminFetch('/api/admin/coachies?resource=assignments', {
        method: 'POST',
        body: JSON.stringify({
          coachie_id: selectedCoachie,
          programm_id: selectedProgramm,
        }),
      })
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setZuordnen(false)
    }
  }

  async function handleUnassign(id) {
    setError('')
    try {
      await adminFetch(`/api/admin/coachies?resource=assignments&id=${id}`, {
        method: 'DELETE',
      })
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleResend(coachie) {
    setError('')
    setResendMessage('')
    setResendingId(coachie.id)
    try {
      await adminFetch('/api/admin/coachies?resource=resend', {
        method: 'POST',
        body: JSON.stringify({ email: coachie.email }),
      })
      setResendMessage(`Einladung erneut an ${coachie.email} gesendet.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setResendingId(null)
    }
  }

  async function handlePasswortReset(coachie) {
    setError('')
    setResendMessage('')
    setResetSendingId(coachie.id)
    try {
      await adminFetch('/api/admin/coachies?resource=passwort-reset', {
        method: 'POST',
        body: JSON.stringify({ email: coachie.email }),
      })
      setResendMessage(`Passwort-Reset-Link an ${coachie.email} gesendet.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setResetSendingId(null)
    }
  }

  function startZugriffEdit(zuordnung) {
    setEditingZugriffId(zuordnung.id)
    setEditingZugriffValue(
      zuordnung.zugriff_bis ? zuordnung.zugriff_bis.slice(0, 10) : '',
    )
  }

  async function handleZugriffBisSave(zuordnungId) {
    setError('')
    setZugriffSpeichertId(zuordnungId)
    try {
      await adminFetch('/api/admin/coachies?resource=assignments', {
        method: 'PATCH',
        body: JSON.stringify({
          id: zuordnungId,
          zugriff_bis: editingZugriffValue
            ? new Date(editingZugriffValue).toISOString()
            : null,
        }),
      })
      setEditingZugriffId(null)
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setZugriffSpeichertId(null)
    }
  }

  function formatZugriffBis(iso) {
    if (!iso) return 'unbegrenzt'
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  async function handleDelete(coachie) {
    if (
      !window.confirm(
        `${coachie.name} (${coachie.email}) wirklich endgültig löschen? Alle Zuordnungen und Fortschrittsdaten gehen verloren.`,
      )
    ) {
      return
    }

    setError('')
    setDeletingId(coachie.id)
    try {
      await adminFetch(`/api/admin/coachies?id=${coachie.id}`, {
        method: 'DELETE',
      })
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-mrh-navy">Coachies</h1>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {resendMessage && (
        <p className="mb-4 text-sm text-green-700">{resendMessage}</p>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleInvite} className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Coachie einladen</h2>
          <div className="mb-3">
            <input
              type="text"
              placeholder="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
            />
          </div>
          <div className="mb-3">
            <input
              type="email"
              placeholder="E-Mail"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
            />
          </div>
          <button
            type="submit"
            disabled={einladen}
            className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
          >
            {einladen ? 'Lädt ein…' : 'Einladen'}
          </button>
        </form>

        <form onSubmit={handleAssign} className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">
            Programm zuordnen
          </h2>
          <div className="mb-3">
            <select
              required
              value={selectedCoachie}
              onChange={(e) => setSelectedCoachie(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
            >
              <option value="">Coachie wählen…</option>
              {coachies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <select
              required
              value={selectedProgramm}
              onChange={(e) => setSelectedProgramm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
            >
              <option value="">Programm wählen…</option>
              {programme.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titel}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={zuordnen}
            className="rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
          >
            {zuordnen ? 'Ordnet zu…' : 'Zuordnen'}
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-slate-500">Lädt…</p>
      ) : (
        <div className="space-y-3">
          {coachies.map((coachie) => {
            const eigeneZuordnungen = zuordnungen.filter(
              (z) => z.coachie_id === coachie.id,
            )
            return (
              <div
                key={coachie.id}
                className="rounded-xl bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      {coachie.name}
                    </h3>
                    <p className="text-sm text-slate-500">{coachie.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      onClick={() =>
                        setExpandedId(expandedId === coachie.id ? null : coachie.id)
                      }
                      className="text-sm text-mrh-navy hover:underline"
                    >
                      {expandedId === coachie.id
                        ? 'Schließen'
                        : 'Testergebnisse verknüpfen'}
                    </button>
                    <button
                      onClick={() => handleResend(coachie)}
                      disabled={resendingId === coachie.id}
                      className="text-sm text-mrh-navy hover:underline disabled:opacity-50"
                    >
                      {resendingId === coachie.id
                        ? 'Sendet…'
                        : 'Einladung erneut senden'}
                    </button>
                    <button
                      onClick={() => handlePasswortReset(coachie)}
                      disabled={resetSendingId === coachie.id}
                      className="text-sm text-mrh-navy hover:underline disabled:opacity-50"
                    >
                      {resetSendingId === coachie.id
                        ? 'Sendet…'
                        : 'Passwort-Reset senden'}
                    </button>
                    <button
                      onClick={() => handleDelete(coachie)}
                      disabled={deletingId === coachie.id}
                      className="text-sm text-red-600 hover:underline disabled:opacity-50"
                    >
                      {deletingId === coachie.id ? 'Löscht…' : 'Löschen'}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {eigeneZuordnungen.map((z) => {
                    const programm = programme.find(
                      (p) => p.id === z.programm_id,
                    )
                    const bearbeitetGerade = editingZugriffId === z.id
                    return (
                      <div
                        key={z.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
                      >
                        <span className="font-medium text-slate-700">
                          {programm?.titel ?? 'Unbekannt'}
                        </span>
                        {bearbeitetGerade ? (
                          <>
                            <input
                              type="date"
                              value={editingZugriffValue}
                              onChange={(e) =>
                                setEditingZugriffValue(e.target.value)
                              }
                              className="rounded border border-slate-300 px-2 py-0.5 text-xs focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
                            />
                            <button
                              onClick={() => handleZugriffBisSave(z.id)}
                              disabled={zugriffSpeichertId === z.id}
                              className="text-mrh-navy hover:underline disabled:opacity-50"
                            >
                              {zugriffSpeichertId === z.id
                                ? 'Speichert…'
                                : 'Speichern'}
                            </button>
                            <button
                              onClick={() => setEditingZugriffId(null)}
                              className="text-slate-400 hover:underline"
                            >
                              Abbrechen
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-400">
                              Zugriff bis: {formatZugriffBis(z.zugriff_bis)}
                            </span>
                            <button
                              onClick={() => startZugriffEdit(z)}
                              className="text-mrh-navy hover:underline"
                            >
                              Bearbeiten
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleUnassign(z.id)}
                          className="ml-auto text-slate-400 hover:text-red-600"
                        >
                          × Zuordnung entfernen
                        </button>
                      </div>
                    )
                  })}
                  {eigeneZuordnungen.length === 0 && (
                    <span className="text-xs text-slate-400">
                      Keine Programme zugeordnet
                    </span>
                  )}
                </div>

                {expandedId === coachie.id && (
                  <TestergebnisseManager
                    coachieId={coachie.id}
                    coachieEmail={coachie.email}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
