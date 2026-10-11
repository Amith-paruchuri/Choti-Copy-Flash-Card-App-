-- Choti Copy — 0024 per-feature daily usage (AI cards / mnemonics / quiz sets)
--
-- A separate, normalized table from `ai_usage_daily` (0021) on purpose: that
-- one stays the general "all AI calls" safety-net counter (soft-warn,
-- unenforced, still used by card-image describe/related-cards/resort/
-- condense — see src/lib/usage/ai.ts). This one backs the three NEW,
-- hard-enforced, individually-capped features in src/lib/billing/limits.ts.
-- One row per (user, day, feature) rather than three new columns on
-- ai_usage_daily, so a future gated feature is a new `feature` value, not
-- another migration.
--
-- Same RLS shape as ai_usage_daily: a user can read their own rows (so the
-- UI can show "14 of 30 used today"), but never write them directly — an
-- insert/update policy would let a user edit their own count down and
-- defeat the cap entirely. Writes only through record_feature_usage(), a
-- SECURITY DEFINER function (same pattern as record_ai_call()).

create table public.feature_usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  feature text not null check (feature in ('ai_cards', 'ai_mnemonics', 'ai_quiz_sets')),
  count   int  not null default 0 check (count >= 0),
  primary key (user_id, day, feature)
);

alter table public.feature_usage_daily enable row level security;

create policy feature_usage_daily_select_own on public.feature_usage_daily
  for select using (user_id = (select auth.uid()));
-- Deliberately no insert/update/delete policies for end users.

-- Increments today's counter for one feature by `p_amount` (default 1 —
-- card generation passes the actual number of cards produced, since one AI
-- call can draft several at once) and returns the new total, so the caller
-- can enforce the cap with the exact same number the UI will later show.
create or replace function public.record_feature_usage(p_feature text, p_amount int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.feature_usage_daily (user_id, day, feature, count)
  values (auth.uid(), (now() at time zone 'utc')::date, p_feature, p_amount)
  on conflict (user_id, day, feature) do update
    set count = public.feature_usage_daily.count + p_amount
  returning count into v_count;
  return v_count;
end;
$$;

revoke all on function public.record_feature_usage(text, int) from public;
grant execute on function public.record_feature_usage(text, int) to authenticated;
