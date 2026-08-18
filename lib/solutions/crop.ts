/**
 * Turning the model's answer into a rectangle of pixels.
 *
 * Boxes come back normalised 0..1 so they survive the difference between the
 * small copy the model saw and the large page we cut from. They also come back
 * approximate: a vision model puts a box roughly around a block of
 * handwriting, and "roughly" routinely clips the first stroke of a line or the
 * tail of a fraction. Every box is therefore padded before it is cut, and
 * clamped so the padding cannot walk off the page.
 *
 * Pure on purpose — no canvas — so the arithmetic can be tested directly.
 */

/** Normalised rectangle, each value a fraction of the page. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Pixel rectangle on a real page. */
export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Grown by this fraction of the page on every side before cutting.
 *
 * Generous rather than tight. Too much padding includes a stray line from the
 * answer above, which a teacher can read past; too little cuts the top off an
 * exponent, which cannot be read back at all.
 */
export const BOX_PAD = 0.025

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** True for a box that is present, finite, and encloses some area. */
export function isUsableBox(box: unknown): box is Box {
  if (!box || typeof box !== 'object') return false
  const b = box as Record<string, unknown>
  const nums = [b.x, b.y, b.w, b.h]
  if (!nums.every(n => typeof n === 'number' && Number.isFinite(n))) return false
  // A zero-area box means the model found nothing and said so with geometry.
  return (b.w as number) > 0.01 && (b.h as number) > 0.01
}

/** The box padded and clamped back inside the page. */
export function padBox(box: Box, pad: number = BOX_PAD): Box {
  const x = clamp01(box.x - pad)
  const y = clamp01(box.y - pad)
  // Computed from the padded origin so the far edge lands where it should
  // rather than drifting by whatever the near edge lost to the clamp.
  const right = clamp01(box.x + box.w + pad)
  const bottom = clamp01(box.y + box.h + pad)
  return { x, y, w: right - x, h: bottom - y }
}

/** Where to cut, in pixels, on a page of this size. */
export function boxToRect(box: Box, pageWidth: number, pageHeight: number, pad: number = BOX_PAD): Rect {
  const p = padBox(box, pad)
  const left = Math.round(p.x * pageWidth)
  const top = Math.round(p.y * pageHeight)
  return {
    left,
    top,
    // Rounded from the far edge rather than by scaling the width, so a
    // rounding error cannot push the rectangle past the edge of the page.
    width: Math.max(1, Math.round((p.x + p.w) * pageWidth) - left),
    height: Math.max(1, Math.round((p.y + p.h) * pageHeight) - top),
  }
}
