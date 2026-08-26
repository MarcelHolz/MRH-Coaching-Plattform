import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { sendMail } from '../_lib/mailer.js'

// Tägliche Erinnerungsautomation bei Inaktivität (Umsetzungsauftrag Phase 1,
// Punkt 2 / strategische Analyse Teil 12). Wird von Vercel Cron aufgerufen
// (siehe vercel.json), Vercel setzt dabei automatisch den Header
// "Authorization: Bearer $CRON_SECRET" -- das schützt die Route davor, dass
// sie von außen beliebig oft ausgelöst werden kann.
//
// Kriterium pro Coachie: mindestens ein zugeordnetes, aktives Programm ist
// begonnen (mind. ein coachie_status-Eintrag existiert), aber noch nicht zu
// 100% abgeschlossen, und die letzte Status-Änderung in diesem Programm
// liegt mindestens 7 Tage zurück. Bei mehreren betroffenen Programmen wird
// nur eine Mail verschickt (das zuletzt bearbeitete Programm), und maximal
// eine pro Coachie pro 7-Tage-Fenster (geprüft über alle Programme hinweg
// anhand von erinnerung_gesendet_am).
//
// Zusätzlich (Feature 2, Testimonial-Sammelmechanismus): derselbe Lauf
// prüft pro Coachie/Programm-Zuordnung, ob inzwischen alle Sessions
// abgeschlossen sind, und verschickt dann einmalig eine Einladung zum
// Testimonial-Formular (testimonial_email_gesendet_am in
// coachie_programme verhindert Mehrfachversand, siehe testimonials.sql).

const SIEBEN_TAGE_MS = 7 * 24 * 60 * 60 * 1000

function erinnerungsText(coachie, kandidat, appUrl) {
  const anrede = coachie.name ? `Hallo ${coachie.name},` : 'Hallo,'
  const sessionHinweis = kandidat.sessionTitel
    ? ` bei "${kandidat.sessionTitel}"`
    : ''

  return [
    anrede,
    '',
    `du warst bei "${kandidat.programmTitel}"${sessionHinweis} kurz stehengeblieben -- soll ich dir helfen, den Faden wiederzufinden?`,
    '',
    `Hier geht's zurück zur Plattform: ${appUrl}/coachie/programme/${kandidat.programmId}`,
    '',
    'Kein Stress, keine Deadline -- mach einfach weiter, wenn es für dich passt.',
  ].join('\n')
}

async function ermittleKandidat(supabase, coachieId, jetzt) {
  const { data: zuordnungen } = await supabase
    .from('coachie_programme')
    .select('programm_id, programme(titel, aktiv)')
    .eq('coachie_id', coachieId)

  const aktiveProgramme = (zuordnungen ?? [])
    .filter((z) => z.programme?.aktiv)
    .map((z) => ({ id: z.programm_id, titel: z.programme.titel }))

  let letzteErinnerung = null
  let kandidat = null

  for (const programm of aktiveProgramme) {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, titel')
      .eq('programm_id', programm.id)

    const sessionIds = (sessions ?? []).map((s) => s.id)
    if (sessionIds.length === 0) continue

    const { data: statusListe } = await supabase
      .from('coachie_status')
      .select('session_id, status, aktualisiert_am, erinnerung_gesendet_am')
      .eq('coachie_id', coachieId)
      .in('session_id', sessionIds)

    if (!statusListe || statusListe.length === 0) continue // nicht begonnen

    for (const s of statusListe) {
      if (
        s.erinnerung_gesendet_am &&
        (!letzteErinnerung || s.erinnerung_gesendet_am > letzteErinnerung)
      ) {
        letzteErinnerung = s.erinnerung_gesendet_am
      }
    }

    const abgeschlossen = statusListe.filter(
      (s) => s.status === 'abgeschlossen',
    ).length
    if (abgeschlossen === sessionIds.length) continue // Programm fertig

    const zeitstempel = statusListe
      .map((s) => s.aktualisiert_am)
      .filter(Boolean)
      .sort()
    const letzteAktivitaet = zeitstempel.at(-1)
    if (!letzteAktivitaet) continue
    if (jetzt.getTime() - new Date(letzteAktivitaet).getTime() < SIEBEN_TAGE_MS) {
      continue // noch innerhalb der 7 Tage aktiv
    }

    if (!kandidat || letzteAktivitaet > kandidat.letzteAktivitaet) {
      const letzterStatus = [...statusListe]
        .filter((s) => s.aktualisiert_am)
        .sort((a, b) => a.aktualisiert_am.localeCompare(b.aktualisiert_am))
        .at(-1)
      const sessionTitel =
        (sessions ?? []).find((s) => s.id === letzterStatus?.session_id)
          ?.titel ?? null

      kandidat = {
        programmId: programm.id,
        programmTitel: programm.titel,
        sessionId: letzterStatus?.session_id,
        sessionTitel,
        letzteAktivitaet,
      }
    }
  }

  if (!kandidat) return null
  if (
    letzteErinnerung &&
    jetzt.getTime() - new Date(letzteErinnerung).getTime() < SIEBEN_TAGE_MS
  ) {
    return null // in den letzten 7 Tagen schon erinnert (irgendein Programm)
  }

  return kandidat
}

// Testimonial-Einladung (Feature 2): pro Coachie/Programm-Zuordnung
// prüfen, ob inzwischen alle Sessions abgeschlossen sind und noch keine
// Einladungsmail verschickt wurde (testimonial_email_gesendet_am,
// siehe testimonials.sql). Anders als die Inaktivitäts-Erinnerung kann
// das pro Lauf mehrere Programme pro Coachie betreffen -- jedes fertige
// Programm bekommt eine eigene Einladung.
async function ermittleTestimonialKandidaten(supabase, coachieId) {
  const { data: zuordnungen } = await supabase
    .from('coachie_programme')
    .select('programm_id, testimonial_email_gesendet_am, programme(titel)')
    .eq('coachie_id', coachieId)

  const kandidaten = []

  for (const zuordnung of zuordnungen ?? []) {
    if (zuordnung.testimonial_email_gesendet_am || !zuordnung.programme) continue

    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('programm_id', zuordnung.programm_id)

    const sessionIds = (sessions ?? []).map((s) => s.id)
    if (sessionIds.length === 0) continue

    const { data: statusListe } = await supabase
      .from('coachie_status')
      .select('status')
      .eq('coachie_id', coachieId)
      .in('session_id', sessionIds)

    const abgeschlossen = (statusListe ?? []).filter(
      (s) => s.status === 'abgeschlossen',
    ).length

    if (abgeschlossen === sessionIds.length) {
      kandidaten.push({
        programmId: zuordnung.programm_id,
        programmTitel: zuordnung.programme.titel,
      })
    }
  }

  return kandidaten
}

function testimonialEinladungsText(coachie, kandidat, appUrl) {
  const anrede = coachie.name ? `Hallo ${coachie.name},` : 'Hallo,'

  return [
    anrede,
    '',
    `du hast "${kandidat.programmTitel}" komplett abgeschlossen -- herzlichen Glückwunsch!`,
    '',
    `Magst du kurz teilen, wie es für dich war? Das hilft anderen bei der Entscheidung: ${appUrl}/coachie/testimonial/${kandidat.programmId}`,
    '',
    'Nur wenn du möchtest -- ganz ohne Verpflichtung, und natürlich prüfen wir jeden Text, bevor er irgendwo erscheint.',
  ].join('\n')
}

export default async function handler(req, res) {
  const erwarteteAuth = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || req.headers.authorization !== erwarteteAuth) {
    res.status(401).json({ error: 'Nicht autorisiert.' })
    return
  }

  const supabase = getSupabaseAdmin()
  const appUrl = process.env.APP_URL
  const jetzt = new Date()

  const { data: coachies, error: coachiesError } = await supabase
    .from('coachies')
    .select('id, name, email')

  if (coachiesError) {
    res.status(500).json({ error: coachiesError.message })
    return
  }

  let versendet = 0
  let testimonialEinladungenVersendet = 0
  const fehler = []

  for (const coachie of coachies ?? []) {
    try {
      const kandidat = await ermittleKandidat(supabase, coachie.id, jetzt)
      if (kandidat && coachie.email) {
        await sendMail({
          to: coachie.email,
          subject: `${coachie.name ? coachie.name + ', d' : 'D'}ein Programm wartet auf dich`,
          text: erinnerungsText(coachie, kandidat, appUrl),
        })

        await supabase
          .from('coachie_status')
          .update({ erinnerung_gesendet_am: jetzt.toISOString() })
          .eq('coachie_id', coachie.id)
          .eq('session_id', kandidat.sessionId)

        versendet += 1
      }

      if (coachie.email) {
        const testimonialKandidaten = await ermittleTestimonialKandidaten(
          supabase,
          coachie.id,
        )

        for (const testimonialKandidat of testimonialKandidaten) {
          await sendMail({
            to: coachie.email,
            subject: `Herzlichen Glückwunsch zum Abschluss von "${testimonialKandidat.programmTitel}"`,
            text: testimonialEinladungsText(coachie, testimonialKandidat, appUrl),
          })

          await supabase
            .from('coachie_programme')
            .update({ testimonial_email_gesendet_am: jetzt.toISOString() })
            .eq('coachie_id', coachie.id)
            .eq('programm_id', testimonialKandidat.programmId)

          testimonialEinladungenVersendet += 1
        }
      }
    } catch (err) {
      fehler.push({ coachie_id: coachie.id, message: err.message })
    }
  }

  res.status(200).json({
    geprueft: (coachies ?? []).length,
    versendet,
    testimonialEinladungenVersendet,
    fehler,
  })
}
