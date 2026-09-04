import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkflowState } from './domain'
import { renderModeSchema } from './domain'

export const chooseRenderModeSchema = z.object({ mode: renderModeSchema })
export const generatePanelsSchema = z.object({ panelIndex: z.number().int().min(1).max(18).optional() })

type MangaPanel = WorkflowState['panels'][number]

export function pendingPanelIndexes(state: WorkflowState, panelIndex?: number) {
  const mode = state.renderSpec.generationMode
  if (!mode) throw new Error('Choose one-by-one or bulk generation before creating images.')

  if (mode === 'one_by_one') {
    if (panelIndex === undefined) throw new Error('Choose one panel to generate in one-by-one mode.')
    const panel = state.panels.find(item => item.index === panelIndex)
    if (!panel) throw new Error(`Panel ${panelIndex} does not exist.`)
    return [panelIndex]
  }

  if (panelIndex !== undefined) throw new Error('Bulk mode generates every pending or failed panel; do not send panelIndex.')
  return state.panels.filter(panel => panel.artStatus === 'pending' || panel.artStatus === 'failed').map(panel => panel.index)
}

export function buildPanelArtPrompt(state: WorkflowState, panel: MangaPanel) {
  const cast = state.cast.map(item => `${item.characterId} version ${item.characterVersion}: ${item.role}`).join('; ')
  const characterDirection = panel.characters.map(character => `${character.characterId}: ${character.action}; expression: ${character.expression}`).join('; ')

  return [
    'Create exactly ONE educational manga panel illustration, not a comic page and not a panel grid.',
    'The illustration will receive deterministic dialogue and math overlays later.',
    `Teaching purpose: ${panel.purpose}`,
    `Scene: ${panel.scene}`,
    `Camera: ${panel.camera}`,
    `Characters: ${characterDirection || 'none'}`,
    `Approved cast: ${cast || 'none supplied'}`,
    `Math overlay: ${panel.mathVisual ? 'reserve clean negative space for a later deterministic math overlay' : 'none'}`,
    `Continuity requirements: ${panel.continuity}`,
    `House art direction: ${state.renderSpec.artDirection}`,
    'Keep intentional negative space for later speech bubbles and mathematical labels.',
    'ABSOLUTELY NO text, letters, numbers, equations, speech bubbles, captions, panel numbers, borders, gutters, page layout, watermark, signature, or multiple panels.',
  ].join('\n')
}

export async function requestPanelImage(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing')

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MANGA_IMAGE_MODEL || 'gpt-image-2',
      prompt,
      n: 1,
      size: '1536x1024',
      quality: 'high',
      output_format: 'png',
    }),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body?.error?.message || `OpenAI image generation returned ${response.status}`)
  const encoded = body?.data?.[0]?.b64_json
  if (!encoded) throw new Error('OpenAI image generation returned no image data')
  return Buffer.from(encoded, 'base64')
}

export async function uploadPanelImage(
  db: SupabaseClient,
  projectId: string,
  panelIndex: number,
  version: number,
  image: Buffer,
) {
  const path = `${projectId}/panel-${String(panelIndex).padStart(2, '0')}-v${version}.png`
  const bucket = db.storage.from('manga-panels')
  const { error } = await bucket.upload(path, image, { contentType: 'image/png', upsert: false })
  if (error) throw error
  return bucket.getPublicUrl(path).data.publicUrl
}
