'use client'

/** Cutting a rectangle out of a rendered page. Browser half of crop.ts. */

import { boxToRect, BOX_PAD, type Box } from './crop'
import { detectWorkBox } from './detect'
import type { RenderedPage } from './pages'

/*
  Padding is for a box that was measured, not one that was drawn.

  A measured box is grown a little before cutting, because the detector stops
  at the last dark pixel and a stroke can sit a hair outside it. A box a
  student dragged around their own working is already exactly what they asked
  for, and growing it would pull in the line above — so a hand-drawn crop is
  cut at zero padding, which the caller asks for by passing it.
*/

/** The region as a JPEG blob, cut from the full-resolution page. */
export async function cropToBlob(page: RenderedPage, box: Box, pad: number = BOX_PAD): Promise<Blob> {
  const { canvas } = page
  const rect = boxToRect(box, canvas.width, canvas.height, pad)

  const out = document.createElement('canvas')
  out.width = rect.width
  out.height = rect.height
  const ctx = out.getContext('2d')!
  // Paper, not transparency: a JPEG has no alpha and would fill it with black.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, rect.width, rect.height)
  ctx.drawImage(canvas, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height)

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob(b => (b ? resolve(b) : reject(new Error('crop failed'))), 'image/jpeg', 0.9)
  })
}

/** The same region as a data URL, for showing in the review list. */
export function cropToDataUrl(page: RenderedPage, box: Box, pad: number = BOX_PAD): string {
  const { canvas } = page
  const rect = boxToRect(box, canvas.width, canvas.height, pad)
  const out = document.createElement('canvas')
  out.width = rect.width
  out.height = rect.height
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, rect.width, rect.height)
  ctx.drawImage(canvas, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height)
  return out.toDataURL('image/jpeg', 0.85)
}

/**
 * The crop for a sheet, measured from the page rather than guessed at.
 *
 * `hint` is the model's box, used only to decide which side of a two-up scan
 * the sheet is on. Its coordinates are otherwise ignored — see detect.ts for
 * why. Returns null when there is nothing handwritten under the card, which
 * the review shows as an unanswered problem.
 */
export function measureWorkBox(page: RenderedPage, hint?: Box | null): Box | null {
  const { canvas } = page
  const ctx = canvas.getContext('2d')!
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height)

  let half: 'left' | 'right' | 'whole' = 'whole'
  if (hint) {
    const centre = hint.x + hint.w / 2
    // Only a box clearly on one side implies a two-up scan; one straddling
    // the middle is the model describing a whole page.
    if (hint.w < 0.62) half = centre < 0.5 ? 'left' : 'right'
  }

  return detectWorkBox({ data: px.data, width: px.width, height: px.height }, half)
}
