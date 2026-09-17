import { NextRequest, NextResponse } from 'next/server'
import { mangaServiceDb, requireMangaAdmin } from '@/lib/manga/server'
import { workflowStateSchema } from '@/lib/manga/domain'

import { analyzeMath, createStoryPitches } from '@/lib/manga/workflow'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireMangaAdmin()
    const db = mangaServiceDb()

    // Optional force flag — if true, re-generate even when results already exist in DB
    const body = await request.json().catch(() => ({}))
    const force = body.force === true

    const { data, error } = await db.from('manga_projects').select('state').eq('id', params.id).single()
    if (error) throw error
    const state = workflowStateSchema.parse(data.state)

    if (state.stage === 'math_review') {
      if (force || !state.mathAnalysis) {
        state.mathAnalysis = await analyzeMath(state)
      }
      // else: use existing mathAnalysis from DB — no OpenAI call
    } else if (state.stage === 'story_selection' && state.mathAnalysis) {
      if (force || !state.storyPitches.length) {
        state.storyPitches = await createStoryPitches(state)
      }
      // else: use existing storyPitches from DB — no OpenAI call
    } else {
      return NextResponse.json({ error: 'This stage requires a user decision or is not automated yet.' }, { status: 409 })
    }

    const { error: updateError } = await db.from('manga_projects').update({ stage: state.stage, state }).eq('id', params.id)
    if (updateError) throw updateError
    return NextResponse.json(state)
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHORIZED' ? 401 : 400
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not advance workflow' }, { status })
  }
}
