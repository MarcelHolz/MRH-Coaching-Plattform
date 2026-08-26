-- ============================================================
-- MRH Coaching-Plattform — Personalisierte Begrüßung mit Coach-Foto
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: zwei neue, nullable Spalten auf programme. Keine
-- RLS-Änderung nötig -- beide Felder werden über dieselbe
-- "coachie sieht zugeordnete Programme"-Policy (bzw. die
-- Freemium-/Teaser-Policies) mitgelesen wie titel/beschreibung/bild_url
-- bereits heute.
-- ============================================================

alter table public.programme
  add column if not exists coach_foto_url text,
  add column if not exists begruessung_text text;

comment on column public.programme.coach_foto_url is
  'Optionales Foto des Coaches für die persönliche Begrüßung im Coachie-Dashboard, oberhalb der Programmliste. NULL = keine Begrüßung, Dashboard bleibt im bisherigen neutralen Zustand.';

comment on column public.programme.begruessung_text is
  'Optionaler persönlicher Begrüßungstext des Coaches, zusammen mit coach_foto_url im Coachie-Dashboard angezeigt (zum zuletzt aktiven Programm des Coachies). NULL = keine Begrüßung.';
