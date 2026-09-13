-- Choti Copy — 0002 row-level security
-- Every table is readable/writable only by the row's owner (auth.uid()).
-- `(select auth.uid())` is wrapped in a subselect so Postgres caches it
-- per-statement (Supabase's recommended RLS performance pattern).

alter table public.subjects       enable row level security;
alter table public.flashcards     enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts  enable row level security;

-- ── subjects ────────────────────────────────────────────────────────────
create policy subjects_select_own on public.subjects
  for select using (user_id = (select auth.uid()));
create policy subjects_insert_own on public.subjects
  for insert with check (user_id = (select auth.uid()));
create policy subjects_update_own on public.subjects
  for update using (user_id = (select auth.uid()))
              with check (user_id = (select auth.uid()));
create policy subjects_delete_own on public.subjects
  for delete using (user_id = (select auth.uid()));

-- ── flashcards ──────────────────────────────────────────────────────────
-- Writes additionally require the target subject to belong to the user.
create policy flashcards_select_own on public.flashcards
  for select using (user_id = (select auth.uid()));
create policy flashcards_insert_own on public.flashcards
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.subjects s
      where s.id = subject_id and s.user_id = (select auth.uid())
    )
  );
create policy flashcards_update_own on public.flashcards
  for update using (user_id = (select auth.uid()))
              with check (
                user_id = (select auth.uid())
                and exists (
                  select 1 from public.subjects s
                  where s.id = subject_id and s.user_id = (select auth.uid())
                )
              );
create policy flashcards_delete_own on public.flashcards
  for delete using (user_id = (select auth.uid()));

-- ── quiz_questions ──────────────────────────────────────────────────────
create policy quiz_questions_select_own on public.quiz_questions
  for select using (user_id = (select auth.uid()));
create policy quiz_questions_insert_own on public.quiz_questions
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.flashcards f
      where f.id = flashcard_id and f.user_id = (select auth.uid())
    )
  );
create policy quiz_questions_update_own on public.quiz_questions
  for update using (user_id = (select auth.uid()))
              with check (user_id = (select auth.uid()));
create policy quiz_questions_delete_own on public.quiz_questions
  for delete using (user_id = (select auth.uid()));

-- ── quiz_attempts ───────────────────────────────────────────────────────
create policy quiz_attempts_select_own on public.quiz_attempts
  for select using (user_id = (select auth.uid()));
create policy quiz_attempts_insert_own on public.quiz_attempts
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.quiz_questions q
      where q.id = question_id and q.user_id = (select auth.uid())
    )
  );
-- attempts are immutable: no update / delete policies (owner still can't,
-- RLS denies by default).
