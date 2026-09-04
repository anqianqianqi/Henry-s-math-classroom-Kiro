import { NextResponse } from 'next/server'
import { workflowStateSchema } from '@/lib/manga/domain'
import { chooseRenderModeSchema } from '@/lib/manga/rendering'
import { mangaError, mangaServiceDb, requireMangaAdmin } from '@/lib/manga/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireMangaAdmin()
    const input = chooseRenderModeSchema.parse(await request.json())
    const db = mangaServiceDb()
    const { data, error } = await db.from('manga_projects').select('state').eq('id', params.id).single()
    if (error) throw error
    const state = workflowStateSchema.parse(data.state)
    if (!['render_mode_selection', 'generating', 'panel_review'].includes(state.stage)) {
      return NextResponse.json({ error: 'Approve the storyboard before choosing image generation mode.' }, { status: 409 })
    }
    if (!state.panels.length) return NextResponse.json({ error: 'The approved storyboard has no panels.' }, { status: 409 })

    state.renderSpec.generationMode = input.mode
    state.stage = 'generating'
    const { error: updateError } = await db.from('manga_projects').update({ stage: state.stage, state }).eq('id', params.id)
    if (updateError) throw updateError
    return NextResponse.json(state)
  } catch (error) {
    const { message, status } = mangaError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
