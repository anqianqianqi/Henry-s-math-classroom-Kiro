/**
 * Choosing a pencil colour that stays visible on whatever room it is drawn on.
 *
 * The sketch boundary used one hardcoded graphite for every room. Measured in
 * the band where the frame actually sits, that gives:
 *
 *   cream room   edge luminance 226 → ink composites to 145, contrast 81  ✓
 *   mid room     edge luminance 110 → ink composites to  87, contrast 22  ✗
 *   dark room    edge luminance  23 → ink composites to  44, contrast 21  ✗
 *
 * On a dark room the graphite is LIGHTER than what it is drawn on, so it is not
 * behaving as ink at all. Since students pick their own room, anyone on a
 * darker one was getting a frame that is effectively not there.
 */

/** Warm graphite, for rooms bright enough to take a dark line. */
export const INK_DARK = '#44403c'

/** Warm off-white, for rooms too dark for graphite to register. */
export const INK_LIGHT = '#efe7d9'

/**
 * The luminance at which both inks give exactly the same contrast.
 *
 * Below it the light ink wins, above it the dark one, so switching here
 * maximises the worst case rather than picking a threshold by eye. Solves
 * |L - dark| = |light - L| for L, with the two ink luminances being ~60 and
 * ~232: the crossover lands at 146.
 */
export const INK_CROSSOVER = 146

/** Rec. 601 luma — matches how the thresholds above were measured. */
export function luminance(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000
}

/**
 * Which ink to draw on a surface of this brightness.
 *
 * Deliberately a hard switch rather than a blend. A mid-grey ink chosen by
 * interpolation would be the one colour guaranteed to be invisible on a
 * mid-grey room, which is precisely the case this exists to fix.
 */
export function inkForLuminance(surfaceLuminance: number): string {
  return surfaceLuminance > INK_CROSSOVER ? INK_DARK : INK_LIGHT
}

/**
 * Contrast the chosen ink will actually achieve at a given opacity.
 *
 * Exported so the rule can be tested by its outcome — "no room ends up below
 * this" — rather than by asserting the threshold constant back at itself.
 */
export function inkContrast(surfaceLuminance: number, opacity: number): number {
  const ink = inkForLuminance(surfaceLuminance)
  const inkLuminance = ink === INK_DARK ? 62.4 : 231.8
  const composited = surfaceLuminance * (1 - opacity) + inkLuminance * opacity
  return Math.abs(surfaceLuminance - composited)
}
