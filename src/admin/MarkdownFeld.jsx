import { useRef, useState } from 'react'
import { adminFetch } from '../lib/adminFetch'
import { supabase } from '../lib/supabaseClient'

const MAX_BILD_BYTES = 5 * 1024 * 1024
const ERLAUBTE_BILD_TYPEN = ['image/jpeg', 'image/png', 'image/webp']

// Kleine Toolbar für einfache Markdown-Formatierung (fett, Überschrift,
// Liste, Hervorheben, Bild einfügen) -- kein voller Rich-Text-Editor,
// nur Syntax-Hilfe an der Cursorposition. Rendering im Coachie-Bereich
// erfolgt separat über `marked` (siehe src/lib/markdown.js).
export default function MarkdownFeld({ value, onChange, placeholder, rows = 4 }) {
  const textareaRef = useRef(null)
  const bildInputRef = useRef(null)
  const [bildLaedt, setBildLaedt] = useState(false)
  const [bildFehler, setBildFehler] = useState('')

  function aktuelleZeileStart(text, cursor) {
    return text.lastIndexOf('\n', cursor - 1) + 1
  }

  function zeilenPraefixEinfuegen(praefix) {
    const el = textareaRef.current
    if (!el) return

    const cursor = el.selectionStart
    const zeileStart = aktuelleZeileStart(value, cursor)
    const naechsterWert =
      value.slice(0, zeileStart) + praefix + value.slice(zeileStart)

    onChange(naechsterWert)

    requestAnimationFrame(() => {
      el.focus()
      const neuePosition = cursor + praefix.length
      el.setSelectionRange(neuePosition, neuePosition)
    })
  }

  function umschliessen(vor, nach) {
    const el = textareaRef.current
    if (!el) return

    const start = el.selectionStart
    const end = el.selectionEnd
    const ausgewaehlt = value.slice(start, end)
    const naechsterWert =
      value.slice(0, start) + vor + ausgewaehlt + nach + value.slice(end)

    onChange(naechsterWert)

    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + vor.length, start + vor.length + ausgewaehlt.length)
    })
  }

  function anCursorEinfuegen(text) {
    const el = textareaRef.current
    if (!el) return

    const cursor = el.selectionStart
    const naechsterWert = value.slice(0, cursor) + text + value.slice(cursor)

    onChange(naechsterWert)

    requestAnimationFrame(() => {
      el.focus()
      const neuePosition = cursor + text.length
      el.setSelectionRange(neuePosition, neuePosition)
    })
  }

  // Dieselbe Upload-Logik wie BildUpload.jsx: Einweg-Token über die
  // admin-geschützte Route, Datei-Upload direkt zu Supabase Storage
  // (nicht durch unsere Serverless Function), dann die öffentliche URL
  // als Markdown-Bildsyntax an der Cursorposition einfügen.
  async function handleBildDateiChange(event) {
    const datei = event.target.files?.[0]
    event.target.value = ''
    if (!datei) return

    setBildFehler('')

    if (!ERLAUBTE_BILD_TYPEN.includes(datei.type)) {
      setBildFehler('Nur JPG, PNG oder WEBP erlaubt.')
      return
    }
    if (datei.size > MAX_BILD_BYTES) {
      setBildFehler('Datei ist größer als 5 MB.')
      return
    }

    setBildLaedt(true)
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

      anCursorEinfuegen(`![Bildbeschreibung](${publicUrlData.publicUrl})`)
    } catch {
      setBildFehler('Bild konnte nicht hochgeladen werden.')
    } finally {
      setBildLaedt(false)
    }
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => umschliessen('**', '**')}
          title="Fett"
          className="rounded border border-slate-300 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          F
        </button>
        <button
          type="button"
          onClick={() => zeilenPraefixEinfuegen('# ')}
          title="Überschrift"
          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          H
        </button>
        <button
          type="button"
          onClick={() => zeilenPraefixEinfuegen('- ')}
          title="Liste"
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          •
        </button>
        <button
          type="button"
          onClick={() => zeilenPraefixEinfuegen('> ')}
          title="Hervorheben"
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          &gt;
        </button>
        <input
          ref={bildInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleBildDateiChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => bildInputRef.current?.click()}
          disabled={bildLaedt}
          title="Bild einfügen"
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {bildLaedt ? 'Lädt hoch…' : '🖼'}
        </button>
        {bildFehler && <p className="text-xs text-red-600">{bildFehler}</p>}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-mrh-navy focus:outline-none focus:ring-1 focus:ring-mrh-navy"
      />
    </div>
  )
}
