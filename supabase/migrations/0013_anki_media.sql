-- Choti Copy — 0013 Anki import + flashcard images
--
-- Anki decks often embed images. They're parsed client-side, uploaded to the
-- `flashcard-media` Storage bucket (see note below), deduplicated by content
-- hash, and referenced from `flashcards.images`.

alter table public.imports drop constraint imports_kind_check;
alter table public.imports
  add constraint imports_kind_check
  check (kind in ('image', 'pdf', 'text', 'zip', 'resort', 'anki'));

-- [{ "path": "<uid>/<hash>.<ext>", "hash": "<sha256>", "mime": "image/png" }]
alter table public.flashcards
  add column images jsonb not null default '[]'::jsonb;

-- One row per distinct file a user has uploaded — so the same image across
-- many cards / imports is stored once.
create table public.media_objects (
  user_id      uuid not null references auth.users (id) on delete cascade,
  content_hash text not null,
  storage_path text not null,
  mime         text not null,
  bytes        integer not null default 0,
  created_at   timestamptz not null default now(),
  primary key (user_id, content_hash)
);

alter table public.media_objects enable row level security;

create policy media_objects_select_own on public.media_objects
  for select using (user_id = (select auth.uid()));
create policy media_objects_insert_own on public.media_objects
  for insert with check (user_id = (select auth.uid()));
create policy media_objects_delete_own on public.media_objects
  for delete using (user_id = (select auth.uid()));

-- ── Storage bucket (create in the Supabase dashboard) ──────────────────
-- Storage → New bucket → name: flashcard-media, Public: OFF.
-- Then add these policies (Storage → Policies → flashcard-media):
--
--   -- read own
--   create policy "flashcard-media read own"
--   on storage.objects for select to authenticated
--   using (bucket_id = 'flashcard-media'
--          and (storage.foldername(name))[1] = auth.uid()::text);
--
--   -- write own
--   create policy "flashcard-media write own"
--   on storage.objects for insert to authenticated
--   with check (bucket_id = 'flashcard-media'
--               and (storage.foldername(name))[1] = auth.uid()::text);
--
--   -- delete own
--   create policy "flashcard-media delete own"
--   on storage.objects for delete to authenticated
--   using (bucket_id = 'flashcard-media'
--          and (storage.foldername(name))[1] = auth.uid()::text);
