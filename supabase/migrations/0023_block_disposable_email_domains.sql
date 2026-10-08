-- Choti Copy — 0023 block disposable/placeholder email domains at signup
--
-- A table, not a hardcoded list — so a new domain can be blocked later with
-- a plain insert, no code change or redeploy needed:
--   insert into public.blocked_email_domains (domain) values ('newdomain.com');
--
-- This is the DATABASE-level half of the check: a BEFORE INSERT trigger on
-- auth.users that rejects the row outright. It's defense in depth, not the
-- only guard — it catches anything that creates a user directly against
-- Supabase's auth API, not just signups that go through this app's own
-- signUpWithPassword() (src/app/login/actions.ts), which has its own
-- independent check so a blocked signup gets a clear, friendly error
-- ("Please use a real email address.") instead of a raw Postgres exception
-- surfacing to the user. The two checks deliberately do NOT share one
-- source of truth: this migration is written but not yet applied (by
-- request), so the app-level check is a self-contained TypeScript list
-- (src/lib/auth/blocked-email-domains.ts) rather than an RPC into a table
-- that doesn't exist in the live database yet. Once this migration is
-- applied, keep both lists in sync when adding a domain — or, as a later
-- improvement, switch the app-level check to call
-- is_blocked_email_domain() below via .rpc() instead of maintaining two
-- lists; not done here since this migration isn't live yet.

create table public.blocked_email_domains (
  domain text primary key
);

-- RLS on, no policies at all — this table is never queried directly by an
-- anon/authenticated client, only through is_blocked_email_domain() below,
-- which runs as security definer regardless of who calls it.
alter table public.blocked_email_domains enable row level security;

insert into public.blocked_email_domains (domain) values
  ('example.com'),
  ('example.org'),
  ('example.net'),
  ('test.com'),
  ('mailinator.com'),
  ('mailinator.net'),
  ('guerrillamail.com'),
  ('guerrillamail.org'),
  ('guerrillamail.net'),
  ('guerrillamail.biz'),
  ('guerrillamail.de'),
  ('10minutemail.com'),
  ('10minutemail.net'),
  ('tempmail.com'),
  ('temp-mail.org'),
  ('yopmail.com'),
  ('yopmail.net'),
  ('yopmail.fr'),
  ('trashmail.com'),
  ('sharklasers.com'),
  ('maildrop.cc'),
  ('dispostable.com'),
  ('throwawaymail.com'),
  ('getnada.com'),
  ('fakeinbox.com'),
  ('mailnesia.com'),
  ('mintemail.com'),
  ('mohmal.com'),
  ('emailondeck.com'),
  ('mailcatch.com'),
  ('spamgourmet.com'),
  ('discard.email')
on conflict (domain) do nothing;

-- Single source of truth for the DB-level check — shared by the trigger
-- below. `stable` (reads data, writes none) not `immutable` (the table's
-- contents can change between calls).
create or replace function public.is_blocked_email_domain(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_domain text;
begin
  if p_email is null or position('@' in p_email) = 0 then
    return false;
  end if;
  v_domain := lower(split_part(p_email, '@', 2));
  return exists (
    select 1 from public.blocked_email_domains where domain = v_domain
  );
end;
$$;

-- Exposed so the app could eventually call this instead of keeping its own
-- TypeScript list in sync by hand (see header comment) — granted to `anon`
-- specifically because signup happens before any session/JWT exists.
revoke all on function public.is_blocked_email_domain(text) from public;
grant execute on function public.is_blocked_email_domain(text) to anon, authenticated;

create or replace function public.reject_blocked_email_domains()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_blocked_email_domain(new.email) then
    raise exception 'Please use a real email address.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger reject_blocked_email_domains_trigger
  before insert on auth.users
  for each row execute function public.reject_blocked_email_domains();
