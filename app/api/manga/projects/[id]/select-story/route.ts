import { NextResponse } from 'next/server'
import { z } from 'zod'
import { workflowStateSchema } from '@/lib/manga/domain'
import { mangaError, mangaServiceDb, requireMangaAdmin } from '@/lib/manga/server'

const inputSchema = z.object({ pitchId: z.string().min(1) })

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireMangaAdmin()
    const input = inputSchema.parse(await request.json())
    const db = mangaServiceDb()
    const { data, error } = await db.from('manga_projects').select('state').eq('id', params.id).single()
    if (error) throw error
    const state = workflowStateSchema.parse(data.state)
    if (!state.storyPitches.some(pitch => pitch.id === input.pitchId)) {
      return NextResponse.json({ error: 'Story pitch not found' }, { status: 404 })
    }
    state.selectedPitchId = input.pitchId
    state.stage = 'casting'
    const { error: updateError } = await db.from('manga_projects').update({ stage: state.stage, state }).eq('id', params.id)
    if (updateError) throw updateError
    return NextResponse.json(state)
  } catch (error) {
    const { message, status } = mangaError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

