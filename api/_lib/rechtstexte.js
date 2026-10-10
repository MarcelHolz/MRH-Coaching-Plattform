import { readFileSync } from 'node:fs'
import { absoluteUrl } from '../../src/lib/rechtliches.js'

// Vollständige AGB und Widerrufsbelehrung als Klartext für die
// Kaufbestätigungsmail (dauerhafter Datenträger, AGB § 4 Abs. 3). Quelle
// sind dieselben Dateien wie für /agb und /widerruf (src/content/*.md).
// new URL(..., import.meta.url) lässt Vercel die Dateien mitbündeln,
// zusätzlich abgesichert über "includeFiles" in vercel.json.
const DATEIEN = {
  agb: new URL('../../src/content/agb.md', import.meta.url),
  widerruf: new URL('../../src/content/widerruf.md', import.meta.url),
}

const cache = {}

function lies(name) {
  if (!(name in cache)) cache[name] = readFileSync(DATEIEN[name], 'utf8')
  return cache[name]
}

// Markdown-Zeichen entfernen: Überschriften als eigene Zeilen mit
// Leerzeile davor und danach, Links als "Text (absolute URL)", Fett und
// Escapes ohne Sternchen bzw. Backslash, Trennlinien als Leerzeile.
export function markdownZuKlartext(markdown, appUrl) {
  const zeilen = markdown.replace(/\r\n/g, '\n').split('\n').map((zeile) => {
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(zeile)) return ''

    let text = zeile.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, ziel) => {
      const url = ziel.startsWith('/') ? absoluteUrl(appUrl, ziel) : ziel
      return label === url ? url : `${label} (${url})`
    })
    text = text
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/(^|[^\\*])\*(?!\s)([^*]+?)\*/g, '$1$2')
      .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1')

    const ueberschrift = text.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/)
    if (ueberschrift) return `\n${ueberschrift[1]}\n`
    return text.replace(/^\s{0,3}>\s?/, '')
  })

  return zeilen
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function rechtstexteAlsKlartext(appUrl) {
  const trenner = '='.repeat(60)
  return [
    trenner,
    markdownZuKlartext(lies('agb'), appUrl),
    '',
    trenner,
    markdownZuKlartext(lies('widerruf'), appUrl),
  ].join('\n')
}
