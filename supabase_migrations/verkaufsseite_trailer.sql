-- ============================================================
-- MRH Coaching-Plattform — Trailer-Video für die Verkaufsseite
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue, nullable Spalte auf programme. Keine
-- RLS-Änderung nötig -- die Verkaufsseite liest Programme weiterhin
-- über api/checkout.js mit dem service_role Key (siehe
-- phase2_stripe.sql, Punkt 5), unabhängig von den Coachie-Policies.
-- ============================================================

alter table public.programme
  add column if not exists trailer_video_url text;

comment on column public.programme.trailer_video_url is
  'Optionaler YouTube-Link für ein Trailer-Video auf der öffentlichen Verkaufsseite (/kaufen/:slug). NULL = kein Trailer, Seite zeigt stattdessen bild_url falls vorhanden.';
