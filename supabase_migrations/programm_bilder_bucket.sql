-- ============================================================
-- MRH Coaching-Plattform — Öffentlicher Storage-Bucket für
-- Programm-/Modul-Vorschaubilder (Bild-Upload im Admin-Bereich)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Getrennt vom bestehenden privaten Bucket "Programme" (Kursmaterial,
-- pro Programm zugriffsbeschränkt via storage_policy_pro_programm.sql)
-- -- "programm-bilder" ist bewusst public, da Programm-/Modul-
-- Vorschaubilder ohnehin überall im Coachie-Bereich sichtbar sind,
-- keine Kaufberechtigung voraussetzen und öffentlich über eine feste
-- URL eingebunden werden (kein Signed-URL-Overhead nötig).
--
-- Upload läuft ausschließlich über die admin-geschützte Route
-- api/admin/programme.js (?resource=bild-upload): der Server erzeugt
-- dort per service_role ein Einweg-Token (createSignedUploadUrl), das
-- der Client anschließend für genau einen Upload einlöst
-- (uploadToSignedUrl) -- ohne dieses Token ist kein Schreibzugriff auf
-- den Bucket möglich, unabhängig von RLS (die Supabase-Doku bestätigt
-- für uploadToSignedUrl ausdrücklich "objects table permissions:
-- none"). Es sind daher keine zusätzlichen RLS-Policies nötig, weder
-- für Lesezugriff (public-Flag reicht) noch für Schreibzugriff.
--
-- file_size_limit/allowed_mime_types sind serverseitige
-- Zusatzabsicherung auf Supabase-Ebene (zusätzlich zur Prüfung in
-- api/admin/programme.js und im Browser) -- falls diese Spalten auf
-- einem älteren Supabase-Projekt nicht existieren, die beiden Zeilen
-- entfernen und Größen-/Typ-Limit nur clientseitig/serverseitig
-- durchsetzen.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'programm-bilder',
  'programm-bilder',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
