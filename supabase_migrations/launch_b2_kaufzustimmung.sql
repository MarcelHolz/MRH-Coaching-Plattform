-- ============================================================
-- MRH Coaching-Plattform — Launch B2: Nachweis von AGB-Zustimmung
-- und Widerrufsverzicht (§ 356 Abs. 5 BGB)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- MUSS vor dem Deployment laufen: der Stripe-Webhook schreibt diese
-- Spalten bei jedem Kauf. Rein additiv, mehrfach ausführbar.
-- ============================================================

alter table public.coachie_programme
  add column if not exists agb_akzeptiert_am timestamptz,
  add column if not exists widerrufsverzicht_am timestamptz;

comment on column public.coachie_programme.agb_akzeptiert_am is
  'Zeitpunkt, zu dem der Käufer auf /kaufen/:slug die AGB akzeptiert hat (aus den Metadaten der Stripe-Session). NULL bei manueller Zuordnung oder Gratis-Anmeldung.';
comment on column public.coachie_programme.widerrufsverzicht_am is
  'Zeitpunkt der ausdrücklichen Zustimmung zum Beginn der Bereitstellung vor Ablauf der Widerrufsfrist (§ 356 Abs. 5 BGB). Nachweis im Streitfall.';

alter table public.mitgliedschaften
  add column if not exists agb_akzeptiert_am timestamptz,
  add column if not exists widerrufsverzicht_am timestamptz;
