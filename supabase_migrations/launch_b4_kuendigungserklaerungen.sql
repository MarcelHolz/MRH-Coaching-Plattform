-- ============================================================
-- MRH Coaching-Plattform — Launch B4: Kündigungserklärungen
-- (§ 312k BGB), datenschutzkonform
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Ersetzt die (live nie ausgeführte) Tabelle "kuendigungen" aus
-- kuendigung.sql. kuendigung.sql muss NICHT mehr ausgeführt werden.
-- Rein additiv, mehrfach ausführbar.
-- ============================================================

-- 1) Protokoll jeder Kündigungserklärung, unabhängig davon, ob sie
--    einem Vertrag zugeordnet werden kann. Nachweis für Zugang und
--    Inhalt der Erklärung. RLS an, bewusst ohne Policies: nur der
--    service_role-Key im Backend greift darauf zu.
create table if not exists public.kuendigungserklaerungen (
  id uuid primary key default gen_random_uuid(),
  erstellt_am timestamptz not null default now(),
  name text not null,
  email text not null,
  vertrag text not null default 'alle' check (vertrag in ('alle', 'mitgliedschaft', 'kurs')),
  vertrag_id uuid,
  angaben text,
  zeitpunkt text not null default 'naechstmoeglich',
  quelle text not null default 'formular' check (quelle in ('formular', 'eingeloggt')),
  coachie_id uuid references public.coachies(id) on delete set null,
  status text not null default 'eingegangen'
    check (status in ('eingegangen', 'manuell_pruefen', 'ausgefuehrt', 'fehler')),
  ausgefuehrt_am timestamptz,
  ergebnis text
);

comment on table public.kuendigungserklaerungen is
  'Kündigungserklärungen über /vertrag-kuendigen (quelle formular, Ausführung erst nach Klick auf den signierten Mail-Link) oder aus den Einstellungen (quelle eingeloggt, sofort ausgeführt). zeitpunkt = naechstmoeglich oder YYYY-MM-DD. Nur service_role.';

create index if not exists kuendigungserklaerungen_email_idx
  on public.kuendigungserklaerungen (email, erstellt_am desc);

alter table public.kuendigungserklaerungen enable row level security;

-- 2) Kündigungszeitpunkt für Kurszugriffe (aus kuendigung.sql, live
--    bisher nicht vorhanden). Rein informativ, ändert zugriff_bis nicht.
alter table public.coachie_programme
  add column if not exists gekuendigt_am timestamptz;
