/**
 * Art styles — how a thing is painted, as opposed to what is in it.
 *
 * ── WHY THIS MOVED OUT OF THE PAGE ──────────────────────────
 * These lived inline in app/book-skins/page.tsx, which is a 'use client'
 * module. The challenge-room and book-bundle prompt compilers run inside route
 * handlers, so they could not reach them — which is a large part of why art
 * style ended up hard-coded into those prompts instead.
 *
 * The six original entries are moved VERBATIM. /book-skins swaps a literal for
 * an import and behaves identically; artStyles.test.ts pins the strings so that
 * stays true, since that page has no other coverage.
 *
 * ── THE SPLIT THAT MAKES STYLE COMPOSABLE ───────────────────
 * Style owns the render descriptor — brushwork, edges, light. The theme owns
 * the substrate: paper, frame, materials, architecture. Keeping those apart is
 * what lets a style vary freely without colliding with the world it is painting,
 * and it is why the prompts can stop contradicting their own spec.
 */

export interface ArtStyle {
  id: string
  label: string
  emoji: string
  /** Appended to the book-skins cover prompt. */
  coverSuffix: string
  /** Used as a style rule in the enrich-cluster-items system prompt. */
  objectStyle: string
  /** Replaces the hard-coded style line in compileRoomPrompt. */
  roomRender: string
  /** Replaces the hard-coded style line in the book cover/inner prompts. */
  textureRender: string
}

export const ART_STYLES: ArtStyle[] = [
  {
    id: 'realistic',
    label: 'Realistic',
    emoji: '📸',
    coverSuffix: 'rendered in a photorealistic style — rich textures, accurate materials, lifelike lighting as if photographed',
    objectStyle: 'photorealistic — accurate materials, lifelike lighting, physical depth, as if photographed in a studio',
    roomRender: 'Photographic interior render: accurate materials, physically plausible light falloff, fine surface texture, natural depth of field.',
    textureRender: 'Photographic print artwork: accurate material texture, true-to-life colour, crisp detail, even studio lighting.',
  },
  {
    id: 'ghibli',
    label: 'Ghibli',
    emoji: '🌿',
    coverSuffix: 'in the style of Studio Ghibli — soft watercolour washes, hand-painted detail, warm nostalgic palette, painterly brushwork, gentle rounded forms',
    objectStyle: 'Studio Ghibli illustration style — soft watercolour texture, hand-painted feel, warm nostalgic colours, rounded friendly forms, painterly brushwork',
    roomRender: 'Hand-painted animation background: soft washes, warm nostalgic light, gentle rounded forms, painterly brushwork, generous atmospheric depth.',
    textureRender: 'Hand-painted animation-cel artwork: soft washes, warm nostalgic colour, gentle rounded forms, visible painterly brushwork.',
  },
  {
    id: 'futuristic',
    label: 'Futuristic',
    emoji: '🚀',
    coverSuffix: 'in a sleek futuristic sci-fi style — glowing neon accents, holographic surfaces, carbon fibre and chrome materials, crisp hard-edge design',
    objectStyle: 'futuristic sci-fi style — glowing neon edges, holographic sheen, chrome and carbon materials, crisp angular forms, cyberpunk atmosphere',
    roomRender: 'Crisp sci-fi environment render: hard-edge surfaces, smooth gradients, luminous edge accents, controlled specular highlights, clean cinematic depth.',
    textureRender: 'Clean sci-fi print artwork: hard-edge shapes, smooth gradients, luminous accents, precise machined linework, no pigment texture.',
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    emoji: '◻️',
    coverSuffix: 'in a clean minimalist style — flat bold shapes, limited colour palette of 2-3 colours, strong negative space, geometric precision, no fine detail',
    objectStyle: 'minimalist flat design — bold simplified silhouette, 2-3 colour palette, geometric clean shapes, strong negative space, no fine ornament',
    roomRender: 'Spare graphic interior: flat planes, a restrained palette, strong negative space, precise geometry, minimal ornament.',
    textureRender: 'Flat minimalist print artwork: bold simplified shapes, a two- or three-colour palette, generous negative space, crisp even edges, no pigment texture.',
  },
  {
    id: 'vintage',
    label: 'Vintage',
    emoji: '🕰️',
    coverSuffix: 'in a vintage illustration style — aged paper texture, muted sepia and ochre tones, classic engraving hatching detail, antique lithograph feel',
    objectStyle: 'vintage engraving illustration style — aged paper tone, sepia and ochre palette, classic cross-hatching linework, antique woodcut feel',
    roomRender: 'Antique lithograph interior: aged tonal printing, fine cross-hatched shading, muted ink colour, engraved plate character.',
    textureRender: 'Antique lithograph print artwork: aged plate tone, fine cross-hatched shading, muted ink colour, letterpress bite.',
  },
  {
    id: 'watercolour',
    label: 'Watercolour',
    emoji: '🎨',
    coverSuffix: 'in a loose expressive watercolour style — translucent overlapping washes, soft bleeding edges, visible brushstrokes, delicate wet-on-wet blending',
    objectStyle: 'loose watercolour illustration — translucent colour washes, soft bleeding edges, visible brushstroke texture, delicate wet-on-wet blending',
    roomRender: 'Watercolour interior painting: translucent washes, soft bleeding edges, visible brushwork, luminous paper showing through.',
    textureRender: 'Delicate hand-painted watercolour: subtle pigment blooms, soft edges, gentle paper grain, fine painted linework.',
  },
]

/*
 * The style lines the prompts used before style was a variable.
 *
 * Kept as their own constants rather than aliased onto `ghibli` or
 * `watercolour`: a recipe saved before this existed should reproduce its old
 * look exactly, and the styles above should read honestly as themselves. Note
 * the watercolour entry drops "antique-gold" — a colour belongs to the theme's
 * frame, not to the medium.
 */
export const LEGACY_ROOM_RENDER =
  'Richly detailed storybook environment illustration with tactile materials, elegant lighting, and polished cinematic depth.'

export const LEGACY_TEXTURE_RENDER =
  'Delicate hand-painted watercolor, subtle pigment blooms, soft edges, gentle paper grain, fine antique-gold linework.'

/**
 * Look up a style, tolerating anything.
 *
 * `artStyle` is persisted in a JSONB recipe and is hand-editable, so absent,
 * empty and unrecognised all have to mean the same safe thing rather than
 * throwing inside a prompt compiler that a route handler is awaiting.
 */
export function resolveArtStyle(id: string | undefined | null): ArtStyle | null {
  if (!id) return null
  return ART_STYLES.find(s => s.id === id) ?? null
}

export function roomRenderFor(id: string | undefined | null): string {
  return resolveArtStyle(id)?.roomRender ?? LEGACY_ROOM_RENDER
}

export function textureRenderFor(id: string | undefined | null): string {
  return resolveArtStyle(id)?.textureRender ?? LEGACY_TEXTURE_RENDER
}
