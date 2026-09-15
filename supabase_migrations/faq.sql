-- ============================================================
-- MRH Coaching-Plattform — FAQ-Wissensbasis für den Coachie-Chat
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue Tabelle. Keine bestehende Tabelle/Policy
-- wird verändert.
-- ============================================================

create table if not exists public.faq_eintraege (
  id uuid primary key default gen_random_uuid(),
  frage text not null,
  antwort text not null,
  aktiv boolean not null default true,
  reihenfolge integer not null default 0,
  erstellt_am timestamptz not null default now()
);

comment on table public.faq_eintraege is
  'Feste Wissensbasis für den FAQ-Chat im Coachie-Bereich (api/certificate.js?resource=faq-chat) -- ausschließlich admin- bzw. agent-gepflegte Frage/Antwort-Paare, nie automatisch aus Coachie-individuellen Fortschrittsdaten befüllt (FernUSG-Abgrenzung: der Chat darf keine persönliche Rückmeldung zum Lernfortschritt geben).';

comment on column public.faq_eintraege.aktiv is
  'true = im Chat sichtbar/verwendbar. Über die Agent-API (api/agent/inhalte.js?resource=faq) angelegte Einträge landen mit aktiv=false als Entwurf, bis ein Admin sie freigibt -- gleiches Muster wie programme.aktiv.';

-- Kein Client-/Browser-Zugriff vorgesehen: Admin-CRUD, Agent-CRUD und
-- der Chat-Endpunkt laufen ausnahmslos über service_role
-- (getSupabaseAdmin(), umgeht RLS). RLS bleibt aktiviert, aber bewusst
-- ohne Policies -- sperrt jeden Zugriff über den Supabase-Client im
-- Browser vollständig, analog zu anderen rein admin-verwalteten
-- Tabellen dieses Projekts.
alter table public.faq_eintraege enable row level security;
