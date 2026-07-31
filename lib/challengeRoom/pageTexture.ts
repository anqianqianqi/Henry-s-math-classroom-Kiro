/**
 * Composites text onto the inner-page art to produce a page texture.
 *
 * This is why the problem appears to be *written in the book* rather than
 * floating over it: the text becomes part of the texture, so the 3D pipeline
 * gives it the page's perspective, curl and lighting for free. Aligning an HTML
 * overlay to the page quad would have to re-derive all of that and would drift
 * whenever the placement changed.
 *
 * Only a preview belongs here. Anything the student types into lives in the
 * zoomed DOM pages — you cannot put a form in a texture.
 */

export interface PageContent {
  heading?: string
  body?: string
  footer?: string
}

/** Texture space. Matches the generated page art (3:4 portrait). */
const TEX_W = 1536
const TEX_H = 2048

/**
 * Inset past the frame and corner clusters. The cover/inner prompts put a gold
 * border ~2% in and vignettes in each corner, and promise a blank centre — this
 * keeps text inside that promised area.
 */
const PAD_X = 210
const PAD_TOP = 300
const PAD_BOTTOM = 240

const HEADING_SIZE = 68
const BODY_SIZE = 48
const LINE_HEIGHT = 1.55

/** Serif to match the DOM pages, with CJK fallbacks — problems are bilingual. */
const FONT_STACK = '"Georgia", "Times New Roman", "Noto Serif SC", "Microsoft YaHei", serif'

const INK = '#2d1a00'
const INK_SOFT = 'rgba(100,60,10,0.62)'

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  // Respect the author's own line breaks, then wrap each paragraph.
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }
    let line = ''
    // CJK has no spaces, so fall back to per-character wrapping when a
    // "word" is itself wider than the column.
    for (const word of paragraph.split(/(\s+)/)) {
      const candidate = line + word
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate
        continue
      }
      if (ctx.measureText(word).width > maxWidth) {
        if (line) lines.push(line.trimEnd())
        line = ''
        for (const char of word) {
          if (ctx.measureText(line + char).width > maxWidth) {
            lines.push(line)
            line = char
          } else {
            line += char
          }
        }
        continue
      }
      lines.push(line.trimEnd())
      line = word.trimStart()
    }
    if (line.trim()) lines.push(line.trimEnd())
  }
  return lines
}

/**
 * @param baseImage the inner-page art, already loaded and CORS-clean
 * @returns a canvas usable as a THREE.CanvasTexture
 */
export function renderPageCanvas(
  baseImage: CanvasImageSource,
  content: PageContent,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.drawImage(baseImage, 0, 0, TEX_W, TEX_H)

  ctx.textBaseline = 'top'
  ctx.fillStyle = INK

  const maxWidth = TEX_W - PAD_X * 2
  const bottomLimit = TEX_H - PAD_BOTTOM
  let y = PAD_TOP

  if (content.heading) {
    ctx.font = `600 ${HEADING_SIZE}px ${FONT_STACK}`
    for (const line of wrap(ctx, content.heading, maxWidth)) {
      if (y + HEADING_SIZE > bottomLimit) break
      ctx.fillText(line, PAD_X, y)
      y += HEADING_SIZE * 1.3
    }

    // Rule under the heading, matching the page's ink
    y += 14
    ctx.strokeStyle = 'rgba(100,60,10,0.28)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(PAD_X, y)
    ctx.lineTo(TEX_W - PAD_X, y)
    ctx.stroke()
    y += 40
  }

  if (content.body) {
    ctx.font = `${BODY_SIZE}px ${FONT_STACK}`
    ctx.fillStyle = INK
    const step = BODY_SIZE * LINE_HEIGHT
    const lines = wrap(ctx, content.body, maxWidth)
    for (let i = 0; i < lines.length; i += 1) {
      if (y + step > bottomLimit) {
        // Ran out of page — signal there is more rather than cutting mid-word
        ctx.fillStyle = INK_SOFT
        ctx.font = `italic ${BODY_SIZE}px ${FONT_STACK}`
        ctx.fillText('…', PAD_X, y)
        break
      }
      ctx.fillText(lines[i], PAD_X, y)
      y += step
    }
  }

  if (content.footer) {
    ctx.font = `italic ${BODY_SIZE * 0.85}px ${FONT_STACK}`
    ctx.fillStyle = INK_SOFT
    const line = wrap(ctx, content.footer, maxWidth)[0] ?? ''
    ctx.fillText(line, PAD_X, bottomLimit - BODY_SIZE)
  }

  return canvas
}
