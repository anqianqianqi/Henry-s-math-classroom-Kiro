import { describe, expect, it } from 'vitest'
import { workflowStateSchema, type WorkflowState } from '../domain'
import { buildPanelArtPrompt, pendingPanelIndexes } from '../rendering'

function state(mode: 'one_by_one' | 'bulk' | null): WorkflowState {
  return workflowStateSchema.parse({
    stage: mode ? 'generating' : 'render_mode_selection',
    sourceProblem: 'A sample problem',
    sourceChallengeId: null,
    classId: null,
    gradeLevel: '5',
    language: 'bilingual',
    mathAnalysis: null,
    storyPitches: [],
    selectedPitchId: null,
    cast: [],
    panels: [
      { index: 1, purpose: 'Introduce the problem', scene: 'Funbo sees two tubes', camera: 'medium', characters: [], dialogue: [{ speaker: 'Funbo', text: 'Hello!' }], narration: '', mathVisual: '7 × 5', continuity: '' },
      { index: 2, purpose: 'Show the operation', scene: 'The short tube pours into the tall tube', camera: 'close', characters: [], dialogue: [], narration: '', mathVisual: '', continuity: 'A remains shorter than B', artStatus: 'ready', imageUrl: 'https://example.com/panel.png' },
      { index: 3, purpose: 'Try again', scene: 'Funbo retries', camera: 'wide', characters: [], dialogue: [], narration: '', mathVisual: '', continuity: '', artStatus: 'failed', lastError: 'temporary failure' },
    ],
    renderSpec: { layout: 'adaptive', artDirection: 'warm watercolor', aspectRatio: '3:2', answerReveal: 'last_panel', outputLanguages: ['zh', 'en'], translationPolicy: 'same art', generationMode: mode },
  })
}

describe('panel-first manga rendering', () => {
  it('requires the admin to choose a generation mode first', () => {
    expect(() => pendingPanelIndexes(state(null))).toThrow(/Choose one-by-one or bulk/)
  })

  it('generates only the selected panel in one-by-one mode', () => {
    expect(pendingPanelIndexes(state('one_by_one'), 2)).toEqual([2])
    expect(() => pendingPanelIndexes(state('one_by_one'))).toThrow(/Choose one panel/)
  })

  it('bulk mode schedules separate pending and failed panels, never ready panels', () => {
    expect(pendingPanelIndexes(state('bulk'))).toEqual([1, 3])
    expect(() => pendingPanelIndexes(state('bulk'), 1)).toThrow(/do not send panelIndex/)
  })

  it('builds a single text-free panel prompt without leaking dialogue or equations', () => {
    const current = state('one_by_one')
    const prompt = buildPanelArtPrompt(current, current.panels[0])
    expect(prompt).toContain('exactly ONE educational manga panel')
    expect(prompt).toContain('ABSOLUTELY NO text')
    expect(prompt).toContain('not a comic page')
    expect(prompt).not.toContain('Hello!')
    expect(prompt).not.toContain('7 × 5')
  })

  it('adds safe defaults when older stored panels are parsed', () => {
    const current = state(null)
    expect(current.panels[0]).toMatchObject({ artPrompt: '', artStatus: 'pending', artVersion: 0, imageUrl: null, lastError: null })
    expect(current.renderSpec.imagePolicy).toMatch(/one text-free image per panel/i)
  })
})
