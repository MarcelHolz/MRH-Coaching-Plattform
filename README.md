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

### Passwort vergessen / zurücksetzen

Der Einladungslink (`inviteUserByEmail`) funktioniert nur einmalig, bevor
ein Coachie bereits ein eigenes Passwort gesetzt hat — "Einladung erneut
senden" hilft danach nicht mehr weiter. Für aktive Coachies gibt es
stattdessen zwei Wege, denselben `supabase.auth.resetPasswordForEmail`-
Mechanismus auszulösen (Supabase-Standard-Passwort-Reset, kein
Custom-Code-Pfad):

- **Coachie selbst:** Login-Seite → "Passwort vergessen?" → E-Mail
  eingeben. Bewusst dieselbe Bestätigungsmeldung unabhängig davon, ob die
  E-Mail existiert (verhindert, registrierte Adressen über das
  Login-Formular zu erraten).
- **Admin-Fallback:** **Coachies** → bei einem bereits aktiven Coachie
  "Passwort-Reset senden".

Beide Wege führen zur bereits vorhandenen `/passwort-festlegen`-Seite
(`SetPasswordPage`) — sie war zuvor nur für Einladungslinks (`type=invite`
im URL-Hash) vorgesehen, erkennt jetzt zusätzlich Passwort-Reset-Links
(`type=recovery`) und schickt den Coachie in beiden Fällen dorthin, statt
direkt eingeloggt ins Dashboard (siehe `pendingPasswordSetup` in
`src/lib/supabaseClient.js`, vormals `invite`).

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
| `mrh-navy` / `mrh-navy-dark` | `#1f2a44` / `#161d30` | Header, Struktur, funktionale Buttons (Anmelden, Speichern, Navigation) |
| `mrh-gold` / `mrh-gold-dark` / `mrh-gold-soft` | `#b9913f` / `#9c7831` / `#d9bc7a` | Akzentfarbe (vormals Orange) — Call-to-Action, Hervorhebungen, "abgeschlossen"-Badges |
| `mrh-black` | `#0c0b0a` | Schwarze Kontrastflächen für Kauf-CTAs (Kaufseite, Programm-Upsell-Kacheln) |
| `mrh-grey` | `#6b7280` | Metadaten, Zeitstempel, sekundäre Beschriftungen |

**UX-Refresh nach mrh-beratung.de (Stand 22.08.2026):** Die Akzentfarbe
wurde von Orange auf Gold/Bronze umgestellt und schwarze Kontrastflächen
für Kauf-CTAs ergänzt, angeglichen an die inzwischen weiterentwickelte
MRH-Website. Alle Werte stammen 1:1 aus dem kompilierten CSS der Live-Seite
(`app-DiRqed_w.css`: `--color-gold`, `-deep`, `-soft`, `--color-black`),
nicht geschätzt. **Navy bleibt bewusst erhalten** (Header, Struktur,
funktionale Buttons) — die Live-Seite selbst nutzt inzwischen kein Navy
mehr (dort "ink" `#121110` statt Navy), das ist hier also eine bewusste
Abweichung, kein 1:1-Abgleich. Zusätzlich **Fraunces** (Serif, via Google
Fonts in `index.html`, Schnitte 500/600 normal + italic) für
Kernbotschaften/Zitate (`font-serif italic`, z. B. die Bildunterschrift auf
Login-/Passwort-festlegen-Seite) sowie nicht-kursiv für Seiten-Überschriften
(`font-serif`, z. B. Programmtitel) — Fließtext bleibt unverändert bei
`system-ui`. Admin-Bereich bewusst zurückhaltend behandelt (nur die
Akzentfarbe zieht über die bestehenden Badges mit, keine neuen
Schwarz-/Serif-Elemente).

**Bildmaterial**: `public/brand/` erwartet drei Dateien (Marcels Fotos von
mrh-beratung.de), die aus Netzwerkgründen nicht automatisch geholt werden
konnten — Details und exakte Dateinamen in `public/brand/README.md`. Ohne
diese Dateien funktionieren Login-Seite, Passwort-festlegen-Seite,
Coachie-Dashboard und Programm-Detailseite normal, zeigen aber ein
gebrochenes Bild-Icon statt Foto.

**Einladungs-E-Mail**: `email-templates/invite.html` enthält das
HTML-Template im MRH-Design (Creme/Navy/Orange — noch nicht auf den
Gold-Akzent umgestellt, da E-Mail-Templates nicht Teil dieses Refreshs
waren; bei Bedarf separat nachziehen). Unter Supabase Dashboard →
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
   Diese Policies sind live geprüft aktiv (`programme`/`sessions`/
   `session_material` blenden abgelaufene Zuordnungen bereits
   serverseitig aus, nicht nur im Frontend).
2. `supabase_migrations/standard_zugriffsmonate.sql` ausführen (neue,
   optionale Spalte `programme.standard_zugriffsmonate`).
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
Kaufdatum + `programme.standard_zugriffsmonate` gesetzt, sofern das
Programm einen Wert dafür hat (einstellbar im Admin-Bereich unter
**Programme → Verkauf einrichten** → "Standardzugriff (Monate)"). Ohne
gesetzten Wert bleibt der Zugriff auch bei automatischen Käufen
unbegrenzt.

Nach Ablauf von `zugriff_bis` blendet die Datenbank (nicht nur das
Frontend) das Programm inklusive Sessions und Materialien für diesen
Coachie automatisch aus; er sieht stattdessen einen Hinweis mit
Kontaktmöglichkeit für eine Verlängerung. Manuell von Marcel zugeordnete
Programme haben `zugriff_bis = NULL` und bleiben unbegrenzt zugänglich.
Marcel kann `zugriff_bis` pro Zuordnung jederzeit manuell einsehen und
anpassen (**Coachies** → bei der jeweiligen Programm-Zuordnung
"Bearbeiten", z. B. für eine Kulanzverlängerung) — unabhängig davon, ob
der Wert automatisch oder gar nicht gesetzt wurde. Ist für eine Zuordnung
ein `zugriff_bis` gesetzt, zeigt die zugehörige Programm-Kachel im
Coachie-Dashboard zusätzlich einen dezenten Hinweis "Zugriff bis
TT.MM.JJJJ"; bei unbegrenztem Zugriff (`zugriff_bis = NULL`) bleibt die
Kachel unverändert ohne Hinweis.

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

## Module (Strukturebene zwischen Programm und Session)

Optionale Gruppierungsebene: eine `sessions`-Zeile kann per `modul_id`
einem Eintrag in `module` zugeordnet werden, muss aber nicht (`NULL` =
Session liegt direkt unter dem Programm, z. B. eine Willkommens-Session
vor den eigentlichen Modulen).

Anzeigereihenfolge im Coachie-Bereich: erst alle modullosen Sessions in
ihrer `reihenfolge`, danach die Module in ihrer eigenen `reihenfolge`
mit ihren Sessions darunter (siehe `ordneSessionsNachModul` in
`CoachieProgramPage.jsx` — dieselbe Funktion bestimmt auch, welche
Session als Nächstes drankommt, z. B. für den "Fortsetzen"-Button).
Ein Modul wird wie eine Kurskarte dargestellt (optionales Bild, Titel,
Beschreibung, eigener Fortschrittsbalken, Sessions-Anzahl,
Status-Badge) und klappt beim Anklicken die enthaltenen Sessions in
der unveränderten Session-Ansicht auf. Die Fortschrittsberechnung für
das gesamte Programm bleibt unabhängig von der Modul-Zugehörigkeit auf
Basis aller Sessions.

Verwaltung im Admin-Bereich unter **Programme → Sessions verwalten**
(`ModuleManager.jsx`, oberhalb der Sessions-Liste): Module anlegen,
bearbeiten, per Auf/Ab neu sortieren; die Session-Formulare bekommen
zusätzlich eine Modul-Auswahl (oder "Kein Modul").

Einmalige Einrichtung: `supabase_migrations/modul_ebene.sql` im
Supabase SQL Editor ausführen (neue Tabelle `module`, neue Spalten
`sessions.modul_id` und `programme.bild_url`, rein additiv).

### Bild-Upload für Programm-/Modul-Vorschaubilder

Die Bild-URL-Felder (Programm "Verkauf einrichten" und Modul) erlauben
neben manueller URL-Eingabe auch einen direkten Datei-Upload
(`BildUpload.jsx`, max. 5 MB, JPG/PNG/WEBP). Ablauf: der Browser fragt
über die admin-geschützte Route `api/admin/programme.js
?resource=bild-upload` ein Einweg-Upload-Token an (per service_role
erzeugt, `createSignedUploadUrl`), lädt die Datei damit direkt zu
Supabase Storage hoch (`uploadToSignedUrl`, läuft nicht durch unsere
Serverless Function) und übernimmt die resultierende öffentliche URL
automatisch ins Textfeld.

Einmalige Einrichtung: `supabase_migrations/programm_bilder_bucket.sql`
im Supabase SQL Editor ausführen -- legt den neuen, öffentlichen
Storage-Bucket `programm-bilder` an (getrennt vom privaten Bucket
`Programme` fürs Kursmaterial), inkl. serverseitigem 5-MB-/
Format-Limit auf Supabase-Ebene.

## Testergebnisse ("Meine Auswertungen")

Coachies sehen ihre verknüpften Kurztest-Ergebnisse (aus dem separaten
Profil-Quiz-Projekt) unter **Meine Auswertungen**. Marcel verknüpft sie
im Admin-Bereich pro Coachie (**Coachies → Testergebnisse verknüpfen**)
— automatischer Vorschlag per exaktem E-Mail-Abgleich, plus manuelle
Suche über Name/E-Mail als Fallback (z. B. wenn beim Test eine andere
Adresse verwendet wurde). Verknüpfte Ergebnisse werden einmalig als
Kopie gespeichert, nicht bei jedem Aufruf neu abgefragt.

Jede Kachel zeigt zunächst nur den dominanten Typ; über "Vollständige
Auswertung anzeigen" öffnet sich ein Säulendiagramm
(`src/components/TestergebnisChart.jsx`) der vier Punktewerte
(Dominant/Kreativ/Sachlich/Harmonisch), alle vier Säulen von einer
gemeinsamen, durchgehenden Basislinie aus. Werte können negativ sein
(Coaching-Vorbereitungstest) — statt divergierender Balken (nach oben
*und* unten, wie ursprünglich umgesetzt) wird die Skala verschoben: der
kleinste tatsächliche Wert wird als kleiner, aber sichtbarer Balken
dargestellt, alle anderen proportional höher relativ zueinander (an
mrh-quiz.vercel.app orientiert, dort für denselben Fall verwendet — die
Seite war per Netzwerk-Sandbox nicht direkt einsehbar, die Umsetzung
folgt der vom Nutzer beschriebenen Transformation). Kein Radardiagramm,
das würde ohnehin eine nicht-negative Skala ab der Mitte voraussetzen.
Das angezeigte Zahlenlabel bleibt immer der echte, unverschobene Wert
(z. B. "-2") — nur die Balkenhöhe ist relativ. Die Farben entsprechen der
Typ-Zuordnung der ursprünglichen Kurztest-App (`TRAIT_COLOR` in
`src/lib/testergebnisse.js`, DISG-Konvention: Dominant=Rot, Kreativ=Gelb,
Sachlich=Blau, Harmonisch=Grün). Zusätzlich, beim
Coaching-Vorbereitungstest, eine Block-für-Block-Übersicht (je Block: am
meisten/am wenigsten gewählter Typ). Beides steckt bereits vollständig in
`ergebnis_daten` (`punkte_*`- bzw. `block_antworten`-Feld) — keine
zusätzliche Migration nötig. **Nicht** enthalten sind die
Fließtext-Interpretationen aus dem per E-Mail versendeten PDF-Bericht
(die werden dort offenbar zur Versandzeit generiert und nirgends
persistiert, auch nicht im Profil-Quiz-Projekt selbst) — das PDF lässt
sich aktuell also nicht 1:1 nachbilden, nur die zugrunde liegenden Zahlen.

Das Profil-Quiz-Projekt ist eine komplett separate Supabase-Instanz
(eigene Region, eigene Zugangsdaten) — die Coaching-Plattform bekommt
bewusst **keinen** `service_role`-Zugriff darauf. Stattdessen läuft der
Zugriff über eine dort deployte **Edge Function**
(`testergebnisse-reader`), die intern mit dem projekteigenen
`service_role`-Key auf zwei schmale `SECURITY DEFINER`-SQL-Funktionen
zugreift und sich nach außen über ein selbst vergebenes Secret im
Header absichert — kein Tabellenzugriff, kein Supabase-JWT nötig. Ein
kompromittiertes Secret kann damit höchstens Testergebnisse per
Name/E-Mail nachschlagen — nichts anderes in diesem Projekt lesen,
schreiben oder löschen. Der `service_role`-Key selbst verlässt das
Profil-Quiz-Projekt nie (von Supabase automatisch in die Edge Function
injiziert, nirgendwo manuell eingetragen).

(Ursprünglich war das über eine dedizierte Postgres-Rolle mit selbst
gemintetem JWT gelöst — siehe `supabase_migrations/profil_quiz_reader.sql`,
inzwischen überholt. Umgestellt auf die Edge Function, weil die
Verwaltung mehrerer HS256-Signing-Keys im neuen Supabase-Dashboard nicht
zuverlässig nutzbar war.)

### Einmalige Einrichtung (zwei Supabase-Projekte)

1. **Im Profil-Quiz-Projekt** (`rbfsfcetdzdsyoffglwi`, eu-west-1) im SQL
   Editor `supabase_migrations/profil_quiz_reader_v2.sql` ausführen.
   Legt die zwei `SECURITY DEFINER`-Funktionen an (bzw. aktualisiert sie,
   falls die alte Migration bereits lief) und beschränkt `EXECUTE` auf
   `service_role`; kein Tabellenzugriff wird gewährt.
2. Eigenes Secret erzeugen — ein beliebiger langer Zufallswert, z. B.:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Diesen Wert für die nächsten beiden Schritte merken (nirgendwo außer
   den beiden folgenden Stellen eintragen).
3. Edge Function deployen — im Ordner `profil-quiz-edge-function/` dieses
   Repos (separates Deployment-Ziel, gehört nicht zur Coaching-Plattform
   selbst):
   ```bash
   cd profil-quiz-edge-function
   npx supabase@latest login
   npx supabase@latest link --project-ref rbfsfcetdzdsyoffglwi
   npx supabase@latest secrets set READER_SECRET="<Secret aus Schritt 2>" \
     --project-ref rbfsfcetdzdsyoffglwi
   npx supabase@latest functions deploy testergebnisse-reader \
     --project-ref rbfsfcetdzdsyoffglwi
   ```
   `npx supabase@latest` lädt die Supabase-CLI bei Bedarf automatisch,
   keine separate Installation nötig. `login` öffnet einmalig den Browser
   zur Anmeldung; `link` verbindet diesen lokalen Ordner mit dem
   Profil-Quiz-Projekt (getrennt vom Coaching-Plattform-Projekt).
   `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` müssen nicht gesetzt werden
   — die injiziert Supabase automatisch in jede Edge Function.

   Sicherheitshalber danach im Profil-Quiz-Dashboard prüfen: **Edge
   Functions → testergebnisse-reader → "Enforce JWT Verification"** muss
   **aus** sein (steuert `supabase/config.toml` in diesem Ordner
   automatisch mit, aber ein CLI-seitiger Bug kann das vereinzelt nicht
   zuverlässig durchsetzen — deshalb kurz nachsehen).
4. Testen, unabhängig vom Coaching-Plattform-Deployment:
   ```bash
   curl -i -X POST "https://rbfsfcetdzdsyoffglwi.supabase.co/functions/v1/testergebnisse-reader" \
     -H "x-reader-secret: <Secret aus Schritt 2>" \
     -H "Content-Type: application/json" \
     -d '{"action":"suchen","such_email":"test@example.com"}'
   ```
   `200` mit `{"ergebnisse":[...]}` (auch leer) = funktioniert. `401` =
   Secret stimmt nicht überein oder wurde nicht gesetzt (Schritt 3).
5. **Im Coaching-Plattform-Projekt** (dieses hier) im SQL Editor
   `supabase_migrations/testergebnisse.sql` ausführen (neue Tabelle
   `coachie_testergebnisse`, eigene RLS-Policy).
6. In Vercel (Coaching-Plattform) zwei Variablen eintragen, server-only,
   alle drei Umgebungen:
   - `PROFIL_QUIZ_URL` (Standard: `https://rbfsfcetdzdsyoffglwi.supabase.co`)
   - `PROFIL_QUIZ_READER_SECRET` — derselbe Wert wie in Schritt 2/3.

   `PROFIL_QUIZ_ANON_KEY` und `PROFIL_QUIZ_READER_TOKEN` (aus einer
   früheren Version dieses Setups) werden nicht mehr gebraucht — die
   Edge Function braucht keinen Supabase-API-Key vom aufrufenden Client,
   da `verify_jwt` für sie bewusst deaktiviert ist und stattdessen das
   eigene Secret prüft.

Struktur ist bewusst so angelegt (eigenes `test_typ`-Feld, eigene
Tabelle), dass sie sich später um Zertifikate erweitern lässt, ohne
etwas Bestehendes umbauen zu müssen.

## Produktagent (eigenständige Kursanlage als Entwurf)

Ein externer Produktagent kann über eine eigene API-Route (`api/agent/
inhalte.js`) selbstständig Kurse (Programm/Modul/Session) anlegen,
bearbeiten und löschen. Freigabe bleibt exklusiv dem Admin-Bereich
vorbehalten: neue Programme landen immer mit `aktiv = false`, unabhängig
davon, was der Agent im Request-Body schickt, und der Agent kann ein
Programm (bzw. dessen Module/Sessions) nach der Freigabe (`aktiv = true`,
per "Aktivieren"-Button unter **Programme**) nicht mehr bearbeiten oder
löschen — die Route prüft das vor jedem Update/Delete serverseitig.

**Warum keine eigene Postgres-Rolle mit Supabase-JWT:** Dieses Projekt
hat genau dieses Muster bereits für die Profil-Quiz-Anbindung versucht
und wieder verworfen (siehe `supabase_migrations/profil_quiz_reader.sql`
/ `_v2.sql`) — im aktuellen Supabase-Dashboard lässt sich kein zweiter
HS256-Standby-Signing-Key mehr anlegen (nur noch "Rotate"), ohne den
sich kein selbst signiertes JWT mit eigenem Rollen-Claim ausstellen
lässt, das PostgREST akzeptiert. Stattdessen: dieselbe Route nutzt
intern `service_role` (wie alle `api/admin/*`-Routen) und ist nach außen
über ein selbst vergebenes Secret im Header abgesichert, kein
Supabase-JWT nötig.

### Einmalige Einrichtung

1. Secret erzeugen:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. In Vercel als `AGENT_CONTENT_SECRET` eintragen, server-only, alle drei
   Umgebungen (Production/Preview/Development).
3. Dem Agenten denselben Wert geben — er schickt ihn bei jedem Request
   als Header `x-agent-secret`.

Falls zuvor schon `agent_content_rolle.sql` (frühere Version dieses
Features, mittlerweile aus dem Repo entfernt) im SQL Editor ausgeführt
wurde: zusätzlich `supabase_migrations/agent_content_rolle_rueckbau.sql`
ausführen (räumt die verworfene Rolle/Policies wieder auf). War die
vorherige Migration nie ausgeführt, ist diese Datei ein reines No-Op.

### API

Alle Requests brauchen den Header `x-agent-secret: <Secret>`.

- `GET/POST/PATCH/DELETE /api/agent/inhalte` — Programme (Felder:
  `titel`, `beschreibung`, `bild_url`).
- `GET/POST/PATCH/DELETE /api/agent/inhalte?resource=module` — Module
  (Felder: `programm_id`, `titel`, `beschreibung`, `bild_url`,
  `reihenfolge`).
- `GET/POST/PATCH/DELETE /api/agent/inhalte?resource=sessions` —
  Sessions (Felder: `programm_id`, `modul_id` optional, `titel`,
  `beschreibung`, `video_url`, `bild_url`, `reihenfolge`).
- `GET /api/agent/inhalte?resource=lesen` — kompletter Ist-Stand der
  Plattform in einem Call, verschachtelt `programme[].module[].sessions[]`
  statt drei flacher Listen. Programme/Module/Sessions liefern jeweils
  auch `beschreibung` (bei Sessions der vollständige Session-Inhalt,
  nicht nur eine Kurzbeschreibung — es gibt kein separates
  Sessiontext-Feld). Enthält auch Entwürfe (`aktiv = false`). Leere
  Felder werden explizit als `null` zurückgegeben, nicht weggelassen.
  Rein lesend — `POST`/`PATCH`/`DELETE` auf diesen Pfad antworten mit
  `405`, unabhängig vom Body. Sessions ohne `modul_id` landen in einer
  synthetischen Gruppe `{ id: null, titel: 'Kein Modul', ... }`. Jede
  Session liefert zusätzlich `material: [{ typ, dateiname, url }]` aus
  `session_material` — `url` ist eine signierte URL (1 Stunde gültig,
  der private Bucket "Programme" hat keine öffentlichen Links).
  "Impulskarten" haben kein eigenes Feld/keinen eigenen Materialtyp,
  sondern sind normale `session_material`-Einträge mit `typ = "bild"`
  und einer Titel-Konvention wie `P1_Impulskarte_01` — über `material`
  bereits mit erfasst. Optionaler Filter `?programm_id=<uuid>` reduziert
  die Antwort auf ein einzelnes Programm, falls die volle Antwort (voller
  Sessiontext + Materialien für alle Programme, aktuell ca. 400 KB) zu
  groß wird. **Nur bei dieser einen Resource** wird das Secret
  zusätzlich als Query-Parameter akzeptiert
  (`?resource=lesen&secret=<Secret>`), für Tools wie Copilot Studio, die
  keinen Custom-Header setzen können — der Header bleibt der primäre,
  empfohlene Weg. Bewusst nicht für die schreibenden Ressourcen
  verfügbar: ein Secret in der URL landet in Server-/Proxy-Logs und im
  Browser-Verlauf, für Lesezugriff vertretbar, für Schreibzugriff ein
  unnötiges Risiko.
- `GET /api/agent/inhalte?resource=materials` — rohe, ungefilterte
  `session_material`-Liste (`select('*')`), analog zum GET-Zweig von
  `?resource=module`/`?resource=sessions`, aber bewusst nur `GET` (auch
  hier `405` auf jede andere Methode). Für Werkzeuge, die selbst
  gruppieren wollen, statt der zusammengesetzten `?resource=lesen`-
  Antwort — siehe `export-nach-sharepoint.js`.
- `GET /api/agent/inhalte?resource=material-signed-url&pfad=<Storage-Pfad>`
  — signierte URL (1 Stunde gültig) für eine einzelne Datei im privaten
  Bucket "Programme". Für Werkzeuge, die Materialien einzeln
  herunterladen, statt der Batch-Signierung in `?resource=lesen`.

### Lokaler Komplett-Export (`export-nach-sharepoint.js`)

Einmaliges lokales Skript (kein npm-Paket nötig, Node 18+), das die
komplette Plattform (Texte, Programm-/Modulbilder, Session-Materialien)
in eine lokale Ordnerstruktur exportiert — z. B. zum Hochladen in
SharePoint. Nicht Teil der deployten App, keine Migration, kein Einfluss
auf das Vercel-Function-Limit.

```bash
# Windows (CMD)
set AGENT_CONTENT_SECRET=... && node export-nach-sharepoint.js

# Windows (PowerShell)
$env:AGENT_CONTENT_SECRET="..."; node export-nach-sharepoint.js

# macOS/Linux
AGENT_CONTENT_SECRET=... node export-nach-sharepoint.js
```

Legt `export/<Programm-Titel>/<Modul-Titel oder "Ohne Modul">/<Session-
Nummer>_<Session-Titel>/` an, mit `inhalt.md` (voller Session-Text,
Video-URL, Dauer) und den zugehörigen Materialien unter ihrem
ursprünglichen Dateinamen. Datei-/Ordnernamen werden von
Windows-inkompatiblen Zeichen bereinigt. Einzelne fehlgeschlagene
Downloads brechen den Export nicht ab, sondern erscheinen am Ende in der
Zusammenfassung.

Beispiel — neues Entwurfsprogramm anlegen:

```bash
curl -i -X POST "https://app.mrh-beratung.de/api/agent/inhalte" \
  -H "x-agent-secret: <Secret>" \
  -H "Content-Type: application/json" \
  -d '{"titel": "Neuer Kurs", "beschreibung": "Kurzbeschreibung"}'
```

`PATCH`/`DELETE` auf ein bereits veröffentlichtes Programm (bzw. dessen
Module/Sessions) antworten mit `409` statt die Freigabe zu umgehen.

### Review-Interface für Agent-Entwürfe

Admin-Seite **Agent-Entwürfe** (`src/admin/AdminEntwuerfePage.jsx`,
`api/admin/programme.js?resource=entwuerfe`), die alle noch nicht
freigegebenen Programm-Entwürfe (`aktiv = false`) verschachtelt mit
ihren Modulen/Sessions auflistet:

- **Vorher/Nachher-Diff:** jede PATCH-Änderung des Agenten an einem
  Entwurf wird in `entwurf_historie` protokolliert (siehe
  `supabase_migrations/entwurf_historie.sql`, **manuell im Supabase SQL
  Editor ausführen**) und im Review-Interface je geändertem Feld als
  "alter Wert → neuer Wert" angezeigt. Brandneue, noch nie bearbeitete
  Entwürfe zeigen naturgemäß keinen Verlauf.
- **Freigeben:** veröffentlicht das komplette Programm (`aktiv = true`),
  identisch zum bestehenden "Aktivieren"-Button unter **Programme** --
  kein separater Freigabe-Mechanismus, dieselbe RLS-/Sichtbarkeitslogik.
- **Ablehnen:** verwirft den kompletten Entwurf inklusive aller Module
  und Sessions unwiderruflich. Nutzt denselben `DELETE`-Endpunkt wie das
  Löschen unter **Programme**, der für noch nie veröffentlichte Entwürfe
  (`aktiv = false`) kaskadierend löscht -- der bestehende
  Abhängigkeits-Schutz ("Programm hat noch X Sessions...") bleibt für
  bereits veröffentlichte Programme unverändert bestehen, er soll ein
  LIVE-Programm vor versehentlichem Löschen schützen, nicht das gezielte
  Verwerfen eines Entwurfs erschweren.

Zusätzlich verwaltet dieselbe Route eine FAQ-Wissensbasis für den unten
beschriebenen FAQ-Chat: `GET/POST/PATCH/DELETE
/api/agent/inhalte?resource=faq` (Felder: `frage`, `antwort`,
`reihenfolge`), gleiches Entwurfs-Muster wie Programme — neue Einträge
landen immer mit `aktiv = false`, `PATCH`/`DELETE` auf bereits
freigegebene Einträge antworten mit `409`.

## FAQ-Chat für Coachies

Chat-Widget im Coachie-Bereich (`src/components/FaqChatWidget.jsx`,
eingebunden in `CoachieLayout`), das Fragen ausschließlich auf Basis
einer festen, admin- bzw. agent-gepflegten FAQ-Wissensbasis beantwortet
(`faq_eintraege`, siehe `supabase_migrations/faq.sql`). Serverseitig
untergebracht in `api/certificate.js?resource=faq-chat` (POST,
coachie-authentifiziert über denselben `requireCoachie`-Mechanismus wie
der Zertifikat-Download) statt einer eigenen Function-Datei — Vercel
Hobby war zum Zeitpunkt der Umsetzung bei 12 von 12 Functions.

**FernUSG-Abgrenzung:** Der Chat darf sich laut Aufgabenstellung nicht
auf individuelle Eingaben/Abgaben eines Coachies zu dessen persönlichem
Lernfortschritt beziehen und keine personalisierte Rückmeldung dazu
geben. Deshalb bekommt der System-Prompt ausschließlich die aktiven
FAQ-Einträge als Kontext — niemals `coachie_status`, Testergebnisse oder
sonstige individuelle Fortschrittsdaten — und wird explizit angewiesen,
Fragen zum persönlichen Fortschritt höflich abzulehnen statt zu
beantworten.

**Admin-Pflege:** `src/admin/AdminFaqPage.jsx` (**FAQ-Chat** im
Admin-Menü) — Anlegen/Bearbeiten/Löschen sowie Freigabe von
Agent-Entwürfen (`aktiv = false → true`), analog zu Testimonials.

**Modell:** `claude-opus-5` über das offizielle `@anthropic-ai/sdk`
(nicht ein günstigeres Modell) — Standardvorgabe für neue
Claude-API-Integrationen in diesem Projekt.

**Einrichtung:** `ANTHROPIC_API_KEY` (Server-only) in Vercel eintragen.
Kann derselbe Key sein, der bereits in einem anderen Projekt für die
Anthropic-API hinterlegt ist — dieses Projekt liest ihn nur aus seiner
eigenen Umgebungsvariable, es besteht keine Abhängigkeit zwischen den
Projekten.

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
  _lib/          adminAuth (HMAC-Token), agentAuth (Secret-Header für den
                 Produktagenten), supabaseAdmin (service_role Client),
                 stripeClient (Stripe-SDK-Singleton), mailer (SMTP-Versand
                 für die Erinnerungsautomation)
  admin/         Serverless Functions für Programme, Sessions (+Materialien
                 via ?resource=materials, +Module via ?resource=module),
                 Coachies (+Zuordnungen via ?resource=assignments,
                 +Einladung erneut senden via ?resource=resend),
                 Testergebnisse (+Suche via ?resource=suche), Fortschritt,
                 Login
  agent/         Secret-geschützte Route für den Produktagenten
                 (inhalte.js, Programme + ?resource=module/sessions/lesen/
                 materials/material-signed-url), siehe README-Abschnitt
                 "Produktagent"
  checkout.js    Öffentliche Kaufseite: GET Programm-Vorschau, POST Stripe
                 Checkout Session
  cron/          Tägliche Erinnerungsautomation bei Inaktivität
                 (erinnerungen.js, per Vercel Cron ausgelöst)
  webhooks/      Stripe-Webhook (Signaturprüfung, Idempotenz)
profil-quiz-edge-function/
                 Separates Deployment-Ziel (NICHT Teil der Coaching-
                 Plattform-App) -- Edge Function fürs Profil-Quiz-Projekt,
                 siehe README-Abschnitt "Testergebnisse"
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
  (Programm-Zuordnungen), `?resource=empfehlungen` (rein lesend,
  Empfehlungsprogramm-Übersicht), `?resource=mitgliedschaften` (rein
  lesend, Mitgliedschafts-Übersicht, siehe README-Abschnitt
  "Mitgliederbereich").
- `api/admin/sessions.js` — Standard (Sessions), `?resource=materials`
  (Session-Materialien), `?resource=module` (Modul-Ebene).
- `api/admin/testergebnisse.js` — Standard (Verknüpfen/Liste),
  `?resource=suche` (Profil-Quiz-Suche).
- `api/agent/inhalte.js` — Standard (Programme), `?resource=module`,
  `?resource=sessions`, `?resource=lesen` (rein lesend, verschachtelter
  Gesamtstand), `?resource=materials` (rein lesend, rohe Liste),
  `?resource=material-signed-url` (rein lesend, einzelne signierte URL),
  `?resource=faq` (FAQ-Entwürfe für den Coachie-Chat)
  (Produktagent, siehe README-Abschnitt
  "Produktagent").
- `api/admin/programme.js` — Standard (Programme), `?resource=testimonials`,
  `?resource=entwuerfe` (rein lesend, Review-Interface für
  Agent-Entwürfe, siehe README-Abschnitt "Review-Interface für
  Agent-Entwürfe"), `?resource=faq` (FAQ-Pflege für den Coachie-Chat),
  `?resource=events` (Admin-CRUD für den Events-Kalender, siehe
  README-Abschnitt "Events-Kalender"),
  `?resource=mitgliedschaft-einstellungen` (Preis/Bezahltext),
  `?resource=mitglieder-inhalte` (Admin-CRUD),
  `?resource=mitglieder-datei-upload` (Signed-Upload-URL) — die letzten
  drei für den Mitgliederbereich, siehe README-Abschnitt
  "Mitgliederbereich".
- `api/certificate.js` — Standard/GET (PDF-Zertifikat), `?resource=faq-chat`
  (POST, FAQ-Chat für Coachies, siehe README-Abschnitt "FAQ-Chat für
  Coachies"), `?resource=empfehlung` (GET, persönlicher Empfehlungscode
  für den eingeloggten Coachie), `?resource=peer-interesse` (POST,
  "Interesse zeigen" in der Peer Group, siehe README-Abschnitt "Peer
  Group"), `?resource=rechnungen` (GET, Rechnungshistorie von Stripe,
  siehe README-Abschnitt "Rechnungs-Download im Coachie-Bereich").
- `api/checkout.js` — GET (öffentliche Programm-Vorschau, vormals
  `api/public/programme.js`), POST (Stripe Checkout Session, jetzt mit
  optionalem `ref`-Empfehlungscode), `?resource=mitgliedschaft` (GET
  öffentliche Preis-/Textvorschau, POST Subscription-Checkout-Session
  für die Mitgliedschaft, siehe README-Abschnitt "Mitgliederbereich").

Ergebnis: 12 Functions (`admin/coachies.js`, `admin/login.js`,
`admin/programme.js`, `admin/progress.js`, `admin/sessions.js`,
`admin/testergebnisse.js`, `agent/inhalte.js`, `certificate.js`,
`checkout.js`, `cron/erinnerungen.js`, `webhooks/calendly.js`,
`webhooks/stripe.js`) — exakt am Hobby-Limit von 12, jeder weitere
Endpunkt muss über eine bestehende Datei laufen.

## Erinnerungsautomation bei Inaktivität

Täglicher Vercel-Cron-Job (`vercel.json`, `0 6 * * *` UTC), der
`api/cron/erinnerungen.js` aufruft. Vercel Cron ist auf dem Hobby-Plan mit
maximal einer Ausführung pro Tag je Job nutzbar -- das deckt sich exakt mit
der hier benötigten täglichen Prüfung, eine alternative Auslösung (z. B. bei
jedem Admin-Login) ist daher nicht nötig.

Prüft je Coachie, ob ein zugeordnetes, aktives Programm begonnen, aber noch
nicht abgeschlossen ist und seit mindestens 7 Tagen keine Status-Änderung
hatte. Verschickt in diesem Fall maximal eine Erinnerungsmail pro Coachie
pro 7-Tage-Fenster (Feld `coachie_status.erinnerung_gesendet_am`) mit
Programmname, Name der zuletzt bearbeiteten Session und Link zurück zur
Plattform.

Der Versand läuft über einen eigenen SMTP-Client (`api/_lib/mailer.js`,
`nodemailer`) und **nicht** über die Supabase-Auth-Mails (Einladung/
Passwort-Reset) -- deren feste Vorlagen erlauben keinen individuellen
Inhalt. Dafür server-only in allen drei Umgebungen (Production/Preview/
Development) zu setzen, siehe `.env.example`:

- `CRON_SECRET` -- schützt die Route; Vercel schickt automatisch
  `Authorization: Bearer $CRON_SECRET` bei jedem Cron-Aufruf.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` --
  All-Inkl-Postfachzugang für `info@mrh-beratung.de`.

## Empfehlungsprogramm (technische Grundstruktur)

Jeder Coachie bekommt einen persönlichen Empfehlungscode; erfolgreiche
(abgeschlossene) Käufe über diesen Code erscheinen im Admin-Bereich unter
**Empfehlungen**. **Belohnungslogik (Rabatt, Guthaben o. Ä.) ist bewusst
nicht Teil dieser Umsetzung** -- das ist laut Aufgabenstellung eine
eigenständige, spätere Entscheidung. Ein Vorschlag dazu:

> **Vorschlag zur Belohnungslogik** (zur Entscheidung, nicht umgesetzt):
> ein Startguthaben-Modell -- z. B. 20 € Gutschrift für den Werber nach
> jeder erfolgreichen Empfehlung, einlösbar beim nächsten Kauf über einen
> Stripe-Gutschein-Code (`stripe.coupons`). Vorteil gegenüber einem festen
> Rabatt für den Geworbenen: verschiebt keinen bereits kalkulierten
> Verkaufspreis, sondern ist ein separat buchbarer Bonus, und lässt sich
> ohne Schema-Änderung nachrüsten (`empfehlungen` hat bereits alle nötigen
> Zeilen, nur ein `eingeloest`/`gutschrift_cent`-Feld müsste ergänzt
> werden). Alternativen wären ein Rabatt für beide Seiten (Werber + neuer
> Coachie) oder ein Freischalt-Bonus (z. B. ein zusätzliches 1:1-Kontingent).

### Funktionsweise

- **Code:** `coachies.empfehlungscode`, lazy vergeben beim ersten Aufruf
  von `api/certificate.js?resource=empfehlung` (nicht beim Anlegen des
  Coachies) -- deckt so auch bereits bestehende Coachies ab, ohne
  Backfill-Migration. Sichtbar unter **Einstellungen** im Coachie-Bereich,
  zusammen mit einem fertigen Beispiellink (`/kaufen/<slug>?ref=<Code>`)
  zum Kopieren, sowie einer Liste der eigenen erfolgreichen Empfehlungen
  (`empfehlungen` gefiltert auf `werber_coachie_id`, derselbe Endpunkt).
- **Zuordnung:** `KaufenPage.jsx` merkt `?ref=` in `sessionStorage` und
  schickt es beim Checkout mit. `api/checkout.js` löst den Code zu einer
  `werber_coachie_id` auf und legt sie in die Stripe-Session-Metadaten --
  ein unbekannter/ungültiger Code blockiert den Kauf nicht, er wird
  einfach nicht zugeordnet.
- **Tracking:** `api/webhooks/stripe.js` trägt bei `checkout.session.completed`
  eine Zeile in `empfehlungen` ein, sofern eine `werber_coachie_id` in den
  Metadaten steckt und sie nicht mit dem kaufenden Coachie identisch ist
  (kein Selbst-Verweis). `unique(geworbener_coachie_id, programm_id)` macht
  das idempotent gegen Stripe-Retry-Zustellungen.
- **Admin-Übersicht:** `api/admin/coachies.js?resource=empfehlungen` +
  `src/admin/AdminEmpfehlungenPage.jsx` -- Liste aller erfolgreichen
  Empfehlungen mit Rangliste je Werber.

`supabase_migrations/empfehlungsprogramm.sql` (**manuell im Supabase SQL
Editor ausführen**) legt `coachies.empfehlungscode` sowie die Tabelle
`empfehlungen` an, rein additiv.

## Mobile-Optimierung / PWA

### Installierbare PWA

- `public/manifest.webmanifest` -- Name, Theme-/Hintergrundfarbe (Corporate
  Design), `display: standalone`, Icons in `public/icons/` (192/512px
  normal + maskable-Variante für Android-Adaptive-Icons, 180px für
  `apple-touch-icon`). Im Corporate Design generiert (Navy-Hintergrund,
  goldenes "M").
- `public/sw.js` -- Service Worker, in `src/main.jsx` nur in Produktion
  registriert (`import.meta.env.PROD`), damit `npm run dev`/HMR nicht
  durch gecachte Antworten gestört wird. Bewusst **kein** Precache-
  Manifest (Vite-Bundle-Dateinamen sind pro Build gehasht) -- stattdessen
  Laufzeit-Caching: Navigationen network-first mit Cache-Fallback,
  statische Assets stale-while-revalidate. `/api/*` wird nie
  abgefangen/gecacht -- die Antworten sind dynamisch und teils
  personenbezogen, Caching wäre auf einem geteilten Gerät ein
  Datenleck-Risiko.
- `index.html` verlinkt Manifest, `theme-color` und `apple-touch-icon`.

Installierbar über den Browser (Chrome/Edge: Adressleisten-Icon oder
Menü "App installieren", iOS Safari: "Zum Home-Bildschirm").

### Responsive Pass

Der Coachie-Bereich hatte bereits eine mobile Navigation
(`CoachieLayout.jsx`, Hamburger-Menü). Für diesen Durchgang identifiziert
und behoben: mehrere dichte Aktions-Zeilen im **Admin**-Bereich, die auf
schmalen Bildschirmen (< 640px) über den Viewport hinaus liefen, weil
mehrere Buttons/Links in einer nicht umbrechenden `flex`-Zeile
nebeneinanderstanden:

- `AdminProgrammePage.jsx` (Programm-Kartenkopf: "Sessions verwalten" /
  "Verkauf einrichten" / "Aktivieren" / "Löschen")
- `AdminCoachiesPage.jsx` (Coachie-Kartenkopf: "Testergebnisse
  verknüpfen" / "Einladung erneut senden" / "Passwort-Reset senden" /
  "Löschen")
- `AdminProgramDetailPage.jsx` (Session-Kartenkopf: ↑/↓/"Bearbeiten"/
  "Materialien"/"Löschen")
- `MaterialManager.jsx` (Material-Zeile, zusätzlich `break-words` für
  lange Material-Titel)
- `AdminProgressPage.jsx` ("Abschlussquote pro Session": Titel + Balken +
  zwei Kennzahlen liefen mit festen Pixelbreiten unweigerlich über)

Durchgängiges Muster: `flex-col` (gestapelt) auf Mobile, `sm:flex-row`
(nebeneinander) ab 640px -- identisch zum bereits etablierten
Tailwind-Breakpoint-Ansatz im Rest der App, keine neue Konvention. Bei
900px Fensterbreite können die Aktions-Zeilen noch umbrechen (zwei
Zeilen statt einer) -- immer noch besser als der vorherige harte
Überlauf, und beim eigentlichen Ziel-Breakpoint dieser App
(`max-w-6xl`/1152px Content-Breite) passt wieder alles in eine Zeile.

Verifiziert per Playwright-Screenshot eines statischen Mockups mit den
identischen Tailwind-Klassen bei 375px (kein horizontaler Overflow) und
1200px (identisch zur vorherigen einzeiligen Darstellung) -- ein
Live-Login war in der Sandbox mangels Supabase-Zugangsdaten nicht
möglich, siehe Hinweis im zugehörigen PR.

## Automatisierte Rechnungsstellung über Lexware Office (Konzept, noch nicht umgesetzt)

**Blocker:** Die Lexware Office Public API steht erst ab **Tarif XL**
zur Verfügung -- der ist aktuell nicht gebucht. Dieser Abschnitt ist
daher bewusst reine Vorbereitung (Doku-Sichtung + Integrationskonzept),
**kein Code wurde geschrieben**. Sobald der Tarif gebucht und ein
`LEXWARE_API_KEY` vorhanden ist, kann die Integration umgesetzt werden --
bis dahin bitte nicht ohne Rückfrage anfassen.

### API-Eckdaten (Stand dieser Recherche, vor Implementierung erneut verifizieren)

Direkter Zugriff auf `developers.lexware.io`/`help.lexware.de` war aus
dieser Sandbox heraus nicht möglich (vom Netzwerk-Egress-Proxy
blockiert) -- die folgenden Punkte stammen aus Websuche-Treffern
(u. a. offizielle Lexware-Partnerseiten, Hilfe-Center-Artikel,
Drittanbieter-Integrationsguides), nicht aus der Originaldokumentation
selbst:

- **Voraussetzung:** Tarif XL (bestätigt den vom Auftrag genannten
  Blocker).
- **Base-URL:** `https://api.lexware.io` (Stand Recherche; die API hieß
  früher `lexoffice`, `api.lexoffice.io` galt bis zum Rebranding im Mai
  2025 -- unbedingt vor Implementierung erneut prüfen, welche Domain
  aktuell gültig ist).
- **Auth:** statischer API-Key als `Authorization: Bearer <Key>`-Header,
  erzeugt in der Lexware-Oberfläche unter Einstellungen → Öffentliche
  API. Kein OAuth-Flow.
- **Rate-Limit:** rund 2 Requests/Sekunde pro Client (Drittquelle,
  Größenordnung vor Implementierung verifizieren).
- **Rechnung erstellen:** `POST /v1/invoices` -- landet standardmäßig
  als Entwurf, ein Parameter kann die Rechnung direkt als "offen"/
  finalisiert anlegen.
- **Kontakt anlegen/finden:** `POST /v1/contacts` (Rollen wie `customer`,
  Name/E-Mail als Body). Ob es einen dokumentierten Weg gibt, einen
  bestehenden Kontakt gezielt per E-Mail zu finden statt Duplikate
  anzulegen, ließ sich aus der Sandbox nicht abschließend klären --
  vor Implementierung in der echten Doku nachschlagen.
- **Voraussetzung für rechtsgültige Rechnungen:** Firmendaten (Name,
  Adresse) müssen vorher einmalig in den Lexware-Office-Einstellungen
  hinterlegt sein.

### Integrationskonzept (Skizze)

- **Auslöser:** der bereits bestehende Stripe-Webhook
  (`api/webhooks/stripe.js`, `checkout.session.completed`) -- der Moment
  des Kaufabschlusses ist ohnehin schon der richtige Zeitpunkt, kein
  neuer Cron-Job oder Trigger nötig.
- **Ablauf (Vorschlag):**
  1. Lexware-Kontakt für die Käufer-E-Mail suchen bzw. anlegen.
  2. Rechnung mit dem gekauften Programm als Position erstellen
     (Betrag aus `programme.preis_cent`, ggf. `einfuehrungspreis_cent`
     falls zum Kaufzeitpunkt aktiv).
  3. Rechnung zunächst als **Entwurf** anlegen, nicht direkt
     finalisieren -- Marcel behält die Kontrolle, bis Vertrauen in die
     Automatisierung besteht; Umstellung auf automatische Finalisierung
     wäre später eine reine Konfigurationsänderung.
- **Function-Budget:** würde in die bestehende Datei
  `api/webhooks/stripe.js` eingebaut, keine 13. Function nötig (aktuell
  12/12 belegt).
- **Neue Umgebungsvariable:** `LEXWARE_API_KEY` (server-only).
- **Fehlerbehandlung:** analog zum bereits bestehenden
  Empfehlungsprogramm-Tracking im selben Webhook -- ein Fehler bei der
  Rechnungserstellung darf den Kauf/die Programmfreischaltung nicht
  blockieren (best-effort, mit Logging).

### Offene Fragen (zur Klärung, sobald der Tarif gebucht ist)

- Rechnung automatisch finalisieren, oder erstmal als Entwurf zur
  manuellen Prüfung durch Marcel?
- Soll Lexware die Rechnung direkt per E-Mail an den Kunden verschicken,
  oder bleibt das intern für die Buchhaltung?
- Für jeden Kauf automatisch eine Rechnung, oder nur ab einer bestimmten
  Preisschwelle / für bestimmte Programme?
- Kleinunternehmerregelung (§19 UStG) oder Regelbesteuerung -- relevant
  für den Steuerausweis auf der Rechnung?

Sobald diese Fragen geklärt und `LEXWARE_API_KEY` in Vercel hinterlegt
sind, ist die eigentliche Implementierung ein überschaubarer,
eigenständiger PR.

## Fortschritts-Badges (privat, kein Leaderboard)

Bewusst kein öffentliches Ranking zwischen Coachies -- private
Meilensteine, die ausschließlich der jeweilige Coachie selbst sieht
(auch nicht innerhalb der Peer Group). Neue Seite
`src/pages/MeilensteinePage.jsx` (`/coachie/meilensteine`, neuer
Nav-Eintrag "Meilensteine").

**Bewusst keine neue Migration/Tabelle.** Die Meilensteine werden rein
clientseitig aus bereits vorhandenen Daten abgeleitet
(`coachie_programme`, `module`, `sessions`, `coachie_status`) --
`berechneMeilensteine()` (reine, isoliert getestete Funktion am Anfang
der Datei) erzeugt daraus:

- "Modul '…' abgeschlossen", sobald alle Sessions eines Moduls den
  Status `abgeschlossen` haben.
- "Halbzeit bei '…' (50 %)" bzw. "'…' abgeschlossen" anhand des
  Gesamtfortschritts eines Programms.

Das "Datum" je Meilenstein ist eine Näherung: der späteste
`aktualisiert_am`-Zeitpunkt der beteiligten `coachie_status`-Zeilen, da
kein exakter Erreichungs-Zeitpunkt je Schwelle gespeichert wird.

**Privatsphäre:** Da `coachie_status` per RLS ohnehin nur die eigenen
Zeilen liefert (`coachie_id = auth.uid()`), ist diese Seite bereits
durch die bestehende RLS korrekt abgeschottet -- keine neue
Policy/Migration nötig, keine Sichtbarkeit für andere Coachies.

## Automatisierte Onboarding-Sequenz

Kurzes, geführtes Overlay (`src/components/OnboardingTour.jsx`) direkt
nach dem allerersten Login, das auf die wichtigsten Bereiche hinweist:
aktuelles Programm, Fortschrittsübersicht ("Meine Auswertungen"),
FAQ-Chat, Lesezeichen-Funktion.

**Bewusst keine neue Migration.** Das "einmalig automatisch zeigen"
nutzt das bereits bestehende `erster_login_am`/`istErsterLogin` aus
`AuthContext.jsx` (Feature "Aktives Onboarding nach Login", Phase 1) --
`CoachieLayout.jsx` erfasst dessen Wert per Lazy-Initializer einmalig
beim Mount (`useState(() => istErsterLogin)`). Nötig, weil
`CoachieDashboardPage.jsx` denselben Flag in einem eigenen Effekt kurz
danach konsumiert und auf `false` zurücksetzt -- ohne den
Lazy-Initializer würde das Tour-Overlay dadurch sofort wieder
verschwinden, statt einmal vollständig durchlaufen zu werden.

**Erneuter Aufruf:** "Rundgang"-Button im Header (`CoachieLayout.jsx`)
öffnet die Tour jederzeit erneut -- rein clientseitiger State, keine
Persistenz nötig.

## Events-Kalender

Kalender-Bereich im Coachie-Bereich für Live-Calls, Webinare oder
Gruppentermine. Neue, additive Tabelle `events`
(`supabase_migrations/events.sql`): Titel, Beschreibung,
Start-/Endzeitpunkt, optionaler Link (z. B. zu einem Videocall) und
optionale `programm_id`.

- `programm_id = NULL` → Termin ist **plattformweit** für alle
  eingeloggten Coachies sichtbar.
- `programm_id` gesetzt → Termin ist nur für Coachies mit einer
  Zuordnung zu diesem Programm sichtbar (`coachie_programme`).

**Admin-Pflege:** `src/admin/AdminEventsPage.jsx` (**Events** im
Admin-Menü, neue Gruppe "Community") — Anlegen/Bearbeiten/Löschen,
läuft über `api/admin/programme.js?resource=events` (`service_role`,
kein neuer Function-Endpunkt).

**Coachie-Ansicht:** `src/pages/EventsPage.jsx`
(`/coachie/termine`, neuer Nav-Eintrag "Termine") — zeigt nur
zukünftige Termine, sortiert nach Startzeitpunkt. Liest die Liste
direkt über den Supabase-Client mit RLS (analog zu
Testimonials/Lesezeichen), ganz ohne eigenen Endpunkt: Die Policy in
`events.sql` filtert serverseitig bereits auf eigene Programme oder
plattformweite Termine.

## Peer Group (Opt-in, reziprok)

Kein offener Community-Feed, sondern eine reziproke Opt-in-Sichtbarkeit
für Coachies, die gezielt andere Coachies auf ähnlichem Weg finden
wollen. Neue Seite `src/pages/PeerGroupPage.jsx`
(`/coachie/peer-group`, eigener Nav-Eintrag in `CoachieLayout.jsx`).

**Schema:** `supabase_migrations/peer_group.sql` — zwei neue, additive
Tabellen:

- `peer_profile` (1:1 zu `coachies`, aber **bewusst getrennt** davon):
  `sichtbar` (Schalter, Default `false`), `vorname`, `branche_rolle`,
  `kurztext`. Getrennt von `coachies`, damit eine Sichtbarkeits-Policy
  für andere Coachies niemals `coachies.email` oder andere sensible
  Felder der Zeile mit ausliefert — exakt die im Auftrag geforderte
  Grenze ("keine E-Mail-Adresse ... sichtbar").
- `peer_interesse` — Protokoll ausgelöster "Interesse
  zeigen"-Benachrichtigungen, dient serverseitig der Sperrfrist (14
  Tage pro Zielperson) und dem UI-Status "Interesse bereits gezeigt".

**RLS (hart durchgesetzt, siehe Migration):**

- Eigene Zeile immer lesbar/schreibbar (`coachie_id = auth.uid()`).
- Fremde Zeilen nur sichtbar, wenn **alle drei** Bedingungen gelten:
  Zielzeile `sichtbar = true`, die eigene Zeile ebenfalls
  `sichtbar = true` (reziprok — wer den Schalter deaktiviert hat, sieht
  selbst auch keine Übersicht), und beide sind laut `coachie_programme`
  im selben Programm eingeschrieben (keine Sicht über Programmgrenzen
  hinweg).
- `peer_interesse` ist nur für die eigenen, selbst ausgelösten
  Einträge lesbar (`von_coachie_id = auth.uid()`) — eingehende
  Kontaktaufnahmen sind darüber nicht einsehbar, das läuft
  ausschließlich per E-Mail.

**"Interesse zeigen":** Direkter Profil-Zugriff (Vorname, Kurzprofil)
läuft über den Supabase-Client mit obiger RLS, ganz ohne eigenen
Endpunkt. Nur der Mailversand braucht `service_role` (Zugriff auf
`coachies.email`) und ist deshalb in
`api/certificate.js?resource=peer-interesse` (POST) untergebracht —
kein neuer Function-Endpunkt, Vercel Hobby war zum Zeitpunkt der
Umsetzung bei 12 von 12 Functions. Der Endpunkt prüft dieselben drei
Bedingungen (reziprokes Opt-in + gemeinsames Programm) serverseitig
noch einmal explizit nach, da RLS nur für den anon/authenticated-Weg
gilt, nicht für `getSupabaseAdmin()`. Die E-Mail an den Zielcoachie
enthält den Vornamen des Absenders und setzt `Reply-To` auf dessen
E-Mail-Adresse (`api/_lib/mailer.js` um `replyTo` erweitert) — der
Zielcoachie kann direkt antworten, ohne dass Kontaktdaten je im UI
angezeigt werden. Wiederholtes "Interesse zeigen" an dieselbe Person
innerhalb von 14 Tagen löst keine erneute E-Mail aus
(`peer_interesse`-Sperrfrist).

## Mitgliederbereich (Community-Abo)

Eigenständiges, wiederkehrendes Community-Abo (Stripe Subscription),
unabhängig von jedem Kurskauf -- ein Coachie kann Mitglied sein, ohne
je ein Programm gekauft zu haben, und umgekehrt.

**Schema:** `supabase_migrations/mitgliederbereich.sql` -- additiv, mit
einer Ausnahme (siehe unten):

- `mitgliedschaften`: `coachie_id` (unique), `status`
  (`aktiv`/`gekuendigt`/`zahlung_fehlgeschlagen`),
  `stripe_subscription_id`, `start_datum`, `naechste_abrechnung`.
  Status wird ausschließlich über den Stripe-Webhook gepflegt, nie
  direkt vom Client (nur eine SELECT-Policy für die eigene Zeile).
- `mitglieder_inhalte`: `typ`
  (`kpi_handbuch`/`audio`/`tipp`/`sonstiges`), `titel`, `beschreibung`,
  `datei_url` oder `link_url`, `veroeffentlicht_am`, `aktiv`. Nur bei
  `mitgliedschaften.status = 'aktiv'` sichtbar (RLS). "Live-Sitzung" ist
  bewusst **kein** eigener Typ hier, sondern ein `nur_mitglieder`-Termin
  im Events-Kalender (nächster Punkt) -- vermeidet eine zweite
  Terminverwaltung, wie im Auftrag gefordert.
- `mitgliedschaft_einstellungen`: Singleton-Zeile (Preis, Stripe Price
  ID, Titel/Beschreibung/Bezahltext) -- **Preis und Bezahltext sind
  admin-konfigurierbar statt hart codiert**, analog zu
  `programme.preis_cent`. RLS aktiv, aber ohne Policies (nur
  `service_role`/Admin und der öffentliche Vorschau-Endpunkt lesen sie,
  siehe unten).
- Privater Storage-Bucket `mitglieder-inhalte` (20 MB Limit, PDF/MP3/
  WAV/JPG/PNG) mit eigener Storage-Policy (aktive Mitgliedschaft statt
  `coachie_programme`) -- bewusst ein eigener Bucket statt eines
  weiteren Sonderfalls in der bestehenden `Programme`-Bucket-Policy.

**Die eine Ausnahme -- bestehende Policy ersetzt:** Die Events-Select-
Policy aus `events.sql` wird um eine `nur_mitglieder`-Bedingung
ergänzt (`events.nur_mitglieder boolean default false`, neue Spalte).
Admin kann beim Anlegen eines Termins "nur für Mitglieder" wählen; die
Filterung läuft serverseitig über RLS, nicht nur im Frontend
ausgeblendet -- exakt wie im Auftrag gefordert. Coachie-seitig ändert
sich sonst nichts: `EventsPage.jsx` zeigt zusätzlich ein
"Mitglieder"-Badge, blendet aber nichts eigenständig aus (die Zeile
kommt von der DB schlicht nicht zurück, wenn nicht berechtigt).

**Stripe-Abo-Anbindung:** `api/checkout.js?resource=mitgliedschaft` --
GET liefert die öffentliche Preis-/Textvorschau (Verkaufsseite), POST
erstellt eine Checkout-Session mit `mode: 'subscription'` (statt
`'payment'` beim Kurskauf). `api/webhooks/stripe.js` erkennt
Mitgliedschafts-Checkouts über `session.mode === 'subscription'` (kein
`programm_id` in den Metadaten) und legt die `mitgliedschaften`-Zeile
an; die Coachie-Anlage/Einladung teilt sich denselben, dafür
extrahierten Code-Pfad (`findeOderErstelleCoachie()`) mit dem
bestehenden Kurs-Kauf-Flow. Lifecycle-Events
(`customer.subscription.updated`/`.deleted`, `invoice.payment_failed`)
aktualisieren `status`/`naechste_abrechnung` der bestehenden Zeile.
Bei `zahlung_fehlgeschlagen`/`gekuendigt` verliert der Coachie
automatisch den Zugriff auf die Mitglieder-Inhalte/-Termine (RLS
greift sofort) -- der sonstige Kurszugriff (`coachie_programme`) bleibt
komplett unberührt, andere Tabelle.

**Nicht in dieser Sandbox gegen einen echten Stripe-Account
verifiziert:** Das Auslesen des Abrechnungszeitraums
(`ermittleNaechsteAbrechnung()` in `api/webhooks/stripe.js`) ist wegen
einer Stripe-API-Umstellung (`current_period_end` wanderte von der
Subscription auf die Subscription-Items) defensiv mit Fallback
geschrieben -- vor dem ersten Live-Abo einmal gegen die tatsächlich
verwendete Stripe-API-Version prüfen.

**Admin-Pflege:**

- `src/admin/AdminMitgliedschaftPage.jsx` (**Mitgliedschaft** im
  Admin-Menü) -- Preis/Stripe-Price-ID/Bezahltext-Einstellungen plus
  rein lesende Mitgliederübersicht
  (`api/admin/coachies.js?resource=mitgliedschaften`).
- `src/admin/AdminMitgliederInhaltePage.jsx` (**Mitglieder-Inhalte**)
  -- CRUD, Datei-Upload analog zum bestehenden Material-Upload-Muster
  (`MitgliederDateiUpload.jsx`, Signed-Upload-URL über
  `?resource=mitglieder-datei-upload`) oder alternativ ein externer
  Link.
- `src/admin/AdminEventsPage.jsx` -- neue Checkbox "Nur für Mitglieder"
  beim Anlegen/Bearbeiten eines Termins.

**Coachie-Seite:**

- `src/pages/MitgliederBereichPage.jsx` (`/coachie/mitgliederbereich`,
  neuer Nav-Eintrag) -- bei aktiver Mitgliedschaft die nach Datum
  sortierte Inhaltsliste (Dateien über eine on-demand angeforderte
  Signed URL, `getSignedMitgliederDateiUrl()`), sonst ein kompakter
  Upsell-Hinweis auf derselben Seite statt eines Fehlers.
- `src/pages/MitgliedschaftPage.jsx` (`/mitgliedschaft`, öffentlich,
  auch ohne Login/Kurskauf erreichbar) -- eigenständige Verkaufsseite,
  analog zu `KaufenPage.jsx`, aber ohne `:slug` (ein einzelnes Produkt
  statt vieler Programme).
- `src/components/MitgliedschaftHinweis.jsx` -- dezenter Hinweis für
  Nicht-Mitglieder im Coachie-Dashboard (schmale Textzeile mit Link,
  kein Banner/Modal, rendert nichts für aktive Mitglieder oder solange
  der Status noch lädt).

**Einrichtung:** `supabase_migrations/mitgliederbereich.sql` muss
manuell im Supabase SQL Editor laufen. Zusätzlich in Stripe: Produkt +
monatlichen Preis anlegen (Betrag steht laut Auftrag noch nicht fest),
die Price ID danach in **Mitgliedschaft** im Admin eintragen, und im
Stripe-Webhook-Endpunkt die drei neuen Event-Typen aktivieren
(`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.payment_failed`) -- der Endpunkt selbst ändert sich nicht
(`api/webhooks/stripe.js`), nur die dort abonnierten Event-Typen in
den Stripe-Webhook-Einstellungen.

## Rechnungs-Download im Coachie-Bereich

Keine eigene Rechnungserzeugung -- Stripe legt Rechnungen (mit PDF und
Hosted-Invoice-Link) automatisch selbst an, diese Funktion listet sie
nur auf. Neue Seite `src/pages/RechnungenPage.jsx`
(`/coachie/rechnungen`, neuer Nav-Eintrag).

**Voraussetzung: eine gespeicherte `stripe_customer_id` je Coachie.**
Bisher gab es die nur auf `mitgliedschaften` (nicht auf `coachies`
selbst), und nur Subscriptions erzeugen bei Stripe automatisch
Invoice-Objekte -- Kurskäufe (Payment-Mode-Checkout) bislang nicht.
Beides ergänzt:

- `coachies.stripe_customer_id` (neue Spalte,
  `supabase_migrations/rechnungen.sql`) -- `api/webhooks/stripe.js`
  setzt sie jetzt bei **beiden** Kauf-Flows (Mitgliedschaft und
  Kurskauf), sofern noch nicht gesetzt.
- `api/checkout.js` (Kurskauf-Zweig, `handleCheckoutSession`):
  `customer_creation: 'always'` (sonst kein zuverlässiger
  Stripe-Customer bei Payment-Mode) und `invoice_creation: { enabled:
  true }` (sonst gar kein Invoice-Objekt bei Payment-Mode) ergänzt.
  **Gilt nur für ab jetzt neu erstellte Checkout-Sessions** --
  bestehende, bereits abgeschlossene Käufe bekommen dadurch nicht
  rückwirkend eine Rechnung.

**Endpunkt:** `api/certificate.js?resource=rechnungen` (GET,
coachie-authentifiziert, kein neuer Function-Endpunkt) -- liest
`stripe.invoices.list({ customer: coachie.stripe_customer_id })` und
liefert Nummer, Datum, Betrag, Status sowie `hosted_invoice_url`/
`invoice_pdf` direkt von Stripe durch. Ohne gespeicherte
`stripe_customer_id` (z. B. noch nie über Stripe bezahlt) liefert der
Endpunkt eine leere Liste statt eines Fehlers.

**Migration:** `supabase_migrations/rechnungen.sql` -- eine neue
Spalte, keine neue RLS-Policy nötig (die bestehende Policy, über die
ein Coachie schon heute seine eigene `coachies`-Zeile lesen kann,
deckt die neue Spalte automatisch mit ab). Noch nicht auf der Live-DB
ausgeführt.
