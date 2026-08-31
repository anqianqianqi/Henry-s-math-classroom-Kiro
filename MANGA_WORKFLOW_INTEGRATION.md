# Standalone manga workflow integration

Henry Math Classroom and the manga workflow remain separate deployments.

## Feed a challenge into the workflow

The classroom UI calls its own authenticated endpoint:

```ts
await fetch('/api/manga/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ challengeId, classId, language: 'bilingual' }),
})
```

The server loads the trusted challenge text from `daily_challenges` and forwards it to `MANGA_WORKFLOW_URL`. The browser never receives `MANGA_WORKFLOW_ADMIN_TOKEN`.

## Read the result

Use `getPublishedMangaForChallenge(supabase, challengeId)` from `lib/manga/published.ts`. It reads only `manga_published_comics` and ordered `manga_comic_panels`. Supabase RLS limits class-scoped comics to members of that class.

