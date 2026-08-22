-- ============================================================
-- MRH Coaching-Plattform — Punkt 2 (Phase 2): Storage-Zugriff auf
-- Bucket "Programme" pro Programm statt bucket-weit
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Ersetzt die bestehende Basis-Policy (nur authentifizierte Nutzer,
-- bucket-weiter Lesezugriff inkl. list()) durch eine Policy, die das
-- erste Pfadsegment (Programm-Ordner) gegen einen aktiven
-- coachie_programme-Eintrag des eingeloggten Coachies prüft, inkl.
-- zugriff_bis. Voraussetzung: der Ordnername auf oberster Ebene im
-- Bucket entspricht exakt der programm_id (UUID) als Text -- die
-- aktuell dort liegenden Testdateien mit sprechenden Ordnernamen
-- (z. B. 03_Fuehrung-Kommunikation/...) müssen dafür auf UUID-Ordner
-- umgezogen bzw. neu hochgeladen werden, siehe Hinweis am Ende der
-- Datei.
--
-- Der Name der bestehenden Basis-Policy wurde direkt im Supabase
-- Dashboard vergeben und ist uns daher nicht bekannt. Der folgende
-- Block sucht dynamisch nach allen bestehenden Policies auf
-- storage.objects, deren USING-Klausel den Bucket "Programme"
-- referenziert, und löscht genau diese -- sicherer als ein Drop auf
-- einen geratenen Namen, ohne Policies anderer Buckets zu berühren.
-- ============================================================

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and qual ilike '%''Programme''%'
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy "Nur Coachies mit aktivem Zugriff auf das Programm"
on storage.objects for select
to authenticated
using (
  bucket_id = 'Programme'
  and exists (
    select 1 from public.coachie_programme cp
    where cp.coachie_id = auth.uid()
      and cp.programm_id::text = (storage.foldername(name))[1]
      and (cp.zugriff_bis is null or cp.zugriff_bis > now())
  )
);

-- Hinweis: Bestehende Testdateien (aktuell z. B. unter
-- "03_Fuehrung-Kommunikation/03.01/...") sind mit dieser Policy für
-- keinen Coachie mehr lesbar, da kein programm_id-Ordner mit diesem
-- Namen existiert. Entweder die Ordner im Bucket "Programme" auf die
-- jeweilige programm_id (aus der Tabelle programme, Spalte id)
-- umbenennen/verschieben, oder die Dateien unter dem korrekten
-- UUID-Ordner neu hochladen und die zugehörigen session_material.
-- datei_url-Einträge entsprechend anpassen.
