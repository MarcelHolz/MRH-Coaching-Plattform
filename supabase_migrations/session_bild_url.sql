-- ============================================================
-- MRH Coaching-Plattform — Punkt 6 (Phase 2): Bild-Link statt
-- Workbook-Link bei der Session-Anlage
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: neue nullable Spalte. sessions.workbook_url bleibt
-- unangetastet (kein Datenverlust bei eventuell bereits gesetzten
-- Werten) -- das Admin-Formular schreibt dort nur schlicht nichts
-- mehr hinein, da das Workbook inzwischen über die Material-Ablage
-- läuft (Phase 2, Punkt 1).
-- ============================================================

alter table public.sessions
  add column if not exists bild_url text;

comment on column public.sessions.bild_url is
  'Optionales Bild als unterstützende Grafik für Sessions ohne Video, extern verlinkt (wie video_url). NULL = kein Bild.';
