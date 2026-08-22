-- ============================================================
-- MRH Coaching-Plattform — Punkt 1: Aktives Onboarding nach Login
-- (Umsetzungsauftrag Phase 1 Quick Wins)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: neue nullable Spalte, bestehende Daten/Policies
-- bleiben unverändert. Damit der Coachie erster_login_am direkt nach
-- dem ersten Login clientseitig selbst setzen kann (siehe
-- src/context/AuthContext.jsx), wird eine Update-Policy ergänzt --
-- bewusst per Column-Grant auf genau dieses eine Feld beschränkt,
-- damit über den authenticated-Zugang weiterhin keine anderen
-- Felder der eigenen Zeile (z. B. name, email) verändert werden
-- können.
-- ============================================================

alter table public.coachies
  add column if not exists erster_login_am timestamptz;

comment on column public.coachies.erster_login_am is
  'Zeitpunkt des allerersten erfolgreichen Logins. Wird einmalig beim ersten Login clientseitig gesetzt und danach von der Anwendung nie wieder verändert. NULL = noch nie eingeloggt.';

drop policy if exists "coachie setzt eigenen ersten Login" on public.coachies;
create policy "coachie setzt eigenen ersten Login" on public.coachies
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.coachies from authenticated;
grant update (erster_login_am) on public.coachies to authenticated;
