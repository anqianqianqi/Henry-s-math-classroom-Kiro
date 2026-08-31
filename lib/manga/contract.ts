export type MangaProjectRequest = {
  sourceProblem: string
  sourceChallengeId: string
  classId: string | null
  gradeLevel: string | null
  language: 'zh' | 'en' | 'bilingual'
}

export type PublishedManga = {
  id: string
  source_challenge_id: string | null
  class_id: string | null
  title: string
  language: string
  math_takeaway: string
  cover_image_url: string
  panel_count: number
  published_at: string
  manga_comic_panels: {
    panel_index: number
    image_url: string
    dialogue: { speaker: string; text: string }[]
    narration: string
    math_visual: string
  }[]
}

export function challengeToMangaRequest(input: {
  id: string
  title: string
  description: string
  classId?: string | null
  gradeLevel?: string | null
  language?: 'zh' | 'en' | 'bilingual'
}): MangaProjectRequest {
  return {
    sourceProblem: `${input.title.trim()}\n\n${input.description.trim()}`,
    sourceChallengeId: input.id,
    classId: input.classId ?? null,
    gradeLevel: input.gradeLevel ?? null,
    language: input.language ?? 'bilingual',
  }
}

