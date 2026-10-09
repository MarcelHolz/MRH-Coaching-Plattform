import { useEffect, useState } from 'react'

// Ob die Mitgliedschaft aktuell überhaupt angeboten wird (Schalter
// mitgliedschaft_aktiv im Admin). Einmal pro Seitenaufruf geladen und
// zwischengespeichert, da Layout, Hinweis und Seiten es gleichzeitig
// abfragen. Bei Fehlern gilt das Angebot als aus: lieber keinen Hinweis
// zeigen als auf eine gesperrte Seite verweisen.
let anfrage = null

export function ladeMitgliedschaftAngebot() {
  if (!anfrage) {
    anfrage = fetch('/api/checkout?resource=mitgliedschaft')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data?.mitgliedschaft ?? { aktiv: false })
      .catch(() => {
        anfrage = null
        return { aktiv: false }
      })
  }
  return anfrage
}

export function useMitgliedschaftAngebotAktiv() {
  const [aktiv, setAktiv] = useState(null)

  useEffect(() => {
    let cancelled = false
    ladeMitgliedschaftAngebot().then((angebot) => {
      if (!cancelled) setAktiv(angebot.aktiv === true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return aktiv
}
