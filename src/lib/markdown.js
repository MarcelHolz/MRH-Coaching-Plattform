import { marked } from 'marked'

marked.setOptions({ breaks: true })

// Nur einfache Formatierung vorgesehen (fett, Überschrift, Liste,
// Absätze) -- Inhalt kommt ausschließlich aus dem admin-geschützten
// Programmformular (api/admin/programme.js, requireAdmin), daher kein
// zusätzliches Sanitizing nötig.
export function renderMarkdown(text) {
  if (!text) return ''
  return marked.parse(text)
}
