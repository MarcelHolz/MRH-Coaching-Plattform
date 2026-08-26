-- ============================================================
-- MRH Coaching-Plattform — Coachie-Profilbild
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue, nullable Spalte auf coachies. Coachies
-- können bereits heute die eigene Zeile lesen/aktualisieren (siehe
-- AuthContext.jsx: select/update auf coachies mit id = eigener
-- auth.uid()) -- keine neue RLS-Policy nötig, gilt spaltenunabhängig.
-- ============================================================

alter table public.coachies
  add column if not exists avatar_url text;

comment on column public.coachies.avatar_url is
  'Optionales Profilbild des Coachies, in EinstellungenPage.jsx hochladbar (öffentlicher Bucket "programm-bilder", analog zu Programm-/Modulbildern). NULL = Platzhalter mit Initialen im Header (CoachieLayout.jsx).';
