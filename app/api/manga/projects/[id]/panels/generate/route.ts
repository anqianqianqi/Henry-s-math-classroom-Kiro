import { NextResponse } from 'next/server'
import { workflowStateSchema } from '@/lib/manga/domain'
import { buildPanelArtPrompt, generatePanelsSchema, pendingPanelIndexes, requestPanelImage, uploadPanelImage } from '@/lib/manga/rendering'
import { mangaError, mangaServiceDb, requireMangaAdmin } from '@/lib/manga/server'

export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireMangaAdmin()
    const input = generatePanelsSchema.parse(await request.json())
    const db = mangaServiceDb()
    const { data, error } = await db.from('manga_projects').select('state').eq('id', params.id).single()
    if (error) throw error
    const state = workflowStateSchema.parse(data.state)
    if (!['generating', 'panel_review'].includes(state.stage)) {
      return NextResponse.json({ error: 'Choose an image generation mode after storyboard approval.' }, { status: 409 })
    }

    const indexes = pendingPanelIndexes(state, input.panelIndex)
    if (!indexes.length) return NextResponse.json({ state, generated: [], message: 'No pending panels.' })

    const generated: number[] = []
    let cursor = 0
    const configuredConcurrency = Number.parseInt(process.env.OPENAI_MANGA_BULK_CONCURRENCY || '3', 10)
    const concurrency = state.renderSpec.generationMode === 'bulk' ? Math.max(1, Math.min(4, configuredConcurrency || 3)) : 1

    async function generateNextPanel(): Promise<void> {
      const index = indexes[cursor++]
      if (index === undefined) return
      const panel = state.panels.find(item => item.index === index)
      if (!panel) return generateNextPanel()
      panel.artStatus = 'generating'
      panel.lastError = null
      panel.artPrompt = buildPanelArtPrompt(state, panel)
      const nextVersion = panel.artVersion + 1

      try {
        const image = await requestPanelImage(panel.artPrompt)
        panel.imageUrl = await uploadPanelImage(db, params.id, panel.index, nextVersion, image)
        panel.artVersion = nextVersion
        panel.artStatus = 'ready'
        generated.push(index)
      } catch (panelError) {
        panel.artStatus = 'failed'
        panel.lastError = panelError instanceof Error ? panelError.message : 'Panel generation failed'
      }
      return generateNextPanel()
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, indexes.length) }, () => generateNextPanel()))

    const allAttempted = state.panels.every(item => item.artStatus === 'ready' || item.artStatus === 'approved' || item.artStatus === 'failed')
    state.stage = allAttempted ? 'panel_review' : 'generating'
    const { error: updateError } = await db.from('manga_projects').update({ stage: state.stage, state }).eq('id', params.id)
    if (updateError) throw updateError

    return NextResponse.json({ state, generated })
  } catch (error) {
    const { message, status } = mangaError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
