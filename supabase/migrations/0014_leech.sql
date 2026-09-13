-- ── Leech suspension ──────────────────────────────────────────────────────
-- A "leech" is a card you keep getting wrong. Once its lapse count crosses
-- LEECH_LAPSES (8, matching Anki's default) it is auto-suspended: pulled from
-- review + quiz rotation until you reactivate it by hand from the Leeches list.
-- `card_memory` is per (user, card) and already RLS-scoped, so no new policy.

alter table public.card_memory
  add column suspended    boolean not null default false,
  add column suspended_at timestamptz;

-- Small partial index — the Leeches list and the "exclude leeches" filters
-- only ever look at the suspended rows.
create index card_memory_suspended_idx
  on public.card_memory (user_id)
  where suspended;

comment on column public.card_memory.suspended is
  'Leech: auto-set once lapses reach the threshold; cleared only by the user.';
