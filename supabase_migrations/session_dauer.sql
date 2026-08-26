-- ============================================================
-- MRH Coaching-Plattform — Zeitangabe pro Session
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue, nullable Spalte auf sessions. Keine
-- RLS-Änderung nötig -- bestehende Policies gelten spaltenunabhängig.
-- ============================================================

alter table public.sessions
  add column if not exists dauer_minuten integer;

comment on column public.sessions.dauer_minuten is
  'Optionale geschätzte Dauer der Session in Minuten, für die Anzeige "N Sessions · M Min." auf der Modul-Kachel in CoachieProgramPage.jsx. NULL = fließt nicht in die Summe ein, kein Fehler.';
