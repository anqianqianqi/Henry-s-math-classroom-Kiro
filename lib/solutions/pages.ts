'use client'

/**
 * An uploaded document, as pages we can look at and cut from.
 *
 * A student prints the problem set, works on paper, and photographs or scans
 * the result. That arrives here as one PDF or a handful of images; either way
 * what the rest of the feature needs is the same thing — a list of pages, each
 * a canvas it can crop a region out of.
 *
 * ── TWO RESOLUTIONS, ON PURPOSE ─────────────────────────────
 * Pages are rendered large enough that a crop of one answer is still legible
 * (CROP_LONG_EDGE), but the copy sent to the model is much smaller
 * (VISION_LONG_EDGE). The model is being asked where things are, not to read
 * them closely, and full-resolution scans of a dozen pages would cost a great
 * deal and time out for nothing. The crop is always taken from the large one.
 *
 * ── WHY pdfjs IS IMPORTED INSIDE THE FUNCTION ───────────────
 * pdfjs-dist is ESM and uses import.meta. A 'use client' module is still
 * compiled and evaluated on the server for the initial render, and that build
 * fails on import.meta outside module code. Importing it where it is used
 * keeps it off the server entirely, which is also where it belongs: it needs a
 * canvas and a Worker, neither of which exists there.
 */

/** Long edge of the page we crop from — enough to read handwriting back. */
const CROP_LONG_EDGE = 2000

/** Long edge of the copy the model sees. Locating boxes needs far less. */
const VISION_LONG_EDGE = 1100

/**
 * The worker, served as a static file.
 *
 * Not `new URL(..., import.meta.url)`: that is the tidier way to let the
 * bundler emit it, and it is exactly the import.meta this file cannot contain.
 * The copy in public/ is made by the `sync:pdfjs` script, which runs on
 * postinstall and before every build, so it cannot drift from the installed
 * version the way a hand-copied file would.
 */
const WORKER_SRC = '/pdfjs/pdf.worker.min.mjs'

export interface RenderedPage {
  /** 0-based, and the number the model is given. */
  index: number
  canvas: HTMLCanvasElement
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

/** Scale that puts the long edge at `target`, never enlarging past it. */
function fitScale(width: number, height: number, target: number): number {
  return Math.min(1, target / Math.max(width, height)) || 1
}

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC
  return pdfjs
}

async function renderPdf(file: File): Promise<HTMLCanvasElement[]> {
  const pdfjs = await loadPdfjs()
  const data = await file.arrayBuffer()
  const task = pdfjs.getDocument({ data })
  const doc = await task.promise
  const canvases: HTMLCanvasElement[] = []

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const base = page.getViewport({ scale: 1 })
    // Scaled UP to the crop size: a PDF page at scale 1 is 72dpi, far too
    // coarse to read handwriting back out of a crop.
    const scale = CROP_LONG_EDGE / Math.max(base.width, base.height)
    const viewport = page.getViewport({ scale })

    const width = Math.round(viewport.width)
    const height = Math.round(viewport.height)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    // Scans of white paper: without this, transparent areas crop to black.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)

    /*
      intent 'print' is not cosmetic here, it decides how the render is driven.

      pdf.js schedules canvas rendering through requestAnimationFrame for
      everything except printing — in its own source, `useRequestAnimationFrame:
      !intentPrint`. A tab that is not being composited never fires rAF, so a
      student who starts an upload and switches away comes back to a page still
      saying "opening your pages", forever, with no error to show for it. Under
      the print intent the work is scheduled on timers instead and finishes
      whether or not anyone is watching.

      It is also the truthful intent: this is rendering a page to reproduce it
      as an image, which is what printing means, not painting it for a reader.
    */
    await page.render({ canvas, canvasContext: ctx, viewport, intent: 'print' }).promise

    canvases.push(canvas)
  }

  // The worker holds the whole file until the loading task is torn down.
  await task.destroy()
  return canvases
}

async function renderImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const scale = fitScale(bitmap.width, bitmap.height, CROP_LONG_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

/** Every page of every file given, in the order they were chosen. */
export async function renderUpload(files: File[]): Promise<RenderedPage[]> {
  const pages: RenderedPage[] = []
  for (const file of files) {
    const canvases = isPdf(file) ? await renderPdf(file) : [await renderImage(file)]
    for (const canvas of canvases) pages.push({ index: pages.length, canvas })
  }
  return pages
}

/** A small JPEG of the page, for the model. */
export function visionDataUrl(page: RenderedPage): string {
  const { canvas } = page
  const scale = fitScale(canvas.width, canvas.height, VISION_LONG_EDGE)
  if (scale >= 1) return canvas.toDataURL('image/jpeg', 0.8)

  const small = document.createElement('canvas')
  small.width = Math.round(canvas.width * scale)
  small.height = Math.round(canvas.height * scale)
  const ctx = small.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, small.width, small.height)
  return small.toDataURL('image/jpeg', 0.8)
}
