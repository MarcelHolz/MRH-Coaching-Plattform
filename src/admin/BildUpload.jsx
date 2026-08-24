import { useRef, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'
import { supabase } from '../lib/supabaseClient'

const MAX_BILD_BYTES = 5 * 1024 * 1024
const ERLAUBTE_TYPEN = ['image/jpeg', 'image/png', 'image/webp']

// Upload-Button für Programm-/Modul-Vorschaubilder: erzeugt über die
// admin-geschützte Route ein Einweg-Token (?resource=bild-upload) und
// lädt die Datei damit direkt in den öffentlichen Bucket
// "programm-bilder" hoch, ohne die Bytes durch unsere eigene
// Serverless Function zu schicken. Ruft bei Erfolg onUploaded(url) auf
// -- das manuelle URL-Textfeld daneben bleibt unverändert nutzbar,
// falls schon eine fertige URL vorliegt.
export default function BildUpload({ onUploaded }) {
  const inputRef = useRef(null)
  const [hochladend, setHochladend] = useState(false)
  const [fehler, setFehler] = useState('')

  async function handleFileChange(event) {
    const datei = event.target.files?.[0]
    event.target.value = ''
    if (!datei) return

    setFehler('')

    if (!ERLAUBTE_TYPEN.includes(datei.type)) {
      setFehler('Nur JPG, PNG oder WEBP erlaubt.')
      return
    }
    if (datei.size > MAX_BILD_BYTES) {
      setFehler('Datei ist größer als 5 MB.')
      return
    }

    setHochladend(true)
    try {
      const { pfad, token } = await adminFetch(
        '/api/admin/programme?resource=bild-upload',
        {
          method: 'POST',
          body: JSON.stringify({ contentType: datei.type }),
        },
      )

      const { error: uploadError } = await supabase.storage
        .from('programm-bilder')
        .uploadToSignedUrl(pfad, token, datei)

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('programm-bilder')
        .getPublicUrl(pfad)

      onUploaded(publicUrlData.publicUrl)
    } catch {
      setFehler('Bild konnte nicht hochgeladen werden.')
    } finally {
      setHochladend(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={hochladend}
        className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-50 disabled:opacity-50"
      >
        {hochladend ? 'Lädt hoch…' : 'Bild hochladen'}
      </button>
      {fehler && <p className="text-xs text-red-600">{fehler}</p>}
    </div>
  )
}
