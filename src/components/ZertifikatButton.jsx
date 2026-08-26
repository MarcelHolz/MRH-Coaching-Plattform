import { useState } from 'react'

// Lädt das PDF-Zertifikat (api/certificate.js) authentifiziert per
// Access-Token herunter -- der erste coachie-authentifizierte
// Backend-Aufruf dieser App, alle anderen Coachie-Schreibzugriffe laufen
// direkt über den Supabase-Client mit RLS. Wiederverwendet in
// CoachieProgramPage.jsx (Abschluss-Moment/laufender Fortschritt) und
// ZertifikatePage.jsx ("Meine Abschlüsse").
export default function ZertifikatButton({ programmId, programmTitel, accessToken }) {
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState('')

  async function handleDownload() {
    setLaedt(true)
    setFehler('')
    try {
      const response = await fetch(`/api/certificate?programm_id=${programmId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        throw new Error('Zertifikat konnte nicht erstellt werden.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Zertifikat-${programmTitel}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setFehler('Zertifikat konnte nicht heruntergeladen werden.')
    } finally {
      setLaedt(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={laedt}
        className="rounded-lg border border-mrh-gold px-4 py-2 text-sm font-medium text-mrh-gold-dark transition hover:bg-mrh-gold/10 disabled:opacity-50"
      >
        {laedt ? 'Erstellt Zertifikat…' : 'Zertifikat herunterladen'}
      </button>
      {fehler && <p className="mt-2 text-xs text-red-600">{fehler}</p>}
    </div>
  )
}
