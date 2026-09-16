-- ============================================================
-- MRH Coaching-Plattform — Events-Kalender
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue Tabelle. Keine bestehende Tabelle/Policy
-- wird verändert.
-- ============================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  beschreibung text,
  start_zeitpunkt timestamptz not null,
  ende_zeitpunkt timestamptz,
  link text,
  programm_id uuid references public.programme(id) on delete cascade,
  erstellt_am timestamptz not null default now()
);

create index if not exists events_start_idx on public.events (start_zeitpunkt);

comment on table public.events is
  'Kalender-Termine für Live-Calls/Webinare/Gruppentermine (Events-Kalender). Admin-CRUD über api/admin/programme.js?resource=events (service_role). programm_id = NULL bedeutet plattformweit sichtbar für alle eingeloggten Coachies, sonst nur für Coachies mit einer Zeile in coachie_programme für dieses Programm.';

comment on column public.events.link is
  'Optionaler Link, z. B. zu einem Videocall (Zoom/Meet/...). Freitext, keine Validierung.';

alter table public.events enable row level security;

-- Coachies lesen direkt über den Supabase-Client (kein eigener
-- Endpunkt nötig, analog zu testimonials/session_lesezeichen): nur
-- eigene Programme oder plattformweite Termine (programm_id NULL).
create policy "coachie sieht eigene und plattformweite Termine" on public.events
  for select
  using (
    auth.uid() is not null
    and (
      programm_id is null
      or exists (
        select 1 from public.coachie_programme cp
        where cp.coachie_id = auth.uid() and cp.programm_id = events.programm_id
      )
    )
  );
