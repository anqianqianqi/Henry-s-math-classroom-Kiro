import { NextRequest, NextResponse } from 'next/server'
import { mangaServiceDb, requireMangaAdmin } from '@/lib/manga/server'
import { workflowStateSchema } from '@/lib/manga/domain'

/**
 * GET /api/manga/projects/[id]
 * Load an existing manga project's full state.
 * Used by the studio page to resume an in-progress workflow after navigation or refresh.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireMangaAdmin()
    const db = mangaServiceDb()
    const { data, error } = await db
      .from('manga_projects')
      .select('id, source_challenge_id, stage, state')
      .eq('id', params.id)
      .single()
    if (error || !data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    const state = workflowStateSchema.parse(data.state)
    return NextResponse.json({ projectId: data.id, challengeId: data.source_challenge_id, state })
  } catch (error) {
    const status = error instanceof Error && error.message === 'UNAUTHORIZED' ? 401 : 400
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load project' }, { status })
  }
}
