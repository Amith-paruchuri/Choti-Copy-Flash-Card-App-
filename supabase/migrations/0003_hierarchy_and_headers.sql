-- Choti Copy — 0003 hierarchy + display headers
-- Purely additive. Prepares for (Phase 4+):
--   • Anki-style nested decks: subjects can have a parent subject.
--   • AI-generated flashcards that carry a short title + summary line.
-- No UI uses the tree yet; every existing subject stays top-level (parent_id null).

-- ── subjects: nesting ───────────────────────────────────────────────────
alter table public.subjects
  add column parent_id uuid references public.subjects (id) on delete cascade;

create index subjects_parent_id_idx on public.subjects (parent_id);

-- Name is unique per level: once among a user's top-level subjects, and once
-- among the children of a given parent. (A single unique index can't express
-- this because NULL parent_id values never compare equal.)
drop index if exists public.subjects_user_lower_name_key;

create unique index subjects_user_toplevel_name_key
  on public.subjects (user_id, lower(name))
  where parent_id is null;

create unique index subjects_user_child_name_key
  on public.subjects (user_id, parent_id, lower(name))
  where parent_id is not null;

-- Writes must own the parent subject too.
drop policy subjects_insert_own on public.subjects;
create policy subjects_insert_own on public.subjects
  for insert with check (
    user_id = (select auth.uid())
    and (
      parent_id is null
      or exists (
        select 1 from public.subjects p
        where p.id = parent_id and p.user_id = (select auth.uid())
      )
    )
  );

drop policy subjects_update_own on public.subjects;
create policy subjects_update_own on public.subjects
  for update using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      parent_id is null
      or exists (
        select 1 from public.subjects p
        where p.id = parent_id and p.user_id = (select auth.uid())
      )
    )
  );

-- ── flashcards: display header ──────────────────────────────────────────
alter table public.flashcards
  add column title text
    check (title is null or char_length(btrim(title)) between 1 and 120),
  add column subtitle text
    check (subtitle is null or char_length(btrim(subtitle)) between 1 and 300);
