-- ============================================================
-- MRH Coaching-Plattform — Launch C3: Testimonials nicht am Admin
-- vorbei freischaltbar
--
-- Einmalig im Supabase Dashboard ausführen: SQL Editor -> New query
-- -> diesen Inhalt einfügen -> Run. Claude Code führt das NICHT
-- automatisch auf der Live-Datenbank aus.
--
-- Ersetzt die Insert-Policy aus testimonials.sql. Ein Coachie darf nur
-- unfreigegebene Testimonials für Programme einreichen, denen er
-- tatsächlich zugeordnet ist. Die Freigabe bleibt dem Admin-Bereich
-- (service_role) vorbehalten. Mehrfach ausführbar.
-- ============================================================

drop policy if exists "coachie legt eigenes Testimonial an" on public.testimonials;
create policy "coachie legt eigenes Testimonial an" on public.testimonials
  for insert
  to authenticated
  with check (
    coachie_id = auth.uid()
    and freigegeben = false
    and exists (
      select 1 from public.coachie_programme cp
      where cp.coachie_id = auth.uid()
        and cp.programm_id = testimonials.programm_id
    )
  );
