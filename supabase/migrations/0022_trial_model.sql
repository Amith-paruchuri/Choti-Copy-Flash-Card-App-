-- Choti Copy — 0022 15-day no-card trial for every account
--
-- Every account — new or existing — gets a 15-day Pro-level trial with no
-- card required. There is no scheduled job to "end" it: `trial_ends_at` is
-- just a timestamp, and the app computes the EFFECTIVE tier live on every
-- read (`effectiveTier()` in `src/lib/billing/tier.ts`) by comparing it to
-- now(). `profiles.subscription_tier` itself is left alone here — it still
-- only changes via the billing webhook — so this never contradicts a real
-- paid subscription (pro always wins, see `effectiveTier()`), and nothing
-- is ever deleted: a lapsed trial is just a past-dated timestamp sitting
-- next to a `subscription_tier` that still correctly reads 'free'.

-- New signups: every row inserted into `auth.users` gets a matching
-- `profiles` row with a trial starting now. Runs as the table owner
-- (security definer) since end users have no write policy on `profiles`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, subscription_tier, trial_ends_at)
  values (new.id, 'trialing', now() + interval '15 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing accounts: back-fill a trial dated from whenever this migration
-- is applied (effectively "launch date + 15 days"). Two passes, both
-- idempotent/re-runnable like 0012's own backfill:
--
--  1. Anyone who signed up before this migration existed but doesn't have a
--     `profiles` row at all yet (the 0012 backfill only ran once, and
--     nothing created a row for a signup after that until the trigger
--     above) gets one now, trial included.
insert into public.profiles (user_id, trial_ends_at)
select id, now() + interval '15 days' from auth.users
on conflict (user_id) do nothing;

--  2. Anyone with an existing `profiles` row that has never had a trial
--     (trial_ends_at is null — true for every row created before today)
--     gets one backfilled. Never overwrites a trial_ends_at that's already
--     set, so re-running this migration is a no-op the second time.
update public.profiles
set trial_ends_at = now() + interval '15 days'
where trial_ends_at is null;
