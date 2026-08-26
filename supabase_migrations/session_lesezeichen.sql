-- ============================================================
-- MRH Coaching-Plattform — Lesezeichen-Funktion
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: neue Tabelle, keine bestehende Tabelle/Policy wird
-- verändert.
-- ============================================================

create table if not exists public.session_lesezeichen (
  id uuid primary key default gen_random_uuid(),
  coachie_id uuid not null references public.coachies(id),
  session_id uuid not null references public.sessions(id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  unique (coachie_id, session_id)
);

comment on table public.session_lesezeichen is
  'Vom Coachie selbst gesetzte Lesezeichen (Toggle in CoachieProgramPage.jsx), rein persönlich -- kein Admin-Bezug.';

alter table public.session_lesezeichen enable row level security;

drop policy if exists "coachie verwaltet eigene Lesezeichen" on public.session_lesezeichen;
create policy "coachie verwaltet eigene Lesezeichen" on public.session_lesezeichen
  for all
  using (coachie_id = auth.uid())
  with check (coachie_id = auth.uid());
