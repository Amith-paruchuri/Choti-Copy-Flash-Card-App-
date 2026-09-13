-- Choti Copy — RLS isolation check
-- Run in the Supabase SQL editor AFTER 0001 + 0002 are applied and after
-- you have at least two real signed-up users with some data.
--
-- Replace the two UUIDs below with real auth.users.id values
-- (Dashboard → Authentication → Users, or `select id, email from auth.users`).

\set user_a '00000000-0000-0000-0000-00000000000a'
\set user_b '00000000-0000-0000-0000-00000000000b'

-- ── Simulate user A ─────────────────────────────────────────────────────
begin;
  select set_config('role', 'authenticated', true);
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', :'user_a', 'role', 'authenticated')::text,
    true
  );

  -- Expect: only user A's rows.
  select 'A sees subjects'  as check, count(*) from public.subjects;
  select 'A sees flashcards' as check, count(*) from public.flashcards;
rollback;

-- ── Simulate user B looking for user A's data ───────────────────────────
begin;
  select set_config('role', 'authenticated', true);
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', :'user_b', 'role', 'authenticated')::text,
    true
  );

  -- Expect: 0 rows for every one of these.
  select 'B sees A subjects (want 0)' as check, count(*)
    from public.subjects where user_id = :'user_a';
  select 'B sees A flashcards (want 0)' as check, count(*)
    from public.flashcards where user_id = :'user_a';
  select 'B sees A quiz_questions (want 0)' as check, count(*)
    from public.quiz_questions where user_id = :'user_a';
  select 'B sees A quiz_attempts (want 0)' as check, count(*)
    from public.quiz_attempts where user_id = :'user_a';

  -- Expect: this INSERT fails the RLS WITH CHECK (wrong user_id).
  -- Uncomment to verify it raises "new row violates row-level security policy".
  -- insert into public.subjects (user_id, name) values (:'user_a', 'hacked');
rollback;
