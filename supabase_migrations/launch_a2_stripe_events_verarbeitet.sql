-- ============================================================
-- MRH Coaching-Plattform — Launch A2: Stripe-Webhook verliert
-- keine bezahlten Käufe mehr
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- MUSS vor dem Deployment des neuen api/webhooks/stripe.js laufen,
-- sonst scheitert jeder Webhook am fehlenden Feld "verarbeitet".
-- Rein additiv, mehrfach ausführbar.
-- ============================================================

-- 1) Event erst nach erfolgreicher Verarbeitung als erledigt markieren.
--    Bestehende Zeilen gelten als verarbeitet (sie wurden bisher mit 200
--    beantwortet), deshalb zuerst mit Default true anlegen und den
--    Default danach auf false umstellen.
alter table public.stripe_events
  add column if not exists verarbeitet boolean not null default true;

alter table public.stripe_events
  alter column verarbeitet set default false;

comment on column public.stripe_events.verarbeitet is
  'false = Event wurde angenommen, die Verarbeitung ist aber (noch) nicht erfolgreich abgeschlossen. Eine erneute Stripe-Zustellung verarbeitet es dann erneut. true = fertig, weitere Zustellungen werden mit already_processed beantwortet.';

-- 2) Live fehlt bisher coachies.stripe_customer_id (rechnungen.sql wurde
--    nicht ausgeführt). Der Webhook schreibt die Spalte bei jedem Kauf;
--    ohne sie fehlt später die Rechnungsübersicht. Identisch zu
--    rechnungen.sql, daher gefahrlos doppelt ausführbar.
alter table public.coachies
  add column if not exists stripe_customer_id text;
