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

// Für zeilenbegrenzte Karten-Vorschauen (line-clamp): gerendertes HTML
// könnte beim Kürzen mitten in einem Tag abgeschnitten werden, daher hier
// bewusst reiner Klartext statt renderMarkdown. Kein vollständiger Parser
// -- gezielte Bereinigung der im Editor verfügbaren Formatierungen
// (siehe MarkdownFeld.jsx: fett, Überschrift, Liste, Bild, Hervorheben).
export function stripMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .split('\n')
    .map((zeile) => zeile.replace(/^\s{0,3}#{1,6}\s+/, '').replace(/^\s{0,3}>\s?/, ''))
    .join('\n')
    .trim()
}
