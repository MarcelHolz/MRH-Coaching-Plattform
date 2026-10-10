-- ============================================================
-- MRH Coaching-Plattform — Widerrufsbutton (§ 356a BGB)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- MUSS vor dem Deployment laufen: ohne die Tabelle scheitert das
-- Absenden auf /vertrag-widerrufen. Rein additiv, mehrfach ausführbar.
-- ============================================================

-- Protokoll jeder Widerrufserklärung über /vertrag-widerrufen. Nachweis
-- für Inhalt und Zeitpunkt des Eingangs. Es wird nichts automatisch
-- erstattet oder gesperrt; der Status wird im Admin unter "Widerrufe"
-- manuell gepflegt. RLS an, bewusst ohne Policies: nur der
-- service_role-Key im Backend greift darauf zu.
create table if not exists public.widerrufserklaerungen (
  id uuid primary key default gen_random_uuid(),
  eingegangen_am timestamptz not null default now(),
  name text not null,
  email text not null,
  vertrag text not null,
  vertrag_programm_id uuid references public.programme(id) on delete set null,
  kaufdatum_oder_bestellnr text,
  anmerkung text,
  coachie_id uuid references public.coachies(id) on delete set null,
  status text not null default 'eingegangen'
    check (status in ('eingegangen', 'erstattet', 'abgelehnt_erloschen', 'manuell_pruefen')),
  bearbeitet_am timestamptz,
  notiz text
);

comment on table public.widerrufserklaerungen is
  'Widerrufserklärungen über den Widerrufsbutton /vertrag-widerrufen (api/checkout.js?aktion=widerruf). vertrag = Programmtitel, "Mitgliedschaft" oder "Anderer Vertrag". Bearbeitung ausschließlich manuell im Admin, keine automatische Erstattung oder Sperre. Nur service_role.';

create index if not exists widerrufserklaerungen_email_idx
  on public.widerrufserklaerungen (email, eingegangen_am desc);

create index if not exists widerrufserklaerungen_eingang_idx
  on public.widerrufserklaerungen (eingegangen_am desc);

alter table public.widerrufserklaerungen enable row level security;
