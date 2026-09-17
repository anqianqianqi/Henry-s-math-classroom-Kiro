import { NextRequest, NextResponse } from 'next/server'
import { mangaServiceDb, requireMangaAdmin } from '@/lib/manga/server'
import { workflowStateSchema } from '@/lib/manga/domain'
import { structuredResponse } from '@/lib/manga/openai'
import { mathAnalysisSchema } from '@/lib/manga/domain'
import { z } from 'zod'

// JSON schema for math analysis (mirrors workflow.ts)
const mathJsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['answer','reasoningSteps','mathTakeaway','prerequisites','commonMistakes','visualMetaphors','verification','confidence','ambiguities'],
  properties: {
    answer: { type: 'string' },
    reasoningSteps: { type: 'array', items: { type: 'string' } },
    mathTakeaway: { type: 'string' },
    prerequisites: { type: 'array', items: { type: 'string' } },
    commonMistakes: { type: 'array', items: { type: 'string' } },
    visualMetaphors: { type: 'array', items: { type: 'string' } },
    verification: { type: 'string' },
    confidence: { type: 'number' },
    ambiguities: { type: 'array', items: { type: 'string' } },
  }
}

/**
 * POST /api/manga/projects/[id]/review-math
 * Body: { reviewNotes: string }
 *
 * Re-runs the math analysis agent with Henry's review notes injected as
 * additional context, so the agent can correct or clarify its previous output.
 * Saves the new analysis and keeps the stage at 'math_review'.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireMangaAdmin()
    const db = mangaServiceDb()

    const body = await request.json()
    const reviewNotes = (body.reviewNotes as string || '').trim()
    if (!reviewNotes) return NextResponse.json({ error: 'reviewNotes is required' }, { status: 400 })

    const { data, error } = await db.from('manga_projects').select('state').eq('id', params.id).single()
    if (error) throw error
    const state = workflowStateSchema.parse(data.state)

    // Re-run math analysis with Henry's review notes as additional context
    const newAnalysis = await structuredResponse({
      instructions: `You are a rigorous math educator. Solve independently, verify the result, flag ambiguity, and produce child-appropriate teaching insight. Never invent missing conditions.

IMPORTANT: The teacher has reviewed the previous math analysis and provided the following correction notes. You MUST address every point raised:

${reviewNotes}`,
      prompt: JSON.stringify({
        problem: state.sourceProblem,
        gradeLevel: state.gradeLevel,
        language: state.language,
        previousAnalysis: state.mathAnalysis ?? undefined,
        teacherReviewNotes: reviewNotes,
      }),
      name: 'math_analysis',
      schema: mathJsonSchema,
      validate: mathAnalysisSchema,
    })

    state.mathAnalysis = newAnalysis
    // Keep stage at math_review so Henry can re-review or approve

    const { error: updateError } = await db
      .from('manga_projects')
      .update({ state })
      .eq('id', params.id)
    if (updateError) throw updateError

    return NextResponse.json(state)
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHORIZED' ? 401 : 400
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Could not re-run math analysis'
    }, { status })
  }
}
