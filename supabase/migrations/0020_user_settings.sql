-- Choti Copy — 0020 study-pacing settings
--
-- Anki-style pacing knobs, per user. Kept OUT of `profiles` on purpose:
-- `profiles` has no end-user write policy (billing state is webhook-only), and
-- RLS can't scope writes to specific columns, so an update policy there would
-- let a user edit their own subscription_tier.

create table public.user_settings (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  -- Max genuinely-new cards introduced per day, across all sessions. Anki default is 20.
  new_cards_per_day     int not null default 20 check (new_cards_per_day between 0 and 500),
  -- Personal "cards/day" goal (due + new, distinct cards). null = no goal set.
  daily_review_target   int check (daily_review_target between 1 and 2000),
  updated_at            timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy user_settings_select_own on public.user_settings
  for select using (user_id = (select auth.uid()));
create policy user_settings_insert_own on public.user_settings
  for insert with check (user_id = (select auth.uid()));
create policy user_settings_update_own on public.user_settings
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
