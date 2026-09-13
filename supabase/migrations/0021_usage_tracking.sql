-- Choti Copy — 0021 per-user usage tracking (AI calls + storage foundation)
--
-- Two halves:
--
-- 1. AI calls/day. A new counter table, one row per (user, UTC day). Same
--    reasoning as `profiles`/`user_settings` (0012/0020): a user must be able
--    to *read* their own usage, but never write it directly — an insert/update
--    policy would let them edit their own count down and defeat the cap
--    entirely. Writes only happen through `record_ai_call()`, a
--    SECURITY DEFINER function (same pattern as `user_owns_subject` in 0006),
--    called once per successful AI provider request from server code.
--
-- 2. Storage. No new table — `media_objects.bytes` (0013) already gives an
--    exact, live per-user total via `sum(bytes)`, so tracking it twice would
--    just be a second number that can drift from the first. The cap numbers
--    themselves (both AI calls and storage) are tier-driven constants in
--    code (`src/lib/usage/caps.ts`), keyed off `profiles.subscription_tier` —
--    there's nothing here to migrate for the cap values themselves.

create table public.ai_usage_daily (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  calls    int  not null default 0 check (calls >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage_daily enable row level security;

create policy ai_usage_daily_select_own on public.ai_usage_daily
  for select using (user_id = (select auth.uid()));
-- Deliberately no insert/update/delete policies for end users.

create or replace function public.record_ai_call()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calls int;
begin
  insert into public.ai_usage_daily (user_id, day, calls)
  values (auth.uid(), (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set calls = public.ai_usage_daily.calls + 1
  returning calls into v_calls;
  return v_calls;
end;
$$;

revoke all on function public.record_ai_call() from public;
grant execute on function public.record_ai_call() to authenticated;
