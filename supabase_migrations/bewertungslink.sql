-- ============================================================
-- MRH Coaching-Plattform — Bewertungslink für Testimonial-Einladung
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue Singleton-Tabelle, keine bestehende Tabelle/
-- Policy wird verändert.
-- ============================================================

create table if not exists public.plattform_einstellungen (
  id boolean primary key default true check (id),
  bewertung_link text,
  aktualisiert_am timestamptz not null default now()
);

comment on table public.plattform_einstellungen is
  'Singleton-Konfiguration für plattformweite, admin-pflegbare Texte/Links -- aktuell nur der externe Bewertungslink (Google/Trustpilot), der der automatischen Testimonial-Einladungsmail (api/cron/erinnerungen.js) nach 100% Kursabschluss beigefügt wird. Admin-Pflege über api/admin/programme.js?resource=plattform-einstellungen. id ist bewusst boolean mit check(id) statt uuid -- erzwingt serverseitig genau eine Zeile, analog zu mitgliedschaft_einstellungen (siehe mitgliederbereich.sql).';

insert into public.plattform_einstellungen (id)
values (true)
on conflict (id) do nothing;

alter table public.plattform_einstellungen enable row level security;

-- Bewusst OHNE Policies: gelesen/geschrieben wird ausschließlich
-- serverseitig (api/cron/erinnerungen.js, api/admin/programme.js),
-- beides mit service_role und damit unabhängig von RLS -- analog zu
-- mitgliedschaft_einstellungen/stripe_events.
