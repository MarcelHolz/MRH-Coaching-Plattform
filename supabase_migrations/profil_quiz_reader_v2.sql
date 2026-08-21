-- ============================================================
-- ACHTUNG: Diese Datei gehört NICHT zur Coaching-Plattform-Datenbank.
-- Im SQL Editor des ANDEREN Supabase-Projekts ausführen:
-- "Profil-Quiz" (rbfsfcetdzdsyoffglwi, Region eu-west-1).
--
-- ERSETZT profil_quiz_reader.sql: Der eingeschränkte Zugriff läuft
-- jetzt über eine Edge Function (profil-quiz-edge-function/, Ordner
-- "testergebnisse-reader"), die intern mit dem service_role-Key
-- aufruft und über ein eigenes Secret im Header geschützt ist --
-- statt über eine Custom-Postgres-Rolle mit selbst gemintetem JWT.
-- Grund für den Wechsel: Die Verwaltung mehrerer HS256-Keys im neuen
-- Supabase "JWT Signing Keys"-UI war nicht zuverlässig nutzbar
-- (nur noch "Rotate" verfügbar, kein zweiter Standby-Key anlegbar).
--
-- Sicher erneut ausführbar -- sowohl auf einem frischen Profil-Quiz-
-- Setup (Rolle existiert noch nicht) als auch auf einem Projekt, auf
-- dem profil_quiz_reader.sql bereits lief (Rolle wird sauber
-- entfernt). testergebnisse_suchen/testergebnis_abrufen bleiben
-- inhaltlich unverändert (identisch zu profil_quiz_reader.sql) --
-- nur der Zugriffsweg von außen ändert sich.
-- ============================================================

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

-- Zugriff strikt auf service_role begrenzen -- die Edge Function ruft
-- ausschließlich damit auf (Key wird von Supabase automatisch in die
-- Function injiziert, verlässt das Profil-Quiz-Projekt nie).
revoke execute on function public.testergebnisse_suchen(text, text) from public;
revoke execute on function public.testergebnis_abrufen(text, uuid) from public;
grant execute on function public.testergebnisse_suchen(text, text) to service_role;
grant execute on function public.testergebnis_abrufen(text, uuid) to service_role;

-- Alten Zugriffsweg (Custom-Rolle + selbst gemintetes JWT) sauber
-- entfernen, falls profil_quiz_reader.sql zuvor gelaufen ist. Auf
-- einem frischen Setup ohne diese Rolle passiert hier nichts.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'coaching_plattform_reader') then
    revoke execute on function public.testergebnisse_suchen(text, text) from coaching_plattform_reader;
    revoke execute on function public.testergebnis_abrufen(text, uuid) from coaching_plattform_reader;
    revoke coaching_plattform_reader from authenticator;
    drop role coaching_plattform_reader;
  end if;
end $$;
