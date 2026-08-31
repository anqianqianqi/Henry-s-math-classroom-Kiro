import { NextRequest, NextResponse } from 'next/server'
import { mangaServiceDb, requireMangaTeacher } from '@/lib/manga/server'
import { workflowStateSchema } from '@/lib/manga/domain'


export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireMangaTeacher(); const db = mangaServiceDb()
    const { data, error } = await db.from('manga_projects').select('state').eq('id',params.id).single(); if (error) throw error
    const state = workflowStateSchema.parse(data.state)
    if (state.stage !== 'ready_to_publish' || state.panels.length !== 6 || state.panels.some(p => !p.imageUrl)) return NextResponse.json({ error:'A quality-approved six-panel comic is required.' }, { status:409 })
    const { data:comic, error:comicError } = await db.from('manga_published_comics').insert({ project_id:params.id, source_challenge_id:state.sourceChallengeId, class_id:state.classId, title:state.storyPitches.find(p => p.id === state.selectedPitchId)?.title || 'Math Comic', language:state.language, math_takeaway:state.mathAnalysis?.mathTakeaway || '', cover_image_url:state.panels[0].imageUrl, panel_count:6, status:'published', published_at:new Date().toISOString() }).select('id').single(); if (comicError) throw comicError
    const { error:panelError } = await db.from('manga_comic_panels').insert(state.panels.map(p => ({ comic_id:comic.id, panel_index:p.index, image_url:p.imageUrl, dialogue:p.dialogue, narration:p.narration, math_visual:p.mathVisual }))); if (panelError) throw panelError
    state.stage='published'; await db.from('manga_projects').update({stage:state.stage,state}).eq('id',params.id)
    return NextResponse.json({ comicId:comic.id, status:'published' })
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : 'Could not publish comic' }, { status:400 }) }
}
