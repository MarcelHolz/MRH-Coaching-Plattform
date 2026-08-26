-- ============================================================
-- MRH Coaching-Plattform — Kurzfeedback (Sternebewertung) pro Session
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue, nullable Spalte auf coachie_status. Keine
-- RLS-Änderung nötig -- die bestehenden Policies "coachie legt eigenen
-- Status an" (INSERT) und "coachie aktualisiert eigenen Status"
-- (UPDATE) prüfen nur coachie_id = auth.uid() und gelten damit
-- automatisch auch für die neue Spalte.
-- ============================================================

alter table public.coachie_status
  add column if not exists bewertung smallint;

alter table public.coachie_status
  drop constraint if exists coachie_status_bewertung_check;

alter table public.coachie_status
  add constraint coachie_status_bewertung_check
  check (bewertung is null or bewertung between 1 and 5);

comment on column public.coachie_status.bewertung is
  'Optionale Sternebewertung (1-5) durch den Coachie nach Abschluss der Session. NULL = keine Bewertung abgegeben (überspringbar).';
