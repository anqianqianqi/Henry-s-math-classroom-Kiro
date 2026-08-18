'use client'

/** Cutting a rectangle out of a rendered page. Browser half of crop.ts. */

import { boxToRect, type Box } from './crop'
import type { RenderedPage } from './pages'

/** The region as a JPEG blob, cut from the full-resolution page. */
export async function cropToBlob(page: RenderedPage, box: Box): Promise<Blob> {
  const { canvas } = page
  const rect = boxToRect(box, canvas.width, canvas.height)

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
export function cropToDataUrl(page: RenderedPage, box: Box): string {
  const { canvas } = page
  const rect = boxToRect(box, canvas.width, canvas.height)
  const out = document.createElement('canvas')
  out.width = rect.width
  out.height = rect.height
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, rect.width, rect.height)
  ctx.drawImage(canvas, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height)
  return out.toDataURL('image/jpeg', 0.85)
}
