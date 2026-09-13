# Supabase setup

## Applying migrations

Migrations in `migrations/` are plain SQL, applied **in filename order**.

**Option A — SQL editor (no CLI):**
1. Supabase Dashboard → SQL Editor → New query.
2. Paste the contents of `0001_init.sql`, run.
3. Repeat for each later file **in order**: `0002_rls.sql` … `0009_subject_icon.sql`.

**Pending: `0009_subject_icon.sql`** — one `add column icon text` on `subjects`
for the divider-tab icons. Subjects show a fallback book icon until it's
applied; nothing breaks. (0007 + 0008 should already be applied — imports work.)

`0005` also creates a private Storage bucket named `imports` and its access
policy (each user can only touch files under `imports/<their-uid>/`). If your
project blocks `insert into storage.buckets` from the SQL editor, create the
bucket manually (Storage → New bucket → name `imports`, **not** public) and run
just the `create policy "imports bucket — own folder" …` statement.

**Option B — CLI:**
```bash
npx supabase link --project-ref nyxivqlpikoffdopfmei
npx supabase db push
```

## One-time dashboard configuration (Phase 1)

**Authentication → URL Configuration**
- Site URL: `http://localhost:3000`
- Redirect URLs: add `http://localhost:3000/**`
  (add your Vercel URL later, e.g. `https://choti-copy.vercel.app/**`)

**Authentication → Sign In / Providers → Email**
- Keep **Email** enabled.
- For frictionless local testing you can turn **"Confirm email" off** during
  development. Turn it back on before shipping.

**Authentication → Sign In / Providers → Google**
- Enable Google, paste a Google OAuth **Client ID** and **Client secret**
  (Google Cloud Console → APIs & Services → Credentials → OAuth client, type
  "Web application").
- Authorised redirect URI in Google:
  `https://nyxivqlpikoffdopfmei.supabase.co/auth/v1/callback`

## Verifying RLS

After 0001 + 0002 are applied and you have two signed-up users with some data,
run `../scripts/rls-check.sql` in the SQL editor (edit the two UUIDs first).
User B must see 0 rows of user A's data on every table.
