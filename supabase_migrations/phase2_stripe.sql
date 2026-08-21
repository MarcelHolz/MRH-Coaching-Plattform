-- ============================================================
-- MRH Coaching-Plattform — Phase 2: Self-Signup & Stripe-Zahlung
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Geprüft gegen den aktuellen Live-Stand von programme/sessions/
-- session_material/coachies/coachie_programme/coachie_status
-- (Schema + RLS-Policies), Stand 21.08.2026. Rein additiv: bestehende
-- Tabellen/Policies werden nicht entfernt, nur um die drei
-- SELECT-Policies unten (Schritt 4) ersetzt, deren neue Fassung
-- exakt dieselbe Zugriffslogik behält und nur die Ablaufprüfung
-- ergänzt.
-- ============================================================

-- 1. Neue Spalten auf programme für den Kauf-Flow
alter table public.programme
  add column if not exists stripe_price_id text,
  add column if not exists preis_cent integer,
  add column if not exists oeffentlich_kaufbar boolean not null default false,
  add column if not exists slug text unique;

-- 2. Idempotenz-Tabelle für Stripe-Webhooks. RLS aktiv, aber bewusst
--    OHNE Policies -- damit ist die Tabelle für anon/authenticated
--    komplett unsichtbar, nur der service_role Key (serverseitig in
--    /api/webhooks/stripe) kann darauf zugreifen.
create table if not exists public.stripe_events (
  id text primary key,
  verarbeitet_am timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- 3. Zugriffsbefristung je Zuordnung. NULL = unbegrenzter Zugriff
--    (z. B. weiterhin bei allen manuell von Marcel zugeordneten
--    Programmen); bei Stripe-Käufen wird das serverseitig im Webhook
--    auf Kaufdatum + 36 Monate gesetzt.
alter table public.coachie_programme
  add column if not exists zugriff_bis timestamptz;

-- 4. RLS-Policies verschärfen: abgelaufener Zugriff blendet Programme,
--    Sessions und Materialien serverseitig aus (nicht nur im
--    Frontend versteckt). coachie_status bleibt bewusst unverändert
--    -- der Coachie soll seinen zuletzt erfassten Bearbeitungsstand
--    weiterhin sehen können, auch wenn der Zugriff auf Video/Workbook
--    später abläuft.

drop policy if exists "coachie sieht zugeordnete Programme" on public.programme;
create policy "coachie sieht zugeordnete Programme" on public.programme
  for select
  using (
    exists (
      select 1 from public.coachie_programme cp
      where cp.programm_id = programme.id
        and cp.coachie_id = auth.uid()
        and (cp.zugriff_bis is null or cp.zugriff_bis > now())
    )
  );

drop policy if exists "coachie sieht Sessions zugeordneter Programme" on public.sessions;
create policy "coachie sieht Sessions zugeordneter Programme" on public.sessions
  for select
  using (
    exists (
      select 1 from public.coachie_programme cp
      where cp.programm_id = sessions.programm_id
        and cp.coachie_id = auth.uid()
        and (cp.zugriff_bis is null or cp.zugriff_bis > now())
    )
  );

drop policy if exists "coachie sieht Material zugeordneter Sessions" on public.session_material;
create policy "coachie sieht Material zugeordneter Sessions" on public.session_material
  for select
  using (
    exists (
      select 1 from public.sessions s
      join public.coachie_programme cp on cp.programm_id = s.programm_id
      where s.id = session_material.session_id
        and cp.coachie_id = auth.uid()
        and (cp.zugriff_bis is null or cp.zugriff_bis > now())
    )
  );

-- 5. Keine neue Policy für die öffentliche Kaufseite nötig: /kaufen/:slug
--    liest Titel/Beschreibung/Preis über die neue Serverless Function
--    api/public/programme.js mit dem service_role Key (umgeht RLS
--    gezielt für die paar öffentlich vorgesehenen Felder), die
--    bestehenden Coachie-Policies bleiben davon unberührt.
