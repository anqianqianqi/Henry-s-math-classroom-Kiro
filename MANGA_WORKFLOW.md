# Built-in manga workflow

Latest saved console decisions and accepted outputs: [2026-09-04 checkpoint](MANGA_PROGRESS_2026-09-04.md). The Math Takeaway-first background-agent end state is documented in [architecture planning](MANGA_MULTI_AGENT_ARCHITECTURE.md); existing runtime gates below have not been removed.

The manga workflow now runs inside Henry Math Classroom. It uses the existing `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`; no second deployment or cross-service token is required.

## Start from a trusted challenge

```ts
await fetch('/api/manga/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ challengeId, classId, language: 'bilingual' }),
})
```

The server loads the challenge from `daily_challenges` and creates its workflow state in `manga_projects`.

## Workflow endpoints

- `POST /api/manga/projects` — create from an existing challenge.
- `POST /api/manga/projects/:id/advance` — run math analysis or generate five story pitches.
- `POST /api/manga/projects/:id/approve-math` — human approval gate.
- `POST /api/manga/projects/:id/approve-storyboard` — lock a reviewed 6–18 panel storyboard and require a generation-mode decision.
- `POST /api/manga/projects/:id/render-mode` — choose `one_by_one` or `bulk`; there is no implicit default.
- `POST /api/manga/projects/:id/panels/generate` — generate one selected panel or schedule all pending panel prompts.
- `POST /api/manga/projects/:id/publish` — publish a quality-approved 6–18 panel comic.
- `POST /api/manga/characters/interview` — one progressive Character Creator turn.
- `GET/POST /api/manga/characters` — list or save Character Bibles.

All authoring endpoints require a signed-in administrator. Teachers and students can only read published output through `getPublishedMangaForChallenge()` in `lib/manga/published.ts`; Supabase RLS enforces class membership.

## Panel-first image generation

The image model never receives a request for a complete comic page. Each approved storyboard panel owns its own text-free image, prompt, status, version, URL and error state.

Before the first image call, the studio asks the administrator to choose:

- `one_by_one` — generate or regenerate one selected panel and review it before continuing;
- `bulk` — run every pending or failed panel prompt, with limited concurrency, while keeping each panel as an independent `gpt-image-2` request and asset.

Dialogue, formulas, state labels, panel numbers and page layout are intentionally excluded from the image prompt. They will be composed deterministically in the bilingual overlay/page-rendering phase.

## Story narrative contract

Every generated pitch must explicitly define the character task, the complete target scope, where the result is observed, the visible success criterion, why every requested result must be found, and a natural story reason for the problem's operational constraints. These must appear in the opening beats so the comic remains understandable without the original worksheet prompt. The story agent silently critiques and rewrites a pitch when any part is missing or merely implied.

Apply `supabase/migrations/20260903_create_manga_panels_bucket.sql` before live image generation. The server uploads generated PNGs to `manga-panels` only after `requireMangaAdmin()` succeeds.

Optional environment variables:

```text
OPENAI_MANGA_IMAGE_MODEL=gpt-image-2
OPENAI_MANGA_BULK_CONCURRENCY=3
```
