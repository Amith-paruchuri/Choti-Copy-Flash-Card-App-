# Launch Report — overnight verification pass

Generated autonomously overnight. Scope: this repo only. No push, no
deploy, no live Razorpay keys touched, no secret values printed, no user
data deleted.

## 1. Did the webhook flow work for last night's test payment?

**No — and it's a setup gap, not a code bug.** Evidence:

- Before cleanup, `subscription_events` held exactly **one** row, and it was
  leftover debris from my own earlier verification run (`user_id: null`,
  event `payment.failed:pay_fail_nouser_...`) — not anything from your test
  payment. Zero real Razorpay webhook deliveries had ever been recorded.
- Your profile (`5e029e9c-de6a-450e-b3f7-e6b59d796611`) **did** have
  `subscription_id: sub_TlAV5fM6ek3yyI` and `billing_provider: razorpay` set
  — proof `startCheckout()` ran correctly and really did create a live
  test-mode Razorpay subscription. But `subscription_tier` was still
  `"trialing"` (not `"pro"`) and `current_period_end` was still `null` —
  proof the webhook never arrived to flip it. This is exactly the safe
  "stuck activating" behavior the app is designed to show when the webhook
  hasn't landed — it correctly never granted Pro from the browser alone.
- An `ngrok` tunnel was running (`https://dragonish-catapult-eggbeater.ngrok-free.dev`
  → `localhost:3001`), but its own metrics showed **zero connections ever
  received** since it started.
- I confirmed the tunnel and route both work correctly: a request through
  the public ngrok URL reached `/api/billing/webhook` and correctly
  rejected a bad signature with `400 {"error":"Invalid signature."}`. So
  the infrastructure (tunnel → dev server → route → signature check) is
  sound end to end.

**Conclusion:** Razorpay's TEST-mode dashboard was never actually
configured to POST to that ngrok URL (or wasn't pointed at the right one at
the time of the test) — nothing reached the tunnel at all. There is nothing
to fix in the webhook code itself; I verified it thoroughly in an earlier
session (24/24 synthetic signed-event checks, including a same-event replay
for idempotency) and it behaves correctly. **Tomorrow's item #1** below
covers exactly this.

One other real bug found and fixed along the way (not in app code): my own
`scripts/test-webhook.ts` cleaned up its synthetic test rows by `user_id`,
which missed the one deliberately-posted-with-no-user-id test case. Fixed
to clean up by timestamp instead, and removed the one leftover row it had
left behind from an earlier session.

## 2. Test subscription reset

Cancelled on Razorpay's side (test mode) and reset in the database.

**Razorpay:** `sub_TlAV5fM6ek3yyI` was `status: "created"` → cancel call →
`status: "cancelled"`.

**Profile row `5e029e9c-de6a-450e-b3f7-e6b59d796611` — before:**
```
subscription_tier:   trialing
billing_provider:    razorpay
subscription_id:     sub_TlAV5fM6ek3yyI
customer_id:         null
current_period_end:  null
trial_ends_at:       2026-10-22T21:01:03Z
```

**— after:**
```
subscription_tier:   free
billing_provider:    null
subscription_id:     null
customer_id:         null
current_period_end:  null
trial_ends_at:       2026-10-22T21:01:03Z   (unchanged — see note)
```

Note on `trial_ends_at`: your instruction assumed it was null; it wasn't —
this account had already started its real 15-day trial at some point
tonight, separately from the checkout attempt. Per "do not delete any user
data" I left it exactly as-is rather than nulling out a real record. Net
effect is the same either way for the trial button (`canStartTrial()`
checks `trial_ends_at === null`, so the "Start trial" button stays
correctly hidden for this account — it's already used its one trial,
which is accurate, not a bug). I also cleared `billing_provider` as part
of the reset (not explicitly listed, but left dangling as `"razorpay"`
with everything else cleared would have been an inconsistent half-state).

`subscription_events` is now empty (0 rows) — the one leftover test row
from item 1 was the only thing in it.

## 3. Checkout modal "far down the page" bug

Investigated `src/components/checkout-button.tsx` and the billing page for
a layout/overflow/containing-block bug. Checked specifically for:
- Content-Security-Policy headers that could block Razorpay's injected
  styles/iframe — **none configured anywhere** in `next.config.ts` or the
  proxy.
- CSS on `document.body` or its ancestors (`transform`, `filter`,
  `backdrop-filter`, `contain`) that would turn Razorpay's
  `position: fixed` overlay into "fixed relative to that ancestor" instead
  of the viewport — **`<body>` has none of these**; the one `overflow:
  hidden` in `globals.css` is on a small decorative `.dogear` card corner,
  unrelated and not an ancestor of anything Razorpay touches.
- Fixed/constrained heights on `html`/`body` — **none set**.
- Custom `iframe` CSS — **none**.
- Fixed pixel widths or viewport units on the billing page or checkout
  button that could misbehave on narrow screens — **none found**.

I could not find a concrete bug in our CSS/layout that explains this, and I
don't have login credentials in this overnight session to reproduce it
live and inspect Razorpay's actual injected element in DevTools — that's
the honest limit of what I could verify here.

What I did apply: a scroll-to-top immediately before `rzp.open()` is
called. This is the standard, well-known mitigation for exactly this
symptom with Razorpay's checkout (reported by other integrators too) — if
the billing page is scrolled down when the button is clicked (likely on
mobile, since the Pro card sits below the fold), resetting scroll first
means the overlay opens against the true top of the viewport rather than
wherever the page happened to be scrolled. It's a safe, purely additive
change. **If it still happens after this, please open DevTools next time,
find the Razorpay-injected element (likely `#razorpay-checkout-frame` or
similar, appended to the end of `<body>`), and check its computed
`position`/`top`/`left` — that would pin down the real cause immediately
and is the next concrete step if this persists.**

## 4. Verification suite

All clean, nothing failed, nothing needed fixing:
- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm test` — **156/156 passing** (21 test files)
- `npm run build` — clean production build, all 29 routes generated

## 5. Launch-blocker scan

| Check | Result |
|---|---|
| `console.log`/`error`/`warn` of sensitive data | None found. One pre-existing `console.warn("media_objects insert failed:", error.message)` in `src/actions/flashcards.ts` logs a Postgres error message (constraint/column info), never a secret value — fine to leave. |
| Hardcoded API keys/secrets in source | None found (scanned `src/` and `scripts/` for Razorpay/Stripe/Google key patterns and PEM headers). |
| `NEXT_PUBLIC_SITE_URL` fallback | **A fallback exists** (`src/lib/env.ts` → defaults to `http://localhost:3000`), so nothing crashes if it's unset. But that fallback is only safe for local dev — if Vercel production doesn't have it set explicitly, auth magic-link/OAuth redirects (`src/app/login/actions.ts`) would silently point users back to `localhost`. **This must be set explicitly in Vercel** — see the checklist below. |
| Webhook: invalid signature → 400, writes nothing | Confirmed both by reading the code (the DB insert only happens after the signature check passes) and empirically, twice — once in an earlier session's 24-check run, once again tonight through the live ngrok tunnel (`400 {"error":"Invalid signature."}`). |
| Webhook: idempotent on duplicate event ids | Confirmed — `subscription_events` has a `(provider, event_id)` unique constraint; a replayed event hits a `23505` (unique violation) and the route returns `200 {"received":true,"duplicate":true}` without re-applying any tier change. Verified by an explicit replay-the-same-event test. |

## What changed tonight

- `scripts/test-webhook.ts` — fixed the cleanup bug described in §1 (now
  cleans up by timestamp, not `user_id`).
- `src/components/checkout-button.tsx` — added a scroll-to-top before
  opening the Razorpay checkout modal (§3).
- Database only (no schema change): cancelled the test subscription on
  Razorpay, reset the one test profile row, deleted the leftover
  synthetic `subscription_events` row. No code migration involved.

Committed locally as a single commit; **not pushed**, per instructions.

## What you need to do yourself tomorrow

1. **Make the webhook actually reachable from Razorpay.** This is almost
   certainly the only thing standing between last night's result and a
   real pass: start `ngrok http <port>` again, then in the Razorpay
   **TEST mode** dashboard go to Settings → Webhooks → add/edit the
   webhook, set the URL to `https://<your-ngrok-url>/api/billing/webhook`,
   set the secret to match `RAZORPAY_WEBHOOK_SECRET` in `.env.local`,
   enable it, and check the subscription.* + payment.failed events. Then
   redo the test payment — `subscription_events` and your profile's
   `subscription_tier` should update within seconds this time.
2. **Create the LIVE Razorpay plan**: run
   `npx tsx scripts/create-razorpay-plan.ts` with your **live** keys set
   (I never touched live keys tonight, per your rule) — note the printed
   `plan_id`, it's separate from the test-mode one already in `.env.local`.
3. **Set Vercel production env vars**: `BILLING_PROVIDER=razorpay`,
   live `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET`,
   the live `RAZORPAY_PLAN_ID` from step 2, `SUPABASE_SERVICE_ROLE_KEY`,
   and — importantly — **`NEXT_PUBLIC_SITE_URL`** set to your real
   production domain (see §5; it silently falls back to `localhost`
   otherwise).
4. **Configure the LIVE webhook** in the Razorpay dashboard (live mode,
   separate from test mode) pointing at
   `https://<your-real-domain>/api/billing/webhook`, with the live webhook
   secret matching what you put in Vercel.
5. **`git push`** this branch, then deploy.
6. **One real payment + refund**, end to end, against live keys, before
   calling it launched — confirm `subscription_tier` flips to `pro` via
   the real webhook, then cancel/refund it the same way you'd want a
   customer's cancellation to work.

---

# Launch Report — Free vs Pro usage limits (2026-10-11)

Scope: this repo only. No push, no DB migration applied, no secrets printed.

## What changed

**Single source of truth**: `src/lib/billing/limits.ts` — `TIER_LIMITS.free`/`.pro`
with every number from your spec (30/5/2 cards-mnemonics-quiz per day free,
300/100/30 Pro; 3/week PDF-image imports free, uncapped Pro; 5MB/20pg free,
50MB/300pg Pro). `limitsForTier()` takes the EFFECTIVE tier
(`effectiveTier()`), so Pro limits apply during an active trial and during a
canceled subscription's remaining paid period, same as the rest of the
billing model. Read by the server checks, the usage-note components, and
the /billing pricing cards — nothing hand-typed in more than one place.

**New migration, NOT applied** — `supabase/migrations/0024_feature_usage_daily.sql`:
a `feature_usage_daily(user_id, day, feature, count)` table (own-row read
only, writes through a SECURITY DEFINER `record_feature_usage()` function —
same shape as `record_ai_call()` from 0021) backing the three new
hard-enforced counters. **Please review and apply it yourself** — SQL
printed below.

**Server enforcement** (day = UTC, week = UTC calendar week starting
Monday 00:00 UTC):
- `generateCardMnemonic()` (`src/actions/mnemonic.ts`) — checks the daily
  mnemonic cap before calling the AI, returns a typed limit error if hit.
- `generateQuizForCards()` / `generateQuizForSubject()` / `regenerateQuizQuestion()`
  (`src/actions/quiz.ts`) — one check per generation EVENT (not per
  underlying batched AI call), so one "quiz set" really means one logical
  quiz-building action. **Design call**: `regenerateQuizQuestion` draws from
  the SAME daily counter as a fresh quiz — otherwise it's a trivial way to
  bypass "2 quiz sets/day" by spamming single-question rerolls. Also fixed
  a real bug while wiring this: `prepareQuiz()` was forwarding only
  `gen.error` (a plain string) from a failed `generateQuizForCards()` call,
  silently dropping the structured `limit` payload the UI needs to show the
  right prompt — now forwards the whole result.
- `/api/import/step` — clamps each AI card-generation call to
  `min(per-chunk cap, per-import cap, today's remaining budget)`, same
  pattern the per-import cap already used. Hard-stops with a typed 429 if
  today's budget is already at 0, rather than silently asking the AI for
  0 cards.
- `/api/import/create` — rejects a new PDF/image import with a typed 429
  if the weekly cap is already used (counts existing `imports` rows, no
  new table needed — RLS already scopes it to the caller). Text/zip
  imports are never gated, per your spec.
- `/api/import/parse` — **behavior change**: a PDF over the tier's page
  cap now REJECTS outright (typed error) instead of the old behavior of
  silently reading only the first N pages and attaching a note. Same for
  file size, checked server-side for the first time (`blob.size` after
  download) — previously `maxUploadBytes` was a 20MB flat cap checked
  **client-side only**, a real gap against "never trust the client."
  Pro's 50MB size cap is now larger than that old flat ceiling, so a
  client-side pre-check was updated too (`import-uploader.tsx`) to not
  wrongly block a Pro user's larger upload before it ever reaches the
  server.

**UI**: new `FeatureUsageNote` ("14 of 30 AI cards used today" — appends
"(Pro trial — N days left)" during an active trial) and `UpgradePrompt`
("Pro gives you 300 AI cards a day" + a /billing link, never blocks the
rest of the app) components, wired into:
- `CardMnemonic` — note + prompt on the "Generate a mnemonic" CTA state
  only (showing it on every already-mnemonic'd card in a deck would be
  noisy).
- `QuizFlow`'s quiz-setup screen — note + prompt next to "Start quiz".
- `ImportUploader` — both the daily cards note and the weekly
  imports-this-week note, plus upgrade prompts on any of the three
  import-specific limit errors (size/pages/weekly).
- `/billing`'s Free and Pro cards now list the exact same numbers,
  generated from `TIER_LIMITS` (can't drift out of sync with
  enforcement) — no more "higher limits" vague wording.

Both `CardMnemonic` and the quiz screen self-fetch today's usage via a
new `getMyFeatureUsage()` server action (`src/actions/usage.ts`) rather
than threading counts down through every parent that might render them —
those two components are reused in many places in the tree.

**"Priority processing" for Pro**: there's no job queue anywhere in this
app — every request is synchronous. This is pricing-card copy only, not
an actual scheduling change. Flagging explicitly rather than silently
deciding.

## Migration SQL you must review and apply

```sql
-- supabase/migrations/0024_feature_usage_daily.sql
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
```

Full file (with header comments explaining each choice) is at
`supabase/migrations/0024_feature_usage_daily.sql`.

**Important**: until you apply this, the three new daily caps are NOT
actually enforced — `checkFeatureLimit()`/`getFeatureUsageToday()`
(`src/lib/usage/feature.ts`) fail OPEN (report "plenty of room left")
when the table doesn't exist yet, matching this codebase's existing
convention for every other pending migration this session
(`getStudyPacing()`, `getUsageSummary()`, etc.) — so shipping this code
ahead of the migration doesn't break card/mnemonic/quiz generation for
anyone, it just means the cap isn't live yet. The import size/page/weekly
checks, by contrast, work immediately — they don't depend on 0024 at all
(size/pages are checked directly against the uploaded file; weekly count
just queries the existing `imports` table).

## Verification

`npm run typecheck`, `npm run lint`, `npm test` (**186/186 passing**, 18
new), and `npm run build` all clean — nothing needed fixing beyond what's
already folded into the implementation above.

## What I could not verify

- **No live click-through.** I didn't have browser/login access to
  actually hit a cap in the running app and watch the UpgradePrompt
  render, or upload an oversized/too-many-page PDF and watch the typed
  429 come back. Everything above is verified by code reading + the pure
  unit tests (`src/lib/billing/limits.test.ts`), not an end-to-end click.
- **The three import-route typed-error shapes** (`{error, limit}` JSON
  bodies with `status: 429`) are new and not covered by an automated
  request-level test — there's no existing convention in this codebase
  for testing Route Handlers directly (same gap noted in the Razorpay
  webhook work; that one got a dedicated `scripts/test-webhook.ts`
  instead, which doesn't apply here since these routes need a real
  authenticated session + real file upload, not a signed payload).
- **Mobile layout**: I didn't have a way to visually confirm the longer
  10-line pricing cards and the new inline usage notes read well at phone
  width — the classes used (`text-sm`/`text-xs`, `flex-wrap`-friendly,
  no fixed widths) follow the same patterns already used elsewhere in
  this app, but I'd treat this as unconfirmed until you look at it on a
  real phone.
