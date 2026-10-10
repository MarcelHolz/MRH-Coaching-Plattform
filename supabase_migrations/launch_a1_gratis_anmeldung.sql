-- ============================================================
-- MRH Coaching-Plattform — Launch A1: Gratis-Anmeldung
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv, mehrfach ausführbar.
-- ============================================================

-- Protokoll der Gratis-Anmeldungen (api/checkout.js?aktion=gratis).
-- Dient der Missbrauchsbremse (höchstens 5 Anmeldungen pro E-Mail-
-- Adresse in 24 Stunden). RLS an, bewusst ohne Policies: nur der
-- service_role-Key im Backend greift darauf zu.
create table if not exists public.gratis_anmeldungen (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  programm_id uuid references public.programme(id) on delete set null,
  erstellt_am timestamptz not null default now()
);

create index if not exists gratis_anmeldungen_email_idx
  on public.gratis_anmeldungen (email, erstellt_am desc);

comment on table public.gratis_anmeldungen is
  'Protokoll der Gratis-Anmeldungen für Programme mit preis_cent = 0 (api/checkout.js?aktion=gratis). Grundlage der Missbrauchsbremse. Nur service_role.';

alter table public.gratis_anmeldungen enable row level security;
