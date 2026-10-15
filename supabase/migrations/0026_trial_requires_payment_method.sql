-- Choti Copy — 0026 free trial now requires a payment method
--
-- The 15-day trial is started by authorising a Razorpay autopay mandate
-- (subscription with a future start_at). The webhook / checkout verification
-- then sets trial_ends_at server-side with the service role. The old no-card
-- start_trial() RPC would let any signed-in user skip that, so it is no longer
-- callable from the client. Accounts that already used it keep their
-- trial_ends_at untouched.

revoke execute on function public.start_trial() from authenticated, anon, public;
