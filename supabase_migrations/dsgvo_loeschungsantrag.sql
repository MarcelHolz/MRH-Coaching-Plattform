-- ============================================================
-- MRH Coaching-Plattform — DSGVO-Löschungsantrag
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue Tabelle, keine bestehende Tabelle/Policy
-- wird verändert. Die "Meine Daten anzeigen"-Ansicht selbst braucht
-- keine Migration -- sie liest ausschließlich bereits bestehende
-- Tabellen (coachies, coachie_programme, coachie_testergebnisse) über
-- deren bereits vorhandene RLS-Policies ("coachie sieht eigene Zeile").
-- ============================================================

create table if not exists public.loeschungsantraege (
  id uuid primary key default gen_random_uuid(),
  coachie_id uuid not null references public.coachies(id),
  status text not null default 'offen' check (status in ('offen', 'bearbeitet')),
  angefragt_am timestamptz not null default now()
);

comment on table public.loeschungsantraege is
  'Protokoll der über /coachie/einstellungen ("Meine Daten" -> "Löschung beantragen") eingereichten DSGVO-Löschungsanträge. Löst KEINE automatische Löschung aus (kollidiert potenziell mit Vertrags-/Rechnungsaufbewahrungspflichten) -- api/certificate.js?resource=dsgvo-loeschung protokolliert hier nur den Antrag und verschickt eine Benachrichtigung an den Admin zur manuellen Prüfung/Bearbeitung. status bleibt vorerst rein informativ, ohne eigenes Admin-UI dafür -- Bearbeitung läuft über die Benachrichtigungsmail.';

alter table public.loeschungsantraege enable row level security;

-- Bewusst OHNE Policies: Insert läuft ausschließlich serverseitig über
-- api/certificate.js?resource=dsgvo-loeschung (service_role, mit
-- requireCoachie-Prüfung im Code) -- analog zu kuendigungen.sql.
