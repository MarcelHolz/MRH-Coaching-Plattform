# MRH Coaching-Plattform

Coaching-Plattform für MRH Beratung & Coaching. Coachies erhalten nach manueller
Freischaltung Zugang zu ihren zugeordneten Programmen, sehen je Session
Video/Workbook/Materialien und pflegen ihren eigenen Bearbeitungsstatus. Marcel
verwaltet Programme, Sessions, Coachies und Fortschritt über einen separaten
Admin-Bereich.

## Stack

- **Frontend:** React (Vite, JSX), React Router v6, Tailwind CSS v4
- **Backend:** Supabase (Auth, Postgres, Storage) für Coachie-Daten
- **Serverless:** Vercel Functions unter `/api` für alle Admin-Operationen
- **Hosting:** Vercel

## Architektur & Sicherheitsmodell

Die Datenbank (`programme`, `sessions`, `session_material`, `coachies`,
`coachie_programme`, `coachie_status`) liegt in Supabase mit Row Level
Security: Jeder Coachie sieht und bearbeitet ausschließlich seine eigenen
Daten (Join über `coachie_programme`). Das Frontend greift für Coachies
direkt über den Supabase-JS-Client mit dem **anon Key** zu — dieser Key ist
öffentlich und unbedenklich im Bundle, da RLS die eigentliche Zugriffskontrolle
übernimmt.

Der Admin-Bereich (`/admin/*`) ist bewusst **nicht** über Supabase Auth /RLS
gelöst, sondern:

1. Marcel meldet sich mit einem Passwort an (`POST /api/admin/login`).
2. Bei Erfolg wird ein HMAC-SHA256-signiertes Token (Node `crypto`, kein
   externes JWT-Package) mit 8h Gültigkeit ausgestellt und im
   `sessionStorage` des Browsers gespeichert.
3. Jeder weitere Request an `/api/admin/*` schickt dieses Token als
   `Authorization: Bearer <token>` mit; jede Route (außer `login.js`) prüft es
   über `requireAdmin()`, bevor sie den Supabase **service_role Key**
   verwendet.

Der service_role Key umgeht RLS vollständig und darf daher **nie** im
Client-Bundle landen. Er wird ausschließlich serverseitig in den
Vercel-Functions unter `/api` referenziert (`process.env.SUPABASE_SERVICE_ROLE_KEY`,
ohne `VITE_`-Prefix) und ist damit für den Browser nicht erreichbar.

## Lokale Entwicklung

```bash
npm install
cp .env.example .env.local   # falls noch nicht vorhanden — Werte eintragen
npm run dev
```

Für die `/api`-Functions lokal (Vercel CLI erforderlich):

```bash
npm install -g vercel
vercel dev
```

### Umgebungsvariablen

| Variable | Sichtbarkeit | Zweck |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Client | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Client | Supabase anon/publishable Key |
| `SUPABASE_URL` | Server | Supabase Project URL (für `/api`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service_role Key — **niemals im Client** |
| `ADMIN_PASSWORD` | Server | Passwort für den Admin-Login |
| `ADMIN_TOKEN_SECRET` | Server | Geheimnis zum Signieren der Admin-Session-Tokens |
| `APP_URL` | Server | Öffentliche URL der App, für den Redirect im Einladungslink |

`.env.local` ist gitignored. `.env.example` dient als Vorlage.

## Deployment (Vercel)

1. Projekt in Vercel importieren (dieses Repo).
2. Unter **Settings → Environment Variables** alle sechs Variablen aus der
   Tabelle oben eintragen (Production/Preview je nach Bedarf).
3. Deployen:

   ```bash
   vercel --prod
   ```

4. `vercel.json` sorgt per Rewrite dafür, dass alle Nicht-`/api`-Routen an
   `index.html` ausgeliefert werden (SPA-Routing über React Router), während
   `/api/*` unangetastet bleibt.

## Ersten Coachie anlegen

1. Im Admin-Bereich (`/admin/login`) mit dem `ADMIN_PASSWORD` anmelden.
2. Unter **Coachies** einen neuen Coachie per Name/E-Mail einladen — das
   löst `supabase.auth.admin.inviteUserByEmail` aus, der Coachie erhält eine
   Einladungs-E-Mail von Supabase. Der Link darin meldet ihn automatisch an
   und leitet (sofern `APP_URL` gesetzt und in Supabase als Redirect URL
   erlaubt ist) direkt auf `/passwort-festlegen` weiter, wo er per
   `supabase.auth.updateUser({ password })` ein eigenes Passwort setzt.
   Ohne `APP_URL`/passendem Supabase-Redirect landet er zwar auf einer
   anderen Seite, wird aber trotzdem automatisch zu `/passwort-festlegen`
   umgeleitet, solange der Einladungslink (`#...&type=invite`) noch in der
   URL steht — erst danach kann er sich mit E-Mail + Passwort einloggen.
3. Den Coachie einem oder mehreren Programmen zuordnen.
4. Unter **Programme** die zugehörigen Sessions (inkl. Video, Workbook,
   Materialien) anlegen und aktivieren.

## Projektstruktur

```
src/
  admin/         Admin-Bereich (Auth, Layout, Unterseiten)
  components/    Geteilte Komponenten (ProtectedRoute)
  context/       AuthContext (Coachie-Session)
  layouts/       CoachieLayout
  lib/           Supabase-Client, adminFetch-Helper, YouTube-Embed-Utility
  pages/         Coachie-Seiten (Login, Dashboard, Programmdetail)
api/
  _lib/          adminAuth (HMAC-Token), supabaseAdmin (service_role Client)
  admin/         Serverless Functions für Programme, Sessions, Materialien,
                 Coachies, Zuordnungen, Fortschritt
```
