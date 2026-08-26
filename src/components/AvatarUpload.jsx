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
      {fehler && <p className="text-xs text-red-600">{fehler}</p>}
    </div>
  )
}
