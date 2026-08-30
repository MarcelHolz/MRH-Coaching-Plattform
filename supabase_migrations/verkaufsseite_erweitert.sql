-- ============================================================
-- MRH Coaching-Plattform — Erweiterte Verkaufsseiten-Inhalte
-- (Subline, Leistungen, Abgrenzung, CTA-Text)
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: vier neue, nullable Spalten auf programme. Keine
-- RLS-Änderung nötig -- werden wie beschreibung/zielgruppe_text über
-- api/checkout.js mit service_role gelesen bzw. im Admin-Bereich
-- gepflegt.
-- ============================================================

alter table public.programme
  add column if not exists subline text,
  add column if not exists leistungen_text text,
  add column if not exists abgrenzung_text text,
  add column if not exists cta_text text;

comment on column public.programme.subline is
  'Kurzer Untertitel direkt unter der Headline auf der Verkaufsseite (KaufenPage.jsx). NULL = keine Subline.';

comment on column public.programme.leistungen_text is
  'Zeilenumbruch-getrennte Liste für den Abschnitt "Was Du bekommst" auf der Verkaufsseite -- eine Zeile = ein Punkt. NULL = Abschnitt entfällt.';

comment on column public.programme.abgrenzung_text is
  'Zeilenumbruch-getrennte Liste für den Abschnitt "Was das hier nicht ist" auf der Verkaufsseite -- eine Zeile = ein Punkt. NULL = Abschnitt entfällt.';

comment on column public.programme.cta_text is
  'Beschriftung des Kaufen-Buttons auf der Verkaufsseite, z. B. "Business & Sichtbarkeit starten". NULL = Standardtext "Jetzt kaufen".';
