import { NextRequest, NextResponse } from 'next/server'
import { mangaServiceDb, requireMangaAdmin } from '@/lib/manga/server'
import { workflowStateSchema } from '@/lib/manga/domain'


export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireMangaAdmin(); const db = mangaServiceDb()
    const { data, error } = await db.from('manga_projects').select('state').eq('id', params.id).single(); if (error) throw error
    const state = workflowStateSchema.parse(data.state)
    if (!state.mathAnalysis || state.mathAnalysis.ambiguities.length) return NextResponse.json({ error:'Math must be complete and unambiguous before approval.' }, { status:409 })
    state.stage = 'story_selection'
    const { error:updateError } = await db.from('manga_projects').update({ stage:state.stage, state }).eq('id',params.id); if (updateError) throw updateError
    return NextResponse.json(state)
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : 'Could not approve math' }, { status:400 }) }
}
