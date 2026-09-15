-- ============================================================
-- MRH Coaching-Plattform — Änderungsprotokoll für Agent-Entwürfe
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue Tabelle. Keine bestehende Tabelle/Policy
-- wird verändert.
-- ============================================================

create table if not exists public.entwurf_historie (
  id uuid primary key default gen_random_uuid(),
  tabelle text not null,
  datensatz_id uuid not null,
  vorher jsonb,
  nachher jsonb not null,
  geaendert_am timestamptz not null default now()
);

create index if not exists entwurf_historie_datensatz_idx
  on public.entwurf_historie (tabelle, datensatz_id, geaendert_am desc);

comment on table public.entwurf_historie is
  'Änderungsprotokoll für Agent-Entwürfe (Produktagent, api/agent/inhalte.js) -- jede PATCH-Änderung an einem noch nicht freigegebenen Entwurf (Programm/Modul/Session/FAQ) wird hier mit vorher/nachher-Snapshot der betroffenen Zeile festgehalten, für die Vorher/Nachher-Diff-Ansicht im Review-Interface (AdminEntwuerfePage.jsx, api/admin/programme.js?resource=entwuerfe). Wird nie manuell bereinigt -- bei den hier üblichen Mengen an Entwürfen unkritisch.';

comment on column public.entwurf_historie.tabelle is
  'programme | module | sessions | faq_eintraege.';

comment on column public.entwurf_historie.vorher is
  'Vollständiger Zeilenstand unmittelbar vor der PATCH-Änderung. null nur, falls die Zeile zum Zeitpunkt der Protokollierung nicht mehr auffindbar war.';

-- Kein Client-/Browser-Zugriff vorgesehen: nur der Agent-Endpunkt
-- schreibt (service_role), nur der Admin-Bereich liest (ebenfalls
-- service_role). RLS bleibt aktiviert, aber bewusst ohne Policies --
-- analog zu faq_eintraege.sql.
alter table public.entwurf_historie enable row level security;
