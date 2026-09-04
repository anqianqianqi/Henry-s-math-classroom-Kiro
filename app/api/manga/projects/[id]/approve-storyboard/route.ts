import { NextResponse } from 'next/server'
import { workflowStateSchema } from '@/lib/manga/domain'
import { mangaError, mangaServiceDb, requireMangaAdmin } from '@/lib/manga/server'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireMangaAdmin()
    const db = mangaServiceDb()
    const { data, error } = await db.from('manga_projects').select('state').eq('id', params.id).single()
    if (error) throw error
    const state = workflowStateSchema.parse(data.state)
    if (state.stage !== 'storyboard_review') {
      return NextResponse.json({ error: 'Only a reviewed storyboard can be approved.' }, { status: 409 })
    }
    if (state.panels.length < 6 || state.panels.length > 18) {
      return NextResponse.json({ error: 'The storyboard must contain 6–18 panels.' }, { status: 409 })
    }

    state.panels = state.panels.map(panel => ({
      ...panel,
      artPrompt: '',
      artStatus: 'pending' as const,
      artVersion: 0,
      imageUrl: null,
      lastError: null,
    }))
    state.renderSpec.generationMode = null
    state.stage = 'render_mode_selection'
    const { error: updateError } = await db.from('manga_projects').update({ stage: state.stage, state }).eq('id', params.id)
    if (updateError) throw updateError
    return NextResponse.json(state)
  } catch (error) {
    const { message, status } = mangaError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
