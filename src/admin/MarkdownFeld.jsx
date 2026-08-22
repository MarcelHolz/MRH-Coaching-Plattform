import { useRef } from 'react'

// Kleine Toolbar für einfache Markdown-Formatierung (fett, Überschrift,
// Liste) -- kein voller Rich-Text-Editor, nur Syntax-Hilfe an der
// Cursorposition. Rendering im Coachie-Bereich erfolgt separat über
// `marked` (siehe src/lib/markdown.js).
export default function MarkdownFeld({ value, onChange, placeholder, rows = 4 }) {
  const textareaRef = useRef(null)

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

  return (
    <div>
      <div className="mb-1 flex gap-1">
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
