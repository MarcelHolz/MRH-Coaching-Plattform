-- ============================================================
-- MRH Coaching-Plattform — Peer Group (Opt-in, reziprok)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: zwei neue Tabellen, keine bestehende Tabelle/Policy
-- wird verändert. Bewusst KEINE neuen Spalten auf coachies -- das
-- Peer-Profil lebt in einer eigenen Tabelle, damit eine Sichtbarkeits-
-- Policy für andere Coachies niemals coachies.email oder andere
-- sensible Felder der eigenen Zeile mit freigibt (Datenschutz-Vorgabe
-- aus dem Auftrag: "keine E-Mail-Adresse ... sichtbar").
-- ============================================================

-- 1) Peer-Profil: eine Zeile pro Coachie, nur die für die Peer Group
--    freigegebenen Felder.
create table if not exists public.peer_profile (
  coachie_id uuid primary key references public.coachies(id) on delete cascade,
  sichtbar boolean not null default false,
  vorname text not null default '',
  branche_rolle text,
  kurztext text,
  aktualisiert_am timestamptz not null default now()
);

comment on table public.peer_profile is
  'Opt-in-Sichtbarkeit für die Peer Group (Feature 1). Getrennt von coachies, damit die Peer-Sichtbarkeits-Policy niemals E-Mail oder andere Felder der coachies-Zeile mit ausliefert. sichtbar=false (Default) = Zeile für andere Coachies unsichtbar, siehe Policies unten.';

comment on column public.peer_profile.vorname is
  'Anzeigename in der Peer-Group-Übersicht. Wird beim Aktivieren des Schalters clientseitig mit dem Vornamen aus coachies.name vorbefüllt, ist aber frei änderbar/leerbar -- kein Pflichtfeld gemäß Auftrag.';

alter table public.peer_profile enable row level security;

-- Eigene Zeile immer lesbar/schreibbar (auch bei sichtbar=false, damit
-- der Coachie sein eigenes Formular in den Einstellungen sehen kann).
create policy "coachie verwaltet eigenes Peer-Profil" on public.peer_profile
  for all
  using (coachie_id = auth.uid())
  with check (coachie_id = auth.uid());

-- Reziprokes Opt-in + gemeinsames Programm: nur sichtbar, wenn (a) die
-- Zielzeile selbst sichtbar=true ist, (b) der lesende Coachie selbst
-- sichtbar=true ist ("Ein Coachie mit deaktiviertem Schalter ... sieht
-- selbst auch keine Übersicht") und (c) beide über coachie_programme
-- im selben Programm eingeschrieben sind (keine Sicht über
-- Programmgrenzen hinweg).
create policy "peer sieht sichtbare Profile im gemeinsamen Programm" on public.peer_profile
  for select
  using (
    sichtbar = true
    and exists (
      select 1 from public.peer_profile ich
      where ich.coachie_id = auth.uid() and ich.sichtbar = true
    )
    and exists (
      select 1
      from public.coachie_programme cp_ich
      join public.coachie_programme cp_andere
        on cp_andere.programm_id = cp_ich.programm_id
      where cp_ich.coachie_id = auth.uid()
        and cp_andere.coachie_id = peer_profile.coachie_id
    )
  );

-- 2) Protokoll der "Interesse zeigen"-Klicks: dient serverseitig
--    (api/certificate.js?resource=peer-interesse) der Prüfung "schon
--    kürzlich kontaktiert?" und dem UI-Status "Interesse bereits
--    gezeigt". Der eigentliche Mailversand läuft über service_role,
--    RLS erlaubt Coachies nur den Blick auf die eigenen, selbst
--    ausgelösten Kontaktaufnahmen -- niemals die eingehenden (das
--    bleibt serverseitig/E-Mail, kein direkter Datenzugriff).
create table if not exists public.peer_interesse (
  id uuid primary key default gen_random_uuid(),
  von_coachie_id uuid not null references public.coachies(id) on delete cascade,
  zu_coachie_id uuid not null references public.coachies(id) on delete cascade,
  erstellt_am timestamptz not null default now()
);

create index if not exists peer_interesse_von_idx
  on public.peer_interesse (von_coachie_id, zu_coachie_id, erstellt_am desc);

comment on table public.peer_interesse is
  'Protokoll ausgelöster "Interesse zeigen"-Benachrichtigungen (Peer Group, Feature 1). Kein direkter Kontaktdatenzugriff -- der Zielcoachie bekommt eine E-Mail und entscheidet selbst, ob er antwortet.';

alter table public.peer_interesse enable row level security;

create policy "coachie sieht eigene ausgeloeste Kontaktaufnahmen" on public.peer_interesse
  for select
  using (von_coachie_id = auth.uid());
