import { useRef, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'
import { supabase } from '../lib/supabaseClient'

const MAX_DATEI_BYTES = 20 * 1024 * 1024
const ERLAUBTE_TYPEN = ['application/pdf', 'audio/mpeg', 'audio/wav', 'image/jpeg', 'image/png']

const MITGLIEDER_BUCKET = 'mitglieder-inhalte'

// Upload-Button für Mitglieder-Inhalte (Mitgliederbereich Punkt 4),
// analog zu MaterialUpload.jsx: Einweg-Token über die admin-geschützte
// Route (?resource=mitglieder-datei-upload), Upload direkt in den
// privaten Bucket "mitglieder-inhalte". onUploaded bekommt den
// Storage-Pfad, nicht eine echte URL -- Lesezugriff läuft später über
// eine clientseitig angeforderte Signed URL (siehe
// getSignedMitgliederDateiUrl), gegen eine aktive Mitgliedschaft
// geprüft.
export default function MitgliederDateiUpload({ onUploaded }) {
  const inputRef = useRef(null)
  const [hochladend, setHochladend] = useState(false)
  const [fehler, setFehler] = useState('')

  async function handleFileChange(event) {
    const datei = event.target.files?.[0]
    event.target.value = ''
    if (!datei) return

    setFehler('')

    if (!ERLAUBTE_TYPEN.includes(datei.type)) {
      setFehler('Nur PDF, MP3, WAV, JPG oder PNG erlaubt.')
      return
    }
    if (datei.size > MAX_DATEI_BYTES) {
      setFehler('Datei ist größer als 20 MB.')
      return
    }

    setHochladend(true)
    try {
      const { pfad, token } = await adminFetch(
        '/api/admin/programme?resource=mitglieder-datei-upload',
        {
          method: 'POST',
          body: JSON.stringify({ contentType: datei.type, dateiname: datei.name }),
        },
      )

      const { error: uploadError } = await supabase.storage
        .from(MITGLIEDER_BUCKET)
        .uploadToSignedUrl(pfad, token, datei)

      if (uploadError) throw uploadError

      onUploaded(pfad)
    } catch {
      setFehler('Datei konnte nicht hochgeladen werden.')
    } finally {
      setHochladend(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,audio/mpeg,audio/wav,image/jpeg,image/png"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={hochladend}
        className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-50 disabled:opacity-50"
      >
        {hochladend ? 'Lädt hoch…' : 'Datei hochladen'}
      </button>
      {fehler && <p className="text-xs text-red-600">{fehler}</p>}
    </div>
  )
}
