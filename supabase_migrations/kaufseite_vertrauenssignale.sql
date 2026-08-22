-- ============================================================
-- MRH Coaching-Plattform — Punkt 3: Kaufseite um Vertrauenssignale
-- ergänzen (Umsetzungsauftrag Phase 1 Quick Wins)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: zwei neue, nullable Spalten auf programme. Bestehende
-- Programme laufen ohne Angabe unverändert weiter (Felder werden auf
-- der Kaufseite nur gerendert, wenn gesetzt). Keine RLS-Änderung
-- nötig -- Lese-/Schreibzugriff läuft wie bisher ausschließlich über
-- den service_role Key in api/checkout.js (Vorschau) bzw.
-- api/admin/programme.js (Pflege im Admin-Bereich).
-- ============================================================

alter table public.programme
  add column if not exists ablauf_schritte jsonb,
  add column if not exists zielgruppe_text text;

comment on column public.programme.ablauf_schritte is
  'Liste von bis zu drei kurzen Texten für "So läuft es ab" auf der Kaufseite, z. B. ["Schritt 1", "Schritt 2", "Schritt 3"]. NULL/leer = Bereich wird ausgeblendet.';

comment on column public.programme.zielgruppe_text is
  'Kurzer "Für wen ist das"-Satz, direkt unter dem Titel der Kaufseite angezeigt. NULL = wird ausgeblendet.';
