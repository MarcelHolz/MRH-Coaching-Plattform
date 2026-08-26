import { useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const MAX_BILD_BYTES = 5 * 1024 * 1024
const ERLAUBTE_TYPEN = ['image/jpeg', 'image/png', 'image/webp']

// Profilbild-Upload für den Coachie selbst (EinstellungenPage.jsx) --
// analog zu BildUpload.jsx (Admin-Bereich), aber mit dem
// Coachie-Access-Token statt dem Admin-Secret, da ?resource=avatar-upload
// in api/admin/programme.js über requireCoachie statt requireAdmin
// geschützt ist. Derselbe öffentliche Bucket "programm-bilder".
export default function AvatarUpload({ accessToken, onUploaded }) {
  const inputRef = useRef(null)
  const [hochladend, setHochladend] = useState(false)
  const [fehler, setFehler] = useState('')

  async function handleFileChange(event) {
    const datei = event.target.files?.[0]
    event.target.value = ''
    if (!datei) return

    setFehler('')

    if (datei.type === 'image/heic' || datei.type === 'image/heif') {
      setFehler(
        "HEIC-Fotos werden nicht unterstützt — bitte als JPG exportieren oder in den iPhone-Kameraeinstellungen unter 'Formate' auf 'Kompatibel' (JPG) umstellen.",
      )
      return
    }
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
      const response = await fetch('/api/admin/programme?resource=avatar-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ contentType: datei.type }),
      })
      const { pfad, token, error } = await response.json()
      if (!response.ok) throw new Error(error || 'Upload fehlgeschlagen.')

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
    <div>
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
          {hochladend ? 'Lädt hoch…' : 'Profilbild hochladen'}
        </button>
      </div>
      {fehler ? (
        <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.028 10.71c.75 1.334-.213 2.99-1.743 2.99H3.972c-1.53 0-2.493-1.656-1.743-2.99l6.028-10.71ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          {fehler}
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-400">
          JPG, PNG oder WEBP, max. 5 MB
        </p>
      )}
    </div>
  )
}
