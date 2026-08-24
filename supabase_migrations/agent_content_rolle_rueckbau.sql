-- ============================================================
-- Rückbau: agent_content Postgres-Rolle (JWT-Ansatz verworfen)
--
-- Nur ausführen, falls agent_content_rolle.sql (frühere Version dieses
-- Features, mittlerweile aus dem Repo entfernt) bereits im Supabase
-- SQL Editor ausgeführt wurde -- falls nicht, ist diese Datei ein
-- reines No-Op (alle Statements sind idempotent) und kann ignoriert
-- werden.
--
-- Der Ansatz "dedizierte Postgres-Rolle + selbst gemintetes JWT für
-- PostgREST" wurde verworfen: dieses Projekt hat exakt dasselbe Muster
-- bereits für die Profil-Quiz-Anbindung versucht und wieder entfernt
-- (siehe supabase_migrations/profil_quiz_reader.sql / _v2.sql), weil
-- sich im aktuellen Supabase-Dashboard kein zweiter HS256-Standby-
-- Signing-Key mehr anlegen lässt -- ohne den lässt sich kein JWT mit
-- eigenem Rollen-Claim signieren, das PostgREST akzeptiert. Ersetzt
-- durch eine eigene, secret-geschützte API-Route
-- (api/agent/inhalte.js) mit service_role, siehe README-Abschnitt
-- "Produktagent".
-- ============================================================

drop policy if exists "agent verwaltet nur Sessions unveröffentlichter Programme" on public.sessions;
drop policy if exists "agent liest alle Sessions" on public.sessions;
drop policy if exists "agent verwaltet nur Module unveröffentlichter Programme" on public.module;
drop policy if exists "agent liest alle Module" on public.module;
drop policy if exists "agent verwaltet nur unveröffentlichte Programme" on public.programme;
drop policy if exists "agent liest alle Programme" on public.programme;

revoke all on public.programme, public.module, public.sessions from agent_content;
revoke usage on schema public from agent_content;

drop role if exists agent_content;

-- Ursprünglichen Default wiederherstellen (agent_content_rolle.sql
-- hatte ihn auf false gesetzt, damit ein Insert ohne "aktiv" als
-- Entwurf landet -- das erzwingt jetzt die neue API-Route im Code,
-- unabhängig vom Spalten-Default).
alter table public.programme alter column aktiv set default true;
