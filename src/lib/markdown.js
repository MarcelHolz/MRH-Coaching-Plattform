import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true })

// Links, die in einem neuen Tab öffnen, bekommen rel="noopener noreferrer",
// damit die Zielseite keinen Zugriff auf window.opener hat.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

// Inhalte kommen aus dem Admin-Formular und über die Agenten-API
// (api/agent/inhalte.js). Das von marked erzeugte HTML wird deshalb vor
// der Ausgabe per dangerouslySetInnerHTML mit DOMPurify bereinigt
// (entfernt Skripte, Event-Handler und javascript:-Links).
export function renderMarkdown(text) {
  if (!text) return ''
  return DOMPurify.sanitize(marked.parse(text), { ADD_ATTR: ['target'] })
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
