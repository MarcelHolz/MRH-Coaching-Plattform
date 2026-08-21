-- ============================================================
-- MRH Coaching-Plattform — Teaser-Programme im Coachie-Bereich
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: keine bestehende Spalte/Policy wird verändert oder
-- entfernt, nur ergänzt.
-- ============================================================

-- 1. Neue Spalten auf programme
alter table public.programme
  add column if not exists teaser_aktiv boolean not null default false,
  add column if not exists preis_anzeigen boolean not null default true;

-- 2. Neue, zusätzliche SELECT-Policy: aktive Teaser-Programme sind für
--    JEDEN Coachie sichtbar, unabhängig von einer eigenen Zuordnung
--    (Werbung/Vorschau, nicht die eigentlichen Inhalte -- Sessions und
--    Materialien bleiben über die bestehende Policy weiterhin nur für
--    zugeordnete Coachies sichtbar, die hier NICHT verändert wird).
--    Postgres verknüpft mehrere permissive Policies für denselben
--    Befehl mit OR, d. h. die bestehende "coachie sieht zugeordnete
--    Programme"-Policy bleibt vollständig erhalten und wird durch diese
--    hier nur ergänzt.
create policy "coachie sieht aktive Teaser-Programme" on public.programme
  for select
  using (teaser_aktiv = true and aktiv = true);
