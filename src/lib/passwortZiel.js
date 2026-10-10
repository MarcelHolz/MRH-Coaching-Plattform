// Merkt sich für den Passwort-Vergessen-Flow, dass der Link vom
// Admin-Login angefordert wurde. Der Reset-Link öffnet sich oft in einem
// neuen Tab, daher localStorage (nicht sessionStorage), mit Ablaufzeit.
// SetPasswordPage leitet danach zu /admin/login statt in den
// Coachie-Bereich.
const SCHLUESSEL = 'mrh_passwort_ziel'
const GUELTIG_MS = 2 * 60 * 60 * 1000

export function merkeAdminZiel() {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify({ ziel: 'admin', bis: Date.now() + GUELTIG_MS }))
  } catch {
    // Ohne Storage greift der Fallback in SetPasswordPage (kein Coachie-Konto).
  }
}

// Liefert true, wenn ein gültiger Admin-Merker existiert, und entfernt ihn.
export function verbraucheAdminZiel() {
  try {
    const wert = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null')
    localStorage.removeItem(SCHLUESSEL)
    return wert?.ziel === 'admin' && wert.bis > Date.now()
  } catch {
    return false
  }
}
