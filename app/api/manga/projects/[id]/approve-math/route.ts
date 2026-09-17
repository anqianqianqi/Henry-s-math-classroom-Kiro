import { NextRequest, NextResponse } from 'next/server'
import { mangaServiceDb, requireMangaAdmin } from '@/lib/manga/server'
import { workflowStateSchema } from '@/lib/manga/domain'


export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireMangaAdmin(); const db = mangaServiceDb()
    const { data, error } = await db.from('manga_projects').select('state').eq('id', params.id).single(); if (error) throw error
    const state = workflowStateSchema.parse(data.state)
    if (!state.mathAnalysis) return NextResponse.json({ error:'Math must be analyzed before approval. Click Analyze first.' }, { status:409 })
    // Only block approval if confidence is too low — ambiguities are informational notes, not blockers
    if (state.mathAnalysis.confidence < 0.7) return NextResponse.json({ error:`Math confidence is too low (${Math.round(state.mathAnalysis.confidence * 100)}%). Use the Review button to correct the analysis before approving.` }, { status:409 })
    state.stage = 'story_selection'
    const { error:updateError } = await db.from('manga_projects').update({ stage:state.stage, state }).eq('id',params.id); if (updateError) throw updateError
    return NextResponse.json(state)
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : 'Could not approve math' }, { status:400 }) }
}
