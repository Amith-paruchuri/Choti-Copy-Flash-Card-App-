-- ── Related-concept links between flashcards ──────────────────────────────
-- AI-detected (or hand-added) "see also" edges. Directed rows, surfaced
-- bidirectionally by querying both endpoints. Becomes the edge set for the
-- knowledge-map graph view.

create table public.flashcard_links (
  user_id      uuid not null references auth.users (id) on delete cascade,
  flashcard_id uuid not null references public.flashcards (id) on delete cascade,
  related_id   uuid not null references public.flashcards (id) on delete cascade,
  relation     text,   -- short label, e.g. "contrast with", "mechanism of"
  source       text not null default 'ai' check (source in ('ai', 'manual')),
  created_at   timestamptz not null default now(),
  primary key (user_id, flashcard_id, related_id),
  constraint flashcard_links_no_self check (flashcard_id <> related_id)
);

create index flashcard_links_related_idx
  on public.flashcard_links (user_id, related_id);

alter table public.flashcard_links enable row level security;

create policy flashcard_links_select_own on public.flashcard_links
  for select using (user_id = (select auth.uid()));
create policy flashcard_links_insert_own on public.flashcard_links
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.flashcards f
      where f.id = flashcard_id and f.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.flashcards f
      where f.id = related_id and f.user_id = (select auth.uid())
    )
  );
create policy flashcard_links_delete_own on public.flashcard_links
  for delete using (user_id = (select auth.uid()));
