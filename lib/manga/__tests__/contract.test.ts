import { describe, expect, it } from 'vitest'
import { challengeToMangaRequest } from '../contract'

describe('manga workflow connector', () => {
  it('turns a classroom challenge into the standalone API contract', () => {
    expect(challengeToMangaRequest({ id: 'challenge-id', title: 'Fractions', description: 'What is 1/2 + 1/4?' })).toEqual({
      sourceProblem: 'Fractions\n\nWhat is 1/2 + 1/4?', sourceChallengeId: 'challenge-id', classId: null, gradeLevel: null, language: 'bilingual',
    })
  })
})

