-- ============================================================
-- MRH Coaching-Plattform — Peer Group v2 (ersetzt peer_group.sql)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Eigenständig ausführbar: legt beide Tabellen an, falls sie fehlen
-- (live bisher nicht vorhanden), und ist mehrfach ausführbar.
-- peer_group.sql muss NICHT mehr ausgeführt werden.
--
-- Fix gegenüber peer_group.sql: Die Select-Policy auf peer_profile
-- enthielt eine Unterabfrage auf peer_profile selbst. Postgres wertet
-- dafür erneut die Policy aus, das endet in "infinite recursion
-- detected in policy". Die Selbstreferenz liegt jetzt in einer
-- security-definer-Funktion, die RLS nicht erneut auslöst.
-- ============================================================

-- 1) Tabellen
create table if not exists public.peer_profile (
  coachie_id uuid primary key references public.coachies(id) on delete cascade,
  sichtbar boolean not null default false,
  vorname text not null default '',
  branche_rolle text,
  kurztext text,
  aktualisiert_am timestamptz not null default now()
);

comment on table public.peer_profile is
  'Opt-in-Sichtbarkeit für die Peer Group. Getrennt von coachies, damit die Sichtbarkeits-Policy niemals E-Mail oder andere Felder der coachies-Zeile mit ausliefert. sichtbar=false (Default) = für andere unsichtbar.';

alter table public.peer_profile enable row level security;

create table if not exists public.peer_interesse (
  id uuid primary key default gen_random_uuid(),
  von_coachie_id uuid not null references public.coachies(id) on delete cascade,
  zu_coachie_id uuid not null references public.coachies(id) on delete cascade,
  erstellt_am timestamptz not null default now()
);

create index if not exists peer_interesse_von_idx
  on public.peer_interesse (von_coachie_id, zu_coachie_id, erstellt_am desc);

comment on table public.peer_interesse is
  'Protokoll ausgelöster "Interesse zeigen"-Benachrichtigungen (Peer Group). Kein direkter Kontaktdatenzugriff.';

alter table public.peer_interesse enable row level security;

-- 2) Hilfsfunktion: Ist der Nutzer selbst sichtbar geschaltet?
--    security definer umgeht RLS auf peer_profile und verhindert so die
--    Rekursion. Gibt nur ein boolean zurück, keine Daten.
create or replace function public.ist_peer_sichtbar(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.sichtbar from public.peer_profile p where p.coachie_id = uid),
    false
  )
$$;

revoke all on function public.ist_peer_sichtbar(uuid) from public, anon;
grant execute on function public.ist_peer_sichtbar(uuid) to authenticated;

-- 3) Policies (alle neu angelegt, auch falls peer_group.sql teilweise lief)
drop policy if exists "coachie verwaltet eigenes Peer-Profil" on public.peer_profile;
create policy "coachie verwaltet eigenes Peer-Profil" on public.peer_profile
  for all
  to authenticated
  using (coachie_id = auth.uid())
  with check (coachie_id = auth.uid());

-- Reziprokes Opt-in + gemeinsames Programm: sichtbar, wenn (a) die
-- Zielzeile sichtbar ist, (b) der lesende Coachie selbst sichtbar ist
-- und (c) beide im selben Programm eingeschrieben sind.
drop policy if exists "peer sieht sichtbare Profile im gemeinsamen Programm" on public.peer_profile;
create policy "peer sieht sichtbare Profile im gemeinsamen Programm" on public.peer_profile
  for select
  to authenticated
  using (
    sichtbar = true
    and public.ist_peer_sichtbar(auth.uid())
    and exists (
      select 1
      from public.coachie_programme cp_ich
      join public.coachie_programme cp_andere
        on cp_andere.programm_id = cp_ich.programm_id
      where cp_ich.coachie_id = auth.uid()
        and cp_andere.coachie_id = peer_profile.coachie_id
    )
  );

drop policy if exists "coachie sieht eigene ausgeloeste Kontaktaufnahmen" on public.peer_interesse;
create policy "coachie sieht eigene ausgeloeste Kontaktaufnahmen" on public.peer_interesse
  for select
  to authenticated
  using (von_coachie_id = auth.uid());
