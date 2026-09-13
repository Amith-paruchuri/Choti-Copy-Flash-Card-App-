-- Choti Copy — 0007 AI subject suggestions on import cards
--
-- The import step now asks the AI to suggest a subject (and a broad→specific
-- path) for each draft card. The review screen groups cards by the suggestion
-- and lets the user accept or override per group.
--
-- `suggested_path` is stored for the future hierarchy UI; today only the leaf
-- (`suggested_subject`) is used, as a flat subject.

alter table public.import_cards
  add column suggested_subject text,
  add column suggested_path jsonb not null default '[]'::jsonb;
