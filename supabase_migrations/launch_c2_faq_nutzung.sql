-- ============================================================
-- MRH Coaching-Plattform — Launch C2: Kostenbremse FAQ-Chat
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- MUSS vor dem Deployment laufen: ohne die Funktion antwortet der
-- FAQ-Chat mit "gerade nicht verfügbar" (bewusst gesperrt statt
-- unbegrenzt). Rein additiv, mehrfach ausführbar.
-- ============================================================

create table if not exists public.faq_nutzung (
  coachie_id uuid not null references public.coachies(id) on delete cascade,
  datum date not null,
  anzahl integer not null default 0,
  primary key (coachie_id, datum)
);

comment on table public.faq_nutzung is
  'Anzahl FAQ-Chat-Fragen pro Coachie und Kalendertag (Europe/Berlin). Tageslimit in api/certificate.js (FAQ_CHAT_TAGESLIMIT). Nur service_role.';

alter table public.faq_nutzung enable row level security;

-- Zählt eine Frage atomar hoch, solange das Limit nicht erreicht ist.
-- Liefert true, wenn die Frage gestellt werden darf, sonst false.
create or replace function public.faq_nutzung_buchen(p_coachie_id uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anzahl integer;
begin
  insert into public.faq_nutzung as fn (coachie_id, datum, anzahl)
  values (p_coachie_id, (now() at time zone 'Europe/Berlin')::date, 1)
  on conflict (coachie_id, datum)
    do update set anzahl = fn.anzahl + 1
    where fn.anzahl < p_limit
  returning anzahl into v_anzahl;

  return v_anzahl is not null;
end;
$$;

revoke all on function public.faq_nutzung_buchen(uuid, integer) from public, anon, authenticated;
grant execute on function public.faq_nutzung_buchen(uuid, integer) to service_role;
