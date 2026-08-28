-- ============================================================
-- MRH Coaching-Plattform — 1:1-Sitzungen aus Kurspaket zählen
-- (Calendly-Webhook)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue, nullable Spalte auf programme sowie eine
-- neue Tabelle. Keine bestehende Tabelle/Policy wird verändert.
-- ============================================================

alter table public.programme
  add column if not exists max_calendly_sitzungen integer;

comment on column public.programme.max_calendly_sitzungen is
  'Anzahl im Kurspaket inkludierter 1:1-Sitzungen (z. B. 4). NULL = kein Limit, Buchungen werden nicht gezählt/begrenzt.';

create table if not exists public.programm_calendly_buchungen (
  id uuid primary key default gen_random_uuid(),
  coachie_id uuid not null references public.coachies(id),
  programm_id uuid not null references public.programme(id),
  calendly_event_uri text not null unique,
  gebucht_am timestamptz not null default now()
);

comment on table public.programm_calendly_buchungen is
  'Über den Calendly-Webhook (api/webhooks/calendly.js, invitee.created) automatisch erfasste 1:1-Buchungen, gegen max_calendly_sitzungen gezählt. calendly_event_uri ist die URI der Calendly-Invitee-Ressource (eindeutig pro Buchung) -- die unique-Constraint verhindert Doppelzählung bei Webhook-Wiederholungen.';

alter table public.programm_calendly_buchungen enable row level security;

-- Coachie sieht nur eigene Buchungen, read-only. Schreibzugriff nur
-- über service_role im Webhook (umgeht RLS) -- kein Coachie soll sich
-- selbst zusätzliche Sitzungen "buchen" können, indem er direkt in die
-- Tabelle schreibt.
drop policy if exists "coachie sieht eigene Calendly-Buchungen" on public.programm_calendly_buchungen;
create policy "coachie sieht eigene Calendly-Buchungen" on public.programm_calendly_buchungen
  for select
  using (coachie_id = auth.uid());
