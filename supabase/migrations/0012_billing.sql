-- Choti Copy — 0012 billing groundwork (payments NOT live)
--
-- `profiles` holds subscription state. Users can read their own row but never
-- write it — billing state is set only by the webhook handler running with the
-- service-role key. Terms acceptance lives in auth user_metadata, not here.

create table public.profiles (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  subscription_tier   text not null default 'free'
    check (subscription_tier in ('free', 'trialing', 'pro', 'past_due', 'canceled')),
  billing_provider    text check (billing_provider in ('stripe', 'razorpay')),
  customer_id         text,
  subscription_id     text,
  current_period_end  timestamptz,
  trial_ends_at       timestamptz,
  updated_at          timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (user_id = (select auth.uid()));
-- Deliberately no insert / update / delete policies for end users.

-- Webhook audit + idempotency. Service-role only (no policies).
create table public.subscription_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null check (provider in ('stripe', 'razorpay')),
  event_id    text not null,
  event_type  text not null,
  user_id     uuid references auth.users (id) on delete set null,
  payload     jsonb,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.subscription_events enable row level security;

-- Backfill a free-tier row for everyone who already has an account.
insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;
