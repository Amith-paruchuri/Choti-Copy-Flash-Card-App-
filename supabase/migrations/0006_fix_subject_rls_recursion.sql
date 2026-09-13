-- Choti Copy — 0006 fix RLS recursion on subjects
--
-- Bug: 0003 made subjects_insert_own / subjects_update_own reference
-- `public.subjects` from *inside a policy on public.subjects*. Postgres
-- re-applies the policy to that sub-select → "infinite recursion detected
-- in policy for relation subjects" on any INSERT/UPDATE. It only bit once a
-- brand-new subject was created (e.g. saving an import to a new subject).
--
-- Fix: check parent ownership through a SECURITY DEFINER function, which runs
-- as the function owner and therefore skips RLS on the inner query.

create or replace function public.user_owns_subject(p_subject_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.subjects
    where id = p_subject_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.user_owns_subject(uuid) from public;
grant execute on function public.user_owns_subject(uuid) to authenticated;

drop policy subjects_insert_own on public.subjects;
create policy subjects_insert_own on public.subjects
  for insert with check (
    user_id = (select auth.uid())
    and (parent_id is null or public.user_owns_subject(parent_id))
  );

drop policy subjects_update_own on public.subjects;
create policy subjects_update_own on public.subjects
  for update using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (parent_id is null or public.user_owns_subject(parent_id))
  );
