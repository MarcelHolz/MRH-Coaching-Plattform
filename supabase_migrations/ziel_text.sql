-- ============================================================
-- MRH Coaching-Plattform — Punkt 4: Zielsetzung zu Programmbeginn
-- (Umsetzungsauftrag Phase 1 Quick Wins)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: neue nullable Spalte, bestehende Daten/Policies
-- bleiben unverändert. Analog zu erster_login.sql (Punkt 1) darf der
-- Coachie dieses eine Feld auf der eigenen Zuordnungszeile
-- clientseitig selbst setzen (siehe src/pages/CoachieProgramPage.jsx)
-- -- per Column-Grant bewusst auf ziel_text beschränkt, damit über
-- den authenticated-Zugang weiterhin keine anderen Felder der
-- eigenen coachie_programme-Zeile (z. B. zugriff_bis) verändert
-- werden können.
-- ============================================================

alter table public.coachie_programme
  add column if not exists ziel_text text;

comment on column public.coachie_programme.ziel_text is
  'Optionale Antwort des Coachies auf "Was soll sich für dich verändert haben, wenn du hier fertig bist?", eingegeben beim ersten Öffnen des Programms. NULL = übersprungen/noch nicht gesetzt.';

drop policy if exists "coachie setzt eigenes Programmziel" on public.coachie_programme;
create policy "coachie setzt eigenes Programmziel" on public.coachie_programme
  for update
  using (coachie_id = auth.uid())
  with check (coachie_id = auth.uid());

revoke update on public.coachie_programme from authenticated;
grant update (ziel_text) on public.coachie_programme to authenticated;
