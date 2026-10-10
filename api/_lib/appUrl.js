// Basis-URL der App für Links in Mails und Stripe-Redirects. APP_URL hat
// Vorrang, sonst wird sie aus den Request-Headern abgeleitet (Preview-
// Deployments auf Vercel).
export function ermittleAppUrl(req) {
  return (
    process.env.APP_URL ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`
  )
}
