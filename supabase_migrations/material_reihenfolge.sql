-- ============================================================
-- MRH Coaching-Plattform — Material-Einträge bearbeitbar + sortierbar
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: neue not-null-Spalte mit Default 0, damit bestehende
-- INSERTs ohne den Wert weiterlaufen. Bestehende Zeilen werden einmalig
-- je Session fortlaufend nummeriert (Reihenfolge nach id, da bislang
-- keine Sortierspalte existierte -- ab jetzt bleibt die im Admin per
-- Auf/Ab festgelegte Reihenfolge erhalten).
-- ============================================================

alter table public.session_material
  add column if not exists reihenfolge integer not null default 0;

with nummeriert as (
  select id, row_number() over (partition by session_id order by id) - 1 as neue_reihenfolge
  from public.session_material
)
update public.session_material sm
set reihenfolge = nummeriert.neue_reihenfolge
from nummeriert
where sm.id = nummeriert.id;

comment on column public.session_material.reihenfolge is
  'Anzeigereihenfolge innerhalb einer Session, wie sessions.reihenfolge. Wird im Admin-Bereich per Auf/Ab-Buttons gepflegt.';
