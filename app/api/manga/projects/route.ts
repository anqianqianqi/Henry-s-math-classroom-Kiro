import { NextResponse } from 'next/server'
import { createProjectSchema, WorkflowState } from '@/lib/manga/domain'
import { challengeToMangaRequest } from '@/lib/manga/contract'
import { mangaError, mangaServiceDb, requireMangaAdmin } from '@/lib/manga/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { supabase } = await requireMangaAdmin()
    const body = await request.json()
    const challengeId = typeof body.challengeId === 'string' ? body.challengeId : ''
    if (!challengeId) return NextResponse.json({ error: 'challengeId is required' }, { status: 400 })

    const { data: challenge, error } = await supabase.from('daily_challenges').select('id,title,description').eq('id', challengeId).single()
    if (error || !challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })

    const input = createProjectSchema.parse(challengeToMangaRequest({
      ...challenge,
      classId: typeof body.classId === 'string' ? body.classId : null,
      gradeLevel: typeof body.gradeLevel === 'string' ? body.gradeLevel : null,
      language: body.language === 'zh' || body.language === 'en' || body.language === 'bilingual' ? body.language : 'bilingual',
    }))
    const state: WorkflowState = { stage:'math_review', ...input, mathAnalysis:null, storyPitches:[], selectedPitchId:null, cast:[], panels:[], renderSpec:{layout:'2x3',artDirection:'warm minimal hand-drawn animation comic, soft natural colors, simple clean silhouettes',aspectRatio:'3:2',answerReveal:'last_panel'} }
    const { data, error: insertError } = await mangaServiceDb().from('manga_projects').insert({ source_challenge_id:input.sourceChallengeId, class_id:input.classId, stage:state.stage, state }).select('id,state').single()
    if (insertError) throw insertError
    return NextResponse.json({ projectId: data.id, challengeId, state: data.state }, { status: 201 })
  } catch (error) {
    const { message, status } = mangaError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
