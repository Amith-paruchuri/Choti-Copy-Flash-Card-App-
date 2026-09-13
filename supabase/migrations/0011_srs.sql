-- Choti Copy — 0011 spaced repetition + unified memory layer
--
-- One scheduling state per (user, card): `card_memory` (FSRS-6). Every graded
-- interaction — a self-rating in the deck viewer OR a quiz answer — writes a
-- row to `review_events` and advances that same state. A wrong quiz answer is
-- an FSRS "Again" (rating 1); there is no separate quiz-scoring system.

-- ── quiz_questions: MCQ vs fill-in-the-blank ────────────────────────────
alter table public.quiz_questions
  add column format text not null default 'mcq'
    check (format in ('mcq', 'blank'));

-- ── drop the never-populated attempts table ────────────────────────────
-- `review_events` below is the single log; quiz_attempts had 0 rows.
drop table if exists public.quiz_attempts;

-- ── card_memory: per-(user,card) FSRS-6 state ──────────────────────────
-- No row ⇒ the card is "New" (state 0, due now).
create table public.card_memory (
  user_id        uuid not null references auth.users (id) on delete cascade,
  flashcard_id   uuid not null references public.flashcards (id) on delete cascade,
  state          smallint not null default 0
                   check (state between 0 and 3), -- New / Learning / Review / Relearning
  due            timestamptz not null default now(),
  stability      double precision not null default 0,
  difficulty     double precision not null default 0,
  elapsed_days   integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps           integer not null default 0,
  lapses         integer not null default 0,
  last_review    timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (user_id, flashcard_id)
);

create index card_memory_user_due_idx on public.card_memory (user_id, due);

create trigger card_memory_set_updated_at
  before update on public.card_memory
  for each row execute function public.set_updated_at();

-- ── review_events: append-only log of every rating ─────────────────────
create table public.review_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  flashcard_id  uuid not null references public.flashcards (id) on delete cascade,
  question_id   uuid references public.quiz_questions (id) on delete set null,
  rating        smallint not null check (rating between 1 and 4),
  source        text not null check (source in ('review', 'quiz')),
  reviewed_at   timestamptz not null default now(),
  log           jsonb, -- full ts-fsrs ReviewLog, for the parameter optimizer later
  constraint review_events_quiz_needs_question
    check (source <> 'quiz' or question_id is not null)
);

create index review_events_user_card_time_idx
  on public.review_events (user_id, flashcard_id, reviewed_at desc);
create index review_events_user_time_idx
  on public.review_events (user_id, reviewed_at desc);
create index review_events_question_idx
  on public.review_events (question_id)
  where question_id is not null;

-- ── RLS ────────────────────────────────────────────────────────────────
alter table public.card_memory   enable row level security;
alter table public.review_events enable row level security;

create policy card_memory_select_own on public.card_memory
  for select using (user_id = (select auth.uid()));
create policy card_memory_insert_own on public.card_memory
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.flashcards f
      where f.id = flashcard_id and f.user_id = (select auth.uid())
    )
  );
create policy card_memory_update_own on public.card_memory
  for update using (user_id = (select auth.uid()))
              with check (user_id = (select auth.uid()));
create policy card_memory_delete_own on public.card_memory
  for delete using (user_id = (select auth.uid()));

create policy review_events_select_own on public.review_events
  for select using (user_id = (select auth.uid()));
create policy review_events_insert_own on public.review_events
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.flashcards f
      where f.id = flashcard_id and f.user_id = (select auth.uid())
    )
  );
-- events are immutable: no update / delete policies (RLS denies by default).

-- ── recall strip: lean toward due / repeatedly-missed cards ────────────
-- The strip stays a passive peek; /review is the graded loop. Weight rises
-- with lapses and once a card is overdue.
create or replace view public.flashcard_weight
with (security_invoker = true) as
select
  f.id      as flashcard_id,
  f.user_id as user_id,
  (
    1.0
    + coalesce(m.lapses, 0)
    + case when m.due is not null and m.due <= now() then 1.0 else 0.0 end
    + case when m.flashcard_id is null then 0.5 else 0.0 end -- unseen cards
  )::double precision as weight
from public.flashcards f
left join public.card_memory m
  on m.flashcard_id = f.id and m.user_id = f.user_id
where f.is_active;
