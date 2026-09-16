-- ============================================================
-- MRH Coaching-Plattform — Mitgliederbereich (Community-Abo)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: neue Tabellen/Spalte/Bucket, keine bestehende Tabelle
-- wird entfernt. EINE bestehende Policy wird ersetzt (Schritt 3,
-- "coachie sieht eigene und plattformweite Termine" aus events.sql) --
-- exakt dieselbe Zugriffslogik wie bisher, nur um die
-- nur_mitglieder-Prüfung ergänzt.
-- ============================================================

-- 1) Mitgliedschaft: eigenständig buchbar, unabhängig von jedem
--    Kurskauf. Status wird ausschließlich serverseitig über den
--    Stripe-Webhook gepflegt (service_role) -- daher hier bewusst nur
--    eine SELECT-Policy für die eigene Zeile, keine INSERT/UPDATE-
--    Policy für authenticated.
create table if not exists public.mitgliedschaften (
  id uuid primary key default gen_random_uuid(),
  coachie_id uuid not null unique references public.coachies(id) on delete cascade,
  status text not null default 'aktiv' check (status in ('aktiv', 'gekuendigt', 'zahlung_fehlgeschlagen')),
  stripe_subscription_id text unique not null,
  stripe_customer_id text,
  start_datum timestamptz not null default now(),
  naechste_abrechnung timestamptz,
  aktualisiert_am timestamptz not null default now()
);

comment on table public.mitgliedschaften is
  'Community-Abo (Mitgliederbereich), eigenständig buchbar unabhängig von coachie_programme. status wird ausschließlich über api/webhooks/stripe.js (Subscription-Lifecycle-Events) gepflegt -- nie direkt vom Client.';

alter table public.mitgliedschaften enable row level security;

create policy "coachie sieht eigene Mitgliedschaft" on public.mitgliedschaften
  for select
  using (coachie_id = auth.uid());

-- 2) Mitglieder-Inhalte: nur bei aktiver Mitgliedschaft sichtbar.
create table if not exists public.mitglieder_inhalte (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('kpi_handbuch', 'audio', 'tipp', 'sonstiges')),
  titel text not null,
  beschreibung text,
  datei_url text,
  link_url text,
  veroeffentlicht_am timestamptz not null default now(),
  aktiv boolean not null default true
);

comment on table public.mitglieder_inhalte is
  'Inhalte exklusiv für aktive Mitglieder (Mitgliederbereich). datei_url zeigt auf ein Objekt im privaten Bucket "mitglieder-inhalte" (Pfad, kein voller Link -- Zugriff läuft über eine clientseitig angeforderte Signed URL, siehe Storage-Policy unten), link_url ist ein externer Link (z. B. YouTube). Mindestens eines der beiden sollte gesetzt sein, das prüft die Anwendung, nicht die Datenbank. "Live-Sitzung" wird bewusst NICHT hier abgebildet, sondern als nur_mitglieder-Termin im Events-Kalender (Punkt 3), um keine zweite Terminverwaltung zu erzeugen.';

alter table public.mitglieder_inhalte enable row level security;

create policy "aktives Mitglied sieht veroeffentlichte Inhalte" on public.mitglieder_inhalte
  for select
  using (
    aktiv = true
    and exists (
      select 1 from public.mitgliedschaften m
      where m.coachie_id = auth.uid() and m.status = 'aktiv'
    )
  );

-- 3) Events-Kalender erweitern: nur_mitglieder-Termine, serverseitig
--    (RLS) gefiltert. Ersetzt die bestehende Select-Policy aus
--    events.sql um exakt eine zusätzliche Bedingung.
alter table public.events
  add column if not exists nur_mitglieder boolean not null default false;

comment on column public.events.nur_mitglieder is
  'true = Termin nur für Coachies mit mitgliedschaften.status = ''aktiv'' sichtbar (z. B. Live-Sitzungen des Mitgliederbereichs), unabhängig von programm_id. false (Standard) = unverändertes bisheriges Verhalten.';

drop policy if exists "coachie sieht eigene und plattformweite Termine" on public.events;
create policy "coachie sieht eigene und plattformweite Termine" on public.events
  for select
  using (
    auth.uid() is not null
    and (
      programm_id is null
      or exists (
        select 1 from public.coachie_programme cp
        where cp.coachie_id = auth.uid() and cp.programm_id = events.programm_id
      )
    )
    and (
      nur_mitglieder = false
      or exists (
        select 1 from public.mitgliedschaften m
        where m.coachie_id = auth.uid() and m.status = 'aktiv'
      )
    )
  );

-- 4) Einstellungen (Preis/Bezahltext), Singleton-Zeile -- analog zu
--    programme.preis_cent/stripe_price_id, aber für die Mitgliedschaft
--    als eigenständiges Produkt statt pro Programm. Preis/Betrag steht
--    laut Auftrag noch nicht fest, deshalb hier konfigurierbar statt
--    hart codiert. RLS aktiv, aber bewusst OHNE Policies -- die
--    öffentliche Verkaufsseite liest über api/checkout.js
--    (?resource=mitgliedschaft, service_role), nicht direkt per
--    Client, analog zum bestehenden Muster für stripe_events.
create table if not exists public.mitgliedschaft_einstellungen (
  id boolean primary key default true check (id),
  titel text not null default 'MRH Community-Mitgliedschaft',
  beschreibung text,
  preis_cent integer,
  stripe_price_id text,
  bezahltext text,
  aktualisiert_am timestamptz not null default now()
);

comment on table public.mitgliedschaft_einstellungen is
  'Singleton-Konfiguration (Preis, Stripe-Price-ID, Verkaufstext) für die Mitgliedschaft, admin-pflegbar über api/admin/programme.js?resource=mitgliedschaft-einstellungen. id ist bewusst boolean mit check(id) statt uuid -- erzwingt serverseitig genau eine Zeile.';

insert into public.mitgliedschaft_einstellungen (id)
values (true)
on conflict (id) do nothing;

alter table public.mitgliedschaft_einstellungen enable row level security;

-- 5) Privater Storage-Bucket für Mitglieder-Dateien (z. B.
--    KPI-Handbuch als PDF), getrennt vom bestehenden Bucket
--    "Programme" (Kurszugriff) -- eigene Zugriffslogik (aktive
--    Mitgliedschaft statt coachie_programme), daher eigener Bucket
--    statt eines weiteren Sonderfalls in der bestehenden Policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mitglieder-inhalte',
  'mitglieder-inhalte',
  false,
  20971520, -- 20 MB
  array['application/pdf', 'audio/mpeg', 'audio/wav', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Nur aktive Mitglieder lesen Mitglieder-Dateien"
on storage.objects for select
to authenticated
using (
  bucket_id = 'mitglieder-inhalte'
  and exists (
    select 1 from public.mitgliedschaften m
    where m.coachie_id = auth.uid() and m.status = 'aktiv'
  )
);
