-- ============================================================
-- Im SQL Editor des Coaching-Plattform-Projekts ausführen
-- (nqrcnnzosyeldwyckmfu), NICHT im Profil-Quiz-Projekt.
--
-- Ergänzt eine je Programm konfigurierbare Standard-Zugriffsdauer für
-- automatische Stripe-Käufe. Ersetzt den bisher im Webhook fest
-- codierten Wert von 36 Monaten (siehe api/webhooks/stripe.js) durch
-- einen im Admin-Bereich einstellbaren, optionalen Wert je Programm.
--
-- Hinweis zur bestehenden RLS-Durchsetzung: coachie_programme.zugriff_bis
-- selbst sowie die zugehörigen RLS-Policies auf programme/sessions/
-- session_material existieren bereits (aus phase2_stripe.sql) und wurden
-- gegen die Live-Datenbank geprüft -- sie sind aktiv und blenden
-- abgelaufene Zuordnungen bereits serverseitig aus. Diese Migration
-- ergänzt nur die neue Spalte, keine erneute RLS-Änderung nötig.
-- ============================================================

alter table public.programme
  add column if not exists standard_zugriffsmonate integer;

comment on column public.programme.standard_zugriffsmonate is
  'Anzahl Monate, die ein automatischer Stripe-Kauf dieses Programms Zugriff gewährt. NULL = unbegrenzter Zugriff (Standard).';
