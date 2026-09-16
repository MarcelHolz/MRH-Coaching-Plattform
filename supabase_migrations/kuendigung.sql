-- ============================================================
-- MRH Coaching-Plattform — Kündigungsbutton (§ 312k BGB)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue Tabelle, eine neue Spalte. Keine bestehende
-- Tabelle/Policy wird entfernt oder ersetzt.
-- ============================================================

-- Protokoll jeder über den Kündigungsbutton (/vertrag-kuendigen)
-- ausgelösten Kündigung -- dient als "systemseitige Zeitstempelung ...
-- als Nachweis für den Zugang der Erklärung" (siehe Auftrag). Bewusst
-- unabhängig vom aktuellen Stand von mitgliedschaften.status bzw.
-- coachie_programme.gekuendigt_am, die sich später durch andere
-- Ereignisse (z. B. erneuter Vertragsabschluss) weiter verändern
-- können -- dieser Log-Eintrag bleibt der unveränderliche Beleg für
-- den Zeitpunkt der Kündigungserklärung selbst.
create table if not exists public.kuendigungen (
  id uuid primary key default gen_random_uuid(),
  coachie_id uuid not null references public.coachies(id) on delete cascade,
  vertrag_typ text not null check (vertrag_typ in ('mitgliedschaft', 'kurs')),
  vertrag_referenz_id uuid not null,
  email text not null,
  erstellt_am timestamptz not null default now(),
  bestaetigungsmail_gesendet_am timestamptz
);

comment on table public.kuendigungen is
  'Protokoll jeder über /vertrag-kuendigen (api/checkout.js?resource=kuendigung) ausgelösten Kündigung -- Nachweis für den Zugang der Kündigungserklärung (§ 312k BGB). vertrag_referenz_id zeigt je nach vertrag_typ auf mitgliedschaften.id oder coachie_programme.id (kein FK, da zwei mögliche Zieltabellen).';

create index if not exists kuendigungen_coachie_idx
  on public.kuendigungen (coachie_id, erstellt_am desc);

alter table public.kuendigungen enable row level security;

create policy "coachie sieht eigene Kuendigungen" on public.kuendigungen
  for select
  using (coachie_id = auth.uid());

-- Kündigungszeitpunkt für Kurszugriffe (Einmalzahlung): kein sofortiger
-- Zugriffsentzug (bereits bezahlt, zugriff_bis bleibt unverändert
-- maßgeblich), aber festgehalten, dass keine automatische Verlängerung
-- mehr stattfinden soll, falls es künftig einmal eine gäbe. Rein
-- informativ -- keine bestehende RLS-Policy prüft diese Spalte.
alter table public.coachie_programme
  add column if not exists gekuendigt_am timestamptz;

comment on column public.coachie_programme.gekuendigt_am is
  'Zeitpunkt der Kündigung über /vertrag-kuendigen (§ 312k BGB). NULL = nicht gekündigt. Ändert zugriff_bis nicht -- der bereits bezahlte Zugriffszeitraum bleibt bestehen, nur eine etwaige künftige automatische Verlängerung entfällt.';
