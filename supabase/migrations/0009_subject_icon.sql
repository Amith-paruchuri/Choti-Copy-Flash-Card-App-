-- Choti Copy — 0009 per-subject icon
--
-- Subjects show as divider tabs on the dashboard, each carrying a small icon
-- in the subject's colour. Icon is a short key (e.g. 'flask', 'dna') resolved
-- to a Lucide component in the app; null falls back to the notebook icon.

alter table public.subjects add column icon text;
