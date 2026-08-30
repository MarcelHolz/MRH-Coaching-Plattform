-- ============================================================
-- MRH Coaching-Plattform — Zeitlich befristeter Einführungspreis
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: drei neue, nullable Spalten auf programme. Keine
-- RLS-Änderung nötig -- werden wie preis_cent über api/checkout.js mit
-- service_role gelesen bzw. im Admin-Bereich gepflegt.
-- ============================================================

alter table public.programme
  add column if not exists einfuehrungspreis_cent integer,
  add column if not exists einfuehrungspreis_gueltig_bis date,
  add column if not exists stripe_price_id_einfuehrung text;

comment on column public.programme.einfuehrungspreis_cent is
  'Optionaler zeitlich befristeter Einführungspreis in Cent, gültig bis einschließlich einfuehrungspreis_gueltig_bis. NULL = kein Einführungspreis, regulärer preis_cent gilt wie bisher.';

comment on column public.programme.einfuehrungspreis_gueltig_bis is
  'Letzter Tag (einschließlich), an dem der Einführungspreis gilt. Wird sowohl auf der Verkaufsseite (KaufenPage.jsx) als auch serverseitig im Checkout (api/checkout.js) geprüft -- Client-Datum wird dafür nie vertraut.';

comment on column public.programme.stripe_price_id_einfuehrung is
  'Stripe Price ID für den Einführungspreis. Muss separat in Stripe angelegt werden (eigene Price-Objekte pro Preispunkt, wie bei stripe_price_id). Wird nur verwendet, wenn gesetzt und einfuehrungspreis_gueltig_bis noch nicht verstrichen ist, sonst greift stripe_price_id wie bisher.';
