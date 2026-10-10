// Newsletter-Anmeldung bei Brevo mit Double-Opt-in.
//
// Wird nur aufgerufen, wenn jemand das freiwillige Newsletter-Kästchen
// ausdrücklich angehakt hat. Brevo verschickt daraufhin selbst die
// Bestätigungsmail (Vorlage BREVO_DOI_TEMPLATE_ID). Erst nach dem Klick auf
// den Bestätigungslink landet der Kontakt in der Liste BREVO_LISTE_ID.
//
// Bewusst fehlertolerant: Fehlt die Konfiguration oder antwortet Brevo nicht,
// wird nur protokolliert. Die eigentliche Anmeldung (Kurs, Test) darf daran
// nie scheitern.
//
// Benötigte Umgebungsvariablen (Vercel):
//   BREVO_API_KEY            API-Schlüssel aus Brevo (SMTP & API > API-Schlüssel)
//   BREVO_LISTE_ID           numerische ID der Liste "Cashmor"
//   BREVO_DOI_TEMPLATE_ID    numerische ID der Double-Opt-in-Vorlage
//   BREVO_DOI_REDIRECT_URL   Seite nach Klick auf den Bestätigungslink

const BREVO_DOI_URL = 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation'
const ZEITLIMIT_MS = 5000

export function brevoKonfiguriert() {
  const { BREVO_API_KEY, BREVO_LISTE_ID, BREVO_DOI_TEMPLATE_ID, BREVO_DOI_REDIRECT_URL } =
    process.env
  return Boolean(BREVO_API_KEY && BREVO_LISTE_ID && BREVO_DOI_TEMPLATE_ID && BREVO_DOI_REDIRECT_URL)
}

export async function meldeNewsletterAn({ email, vorname, quelle }) {
  if (!brevoKonfiguriert()) {
    console.warn('Brevo nicht konfiguriert, Newsletter-Anmeldung übersprungen.')
    return false
  }

  const listeId = Number(process.env.BREVO_LISTE_ID)
  const templateId = Number(process.env.BREVO_DOI_TEMPLATE_ID)
  if (!Number.isInteger(listeId) || !Number.isInteger(templateId)) {
    console.warn('BREVO_LISTE_ID und BREVO_DOI_TEMPLATE_ID müssen Zahlen sein.')
    return false
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ZEITLIMIT_MS)

  try {
    const response = await fetch(BREVO_DOI_URL, {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        email,
        attributes: {
          ...(vorname ? { VORNAME: vorname } : {}),
          ...(quelle ? { QUELLE: quelle } : {}),
        },
        includeListIds: [listeId],
        templateId,
        redirectionUrl: process.env.BREVO_DOI_REDIRECT_URL,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error(`Brevo-Anmeldung fehlgeschlagen (${response.status}): ${text.slice(0, 300)}`)
      return false
    }
    return true
  } catch (err) {
    console.error('Brevo-Anmeldung nicht erreichbar:', err.message)
    return false
  } finally {
    clearTimeout(timer)
  }
}
