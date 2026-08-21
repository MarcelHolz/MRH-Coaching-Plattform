-- ============================================================
-- ÜBERHOLT -- siehe profil_quiz_reader_v2.sql. Der hier eingerichtete
-- Zugriffsweg (Custom-Rolle + selbst gemintetes JWT) wurde durch eine
-- Edge Function ersetzt, weil die Verwaltung mehrerer HS256-Keys im
-- neuen Supabase "JWT Signing Keys"-UI nicht zuverlässig nutzbar war.
-- Diese Datei bleibt nur als Historie stehen (dokumentiert, was auf
-- dem Profil-Quiz-Projekt ursprünglich ausgeführt wurde) -- für ein
-- neues Setup bitte NICHT diese Datei, sondern profil_quiz_reader_v2.sql
-- verwenden.
--
-- ACHTUNG: Diese Datei gehört NICHT zur Coaching-Plattform-Datenbank.
-- Im SQL Editor des ANDEREN Supabase-Projekts ausführen:
-- "Profil-Quiz" (rbfsfcetdzdsyoffglwi, Region eu-west-1).
--
-- Zweck: ein eng begrenzter, lesender Zugriffsweg für die
-- Coaching-Plattform, ohne den vollen service_role Key des
-- Profil-Quiz-Projekts zu teilen. Kein Tabellenzugriff wird gewährt --
-- nur EXECUTE auf zwei schmale Funktionen, die jeweils exakt die für
-- die Verknüpfung nötigen Felder zurückgeben.
--
-- Geprüft gegen den aktuellen Live-Stand von quiz_ergebnisse und
-- kurztest_gross_ergebnisse (read-only via Supabase MCP), Stand
-- 21.08.2026. Rein additiv -- keine bestehende Tabelle/Policy wird
-- verändert.
-- ============================================================

-- 1. Dedizierte Rolle für diesen einen Zugriffsweg. NOLOGIN, weil sie
--    nur über einen selbst signierten JWT mit "role"-Claim aktiviert
--    wird (PostgREST schaltet dafür intern in diese Rolle), nicht über
--    ein Passwort. GRANT ... TO authenticator ist der Schritt, der
--    PostgREST erlaubt, überhaupt in diese Rolle zu wechseln.
create role coaching_plattform_reader nologin;
grant coaching_plattform_reader to authenticator;

-- 2. Suchfunktion: liefert nur Vorschau-Felder (kein antworten/
--    block_antworten JSONB), für automatischen E-Mail-Abgleich und
--    manuelle Suche im Admin-Bereich der Coaching-Plattform. Mindestens
--    einer der beiden Parameter muss gesetzt sein, sonst leeres
--    Ergebnis (verhindert versehentliches "alles auflisten"). Die
--    beiden Parameter werden mit ODER verknüpft -- für den
--    automatischen Abgleich wird nur such_email gesetzt (exakter
--    Treffer), für die manuelle Ein-Feld-Suche übergibt das Frontend
--    denselben eingegebenen Text in beide Parameter.
create or replace function public.testergebnisse_suchen(
  such_email text default null,
  such_name text default null
)
returns table (
  id uuid,
  test_typ text,
  name text,
  email text,
  erstellt_am timestamptz,
  hauptausprägung text,
  ist_mischtyp boolean,
  zweittyp text,
  punkte_dominant integer,
  punkte_kreativ integer,
  punkte_sachlich integer,
  punkte_harmonisch integer
)
language sql
security definer
set search_path = public
as $$
  select
    q.id, 'kurztest_24'::text as test_typ, q.kunde_name as name, q.kunde_email as email,
    q.erstellt_am, q.hauptausprägung, q.ist_mischtyp, q.zweittyp,
    q.punkte_dominant, q.punkte_kreativ, q.punkte_sachlich, q.punkte_harmonisch
  from public.quiz_ergebnisse q
  where (such_email is not null or such_name is not null)
    and (
      (such_email is not null and q.kunde_email ilike '%' || such_email || '%')
      or (such_name is not null and q.kunde_name ilike '%' || such_name || '%')
    )

  union all

  select
    k.id, 'vorbereitung_12'::text as test_typ, k.name, k.email,
    k.erstellt_am, k.hauptausprägung, k.ist_mischtyp, k.zweittyp,
    k.punkte_dominant, k.punkte_kreativ, k.punkte_sachlich, k.punkte_harmonisch
  from public.kurztest_gross_ergebnisse k
  where (such_email is not null or such_name is not null)
    and (
      (such_email is not null and k.email ilike '%' || such_email || '%')
      or (such_name is not null and k.name ilike '%' || such_name || '%')
    )

  order by erstellt_am desc;
$$;

-- 3. Detail-Funktion: liefert die VOLLSTÄNDIGE Zeile (inkl. Roh-Antworten)
--    als jsonb, ausschließlich für die eine Zeile, die der Admin gerade
--    bestätigt verknüpft -- wird direkt 1:1 in
--    coachie_testergebnisse.ergebnis_daten gespeichert.
create or replace function public.testergebnis_abrufen(
  such_test_typ text,
  such_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case such_test_typ
    when 'kurztest_24' then (select to_jsonb(q) from public.quiz_ergebnisse q where q.id = such_id)
    when 'vorbereitung_12' then (select to_jsonb(k) from public.kurztest_gross_ergebnisse k where k.id = such_id)
    else null
  end;
$$;

-- 4. Zugriff strikt auf die neue Rolle begrenzen. Postgres gewährt
--    EXECUTE bei CREATE FUNCTION standardmäßig an PUBLIC -- das muss
--    explizit zurückgenommen werden, sonst könnte jeder (auch anon)
--    diese Funktionen aufrufen.
revoke execute on function public.testergebnisse_suchen(text, text) from public;
revoke execute on function public.testergebnis_abrufen(text, uuid) from public;
grant execute on function public.testergebnisse_suchen(text, text) to coaching_plattform_reader;
grant execute on function public.testergebnis_abrufen(text, uuid) to coaching_plattform_reader;
