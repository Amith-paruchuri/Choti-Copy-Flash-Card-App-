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
