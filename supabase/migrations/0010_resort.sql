-- Choti Copy — 0010 "Re-sort with AI"
--
-- Reuses the imports pipeline to file EXISTING flashcards into the subject
-- hierarchy: an import_card with a flashcard_id is a move, not a new card.

alter table public.imports drop constraint imports_kind_check;
alter table public.imports
  add constraint imports_kind_check
  check (kind in ('image', 'pdf', 'text', 'zip', 'resort'));

-- a re-sort job has no uploaded file
alter table public.imports alter column storage_path drop not null;

-- source subjects, so we can prune the ones left empty after a re-sort
alter table public.imports
  add column source_subject_ids uuid[] not null default '{}';

-- when set, committing the group MOVES this flashcard instead of inserting one
alter table public.import_cards
  add column flashcard_id uuid references public.flashcards (id) on delete cascade;
