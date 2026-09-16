import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Peer Group: bewusst kein offener Community-Feed, sondern reziprokes
// Opt-in. Das eigene Profil (Schalter + Kurzprofil) verwaltet dieser
// Coachie direkt über den Supabase-Client mit RLS (eigene Zeile in
// peer_profile). Die Übersicht anderer sichtbarer Profile läuft über
// dieselbe Tabelle -- die RLS-Policy "peer sieht sichtbare Profile im
// gemeinsamen Programm" liefert serverseitig nur reziprok sichtbare,
// programmgleiche Zeilen zurück, nie eigene fremde Kontaktdaten. Nur
// der eigentliche Mailversand bei "Interesse zeigen" läuft über
// api/certificate.js?resource=peer-interesse (braucht service_role
// für coachies.email).
export default function PeerGroupPage() {
  const { coachie, session } = useAuth()
  const [profil, setProfil] = useState(null)
  const [andere, setAndere] = useState([])
  const [gesendetAn, setGesendetAn] = useState(new Set())
  const [laedt, setLaedt] = useState(true)
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState('')
  const [gespeichert, setGespeichert] = useState(false)

  const [sichtbar, setSichtbar] = useState(false)
  const [vorname, setVorname] = useState('')
  const [brancheRolle, setBrancheRolle] = useState('')
  const [kurztext, setKurztext] = useState('')

  useEffect(() => {
    if (!coachie?.id) return
    let cancelled = false

    async function laden() {
      setLaedt(true)
      const { data, error } = await supabase
        .from('peer_profile')
        .select('sichtbar, vorname, branche_rolle, kurztext')
        .eq('coachie_id', coachie.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        setFehler('Profil konnte nicht geladen werden.')
        setLaedt(false)
        return
      }

      setProfil(data)
      setSichtbar(data?.sichtbar ?? false)
      setVorname(data?.vorname ?? (coachie.name || '').split(' ')[0] ?? '')
      setBrancheRolle(data?.branche_rolle ?? '')
      setKurztext(data?.kurztext ?? '')
      setLaedt(false)
    }

    laden()
    return () => {
      cancelled = true
    }
  }, [coachie])

  useEffect(() => {
    if (!coachie?.id || !profil?.sichtbar) {
      setAndere([])
      return
    }
    let cancelled = false

    async function ladenAndere() {
      const [{ data: profile }, { data: eigeneInteressen }] = await Promise.all([
        supabase
          .from('peer_profile')
          .select('coachie_id, vorname, branche_rolle, kurztext')
          .neq('coachie_id', coachie.id),
        supabase.from('peer_interesse').select('zu_coachie_id').eq('von_coachie_id', coachie.id),
      ])

      if (cancelled) return
      setAndere(profile ?? [])
      setGesendetAn(new Set((eigeneInteressen ?? []).map((e) => e.zu_coachie_id)))
    }

    ladenAndere()
    return () => {
      cancelled = true
    }
  }, [coachie, profil])

  async function handleSpeichern(event) {
    event.preventDefault()
    setSpeichert(true)
    setFehler('')
    setGespeichert(false)

    const { error } = await supabase.from('peer_profile').upsert({
      coachie_id: coachie.id,
      sichtbar,
      vorname: vorname.trim(),
      branche_rolle: brancheRolle.trim() || null,
      kurztext: kurztext.trim() || null,
      aktualisiert_am: new Date().toISOString(),
    })

    if (error) {
      setFehler('Konnte nicht gespeichert werden.')
    } else {
      setProfil({ sichtbar, vorname, branche_rolle: brancheRolle, kurztext })
      setGespeichert(true)
      setTimeout(() => setGespeichert(false), 2000)
    }

    setSpeichert(false)
  }

  async function interesseZeigen(zielCoachieId) {
    setGesendetAn((prev) => new Set(prev).add(zielCoachieId))

    try {
      const response = await fetch('/api/certificate?resource=peer-interesse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ zielCoachieId }),
      })

      if (!response.ok) {
        setGesendetAn((prev) => {
          const next = new Set(prev)
          next.delete(zielCoachieId)
          return next
        })
      }
    } catch {
      setGesendetAn((prev) => {
        const next = new Set(prev)
        next.delete(zielCoachieId)
        return next
      })
    }
  }

  if (laedt) return null

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-mrh-navy">Peer Group</h1>
        <p className="mt-1 text-sm text-mrh-grey">
          Finde andere Coachies auf ähnlichem Weg -- freiwillig und nur, wenn ihr
          euch beide sichtbar schaltet.
        </p>
      </div>

      <form onSubmit={handleSpeichern} className="rounded-2xl bg-white p-6 shadow-sm">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-semibold text-slate-800">
              Ich suche eine Peer Group
            </span>
            <span className="block text-sm text-mrh-grey">
              Andere sichtbare Coachies aus deinen Programmen sehen dich, du siehst sie.
            </span>
          </span>
          <input
            type="checkbox"
            checked={sichtbar}
            onChange={(e) => setSichtbar(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-mrh-navy"
          />
        </label>

        {sichtbar && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Vorname
              </label>
              <input
                type="text"
                value={vorname}
                onChange={(e) => setVorname(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Branche/Rolle (optional)
              </label>
              <input
                type="text"
                value={brancheRolle}
                onChange={(e) => setBrancheRolle(e.target.value)}
                placeholder="z. B. Teamleitung Vertrieb"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Woran ich gerade arbeite (optional)
              </label>
              <textarea
                value={kurztext}
                onChange={(e) => setKurztext(e.target.value)}
                rows={2}
                maxLength={280}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
              />
            </div>
          </div>
        )}

        {fehler && <p className="mt-3 text-sm text-red-600">{fehler}</p>}
        {gespeichert && <p className="mt-3 text-sm text-mrh-gold-dark">Gespeichert.</p>}

        <button
          type="submit"
          disabled={speichert}
          className="mt-4 rounded-lg bg-mrh-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-mrh-navy-dark disabled:opacity-50"
        >
          {speichert ? 'Speichert…' : 'Speichern'}
        </button>
      </form>

      {profil?.sichtbar && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-800">Andere Coachies</h2>
          <p className="mb-4 text-sm text-mrh-grey">
            Sichtbar aus deinen gemeinsamen Programmen. Keine Kontaktdaten direkt
            sichtbar -- &bdquo;Interesse zeigen&ldquo; schickt eine E-Mail, die
            andere Person entscheidet selbst, ob sie antwortet.
          </p>

          {andere.length === 0 ? (
            <p className="text-sm text-mrh-grey">
              Aktuell niemand sichtbar. Schau später nochmal vorbei.
            </p>
          ) : (
            <ul className="space-y-3">
              {andere.map((person) => (
                <li
                  key={person.coachie_id}
                  className="rounded-lg bg-slate-50 p-3 text-sm"
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-800">
                      {person.vorname || 'Anonym'}
                      {person.branche_rolle && (
                        <span className="font-normal text-mrh-grey">
                          {' '}
                          · {person.branche_rolle}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => interesseZeigen(person.coachie_id)}
                      disabled={gesendetAn.has(person.coachie_id)}
                      className="shrink-0 rounded-lg border border-mrh-gold px-3 py-1.5 text-xs font-medium text-mrh-gold-dark transition hover:bg-mrh-gold/10 disabled:opacity-50"
                    >
                      {gesendetAn.has(person.coachie_id)
                        ? 'Interesse gezeigt'
                        : 'Interesse zeigen'}
                    </button>
                  </div>
                  {person.kurztext && (
                    <p className="text-mrh-grey">{person.kurztext}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
