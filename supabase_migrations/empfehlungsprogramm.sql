-- ============================================================
-- MRH Coaching-Plattform — Empfehlungsprogramm (technische Grundstruktur)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue Spalte (nullable, kein Default-Zwang für
-- bestehende Zeilen) und eine neue Tabelle. Keine bestehende Policy
-- wird verändert.
--
-- Belohnungslogik (Rabatt, Guthaben, o.ä.) ist hier bewusst NICHT
-- abgebildet -- das ist laut Aufgabenstellung eine spätere,
-- eigenständige Entscheidung. Diese Migration legt nur die technische
-- Grundlage: Code-Zuordnung + Tracking erfolgreicher Empfehlungen.
-- ============================================================

alter table public.coachies
  add column if not exists empfehlungscode text unique;

comment on column public.coachies.empfehlungscode is
  'Persönlicher Empfehlungscode, lazy vergeben beim ersten Aufruf von api/certificate.js?resource=empfehlung (nicht beim Anlegen des Coachies) -- deckt so auch bereits bestehende Coachies ab, ohne ein Backfill-Skript zu brauchen.';

create table if not exists public.empfehlungen (
  id uuid primary key default gen_random_uuid(),
  werber_coachie_id uuid not null references public.coachies(id) on delete cascade,
  geworbener_coachie_id uuid not null references public.coachies(id) on delete cascade,
  programm_id uuid references public.programme(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  unique (geworbener_coachie_id, programm_id)
);

create index if not exists empfehlungen_werber_idx
  on public.empfehlungen (werber_coachie_id);

comment on table public.empfehlungen is
  'Erfolgreiche Empfehlungen (Feature Empfehlungsprogramm): eine Zeile pro abgeschlossenem Kauf (api/webhooks/stripe.js), der über den persönlichen Empfehlungscode eines Coachies zustande kam. unique(geworbener_coachie_id, programm_id) macht den Insert idempotent gegen Stripe-Webhook-Retries. Belohnungslogik ist bewusst noch nicht abgebildet, siehe README-Abschnitt "Empfehlungsprogramm".';

-- Kein Client-/Browser-Zugriff vorgesehen: Zuordnung (checkout.js),
-- Tracking (webhooks/stripe.js) und Admin-Übersicht laufen
-- ausnahmslos über service_role. RLS bleibt aktiviert, aber bewusst
-- ohne Policies -- analog zu faq_eintraege.sql/entwurf_historie.sql.
alter table public.empfehlungen enable row level security;
