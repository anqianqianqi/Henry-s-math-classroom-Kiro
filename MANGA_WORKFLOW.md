# Built-in manga workflow

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
- `POST /api/manga/projects/:id/publish` — publish a quality-approved six-panel comic.
- `POST /api/manga/characters/interview` — one progressive Character Creator turn.
- `GET/POST /api/manga/characters` — list or save Character Bibles.

All endpoints require a signed-in teacher or administrator. Students read only published output through `getPublishedMangaForChallenge()` in `lib/manga/published.ts`; Supabase RLS enforces class membership.
