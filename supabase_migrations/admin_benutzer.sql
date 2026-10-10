-- ============================================================
-- MRH Coaching-Plattform — Admin-Konten (mehrere Admins mit eigenem
-- Login statt eines gemeinsamen Passworts)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv, mehrfach ausführbar. Solange die Tabelle leer ist,
-- funktioniert nur der Notfallzugang über ADMIN_PASSWORD.
-- ============================================================

-- Ein Eintrag pro Admin. id ist die Supabase-Auth-ID (auth.users.id).
-- Ein Admin ist dadurch NICHT automatisch Coachie (eigene Tabelle
-- coachies) und umgekehrt; wer beides ist, hat in beiden Tabellen eine
-- Zeile mit derselben id. Zugriff nur über das Backend (service_role):
-- RLS an, bewusst ohne Policies.
create table if not exists public.admin_benutzer (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  letzter_login_am timestamptz
);

comment on table public.admin_benutzer is
  'Admin-Konten mit eigenem Login (E-Mail + Passwort über Supabase Auth). aktiv = false sperrt den Zugang sofort, auch für bereits ausgestellte Admin-Tokens (requireAdmin prüft bei jedem Aufruf). Nur service_role.';

alter table public.admin_benutzer enable row level security;
