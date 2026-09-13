-- Choti Copy — 0005 imports
-- Upload material (image / PDF / WhatsApp .zip) → AI drafts flashcards →
-- user reviews → drafts are committed to `flashcards`.
--
-- Processing is chunk-per-request: `imports.chunks` holds the parsed work
-- items, and each POST /api/import/step does one chunk. Drafts land in
-- `import_cards` and survive a page refresh.

create table public.imports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('image', 'pdf', 'whatsapp_zip')),
  original_name text not null,
  storage_path  text not null,
  status        text not null default 'pending'
                     check (status in
                       ('pending', 'processing', 'ready', 'saved', 'error')),
  error         text,
  notes         text,                       -- e.g. "2 scanned pages skipped"
  chunks        jsonb not null default '[]'::jsonb,
  total_chunks  integer not null default 0,
  done_chunks   integer not null default 0,
  truncated     boolean not null default false,   -- hit a cap
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index imports_user_created_idx on public.imports (user_id, created_at desc);

create trigger imports_set_updated_at
  before update on public.imports
  for each row execute function public.set_updated_at();

create table public.import_cards (
  id         uuid primary key default gen_random_uuid(),
  import_id  uuid not null references public.imports (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  subtitle   text not null default '',
  content    text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index import_cards_import_pos_idx
  on public.import_cards (import_id, position);

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table public.imports      enable row level security;
alter table public.import_cards enable row level security;

create policy imports_select_own on public.imports
  for select using (user_id = (select auth.uid()));
create policy imports_insert_own on public.imports
  for insert with check (user_id = (select auth.uid()));
create policy imports_update_own on public.imports
  for update using (user_id = (select auth.uid()))
              with check (user_id = (select auth.uid()));
create policy imports_delete_own on public.imports
  for delete using (user_id = (select auth.uid()));

create policy import_cards_select_own on public.import_cards
  for select using (user_id = (select auth.uid()));
create policy import_cards_insert_own on public.import_cards
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.imports i
      where i.id = import_id and i.user_id = (select auth.uid())
    )
  );
create policy import_cards_update_own on public.import_cards
  for update using (user_id = (select auth.uid()))
              with check (user_id = (select auth.uid()));
create policy import_cards_delete_own on public.import_cards
  for delete using (user_id = (select auth.uid()));

-- ── Storage bucket + policies ───────────────────────────────────────────
-- Private bucket; each user can only touch objects under  imports/<their uid>/…
insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

create policy "imports bucket — own folder"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
