-- Choti Copy — 0004 recall weighting + sampler
-- `flashcard_weight` is the single knob for "how often should this card
-- resurface". Today every active card weighs 1.0 (uniform random). Phase 6
-- (error resurfacing) rewrites this view to boost cards whose quiz questions
-- were answered wrong — nothing else needs to change.

create or replace view public.flashcard_weight
with (security_invoker = true) as
select
  f.id      as flashcard_id,
  f.user_id as user_id,
  1.0::double precision as weight
from public.flashcards f
where f.is_active;

-- Weighted-random sample of the caller's active flashcards.
-- Uses the A-Res trick: order by random()^(1/weight) so higher weight →
-- higher expected key → more likely to be picked. RLS on `flashcards`
-- applies (plain SQL, not SECURITY DEFINER), so this only ever sees the
-- caller's own rows.
create or replace function public.get_recall_cards(p_limit integer default 5)
returns setof public.flashcards
language sql
stable
as $$
  select f.*
  from public.flashcards f
  left join public.flashcard_weight w on w.flashcard_id = f.id
  where f.is_active
  order by power(random(), 1.0 / greatest(coalesce(w.weight, 1.0), 0.01)) desc
  limit greatest(coalesce(p_limit, 5), 0)
$$;

grant execute on function public.get_recall_cards(integer) to authenticated, service_role;
