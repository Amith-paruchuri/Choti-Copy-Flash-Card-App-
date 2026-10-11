-- Choti Copy — 0025 harden record_feature_usage()
--
-- 0024's function trusted p_amount. Because it is callable by any
-- authenticated user via RPC, a negative amount would let a user lower their
-- own daily counter and defeat the cap. This replaces it with a version that
-- only accepts a sane positive amount and requires a signed-in user.

create or replace function public.record_feature_usage(p_feature text, p_amount int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000 then
    raise exception 'Invalid usage amount.' using errcode = '22023';
  end if;

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

-- ROLLBACK (comment only): restore the 0024 definition of record_feature_usage
-- by re-running its create or replace function block.
