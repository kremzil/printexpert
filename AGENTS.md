# AGENTS.md — Codex instructions

This repository is a Next.js (App Router) project with shadcn/ui + Tailwind CSS.
Follow the rules below to keep changes safe, consistent, and reviewable.

## Golden rules
- Make the smallest change that solves the task.
- Prefer editing existing files over introducing new abstractions.
- Do not refactor unrelated code.
- If something is unclear, inspect the codebase first before adding new patterns.
- Keep output deterministic: no random IDs, no time-based behavior unless explicitly requested.

## Language
- Site UI text must be in Slovak.
- Assistant responses must be in Russian.
- Do not replace Slovak text with Unicode escape sequences; keep strings readable.

## Setup commands (use these)
- Install deps: `npm install`
- Run dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

If a command fails, report the error clearly and propose the minimal fix.

## Tech stack
- Next.js App Router (RSC enabled)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- lucide-react icons
- Utility helper: `cn()` from `@/lib/utils`

## Project structure
- `app/` — Next.js App Router routes, layouts, pages
- `components/` — app-level components
- `components/ui/` — shadcn/ui components installed into the repo
- `lib/` — helpers/utilities (includes `lib/utils.ts`)
- `public/` — static assets
- `llms/` — local documentation/knowledge base (LLM-friendly)

## Knowledge base (local docs)
This repo includes a local knowledge base under `/llms`.
Use it as the primary reference when relevant:

- `llms/next-llms-full.txt`
  - Full Next.js documentation dump (LLM-friendly).
  - Use for: App Router, RSC rules, caching/revalidation, metadata, routing patterns.

- `llms/shadcn-llms.txt`
  - shadcn/ui documentation index (LLM-friendly).
  - Use for: shadcn CLI usage, components.json, theming, component patterns.

Rules:
- If a task is about Next.js behavior or correct patterns, check `llms/next-llms-full.txt` first.
- If a task is about UI components, theming, or shadcn setup, check `llms/shadcn-llms.txt` first.
- Prefer these local docs over general web guesses.

## Next.js conventions
- Prefer Server Components by default.
- Use `"use client"` only when needed (state, effects, browser APIs, event handlers).
- Keep server/client boundaries clean.
- Avoid adding custom wrappers around Next APIs unless explicitly requested.

## shadcn/ui conventions
- Prefer shadcn/ui components when possible instead of custom UI.
- Prefer adding components via shadcn tooling instead of hand-copying.
- Use path aliases from `components.json`:
  - `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`
- `cn()` must come from `@/lib/utils`.

## Styling rules
- Use Tailwind classes for styling.
- Do not add new global CSS unless necessary.
- Prefer design tokens via CSS variables in `app/globals.css`.
- Keep spacing and radius consistent with the theme.
- If a needed UI element is missing, check whether a shadcn/ui component exists before building a custom one.

## Dependencies rules
- Do not introduce new libraries unless explicitly requested.
- Do not change package versions unless required to fix a real error.
- Prefer built-in Next.js features over new packages.

## MCP tooling (when available)
This environment may have MCP servers enabled (Codex):
- `next-devtools` — inspect routes/errors/logs/metadata from the running dev server
- `shadcn` — install components from the shadcn registry

Use MCP when it speeds up debugging or component setup, but keep code changes minimal.

## Expectations for each change
When you modify code:
- Explain WHAT you changed and WHY (1–3 bullets).
- List the files touched.
- If the change affects routing or rendering, mention the affected route(s).
- Provide focused code snippets/patches per file.
- Avoid dumping large unrelated files.

## No-go actions
- No large refactors.
- No mass renames or folder moves.
- No “rewrite everything” solutions unless explicitly requested.
