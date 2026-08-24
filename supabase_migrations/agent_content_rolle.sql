-- ============================================================
-- MRH Coaching-Plattform — DB-Rolle für den externen Produktagenten
-- (eigenständige Kurs-/Modul-/Session-Anlage als Entwurf, Freigabe
-- weiterhin ausschließlich manuell im Admin-Bereich)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Korrekturen gegenüber dem Entwurf:
-- 1. "agent_readonly" mit reinem SELECT reicht nicht, um Kurse
--    anzulegen -- die Rolle braucht INSERT/UPDATE/DELETE auf
--    programme/module/sessions. Umbenannt in "agent_content", damit
--    der Name die tatsächlichen Rechte widerspiegelt.
-- 2. Tabellennamen an das echte Schema angepasst: coachie_programme
--    (nicht zuordnung_coachie_programm), coachie_status (nicht
--    status_coachie_session). Eine eigene "zahlungen"-Tabelle
--    existiert nicht -- Zahlungsdaten liegen bei Stripe, lokal nur
--    stripe_events (Webhook-Idempotenz) und coachie_programme.
--    zugriff_bis (abgeleiteter Zugriffszeitraum, über coachie_programme
--    ohnehin schon ausgeschlossen). stripe_events zusätzlich explizit
--    ausgeschlossen.
-- 3. Freigabe-Mechanismus: programme.aktiv steuert bereits heute die
--    Sichtbarkeit für Coachies (siehe phase2_stripe.sql) und wird im
--    Admin-Bereich per "Aktivieren"-Button umgeschaltet -- exakt der
--    beschriebene Workflow. Per RLS darf der Agent NUR Zeilen mit
--    aktiv = false anlegen/bearbeiten/löschen und kann aktiv selbst
--    nicht auf true setzen (WITH CHECK schlägt sonst fehl). Module/
--    Sessions hängen am aktiv-Status ihres Programms. Sobald im
--    Admin-Bereich freigegeben wird (aktiv = true, über den
--    service_role Key, der RLS umgeht), verliert der Agent
--    automatisch den Schreibzugriff auf diese Zeilen -- kein
--    zusätzliches Flag nötig. Materialien (session_material) sind
--    bewusst nicht Teil dieser Rolle, da nicht angefragt.
--
-- Verbindung: Diese Rolle ist LOGIN-fähig (Annahme: der Produktagent
-- verbindet sich direkt per Postgres-Connection-String -- Supabase
-- Dashboard -> Project Settings -> Database -- NICHT über die
-- Coachie-Plattform-App/PostgREST). Passwort NICHT in dieser Datei
-- bzw. NICHT ins Repo committen, sondern separat setzen:
--   ALTER ROLE agent_content WITH PASSWORD '<langes, zufälliges Passwort>';
-- Falls der Agent stattdessen über eine bereits bestehende Login-Rolle
-- läuft und nur per SET ROLE in diese Rolle wechseln soll: unten
-- "login" durch "nologin" ersetzen und zusätzlich
-- "grant agent_content to <bestehende_login_rolle>;" ergänzen.
-- ============================================================

create role agent_content login;

-- Defensiv: stellt sicher, dass die Rolle mit einem sauberen Stand
-- startet, unabhängig von etwaigen Default-Grants an PUBLIC. Betrifft
-- ausschließlich agent_content selbst, nie andere Rollen.
revoke all on schema public from agent_content;
grant usage on schema public to agent_content;

-- Lesen: voller Katalog (auch bereits veröffentlichte Programme),
-- damit der Agent Duplikate erkennen und den eigenen Entwurfsstatus
-- einsehen kann. Explizit KEIN Grant auf coachies, coachie_programme,
-- coachie_status, stripe_events, session_material oder auth.* -- weder
-- SELECT noch Schreibzugriff.
grant select on public.programme, public.module, public.sessions
  to agent_content;

-- Anlegen/Bearbeiten/Löschen: nur für Entwürfe (aktiv = false bzw.
-- Module/Sessions eines noch nicht freigegebenen Programms) -- die
-- USING/WITH-CHECK-Klauseln unten setzen das durch, unabhängig davon,
-- was der Agent selbst zu schreiben versucht.
grant insert, update, delete on public.programme to agent_content;
grant insert, update, delete on public.module to agent_content;
grant insert, update, delete on public.sessions to agent_content;

-- Ergonomie: Agent kann "aktiv" beim Insert einfach weglassen, landet
-- dann automatisch als Entwurf. Ändert nichts an bestehenden Zeilen
-- und nichts am Admin-Insert (setzt aktiv weiterhin explizit true).
alter table public.programme alter column aktiv set default false;

drop policy if exists "agent liest alle Programme" on public.programme;
create policy "agent liest alle Programme" on public.programme
  for select to agent_content
  using (true);

drop policy if exists "agent verwaltet nur unveröffentlichte Programme" on public.programme;
create policy "agent verwaltet nur unveröffentlichte Programme" on public.programme
  for all to agent_content
  using (aktiv = false)
  with check (aktiv = false);
-- "for all" deckt insert/update/delete ab. Für SELECT gilt zusätzlich
-- die Policy oben; permissive Policies werden pro Befehl mit ODER
-- verknüpft, d. h. der volle Lesezugriff bleibt trotz dieser
-- restriktiveren using-Klausel erhalten -- ohne die separate
-- SELECT-Policy würde diese Zeile auch das Lesen auf Entwürfe
-- einschränken.

drop policy if exists "agent liest alle Module" on public.module;
create policy "agent liest alle Module" on public.module
  for select to agent_content
  using (true);

drop policy if exists "agent verwaltet nur Module unveröffentlichter Programme" on public.module;
create policy "agent verwaltet nur Module unveröffentlichter Programme" on public.module
  for all to agent_content
  using (
    exists (
      select 1 from public.programme p
      where p.id = module.programm_id and p.aktiv = false
    )
  )
  with check (
    exists (
      select 1 from public.programme p
      where p.id = module.programm_id and p.aktiv = false
    )
  );

drop policy if exists "agent liest alle Sessions" on public.sessions;
create policy "agent liest alle Sessions" on public.sessions
  for select to agent_content
  using (true);

drop policy if exists "agent verwaltet nur Sessions unveröffentlichter Programme" on public.sessions;
create policy "agent verwaltet nur Sessions unveröffentlichter Programme" on public.sessions
  for all to agent_content
  using (
    exists (
      select 1 from public.programme p
      where p.id = sessions.programm_id and p.aktiv = false
    )
  )
  with check (
    exists (
      select 1 from public.programme p
      where p.id = sessions.programm_id and p.aktiv = false
    )
  );
