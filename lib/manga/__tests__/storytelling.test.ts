import { describe, expect, it } from 'vitest'
import { storyPitchSchema } from '../domain'
import { mangaPreferencePrompt } from '../preferences'
import { STORY_PITCH_INSTRUCTIONS } from '../storyPrompt'

describe('manga story narrative contract', () => {
  it('requires the story agent to state and critique a complete objective', () => {
    for (const requirement of [
      'explicitTask',
      'targetScope',
      'observationPoint',
      'successCriteria',
      'reasonToFindAll',
      'ruleContext',
    ]) expect(STORY_PITCH_INSTRUCTIONS).toContain(requirement)

    expect(STORY_PITCH_INSTRUCTIONS).toContain('SELF-CRITIQUE AND REWRITE')
    expect(STORY_PITCH_INSTRUCTIONS).toContain('STORY ENERGY')
    expect(STORY_PITCH_INSTRUCTIONS).toContain('Personification is strongly preferred')
    expect(STORY_PITCH_INSTRUCTIONS).toContain('Never create or delete countable units')
    expect(STORY_PITCH_INSTRUCTIONS).toContain('original worksheet prompt is hidden')
  })

  it('persists the narrative contract in the house preference prompt', () => {
    const prompt = mangaPreferencePrompt()
    expect(prompt).toContain('Narrative contract:')
    expect(prompt).toContain('visible success criterion')
    expect(prompt).toContain('original worksheet prompt is hidden')
  })

  it('keeps older persisted pitches readable', () => {
    const pitch = storyPitchSchema.parse({
      id: 'legacy', type: 'funny', title: 'Old pitch', hook: 'Hook', synopsis: 'Synopsis',
      mathIntegration: 'Math', beats: ['1', '2', '3', '4', '5', '6'], interaction: 'Ask', tone: 'Warm',
      recommendedTraits: [], whyItFits: 'Works', riskNotes: [],
    })
    expect(pitch.explicitTask).toBe('')
    expect(pitch.successCriteria).toBe('')
  })
})
