-- ============================================================
-- MRH Coaching-Plattform — Punkt 2: Erinnerungsautomation bei
-- Inaktivität (Umsetzungsauftrag Phase 1 Quick Wins)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: neue nullable Spalte. Wird ausschließlich serverseitig
-- vom täglichen Cron-Job (api/cron/erinnerungen.js) über den
-- service_role Key gesetzt -- keine RLS-Änderung nötig, bestehende
-- Policies auf coachie_status bleiben unverändert.
-- ============================================================

alter table public.coachie_status
  add column if not exists erinnerung_gesendet_am timestamptz;

comment on column public.coachie_status.erinnerung_gesendet_am is
  'Zeitpunkt der letzten automatischen Erinnerungsmail, deren Inhalt sich auf diese Session bezog. Verhindert Doppelversand (max. 1 Erinnerung pro Coachie pro 7-Tage-Fenster, siehe api/cron/erinnerungen.js). NULL = noch keine Erinnerung gesendet.';
