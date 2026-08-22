-- ============================================================
-- MRH Coaching-Plattform — Punkt 3 (Phase 2): Material-Typ um
-- "audio" und "datei" erweitern
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- session_material.typ war bislang ein unbeschränktes Freitextfeld
-- (Admin-Formular war ein einfaches <input>, siehe MaterialManager.jsx).
-- Diese Migration führt erstmals eine Check-Constraint für die
-- zulässigen Werte ein (pdf, text, audio, datei) und ergänzt damit
-- audio/datei. Als "not valid" hinzugefügt, damit sie nur für künftige
-- Inserts/Updates gilt und nicht an eventuell abweichend geschriebenen
-- Testdaten (z. B. Groß-/Kleinschreibung) scheitert; NULL bleibt
-- weiterhin erlaubt (kein Pflichtfeld).
-- ============================================================

alter table public.session_material
  add constraint session_material_typ_check
  check (typ is null or typ in ('pdf', 'text', 'audio', 'datei'))
  not valid;

comment on column public.session_material.typ is
  'Materialtyp: pdf, text, audio oder datei (generisch, für alles außerhalb PDF/Audio). NULL = kein Typ angegeben.';
