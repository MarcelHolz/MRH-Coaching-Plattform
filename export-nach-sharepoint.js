// Einmaliger Komplett-Export der Plattform (Texte, Bilder, Workbooks) für
// ein lokales SharePoint-Verzeichnis. Nicht Teil der deployten App --
// läuft nur lokal, ruft die bestehende Agent-API ab (api/agent/inhalte.js,
// ?resource=lesen/module/sessions/materials/material-signed-url). Kein
// npm-Paket nötig (Node 18+, natives fetch).
//
// Nutzung:
//   Windows (CMD):     set AGENT_CONTENT_SECRET=... && node export-nach-sharepoint.js
//   Windows (PowerShell): $env:AGENT_CONTENT_SECRET="..."; node export-nach-sharepoint.js
//   macOS/Linux:        AGENT_CONTENT_SECRET=... node export-nach-sharepoint.js
//
// Optional: AGENT_API_BASIS_URL überschreibt die Standard-Basis-URL
// (z. B. für einen Vercel-Preview-Deploy oder lokal gegen `vercel dev`).

import fs from 'node:fs/promises'
import path from 'node:path'

const BASIS_URL = process.env.AGENT_API_BASIS_URL || 'https://app.mrh-beratung.de'
const SECRET = process.env.AGENT_CONTENT_SECRET
const EXPORT_ORDNER = 'export'

if (!SECRET) {
  console.error('Fehler: Umgebungsvariable AGENT_CONTENT_SECRET ist nicht gesetzt.')
  console.error('')
  console.error('Windows (CMD):        set AGENT_CONTENT_SECRET=... && node export-nach-sharepoint.js')
  console.error('Windows (PowerShell): $env:AGENT_CONTENT_SECRET="..."; node export-nach-sharepoint.js')
  console.error('macOS/Linux:          AGENT_CONTENT_SECRET=... node export-nach-sharepoint.js')
  process.exit(1)
}

// Windows-inkompatible Zeichen für Datei-/Ordnernamen entfernt (nicht
// ersetzt), überflüssige Leerzeichen danach zusammengefasst.
const WINDOWS_VERBOTENE_ZEICHEN = /[\\/:*?"<>|]/g

function bereinigenFuerDateiname(text) {
  return String(text ?? '')
    .replace(WINDOWS_VERBOTENE_ZEICHEN, '')
    .trim()
    .replace(/\s+/g, ' ')
}

async function holeJson(pfad) {
  const antwort = await fetch(`${BASIS_URL}${pfad}`, {
    headers: { 'x-agent-secret': SECRET },
  })

  if (!antwort.ok) {
    throw new Error(`${pfad} -> HTTP ${antwort.status}`)
  }

  return antwort.json()
}

async function stelleOrdnerSicher(ordnerPfad) {
  await fs.mkdir(ordnerPfad, { recursive: true })
}

async function ladeDateiHerunter(url, zielPfad) {
  const antwort = await fetch(url)
  if (!antwort.ok) {
    throw new Error(`Download fehlgeschlagen: HTTP ${antwort.status}`)
  }
  const puffer = Buffer.from(await antwort.arrayBuffer())
  await fs.writeFile(zielPfad, puffer)
}

// Programm-/Modulbilder liegen im öffentlichen Bucket "programm-bilder"
// (siehe programm_bilder_bucket.sql) -- bild_url ist bereits eine direkt
// aufrufbare URL, kein Signed-URL-Umweg nötig.
function dateinameAusUrl(url, fallbackName) {
  try {
    const { pathname } = new URL(url)
    const basisname = decodeURIComponent(pathname.split('/').pop() || '')
    return basisname || fallbackName
  } catch {
    return fallbackName
  }
}

function istBereitsUrl(pfad) {
  return /^https?:\/\//i.test(pfad)
}

// Materialien liegen im privaten Bucket "Programme"; datei_url ist dort
// nur ein Storage-Pfad wie
// "<programm_id>/materialien/<timestamp>-<Original-Dateiname>" (siehe
// handleMaterialUploadUrl in api/admin/sessions.js) -- der Zeitstempel-
// Präfix wird hier wieder entfernt, um den Original-Dateinamen
// zurückzugewinnen.
function originalDateiname(pfad) {
  const basisname = pfad.split('/').pop() ?? 'datei'
  return basisname.replace(/^\d+-/, '')
}

async function ladeSignierteUrl(pfad) {
  const { url } = await holeJson(
    `/api/agent/inhalte?resource=material-signed-url&pfad=${encodeURIComponent(pfad)}`,
  )
  return url
}

// Module (in Reihenfolge) plus eine synthetische "Ohne Modul"-Gruppe für
// modul-lose Sessions eines Programms -- analog zur "Kein Modul"-Gruppe
// in ?resource=lesen (api/agent/inhalte.js) und in
// AdminProgramDetailPage.jsx/CoachieProgramPage.jsx, hier nur mit dem
// für den Export vorgegebenen Ordnernamen "Ohne Modul".
function gruppiereNachModul(alleSessions, alleModule, programmId) {
  const gruppen = alleModule
    .filter((modul) => modul.programm_id === programmId)
    .sort((a, b) => a.reihenfolge - b.reihenfolge)
    .map((modul) => ({
      titel: modul.titel,
      bild_url: modul.bild_url,
      sessions: alleSessions
        .filter((session) => session.modul_id === modul.id)
        .sort((a, b) => a.reihenfolge - b.reihenfolge),
    }))

  const moduleloseSessions = alleSessions
    .filter((session) => session.programm_id === programmId && !session.modul_id)
    .sort((a, b) => a.reihenfolge - b.reihenfolge)

  if (moduleloseSessions.length > 0) {
    gruppen.push({ titel: 'Ohne Modul', bild_url: null, sessions: moduleloseSessions })
  }

  return gruppen
}

function inhaltMarkdown(session) {
  return [
    `# ${session.titel}`,
    '',
    `**Video-URL:** ${session.video_url || '(keine)'}`,
    `**Dauer:** ${session.dauer_minuten != null ? `${session.dauer_minuten} Minuten` : '(keine Angabe)'}`,
    '',
    '---',
    '',
    session.beschreibung || '(kein Text hinterlegt)',
    '',
  ].join('\n')
}

async function main() {
  console.log(`Lade Plattform-Daten von ${BASIS_URL} ...`)

  const [{ programme }, { module: alleModule }, { sessions: alleSessions }, { materialien: alleMaterialien }] =
    await Promise.all([
      holeJson('/api/agent/inhalte'),
      holeJson('/api/agent/inhalte?resource=module'),
      holeJson('/api/agent/inhalte?resource=sessions'),
      holeJson('/api/agent/inhalte?resource=materials'),
    ])

  const gesamtSessions = alleSessions.length
  console.log(
    `${programme.length} Programme, ${alleModule.length} Module, ${gesamtSessions} Sessions, ${alleMaterialien.length} Materialien gefunden.`,
  )
  console.log('')

  await stelleOrdnerSicher(EXPORT_ORDNER)

  let sessionZaehler = 0
  let materialErfolge = 0
  let materialFehler = 0
  const fehlerListe = []

  for (const programm of programme) {
    const programmOrdner = path.join(EXPORT_ORDNER, bereinigenFuerDateiname(programm.titel))
    await stelleOrdnerSicher(programmOrdner)

    if (programm.bild_url) {
      try {
        await ladeDateiHerunter(
          programm.bild_url,
          path.join(programmOrdner, dateinameAusUrl(programm.bild_url, 'programm-bild')),
        )
      } catch (err) {
        fehlerListe.push(`Programmbild "${programm.titel}": ${err.message}`)
      }
    }

    const gruppen = gruppiereNachModul(alleSessions, alleModule, programm.id)

    for (const gruppe of gruppen) {
      const modulOrdner = path.join(programmOrdner, bereinigenFuerDateiname(gruppe.titel))
      await stelleOrdnerSicher(modulOrdner)

      if (gruppe.bild_url) {
        try {
          await ladeDateiHerunter(
            gruppe.bild_url,
            path.join(modulOrdner, dateinameAusUrl(gruppe.bild_url, 'modul-bild')),
          )
        } catch (err) {
          fehlerListe.push(`Modulbild "${gruppe.titel}" (${programm.titel}): ${err.message}`)
        }
      }

      let sessionIndex = 0
      for (const session of gruppe.sessions) {
        sessionIndex += 1
        sessionZaehler += 1

        const sessionNummer = String(sessionIndex).padStart(2, '0')
        const sessionOrdner = path.join(
          modulOrdner,
          `${sessionNummer}_${bereinigenFuerDateiname(session.titel)}`,
        )
        await stelleOrdnerSicher(sessionOrdner)

        await fs.writeFile(
          path.join(sessionOrdner, 'inhalt.md'),
          inhaltMarkdown(session),
          'utf8',
        )

        const sessionMaterialien = alleMaterialien
          .filter((material) => material.session_id === session.id)
          .sort((a, b) => a.reihenfolge - b.reihenfolge)

        for (const material of sessionMaterialien) {
          try {
            const quellUrl = istBereitsUrl(material.datei_url)
              ? material.datei_url
              : await ladeSignierteUrl(material.datei_url)

            const dateiname = bereinigenFuerDateiname(originalDateiname(material.datei_url))
            await ladeDateiHerunter(quellUrl, path.join(sessionOrdner, dateiname))
            materialErfolge += 1
          } catch (err) {
            materialFehler += 1
            fehlerListe.push(
              `Material "${material.titel}" (Session "${session.titel}"): ${err.message}`,
            )
          }
        }

        console.log(`Session ${sessionZaehler}/${gesamtSessions} exportiert: ${session.titel}`)
      }
    }
  }

  console.log('')
  console.log('=== Zusammenfassung ===')
  console.log(`Programme:                   ${programme.length}`)
  console.log(`Sessions:                    ${sessionZaehler}/${gesamtSessions}`)
  console.log(`Materialien heruntergeladen: ${materialErfolge}`)
  if (materialFehler > 0) {
    console.log(`Materialien fehlgeschlagen:  ${materialFehler}`)
  }
  if (fehlerListe.length > 0) {
    console.log('')
    console.log('Fehler:')
    fehlerListe.forEach((zeile) => console.log(`  - ${zeile}`))
  }
  console.log('')
  console.log(`Export abgeschlossen: ${path.resolve(EXPORT_ORDNER)}`)
}

main().catch((err) => {
  console.error('Export abgebrochen:', err.message)
  process.exit(1)
})
