-- Choti Copy — 0008 import kinds: add 'text', rename 'whatsapp_zip' → 'zip'
--
-- The uploader now accepts plain `.txt` notes directly, and `.zip` handling is
-- generalised (a zip may hold a WhatsApp `_chat.txt`, other text files, or just
-- images) — so the kind is 'zip', not 'whatsapp_zip'.
--
-- Symptom without this: uploading a .zip or .txt fails with
--   new row for relation "imports" violates check constraint "imports_kind_check"
-- because the code sends kind 'zip'/'text' but the constraint still only allows
-- ('image','pdf','whatsapp_zip').
--
-- Safe to re-run.

alter table public.imports drop constraint if exists imports_kind_check;

update public.imports set kind = 'zip' where kind = 'whatsapp_zip';

alter table public.imports
  add constraint imports_kind_check
  check (kind in ('image', 'pdf', 'text', 'zip'));
