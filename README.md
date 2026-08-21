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
   und leitet direkt auf `/passwort-festlegen` weiter, wo er per
   `supabase.auth.updateUser({ password })` ein eigenes Passwort setzt.
3. Den Coachie einem oder mehreren Programmen zuordnen.
4. Unter **Programme** die zugehörigen Sessions (inkl. Video, Workbook,
   Materialien) anlegen und aktivieren.

### `APP_URL` korrekt setzen (Einladungslinks)

`api/admin/coachies.js` (Standard- und `?resource=resend`-Zweig) und
`api/webhooks/stripe.js` bauen den Redirect-Link im Einladungslink so:
`process.env.APP_URL`, falls gesetzt — sonst automatisch aus dem
`Host`-Header des eingehenden Requests abgeleitet. Zeigte ein
Einladungslink auf `localhost`, lag es an einer dieser zwei Stellen:

1. **`APP_URL` in Vercel setzen** (Project Settings → Environment
   Variables, für **Production** anhaken, danach neu deployen): der
   Wert ist die tatsächliche Produktions-Domain der App, z. B.
   `https://mrh-coaching-plattform.vercel.app` oder eure eigene Domain
   falls eingerichtet — ohne `/` am Ende. Die genaue Domain steht in
   Vercel unter dem Projekt → **Domains**; das kann ich von hier aus
   nicht einsehen, daher kein exakter Wert von mir vorgegeben.
2. **Supabase Authentication → URL Configuration** prüfen:
   - **Site URL** muss auf dieselbe Produktions-Domain zeigen, nicht auf
     `http://localhost:3000` (Supabase-Standard bei Projekt-Anlage).
     Wenn `redirectTo` aus irgendeinem Grund nicht greift, fällt Supabase
     stillschweigend auf die Site URL zurück — ist die noch `localhost`,
     landen Einladungslinks dort, egal was der Code sendet.
   - **Redirect URLs** muss `<APP_URL>/passwort-festlegen` enthalten
     (oder großzügiger `<APP_URL>/**`), sonst ignoriert Supabase das per
     Code übergebene `redirectTo` ebenfalls und nutzt nur die Site URL.

## Branding

Farbpalette als Tailwind-Theme-Tokens in `src/index.css` (`@theme`):

| Token | Wert | Verwendung |
| --- | --- | --- |
| `mrh-cream` | `#f7f3ec` | Seitenhintergrund |
| `mrh-navy` / `mrh-navy-dark` | `#1f2a44` / `#161d30` | Header, Buttons, Überschriften |
| `mrh-orange` / `mrh-orange-dark` | `#d9772e` / `#b26226` | Call-to-Action, Hervorhebungen, "abgeschlossen"-Badges |
| `mrh-grey` | `#6b7280` | Metadaten, Zeitstempel, sekundäre Beschriftungen |

**Bildmaterial**: `public/brand/` erwartet drei Dateien (Marcels Fotos von
mrh-beratung.de), die aus Netzwerkgründen nicht automatisch geholt werden
konnten — Details und exakte Dateinamen in `public/brand/README.md`. Ohne
diese Dateien funktionieren Login-Seite, Passwort-festlegen-Seite,
Coachie-Dashboard und Programm-Detailseite normal, zeigen aber ein
gebrochenes Bild-Icon statt Foto.

**Einladungs-E-Mail**: `email-templates/invite.html` enthält das
HTML-Template im MRH-Design (Creme/Navy/Orange). Unter Supabase Dashboard →
Authentication → Email Templates → **Invite user** den Inhalt der Datei
einfügen (nutzt ausschließlich die Supabase-eigene Variable
`{{ .ConfirmationURL }}`, keine weitere Konfiguration nötig).

## Phase 2: Self-Signup & Stripe-Zahlung

Ergänzt einen zweiten, parallelen Zugangsweg für kleinere Programme: ein
Interessent bezahlt über eine öffentliche Kaufseite per Stripe Checkout und
wird automatisch als Coachie angelegt und zugeordnet — ohne dass Marcel
manuell im Admin freischalten muss. Große/individuelle Programme bleiben
weiterhin ausschließlich manuell zugeordnet.

### Einmalige Einrichtung

1. **Datenbank-Migration**: `supabase_migrations/phase2_stripe.sql` im
   Supabase SQL Editor ausführen (neue Spalten auf `programme` und
   `coachie_programme`, neue Tabelle `stripe_events`, verschärfte
   RLS-Policies für abgelaufenen Zugriff). Wurde gegen den aktuellen
   Live-Stand von Schema und Policies geprüft, aber bewusst nicht
   automatisch angewendet — bitte vor dem Ausführen selbst durchlesen.
2. Für jedes zu verkaufende Programm in Stripe ein **Produkt + Price**
   anlegen (Modus **Payment**, nicht Subscription — Einmalzahlung).
   Stripe Invoicing/automatische Zahlungsbelege aktivieren.
3. Im Admin-Bereich unter **Programme → Verkauf einrichten**: Preis,
   Stripe Price ID, Slug eintragen und "Öffentlich kaufbar" aktivieren.
   Die Kaufseite ist danach unter `/kaufen/<slug>` erreichbar.
4. Umgebungsvariablen ergänzen: `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET` (server-only, wie die bestehenden
   Vercel-Variablen in allen drei Umgebungen anhaken).
5. In Stripe unter **Developers → Webhooks** einen Endpunkt auf
   `<APP_URL>/api/webhooks/stripe` eintragen, Event-Typ
   `checkout.session.completed` abonnieren. Das dabei angezeigte Signing
   Secret ist `STRIPE_WEBHOOK_SECRET`.
6. Mit Stripe-Testkarten (`4242 4242 4242 4242`) einen Testkauf
   durchspielen, bevor auf Live-Modus umgestellt wird.

`api/checkout.js` und `api/webhooks/stripe.js` teilen sich einen
Stripe-Client aus `api/_lib/stripeClient.js` (ein Modul-Singleton, analog
zu `getSupabaseAdmin()`), mit explizitem Timeout, `maxNetworkRetries`
und `dns.setDefaultResultOrder('ipv4first')` — letzteres vermeidet eine
bekannte Ursache für `StripeConnectionError` in Cloud-/Serverless-Umgebungen,
bei der Node einen kaputten IPv6-Pfad zu einer externen API bevorzugt,
obwohl IPv4 funktioniert.

### Ablauf

`/kaufen/<slug>` → Stripe Checkout (hosted, sammelt E-Mail selbst) →
Webhook `checkout.session.completed` → neuer Coachie wird angelegt und
erhält dieselbe Einladungs-E-Mail wie beim manuellen Einladen (bereits
bestehende Coachies bekommen keine erneute Einladung, nur die neue
Zuordnung) → `coachie_programme.zugriff_bis` wird automatisch auf
Kaufdatum + 36 Monate gesetzt.

Nach Ablauf von `zugriff_bis` blendet die Datenbank (nicht nur das
Frontend) das Programm inklusive Sessions und Materialien für diesen
Coachie automatisch aus; er sieht stattdessen einen Hinweis mit
Kontaktmöglichkeit für eine Verlängerung. Manuell von Marcel zugeordnete
Programme haben `zugriff_bis = NULL` und bleiben unbegrenzt zugänglich.

## Teaser-Programme

Programme mit `teaser_aktiv = true` werden im Coachie-Dashboard unter
"Weitere Programme" auch Coachies angezeigt, die diesem Programm nicht
zugeordnet sind — als nicht anklickbare Vorschau-Kachel (Titel,
Beschreibung, Preis), mit einem "Mehr erfahren"-Link zur öffentlichen
Kaufseite, falls das Programm zusätzlich `oeffentlich_kaufbar` ist.
`preis_anzeigen = false` zeigt stattdessen "Preis auf Anfrage".

Einmalige Einrichtung: `supabase_migrations/teaser_programme.sql` im
Supabase SQL Editor ausführen (neue Spalten + eine zusätzliche,
rein additive RLS-Policy). Danach im Admin-Bereich unter **Programme →
Verkauf einrichten** die beiden neuen Schalter setzen.

## Testergebnisse ("Meine Auswertungen")

Coachies sehen ihre verknüpften Kurztest-Ergebnisse (aus dem separaten
Profil-Quiz-Projekt) unter **Meine Auswertungen**. Marcel verknüpft sie
im Admin-Bereich pro Coachie (**Coachies → Testergebnisse verknüpfen**)
— automatischer Vorschlag per exaktem E-Mail-Abgleich, plus manuelle
Suche über Name/E-Mail als Fallback (z. B. wenn beim Test eine andere
Adresse verwendet wurde). Verknüpfte Ergebnisse werden einmalig als
Kopie gespeichert, nicht bei jedem Aufruf neu abgefragt.

Das Profil-Quiz-Projekt ist eine komplett separate Supabase-Instanz
(eigene Region, eigene Zugangsdaten) — die Coaching-Plattform bekommt
bewusst **keinen** `service_role`-Zugriff darauf, sondern nur `EXECUTE`
auf zwei schmale SQL-Funktionen über eine dedizierte, sonst rechtelose
Postgres-Rolle. Ein kompromittiertes Zugriffstoken kann damit höchstens
Testergebnisse per Name/E-Mail nachschlagen — nichts anderes in diesem
Projekt lesen, schreiben oder löschen.

### Einmalige Einrichtung (zwei Supabase-Projekte)

1. **Im Profil-Quiz-Projekt** (`rbfsfcetdzdsyoffglwi`, eu-west-1) im SQL
   Editor `supabase_migrations/profil_quiz_reader.sql` ausführen. Legt
   die Rolle `coaching_plattform_reader` sowie zwei
   `SECURITY DEFINER`-Funktionen an; kein Tabellenzugriff wird gewährt.
2. Token erzeugen — **lokal, niemals das Secret weitergeben**:
   ```bash
   PROFIL_QUIZ_JWT_SECRET="<JWT Secret aus Profil-Quiz → Project Settings → API>" \
     node scripts/mint-profil-quiz-token.mjs
   ```
   Das JWT Secret steht im Profil-Quiz-Projekt unter Project Settings →
   API → JWT Settings. Die Ausgabe des Skripts ist der fertige Token.
3. **Im Coaching-Plattform-Projekt** (dieses hier) im SQL Editor
   `supabase_migrations/testergebnisse.sql` ausführen (neue Tabelle
   `coachie_testergebnisse`, eigene RLS-Policy).
4. In Vercel (Coaching-Plattform) `PROFIL_QUIZ_URL` (Standard:
   `https://rbfsfcetdzdsyoffglwi.supabase.co`) und
   `PROFIL_QUIZ_READER_TOKEN` (Ausgabe aus Schritt 2) eintragen,
   server-only, alle drei Umgebungen.

Struktur ist bewusst so angelegt (eigenes `test_typ`-Feld, eigene
Tabelle), dass sie sich später um Zertifikate erweitern lässt, ohne
etwas Bestehendes umbauen zu müssen.

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
  _lib/          adminAuth (HMAC-Token), supabaseAdmin (service_role Client),
                 stripeClient (Stripe-SDK-Singleton)
  admin/         Serverless Functions für Programme, Sessions (+Materialien
                 via ?resource=materials), Coachies (+Zuordnungen via
                 ?resource=assignments, +Einladung erneut senden via
                 ?resource=resend), Testergebnisse (+Suche via
                 ?resource=suche), Fortschritt, Login
  checkout.js    Öffentliche Kaufseite: GET Programm-Vorschau, POST Stripe
                 Checkout Session
  webhooks/      Stripe-Webhook (Signaturprüfung, Idempotenz)
```

## API-Konsolidierung (Vercel Hobby: max. 12 Functions)

Vercel zählt jede Datei unter `api/` (außer `api/_lib/*`) als eigene
Serverless Function; der kostenlose Hobby-Plan erlaubt max. 12 pro
Deployment. Ursprünglich waren es 13 Dateien (`coachies.js`,
`coachies-resend.js`, `assignments.js`, `sessions.js`, `materials.js`,
`testergebnisse.js`, `testergebnisse-suche.js`, `programme.js`,
`progress.js`, `login.js`, `public/programme.js`, `checkout.js`,
`webhooks/stripe.js`) — über dem Limit.

Thematisch verwandte Endpunkte wurden in einer Datei mit
Routing-Parameter zusammengefasst, ohne Verhalten zu ändern:

- `api/admin/coachies.js` — Standard (Coachies), `?resource=resend`
  (Einladung erneut senden), `?resource=assignments`
  (Programm-Zuordnungen).
- `api/admin/sessions.js` — Standard (Sessions), `?resource=materials`
  (Session-Materialien).
- `api/admin/testergebnisse.js` — Standard (Verknüpfen/Liste),
  `?resource=suche` (Profil-Quiz-Suche).
- `api/checkout.js` — GET (öffentliche Programm-Vorschau, vormals
  `api/public/programme.js`), POST (Stripe Checkout Session, wie bisher).

Ergebnis: 8 Functions (`admin/coachies.js`, `admin/login.js`,
`admin/programme.js`, `admin/progress.js`, `admin/sessions.js`,
`admin/testergebnisse.js`, `checkout.js`, `webhooks/stripe.js`) —
deutlich unter dem Hobby-Limit von 12, ohne Funktionsverlust.
