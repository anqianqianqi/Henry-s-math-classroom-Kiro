import { describe, expect, it } from 'vitest'
import { createProjectSchema, workflowStateSchema } from '../domain'

describe('built-in manga workflow', () => {
  it('accepts a trusted challenge payload', () => {
    expect(createProjectSchema.parse({ sourceProblem: '1 + 1 = ?' }).language).toBe('zh')
  })

  it('rejects invalid comic panel indexes', () => {
    const result = workflowStateSchema.safeParse({
      stage:'ready_to_publish', sourceProblem:'x', sourceChallengeId:null, classId:null, gradeLevel:null, language:'zh',
      mathAnalysis:null, storyPitches:[], selectedPitchId:null, cast:[],
      panels:[{index:19,purpose:'',scene:'',camera:'',characters:[],dialogue:[],narration:'',mathVisual:'',continuity:'',imageUrl:null}],
      renderSpec:{layout:'2x3',artDirection:'warm',aspectRatio:'3:2',answerReveal:'last_panel',outputLanguages:['zh','en'],translationPolicy:'same locked storyboard, copy only'},
    })
    expect(result.success).toBe(false)
  })
})
