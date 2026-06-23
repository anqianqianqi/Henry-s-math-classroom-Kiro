/**
 * Shared overlay animation helpers for book cover skins.
 * Used by: OverlayEditorInline, MagicBookReveal, BookCoverWithOverlays,
 *          BookCoverLivePreview, ZoomPreviewCover, ShopCoverZoom
 *
 * Each animation has a BASE_DURATION in seconds.
 * Speed multiplier: speed=1 → baseDuration, speed=2 → baseDuration/2 (faster), etc.
 * Default speed = 1.0.
 *
 * SWAY uses transform-origin: top center so it swings like a pendulum.
 * The element wrapper must set transformOrigin accordingly — keyframe only rotates.
 */

export type OverlayAnim = 'none' | 'float' | 'pulse' | 'rotate' | 'shimmer' | 'bounce' | 'sway' | 'flicker' | 'bling' | 'burst'

/** Base durations in seconds for speed=1 */
export const BASE_DURATIONS: Record<OverlayAnim, number> = {
  none:    0,
  float:   3.0,
  pulse:   2.5,
  rotate:  8.0,
  shimmer: 2.0,
  bounce:  1.8,
  sway:    2.5,
  flicker: 1.4,
  bling:   2.0,
  burst:   2.0,  // handled by OverlayBurstRenderer, not CSS
}

/** Easing functions per animation */
const EASINGS: Record<OverlayAnim, string> = {
  none:    '',
  float:   'ease-in-out',
  pulse:   'ease-in-out',
  rotate:  'linear',
  shimmer: 'ease-in-out',
  bounce:  'ease-in-out',
  sway:    'ease-in-out',
  flicker: 'ease-in-out',
  bling:   'ease-in-out',
  burst:   'linear',  // not used — handled by canvas renderer
}

/**
 * Build the animation CSS shorthand string for a given animation + prefix + speed.
 * Returns '' for 'none'.
 * prefix: unique prefix for @keyframe names (e.g. 'bov', 'szp', 'zp')
 */
export function buildAnimCSS(anim: OverlayAnim, prefix: string, speed: number = 1.0): string {
  if (anim === 'none') return ''
  const base = BASE_DURATIONS[anim]
  const duration = (base / Math.max(0.1, speed)).toFixed(2)
  const easing = EASINGS[anim]
  return `${prefix}-${anim} ${duration}s ${easing} infinite`
}

/**
 * Generate @keyframes CSS block for all animations with the given prefix.
 * SWAY uses a simple rotate without translate — transform-origin on the element handles pivot.
 */
export function buildKeyframesCSS(prefix: string): string {
  const p = prefix
  return `
@keyframes ${p}-float   { 0%,100%{transform:translateY(0)}                          50%{transform:translateY(-8px)} }
@keyframes ${p}-pulse   { 0%,100%{transform:scale(1)}                                50%{transform:scale(1.12)} }
@keyframes ${p}-rotate  { from{transform:rotate(0deg)}                               to{transform:rotate(360deg)} }
@keyframes ${p}-shimmer { 0%,100%{opacity:1}                                         50%{opacity:0.45} }
@keyframes ${p}-bounce  { 0%,100%{transform:translateY(0)}                           40%{transform:translateY(-14px)} 60%{transform:translateY(-6px)} }
@keyframes ${p}-sway    { 0%,100%{transform:rotate(-8deg)}                           50%{transform:rotate(8deg)} }
@keyframes ${p}-flicker { 0%,100%{opacity:1} 25%{opacity:0.3} 50%{opacity:0.9} 75%{opacity:0.15} }
@keyframes ${p}-bling   { 0%,100%{filter:brightness(1) drop-shadow(0 0 0px gold)}   50%{filter:brightness(1.6) drop-shadow(0 0 8px gold)} }
`.trim()
}

/** For sway, return transform-origin: top center so it pivots from the top */
export function getTransformOrigin(anim: OverlayAnim): string | undefined {
  return anim === 'sway' ? 'top center' : undefined
}

/** Base overlay size in px at native cover width (1024px). */
export const OVERLAY_BASE_PX = 80
/** Native cover width in px (gpt-image-1 cover output). */
export const COVER_NATIVE_WIDTH = 1024

/**
 * Returns overlay size as a % of the container width.
 * This ensures overlays scale proportionally regardless of rendered cover size.
 *   sizePct = (OVERLAY_BASE_PX * scale / COVER_NATIVE_WIDTH) * 100
 */
export function overlayWidthPct(scale: number): string {
  return `${((OVERLAY_BASE_PX * scale) / COVER_NATIVE_WIDTH) * 100}%`
}
export const OV_ANIM_OPTIONS: { value: OverlayAnim; label: string }[] = [
  { value: 'none',    label: '⏸ None' },
  { value: 'float',   label: '🌊 Float' },
  { value: 'pulse',   label: '💗 Pulse' },
  { value: 'rotate',  label: '🔄 Rotate' },
  { value: 'shimmer', label: '✨ Shimmer' },
  { value: 'bounce',  label: '🏀 Bounce' },
  { value: 'sway',    label: '🌿 Sway' },
  { value: 'flicker', label: '🕯 Flicker' },
  { value: 'bling',   label: '💎 Bling' },
  { value: 'burst',   label: '💥 Burst' },
]

/** Compute CSS mixBlendMode and filter for a given blendMode string.
 *  Returns a partial CSSProperties object to spread onto the <img> element. */
export function overlayBlendStyle(blendMode?: boolean | string, blendStrength?: number, warmTint?: number): { mixBlendMode?: any; filter?: string; opacity?: number } {
  // Support both old string format (backward compat) and new boolean format
  const isMultiply = blendMode === true || blendMode === 'multiply' || blendMode === 'multiply-warm'
  if (!isMultiply) return {}

  const strength = blendStrength ?? 0.85
  const tint = warmTint ?? (blendMode === 'multiply-warm' ? 0.4 : 0)

  // Build filter string: sepia for warm tint
  const filterParts: string[] = []
  if (tint > 0) filterParts.push(`sepia(${tint.toFixed(2)})`)
  const filter = filterParts.length > 0 ? filterParts.join(' ') : undefined

  return {
    mixBlendMode: 'multiply',
    opacity: strength,
    filter,
  }
}
