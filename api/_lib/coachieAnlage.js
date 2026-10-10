// Sucht einen Coachie per E-Mail oder legt ihn neu an (inkl. Einladungs-
// mail über supabase.auth.admin.inviteUserByEmail, Passwort-Setzen-Flow
// aus Phase 1). Gemeinsam genutzt von api/webhooks/stripe.js (Kurskauf
// und Mitgliedschaft) und der Gratis-Anmeldung in api/checkout.js,
// damit alle Wege exakt dasselbe Verhalten für "neuer vs. bestehender
// Coachie" haben. Ein bestehender Coachie bekommt bewusst KEINE erneute
// Einladung.
//
// Rückgabe: { coachieId, neu } oder { error }. neu = true heißt, dass
// gerade eine Einladungsmail verschickt wurde.

export function normalisiereEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

async function sucheCoachie(supabase, email, rohEmail) {
  const { data, error } = await supabase
    .from('coachies')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (error) return { error: error.message }
  if (data?.id || !rohEmail || rohEmail === email) return { coachieId: data?.id ?? null }

  // Ältere Zeilen können die E-Mail in anderer Schreibweise enthalten
  // (vor der Normalisierung angelegt), daher einmal mit dem Rohwert.
  const { data: alt, error: altError } = await supabase
    .from('coachies')
    .select('id')
    .eq('email', rohEmail)
    .maybeSingle()

  if (altError) return { error: altError.message }
  return { coachieId: alt?.id ?? null }
}

// Existiert zur Adresse bereits ein Auth-Nutzer ohne coachies-Zeile (z. B.
// eine frühere Einladung, deren Zeile manuell entfernt wurde), schlägt
// inviteUserByEmail fehl. Ohne diesen Fallback würde der Webhook dann
// bei jeder Zustellung mit 500 scheitern und der Kauf nie freigeschaltet.
// generateLink verschickt selbst keine Mail, liefert aber den
// bestehenden Auth-Nutzer zurück.
async function bestehenderAuthNutzer(supabase, email) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (error || !data?.user?.id) return null
  return data.user
}

export async function findeOderErstelleCoachie({ email, name, supabase, appUrl }) {
  const normalisiert = normalisiereEmail(email)
  if (!normalisiert) return { error: 'E-Mail fehlt.' }

  const gefunden = await sucheCoachie(supabase, normalisiert, email?.trim())
  if (gefunden.error) return { error: gefunden.error }
  if (gefunden.coachieId) return { coachieId: gefunden.coachieId, neu: false }

  let authUserId = null
  let neu = true

  const { data: invited, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(normalisiert, {
      redirectTo: `${appUrl}/passwort-festlegen`,
    })

  if (inviteError) {
    const bestehend = await bestehenderAuthNutzer(supabase, normalisiert)
    if (!bestehend) return { error: inviteError.message }
    authUserId = bestehend.id
    neu = false
  } else {
    authUserId = invited.user.id
  }

  const { data: neuerCoachie, error: insertError } = await supabase
    .from('coachies')
    .insert({
      id: authUserId,
      name: name?.trim() || normalisiert,
      email: normalisiert,
    })
    .select('id')
    .single()

  if (insertError) {
    // Parallel angelegt (z. B. zwei Webhook-Zustellungen gleichzeitig):
    // die Zeile existiert jetzt, also einfach verwenden.
    if (insertError.code === '23505') {
      const erneut = await sucheCoachie(supabase, normalisiert)
      if (erneut.coachieId) return { coachieId: erneut.coachieId, neu: false }
    }
    // Nur einen gerade frisch eingeladenen Auth-Nutzer wieder entfernen,
    // niemals einen bereits bestehenden.
    if (neu) await supabase.auth.admin.deleteUser(authUserId)
    return { error: insertError.message }
  }

  return { coachieId: neuerCoachie.id, neu }
}
