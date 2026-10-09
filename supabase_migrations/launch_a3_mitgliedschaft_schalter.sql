-- ============================================================
-- MRH Coaching-Plattform — Launch A3: Mitgliedschaft ausblendbar
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv, mehrfach ausführbar. Default false: Nach dem Ausführen
-- ist die Mitgliedschaft ausgeblendet, bis sie im Admin unter
-- "Mitgliedschaft" eingeschaltet wird.
-- ============================================================

alter table public.mitgliedschaft_einstellungen
  add column if not exists mitgliedschaft_aktiv boolean not null default false;

comment on column public.mitgliedschaft_einstellungen.mitgliedschaft_aktiv is
  'false = /mitgliedschaft zeigt nur "startet in Kürze", der Checkout antwortet 404 und Hinweise im Coachie-Bereich sind ausgeblendet. Bestehende Mitglieder behalten ihren Zugang.';
