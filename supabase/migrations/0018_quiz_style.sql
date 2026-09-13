-- ── Clinical-vignette question style ──────────────────────────────────────
-- A question is either "plain" (direct recall) or "vignette" (the fact wrapped
-- in a short patient scenario, board-exam style). Style is chosen per quiz;
-- a card can accumulate one of each. Existing rows are plain.

alter table public.quiz_questions
  add column style text not null default 'plain'
    check (style in ('plain', 'vignette'));

create index quiz_questions_flashcard_style_idx
  on public.quiz_questions (flashcard_id, style);
