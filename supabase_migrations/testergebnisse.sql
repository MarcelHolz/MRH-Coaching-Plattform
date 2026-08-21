-- ============================================================
-- MRH Coaching-Plattform — Testergebnisse im Coachie-Bereich
--
-- Einmalig im Supabase Dashboard AUSFÜHREN: Coaching-Plattform-Projekt
-- (nqrcnnzosyeldwyckmfu), SQL Editor -> New query -> diesen Inhalt
-- einfügen -> Run. Claude Code führt das NICHT automatisch aus.
--
-- Voraussetzung auf der anderen Seite (separates Projekt, eigene
-- Datei): supabase_migrations/profil_quiz_reader.sql im
-- Profil-Quiz-Projekt ausgeführt.
-- ============================================================

create table if not exists public.coachie_testergebnisse (
  id uuid primary key default gen_random_uuid(),
  coachie_id uuid not null references public.coachies(id) on delete cascade,
  test_typ text not null check (test_typ in ('kurztest_24', 'vorbereitung_12')),
  quell_email text not null,
  -- id der Original-Zeile im Profil-Quiz-Projekt (quiz_ergebnisse bzw.
  -- kurztest_gross_ergebnisse) -- kein Fremdschlüssel, da andere
  -- Datenbank; verhindert nur, dasselbe Ergebnis zweimal zu verknüpfen.
  quell_id uuid unique,
  ergebnis_daten jsonb not null,
  pdf_url text,
  verknuepft_am timestamptz not null default now()
);

alter table public.coachie_testergebnisse enable row level security;

-- Coachie sieht ausschließlich eigene Ergebnisse. Kein Insert/Update/
-- Delete für authenticated -- das Verknüpfen läuft ausschließlich über
-- den Admin-Bereich (service_role), analog zu coachie_programme, das
-- ebenfalls keine Schreib-Policy für Coachies hat.
create policy "coachie sieht eigene Testergebnisse" on public.coachie_testergebnisse
  for select
  using (coachie_id = auth.uid());
