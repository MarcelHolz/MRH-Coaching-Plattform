-- ============================================================
-- MRH Coaching-Plattform — Calendly-Buchung pro Programm
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue, nullable Spalte auf programme. Keine
-- RLS-Änderung nötig -- wird wie titel/beschreibung über die
-- bestehenden Coachie-Policies mitgelesen.
-- ============================================================

alter table public.programme
  add column if not exists calendly_url text;

comment on column public.programme.calendly_url is
  'Optionaler Calendly-Link für den "1:1-Termin buchen"-Button in CoachieProgramPage.jsx (Standard-Inline-Embed, kein API-Key nötig). NULL = kein Button.';

-- Testweise für "Führung & Kommunikation" eintragen (siehe
-- Aufgabenstellung). Nur relevant, falls das Programm mit exakt diesem
-- Titel existiert -- sonst reines No-Op.
update public.programme
set calendly_url = 'https://calendly.com/deepdive-executivedeepdive/mrh-ihr-gesprach'
where titel = 'Führung & Kommunikation';
