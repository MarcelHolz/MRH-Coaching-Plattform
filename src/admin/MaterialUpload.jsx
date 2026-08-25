import { useRef, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'
import { supabase } from '../lib/supabaseClient'

const MAX_MATERIAL_BYTES = 5 * 1024 * 1024
const ERLAUBTE_TYPEN = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'audio/mpeg',
  'audio/wav',
]

const MATERIAL_BUCKET = 'Programme'

// Upload-Button für Session-Materialien: erzeugt über die admin-geschützte
// Route ein Einweg-Token (?resource=material-upload) und lädt die Datei
// damit direkt in den privaten Bucket "Programme" hoch. Der Bucket ist
// privat (siehe storage_policy_pro_programm.sql) -- es gibt daher keine
// öffentliche URL, onUploaded bekommt stattdessen den Storage-Pfad selbst,
// genau wie datei_url im session_material-Schema ohnehin einen Pfad statt
// einer echten URL erwartet.
export default function MaterialUpload({ programmId, onUploaded }) {
  const inputRef = useRef(null)
  const [hochladend, setHochladend] = useState(false)
  const [fehler, setFehler] = useState('')

  async function handleFileChange(event) {
    const datei = event.target.files?.[0]
    event.target.value = ''
    if (!datei) return

    setFehler('')

    if (!ERLAUBTE_TYPEN.includes(datei.type)) {
      setFehler('Nur PDF, JPG, PNG, MP3 oder WAV erlaubt.')
      return
    }
    if (datei.size > MAX_MATERIAL_BYTES) {
      setFehler('Datei ist größer als 5 MB.')
      return
    }

    setHochladend(true)
    try {
      const { pfad, token } = await adminFetch(
        '/api/admin/sessions?resource=material-upload',
        {
          method: 'POST',
          body: JSON.stringify({
            programm_id: programmId,
            contentType: datei.type,
            dateiname: datei.name,
          }),
        },
      )

      const { error: uploadError } = await supabase.storage
        .from(MATERIAL_BUCKET)
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
        accept="application/pdf,image/jpeg,image/png,audio/mpeg,audio/wav"
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
