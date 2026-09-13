-- ── Test history: one row per completed quiz/exam session ─────────────────
-- The per-answer FSRS log stays in `review_events` (unchanged). This table is
-- the "test history" record: a self-contained snapshot of a finished session
-- so it can be reviewed later even after questions are regenerated or cards
-- are deleted. Written once, at completion.

create table public.quiz_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  mode         text not null check (mode in ('practice', 'exam')),
  subject_ids  uuid[] not null default '{}',
  scope_label  text not null default 'All subjects',
  total        int  not null check (total > 0),
  correct      int  not null default 0 check (correct >= 0),
  answered     int  not null default 0 check (answered >= 0),
  time_limit_s int  check (time_limit_s is null or time_limit_s > 0),
  limit_kind   text check (limit_kind in ('overall', 'per_question')),
  duration_s   int  not null default 0 check (duration_s >= 0),
  -- Array of { questionId, cardId, subjectId, cardTitle, subjectName,
  --   subjectColor, format, questionText, options[], correctAnswer,
  --   explanation, picked (string|null), correct (bool) }
  items        jsonb not null default '[]'::jsonb
                 check (jsonb_typeof(items) = 'array'),
  created_at   timestamptz not null default now()
);

create index quiz_sessions_user_time_idx
  on public.quiz_sessions (user_id, created_at desc);

alter table public.quiz_sessions enable row level security;

create policy quiz_sessions_select_own on public.quiz_sessions
  for select using (user_id = (select auth.uid()));
create policy quiz_sessions_insert_own on public.quiz_sessions
  for insert with check (user_id = (select auth.uid()));
create policy quiz_sessions_delete_own on public.quiz_sessions
  for delete using (user_id = (select auth.uid()));
-- No update policy — a finished session is immutable.
