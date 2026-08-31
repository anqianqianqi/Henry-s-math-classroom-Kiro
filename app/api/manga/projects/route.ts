import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { challengeToMangaRequest } from '@/lib/manga/contract'
import { createMangaWorkflowProject } from '@/lib/manga/workflowClient'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies }) as any
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: roles } = await supabase.from('user_roles').select('roles!inner(name)').eq('user_id', session.user.id).is('class_id', null)
    const allowed = roles?.some((row: any) => row.roles?.name === 'teacher' || row.roles?.name === 'administrator')
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const challengeId = typeof body.challengeId === 'string' ? body.challengeId : ''
    const classId = typeof body.classId === 'string' ? body.classId : null
    const gradeLevel = typeof body.gradeLevel === 'string' ? body.gradeLevel : null
    const language = body.language === 'zh' || body.language === 'en' || body.language === 'bilingual' ? body.language : 'bilingual'
    if (!challengeId) return NextResponse.json({ error: 'challengeId is required' }, { status: 400 })

    const { data: challenge, error } = await supabase.from('daily_challenges').select('id,title,description').eq('id', challengeId).single()
    if (error || !challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })

    const project = await createMangaWorkflowProject(challengeToMangaRequest({ ...challenge, classId, gradeLevel, language }))
    return NextResponse.json({ projectId: project.id, challengeId }, { status: 201 })
  } catch (error) {
    console.error('[manga-project] Could not start workflow:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not start manga workflow' }, { status: 502 })
  }
}

