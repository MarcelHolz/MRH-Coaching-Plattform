-- ============================================================
-- MRH Coaching-Plattform — Rechnungs-Download im Coachie-Bereich
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Rein additiv: eine neue Spalte. Keine neue Policy nötig -- die
-- bestehende(n) Policy(s), über die ein Coachie schon heute seine
-- eigene coachies-Zeile lesen kann (siehe z. B. erster_login.sql,
-- AuthContext.jsx), deckt automatisch auch diese neue Spalte mit ab.
-- ============================================================

alter table public.coachies
  add column if not exists stripe_customer_id text;

comment on column public.coachies.stripe_customer_id is
  'Stripe-Customer-ID, einmal je Coachie -- unabhängig davon, ob sie über einen Kurskauf oder die Mitgliedschaft zustande kam (api/webhooks/stripe.js setzt sie bei beiden, sofern noch nicht vorhanden). Grundlage für die Rechnungshistorie (api/certificate.js?resource=rechnungen, stripe.invoices.list). NULL = noch kein Stripe-Kauf mit Invoice-Erzeugung, z. B. bei manuell vom Admin angelegten Coachies.';
