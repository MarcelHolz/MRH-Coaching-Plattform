import nodemailer from 'nodemailer'

let transporter = null

// Eigener SMTP-Versand (All-Inkl), getrennt von den Supabase-Auth-Mails
// (Einladung/Passwort-Reset laufen weiterhin über supabase.auth.admin.* mit
// dem in Supabase hinterlegten SMTP). Auth-Mails haben feste Vorlagen ohne
// freien Inhalt -- für die Erinnerungsmail mit individuellem Text (Punkt 2)
// brauchen wir einen eigenen Versandweg.
function getTransporter() {
  if (transporter) return transporter

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      'SMTP_HOST, SMTP_PORT, SMTP_USER und SMTP_PASS müssen serverseitig gesetzt sein.',
    )
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  return transporter
}

export async function sendMail({ to, subject, text }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  await getTransporter().sendMail({ from, to, subject, text })
}
