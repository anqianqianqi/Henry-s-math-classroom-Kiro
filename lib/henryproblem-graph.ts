/**
 * Browser-only helpers for the graph embedded in a .henryproblem snapshot.
 *
 * The snapshot always stores the *complete* original image plus a separate
 * normalized crop rectangle; only the cropped region is meant to be displayed.
 * We apply the crop once at upload time and store the result in the
 * challenge-images bucket, so the display path stays a plain <img src=...>.
 */

import type { HenryGraphCrop } from './henryproblem'

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The embedded graph image could not be read.'))
    img.src = dataUrl
  })
}

/**
 * Apply the snapshot's crop to its embedded PNG and return an uploadable Blob.
 * Mirrors crop_graph_image() in homework_prettifier.py.
 */
export async function cropGraphToBlob(
  dataUrl: string,
  crop: HenryGraphCrop
): Promise<Blob> {
  const img = await loadImage(dataUrl)
  const { width, height } = img

  const left = Math.max(0, Math.min(width - 1, Math.round(crop.left * width)))
  const top = Math.max(0, Math.min(height - 1, Math.round(crop.top * height)))
  const right = Math.max(1, Math.min(width, Math.round(crop.right * width)))
  const bottom = Math.max(1, Math.min(height, Math.round(crop.bottom * height)))

  const cropWidth = right > left ? right - left : width
  const cropHeight = bottom > top ? bottom - top : height
  const sourceX = right > left ? left : 0
  const sourceY = bottom > top ? top : 0

  const canvas = document.createElement('canvas')
  canvas.width = cropWidth
  canvas.height = cropHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot process the graph image.')

  ctx.drawImage(img, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Could not encode the graph image.'))),
      'image/png'
    )
  })
}
