-- Choti Copy — 0022 opt-in 15-day no-card trial
--
-- Every account starts on 'free' with no trial. A signed-in user can start
-- their ONE 15-day Pro-level trial whenever they like by calling
-- `start_trial()` (wired to the "Start 15-day free trial" button). There is
-- no scheduled job to "end" it: `trial_ends_at` is just a timestamp, and the
-- app computes the EFFECTIVE tier live on every read (`effectiveTier()` in
-- `src/lib/billing/tier.ts`) by comparing it to now(). `profiles.subscription_tier`
-- otherwise only changes via the billing webhook, so this never contradicts
-- a real paid subscription (pro always wins, see `effectiveTier()`), and
-- nothing is ever deleted: a lapsed trial is just a past-dated timestamp.

-- New signups: every row inserted into `auth.users` gets a matching
-- `profiles` row, plain free, no trial. Runs as the table owner (security
-- definer) since end users have no write policy on `profiles`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, subscription_tier)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing accounts: anyone who signed up before this migration existed but
-- doesn't have a `profiles` row at all yet (the 0012 backfill only ran once,
-- and nothing created a row for a signup after that until the trigger above)
-- gets a plain free row now. Never touches `trial_ends_at` on a row that
-- already exists — opt-in means nobody's trial starts without them asking.
insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- Starts the caller's trial. A single atomic update: both the eligibility
-- check and the write happen in one statement, so there's no window where
-- `subscription_tier` and `trial_ends_at` could be set inconsistently (and
-- no way to call this twice and extend/reset a trial already used). Returns
-- the new `trial_ends_at` on success, or NULL if the caller already has a
-- trial on record (used or active) or is already 'pro' — the server action
-- treats NULL as "not eligible" and surfaces a friendly error.
create or replace function public.start_trial()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trial_ends_at timestamptz;
begin
  update public.profiles
  set subscription_tier = 'trialing',
      trial_ends_at = now() + interval '15 days'
  where user_id = auth.uid()
    and trial_ends_at is null
    and subscription_tier <> 'pro'
  returning trial_ends_at into v_trial_ends_at;

  return v_trial_ends_at;
end;
$$;

revoke all on function public.start_trial() from public;
grant execute on function public.start_trial() to authenticated;
