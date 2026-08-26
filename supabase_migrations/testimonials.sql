-- ============================================================
-- MRH Coaching-Plattform — Testimonial-Sammelmechanismus
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: neue Tabelle sowie eine neue nullable Spalte auf
-- coachie_programme. Keine bestehende Tabelle/Policy wird verändert.
-- ============================================================

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  coachie_id uuid not null references public.coachies(id),
  programm_id uuid not null references public.programme(id),
  text text not null,
  freigegeben boolean not null default false,
  erstellt_am timestamptz not null default now()
);

comment on table public.testimonials is
  'Von Coachies eingereichte Erfahrungsberichte. freigegeben=false bis ein Admin sie im Admin-Bereich manuell prüft und freigibt -- erst dann erscheinen sie auf der Verkaufsseite (/kaufen/:slug). Keine automatische Freigabe.';

alter table public.testimonials enable row level security;

-- Coachie darf eigene Testimonials einreichen und den Status der
-- eigenen Einreichungen einsehen (z. B. um zu sehen, ob sie schon
-- freigegeben wurde) -- aber nicht selbst ändern oder löschen, das
-- bleibt exklusiv dem Admin-Bereich (service_role, umgeht RLS)
-- vorbehalten, ebenso das Lesen freigegebener Testimonials anderer
-- Coachies für die öffentliche Verkaufsseite (läuft über
-- api/checkout.js mit service_role, keine eigene Policy dafür nötig).
drop policy if exists "coachie legt eigenes Testimonial an" on public.testimonials;
create policy "coachie legt eigenes Testimonial an" on public.testimonials
  for insert
  with check (coachie_id = auth.uid());

drop policy if exists "coachie sieht eigene Testimonials" on public.testimonials;
create policy "coachie sieht eigene Testimonials" on public.testimonials
  for select
  using (coachie_id = auth.uid());

-- Verhindert, dass der Cron-Job (api/cron/erinnerungen.js) für dieselbe
-- 100%-Fertigstellung mehrfach eine Einladungs-Mail verschickt.
alter table public.coachie_programme
  add column if not exists testimonial_email_gesendet_am timestamptz;

comment on column public.coachie_programme.testimonial_email_gesendet_am is
  'Zeitpunkt, zu dem die Testimonial-Einladungsmail für dieses Programm/diesen Coachie verschickt wurde, nachdem alle Sessions abgeschlossen waren. NULL = noch nicht verschickt.';
