// Zentrale Links auf die Rechtstexte. Impressum und Datenschutz liegen auf
// mrh-beratung.de, AGB und Widerrufsbelehrung als eigene Seiten in der
// Plattform (src/content/*.md, Routen /agb und /widerruf).
//
// Die *_PFAD-Konstanten sind relative Pfade für Links innerhalb der App.
// In E-Mails (api/webhooks/stripe.js u. a.) müssen es absolute URLs sein:
// dort immer über absoluteUrl(appUrl, PFAD) bilden.
export const IMPRESSUM_URL = 'https://mrh-beratung.de/impressum'
export const DATENSCHUTZ_URL = 'https://mrh-beratung.de/datenschutz'
export const AGB_PFAD = '/agb'
export const WIDERRUF_PFAD = '/widerruf'
export const VERTRAG_WIDERRUFEN_PFAD = '/vertrag-widerrufen'
export const VERTRAG_KUENDIGEN_PFAD = '/vertrag-kuendigen'

export function absoluteUrl(appUrl, pfad) {
  return `${String(appUrl).replace(/\/+$/, '')}${pfad}`
}
