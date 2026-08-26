-- ============================================================
-- MRH Coaching-Plattform — Freemium-Flag pro Programm
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: keine bestehende Spalte/Policy wird verändert oder
-- entfernt, nur ergänzt.
--
-- Ist freemium_aktiv = true, wird die erste Session des Programms für
-- JEDEN eingeloggten Coachie lesbar, unabhängig von einer eigenen
-- coachie_programme-Zuordnung (kostenloses Reinschnuppern). "Erste
-- Session" folgt derselben Reihenfolge wie die Anzeige in
-- CoachieProgramPage.jsx (ordneSessionsNachModul): zuerst modullose
-- Sessions nach reihenfolge, sonst die Session mit der niedrigsten
-- reihenfolge im Modul mit der niedrigsten reihenfolge.
--
-- Damit die Programmseite für einen nicht zugeordneten Coachie
-- überhaupt lädt (CoachieProgramPage.jsx lädt zuerst programme, dann
-- sessions/module), müssen zusätzlich zur Session auch das Programm
-- selbst und dessen erstes Modul lesbar sein -- beide Policies sind
-- bewusst eng gefasst (nur das jeweils erste Modul, nicht alle), um so
-- nah wie möglich am ursprünglich gewünschten "nur auf Session-Ebene"
-- zu bleiben.
-- ============================================================

alter table public.programme
  add column if not exists freemium_aktiv boolean not null default false;

comment on column public.programme.freemium_aktiv is
  'Wenn true, ist die erste Session dieses Programms für alle eingeloggten Coachies ohne Zuordnung lesbar (kostenlose Vorschau).';

-- 1. Programm selbst lesbar, analog zur bestehenden Teaser-Policy.
drop policy if exists "coachie sieht Freemium-Programme" on public.programme;
create policy "coachie sieht Freemium-Programme" on public.programme
  for select
  using (freemium_aktiv = true and aktiv = true);

-- 2. Nur das erste Modul (niedrigste reihenfolge) eines Freemium-
--    Programms lesbar, damit die freigegebene Session nicht durch ein
--    für den Coachie unsichtbares Modul aus der Anzeige herausfällt.
drop policy if exists "coachie sieht erstes Modul bei Freemium-Programmen" on public.module;
create policy "coachie sieht erstes Modul bei Freemium-Programmen" on public.module
  for select
  using (
    exists (
      select 1 from public.programme p
      where p.id = module.programm_id
        and p.freemium_aktiv = true
        and p.aktiv = true
    )
    and module.id = (
      select m2.id
      from public.module m2
      where m2.programm_id = module.programm_id
      order by m2.reihenfolge
      limit 1
    )
  );

-- 3. Nur die erste Session (siehe Reihenfolge-Logik oben) eines
--    Freemium-Programms lesbar, für jeden eingeloggten Coachie.
drop policy if exists "coachie sieht Freemium-Startsession" on public.sessions;
create policy "coachie sieht Freemium-Startsession" on public.sessions
  for select
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.programme p
      where p.id = sessions.programm_id
        and p.freemium_aktiv = true
        and p.aktiv = true
    )
    and sessions.id = (
      select s2.id
      from public.sessions s2
      where s2.programm_id = sessions.programm_id
      order by
        (s2.modul_id is not null),
        (
          select m2.reihenfolge from public.module m2
          where m2.id = s2.modul_id
        ),
        s2.reihenfolge
      limit 1
    )
  );

-- Hinweis: session_material der Freemium-Session bleibt bewusst über
-- die bestehende Policy weiterhin nur für zugeordnete Coachies sichtbar
-- (Aufgabenstellung: Erweiterung "auf Session-Ebene"). Die Vorschau-
-- Session zeigt daher Video/Beschreibung, aber keine Download-
-- Materialien, solange kein echter Zugriff (coachie_programme) besteht.
-- coachie_status bleibt unverändert (coachie_id = auth.uid(), siehe
-- phase2_stripe.sql) -- ein Coachie kann seinen Fortschritt auf der
-- Freemium-Session also ganz normal markieren, auch ohne Zuordnung.
