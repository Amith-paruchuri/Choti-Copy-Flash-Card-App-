# Choti Copy

A mobile-first flashcard / quiz app for students to store their own weak concepts
and error questions and review them until they stick.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 + shadcn/ui ·
Supabase (Postgres / Auth / RLS) · pluggable AI provider (Grok now).

## Getting started

### 1. Install

```bash
npm install
```

### 2. Supabase project

1. Create a free project at <https://supabase.com>.
2. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     (Project Settings → API).
3. Schema migrations live in `supabase/migrations/`. Apply them in order via the
   Supabase SQL editor (or `supabase db push` with the CLI). *(Added in Phase 1.)*

### 3. AI provider

Set `GEMINI_API_KEY` in `.env.local` (from <https://aistudio.google.com/apikey>).
`AI_PROVIDER` defaults to `gemini` (`GEMINI_MODEL` default `gemini-3.1-flash-lite`).
A `grok` provider is also wired up — set `AI_PROVIDER=grok` + `XAI_API_KEY` to use
it. To add another provider: drop a file under `src/lib/ai/` implementing
`AIProvider`, register it in `src/lib/ai/index.ts`, point `AI_PROVIDER` at it.

### 4. Run

```bash
npm run dev        # http://localhost:3000
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (AI parsing / schema tests) |

## Project layout

```
proxy.ts                  Session refresh + route guard (Next 16 "middleware")
supabase/migrations/      SQL schema, applied in order
src/app/                  Routes (App Router)
src/components/            UI — src/components/ui is shadcn-generated
src/lib/supabase/         Browser / server / proxy Supabase clients
src/lib/ai/               Provider abstraction (Grok impl)
src/lib/env.ts            Typed, lazy env access — don't read process.env elsewhere
```

## Build phases

0. **Scaffold** — Next + shadcn + Supabase wiring ✅
1. **Auth** (email/password + Google) + RLS ✅
2. **Subjects + flashcard CRUD** (soft delete) ✅
3. **Subject dashboard grid + random recall strip** ✅
4. **Imports + AI** — condense; upload image / PDF / .txt / .zip → AI-drafted cards with AI-suggested subjects → grouped review ✅ *(AI provider = Gemini, `GEMINI_API_KEY`)*
4b. **Visual identity** — mulberry-ink palette, Bricolage Grotesque + IBM Plex, divider-tab / dog-ear / highlighter motifs ✅ *(apply migration 0009; quiz UI styling deferred to Phase 5)*
5. Quiz generation + quiz-taking UI
6. Attempt tracking + error resurfacing
7. Insights (accuracy, weakest subjects)
