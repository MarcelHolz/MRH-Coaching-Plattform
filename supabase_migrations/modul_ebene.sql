-- ============================================================
-- MRH Coaching-Plattform — Neue Strukturebene "Modul" zwischen
-- Programm und Session
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: neue Tabelle sowie zwei neue nullable Spalten.
-- Bestehende Sessions bleiben automatisch modullos (modul_id NULL) und
-- funktionieren unverändert weiter -- die Fortschrittsberechnung
-- bleibt wie gehabt auf Basis aller Sessions des Programms, unabhängig
-- von Modul-Zugehörigkeit.
-- ============================================================

create table if not exists public.module (
  id uuid primary key default gen_random_uuid(),
  programm_id uuid not null references public.programme(id),
  titel text not null,
  beschreibung text,
  bild_url text,
  reihenfolge integer not null default 0
);

comment on table public.module is
  'Optionale Gruppierungsebene zwischen Programm und Session. Eine Session ohne modul_id liegt direkt unter dem Programm.';

alter table public.sessions
  add column if not exists modul_id uuid references public.module(id) on delete set null;

comment on column public.sessions.modul_id is
  'Optionale Zuordnung zu einem Modul. NULL = Session liegt direkt unter dem Programm, ohne Modul. Bei Löschung des Moduls wird die Session automatisch modullos (on delete set null), nicht mitgelöscht.';

alter table public.programme
  add column if not exists bild_url text;

comment on column public.programme.bild_url is
  'Optionales kleines Vorschaubild für die Kurskarte im Coachie-Bereich ("Deine Programme" / "Weitere Programme"). NULL = Karte ohne Bild.';

-- RLS: analog zur bestehenden Policy "coachie sieht Sessions
-- zugeordneter Programme" (phase2_stripe.sql) -- nur Admin (service_role,
-- umgeht RLS) legt Module an, Coachies benötigen nur Lesezugriff auf
-- Module ihrer zugeordneten, nicht abgelaufenen Programme.
alter table public.module enable row level security;

drop policy if exists "coachie sieht Module zugeordneter Programme" on public.module;
create policy "coachie sieht Module zugeordneter Programme" on public.module
  for select
  using (
    exists (
      select 1 from public.coachie_programme cp
      where cp.programm_id = module.programm_id
        and cp.coachie_id = auth.uid()
        and (cp.zugriff_bis is null or cp.zugriff_bis > now())
    )
  );
