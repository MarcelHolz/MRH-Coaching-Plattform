-- ============================================================
-- MRH Coaching-Plattform — Launch C6: Freemium- und Teaser-Daten
-- nicht für Anonyme
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Geprüft: Keine öffentliche Seite liest programme, module oder sessions
-- anonym über den Supabase-Client. Kaufseite und Startseite laden über
-- api/checkout.js (service_role). Mehrfach ausführbar.
-- ============================================================

-- 1) Hilfsfunktionen: Live haben sie EXECUTE für PUBLIC (damit auch für
--    anon). Ein reines "revoke ... from anon" reicht deshalb nicht, auch
--    PUBLIC muss entzogen werden.
revoke execute on function public.erste_freemium_session(uuid) from public, anon;
revoke execute on function public.erstes_freemium_modul(uuid) from public, anon;
grant execute on function public.erste_freemium_session(uuid) to authenticated, service_role;
grant execute on function public.erstes_freemium_modul(uuid) to authenticated, service_role;

-- 2) Policies auf programme nur noch für eingeloggte Nutzer.
drop policy if exists "coachie sieht Freemium-Programme" on public.programme;
create policy "coachie sieht Freemium-Programme" on public.programme
  for select
  to authenticated
  using (freemium_aktiv = true and aktiv = true);

drop policy if exists "coachie sieht aktive Teaser-Programme" on public.programme;
create policy "coachie sieht aktive Teaser-Programme" on public.programme
  for select
  to authenticated
  using (teaser_aktiv = true and aktiv = true);

-- 3) Die Policies auf module und sessions rufen die Funktionen auf. Ohne
--    EXECUTE würde eine anonyme Abfrage mit "permission denied" scheitern
--    statt leer zu bleiben, daher ebenfalls auf authenticated beschränken
--    (gleiche Bedingung wie live).
drop policy if exists "coachie sieht erstes Modul bei Freemium-Programmen" on public.module;
create policy "coachie sieht erstes Modul bei Freemium-Programmen" on public.module
  for select
  to authenticated
  using (
    exists (
      select 1 from public.programme p
      where p.id = module.programm_id
        and p.freemium_aktiv = true
        and p.aktiv = true
    )
    and module.id = public.erstes_freemium_modul(module.programm_id)
  );

drop policy if exists "coachie sieht Freemium-Startsession" on public.sessions;
create policy "coachie sieht Freemium-Startsession" on public.sessions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.programme p
      where p.id = sessions.programm_id
        and p.freemium_aktiv = true
        and p.aktiv = true
    )
    and sessions.id = public.erste_freemium_session(sessions.programm_id)
  );
