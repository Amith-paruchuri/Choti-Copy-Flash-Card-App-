-- Choti Copy — 0019 image-primary flashcards
--
-- Some cards (pathway diagrams — Krebs cycle, Hb synthesis, coagulation
-- cascade) ARE an image, with little or no typed text. On upload we ask a
-- vision model for a short, keyword-dense description of each image and store
-- it per-image in `flashcards.images` (the jsonb entries gain an `alt` key).
--
-- `image_alt` denormalises every image's `alt` for one card into a single
-- text column so account-wide search (which does `ilike` over title / subtitle
-- / content) can also match a term that only appears inside a diagram. It is
-- rewritten by the card create/update actions whenever a card's images change;
-- existing Anki-imported images have no description until the card is edited.

alter table public.flashcards add column image_alt text;

-- Allow a blank body when the card carries an image instead — an image-primary
-- card. Text still caps at 4000 chars; a card with neither text nor an image is
-- still rejected.
alter table public.flashcards drop constraint flashcards_content_check;
alter table public.flashcards
  add constraint flashcards_content_check
  check (
    char_length(btrim(content)) <= 4000
    and (
      char_length(btrim(content)) >= 1
      or jsonb_array_length(images) > 0
    )
  );
