import { z } from 'zod'

export const stageSchema = z.enum(['math_review','story_selection','casting','storyboard_review','generating','quality_review','ready_to_publish','published'])
export type WorkflowStage = z.infer<typeof stageSchema>

export const mathAnalysisSchema = z.object({
  answer: z.string(), reasoningSteps: z.array(z.string()).min(1), mathTakeaway: z.string(),
  prerequisites: z.array(z.string()), commonMistakes: z.array(z.string()), visualMetaphors: z.array(z.string()),
  verification: z.string(), confidence: z.number().min(0).max(1), ambiguities: z.array(z.string()),
})

export const storyPitchSchema = z.object({
  id: z.string(), type: z.enum(['funny','warm','interactive','tiktok','instagram']), title: z.string(), hook: z.string(),
  synopsis: z.string(), mathIntegration: z.string(), beats: z.array(z.string()).min(6).max(18), interaction: z.string(),
  tone: z.string(), recommendedTraits: z.array(z.string()), whyItFits: z.string(), riskNotes: z.array(z.string()),
})

export const panelSchema = z.object({
  index: z.number().int().min(1).max(18), purpose: z.string(), scene: z.string(), camera: z.string(),
  characters: z.array(z.object({ characterId: z.string(), action: z.string(), expression: z.string() })),
  dialogue: z.array(z.object({ speaker: z.string(), text: z.string() })), narration: z.string(),
  mathVisual: z.string(), continuity: z.string(), imageUrl: z.string().nullable().default(null),
})

export const workflowStateSchema = z.object({
  stage: stageSchema, sourceProblem: z.string(), sourceChallengeId: z.string().uuid().nullable(), classId: z.string().uuid().nullable(),
  gradeLevel: z.string().nullable(), language: z.enum(['zh','en','bilingual']), mathAnalysis: mathAnalysisSchema.nullable(),
  storyPitches: z.array(storyPitchSchema), selectedPitchId: z.string().nullable(), cast: z.array(z.object({ characterId: z.string().uuid(), characterVersion: z.number().int(), role: z.string() })),
  panels: z.array(panelSchema), renderSpec: z.object({
    layout: z.string(), artDirection: z.string(), aspectRatio: z.string(), answerReveal: z.string(),
    outputLanguages: z.array(z.enum(['zh','en'])).length(2), translationPolicy: z.string(),
  }),
})
export type WorkflowState = z.infer<typeof workflowStateSchema>

export const createProjectSchema = z.object({ sourceProblem: z.string().min(3).max(20000), sourceChallengeId: z.string().uuid().nullable().default(null), classId: z.string().uuid().nullable().default(null), gradeLevel: z.string().nullable().default(null), language: z.enum(['zh','en','bilingual']).default('zh') })
