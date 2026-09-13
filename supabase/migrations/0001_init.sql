-- Choti Copy — 0001 init
-- Apply in the Supabase SQL editor (Dashboard → SQL Editor → New query),
-- or with the CLI: `supabase db push`. Run migrations in filename order.

create extension if not exists pgcrypto;

-- ── updated_at trigger helper ───────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── subjects ────────────────────────────────────────────────────────────
create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  color      text not null default '#6366f1'
                  check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);

create unique index subjects_user_lower_name_key
  on public.subjects (user_id, lower(name));
create index subjects_user_id_idx on public.subjects (user_id);

-- ── flashcards ──────────────────────────────────────────────────────────
create table public.flashcards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  content     text not null check (char_length(btrim(content)) between 1 and 4000),
  source_type text not null default 'typed'
                   check (source_type in ('typed', 'pasted', 'image')),
  is_active   boolean not null default true,          -- soft delete
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index flashcards_user_subject_active_idx
  on public.flashcards (user_id, subject_id, is_active);
create index flashcards_user_active_idx
  on public.flashcards (user_id, is_active);

create trigger flashcards_set_updated_at
  before update on public.flashcards
  for each row execute function public.set_updated_at();

-- ── quiz_questions ──────────────────────────────────────────────────────
create table public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  flashcard_id   uuid not null references public.flashcards (id) on delete cascade,
  question_text  text not null check (char_length(btrim(question_text)) between 1 and 1000),
  options        jsonb not null,
  correct_answer text not null,
  explanation    text not null default '',
  created_at     timestamptz not null default now(),
  constraint quiz_questions_options_is_array
    check (jsonb_typeof(options) = 'array'),
  constraint quiz_questions_options_len
    check (jsonb_array_length(options) between 2 and 6),
  constraint quiz_questions_correct_in_options
    check (options ? correct_answer)
);

create index quiz_questions_user_flashcard_idx
  on public.quiz_questions (user_id, flashcard_id);

-- ── quiz_attempts ───────────────────────────────────────────────────────
create table public.quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  question_id     uuid not null references public.quiz_questions (id) on delete cascade,
  selected_answer text not null,
  is_correct      boolean not null,
  attempted_at    timestamptz not null default now()
);

create index quiz_attempts_user_question_idx
  on public.quiz_attempts (user_id, question_id, attempted_at desc);
create index quiz_attempts_user_time_idx
  on public.quiz_attempts (user_id, attempted_at desc);
