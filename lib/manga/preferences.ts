export const HENRY_MANGA_PREFERENCE_KEY = 'henry-classroom-default-v1'

export const HENRY_MANGA_VISUAL_PREFERENCE = {
  key: HENRY_MANGA_PREFERENCE_KEY,
  name: 'Henry warm classroom manga',
  referenceImageUrl: '/manga/preferences/henry-preferred-comic-reference.png',
  format: {
    layout: '2x3',
    panelsPerPage: 6,
    aspectRatio: '3:2',
    readingOrder: 'left-to-right, top-to-bottom',
    continuation: 'Use another 2x3 page only when six panels cannot explain the story clearly.',
    gutters: 'wide warm-white gutters with thin, slightly hand-drawn black panel borders',
    numbering: 'small yellow circular panel number in the upper-left corner',
  },
  storytelling: {
    density: 'low',
    rule: 'one story beat, one main action and one math idea per panel',
    priority: 'story first; keep the scene cute and immediately readable',
    explanation: 'Use a simple board, card, token or transformation only when it clarifies the current math idea.',
    dialogue: 'short speech bubbles; prefer expressions and visual action over explanation-heavy dialogue',
    mathText: 'show only the essential equation for the current beat; typeset exact math separately when possible',
    answerReveal: 'last_panel',
  },
  artDirection: {
    summary: 'warm, cute, clean hand-drawn classroom comic with soft watercolor and gouache color',
    linework: 'clear expressive ink outlines, slightly organic rather than mechanically perfect',
    palette: 'cream paper, sunny yellow, sky blue and gentle pastel panel backgrounds',
    lighting: 'soft natural classroom light with a warm, optimistic mood',
    shapes: 'rounded child-friendly silhouettes and highly readable facial expressions',
    backgrounds: 'minimal classroom details; use soft flat color or a light wash when props are unnecessary',
    effects: 'small stars, motion lines and friendly sound effects used sparingly',
    avoid: [
      'dense infographic panels',
      'crowded classroom props',
      'long paragraphs inside panels',
      'photorealism',
      'dark cinematic lighting',
      'copying characters or compositions from the preference reference',
    ],
  },
  characterPolicy: {
    source: 'Always use the approved character-library versions and their reference sheets.',
    hanbao: '/manga/characters/hanbao-v3-idle-f-character-sheet.png',
    leo: '/manga/characters/leo-v1-character-sheet.png',
  },
} as const

export const DEFAULT_MANGA_RENDER_SPEC = {
  layout: HENRY_MANGA_VISUAL_PREFERENCE.format.layout,
  aspectRatio: HENRY_MANGA_VISUAL_PREFERENCE.format.aspectRatio,
  answerReveal: HENRY_MANGA_VISUAL_PREFERENCE.storytelling.answerReveal,
  artDirection: [
    HENRY_MANGA_VISUAL_PREFERENCE.artDirection.summary,
    HENRY_MANGA_VISUAL_PREFERENCE.artDirection.linework,
    HENRY_MANGA_VISUAL_PREFERENCE.artDirection.palette,
    HENRY_MANGA_VISUAL_PREFERENCE.artDirection.lighting,
    HENRY_MANGA_VISUAL_PREFERENCE.artDirection.backgrounds,
    HENRY_MANGA_VISUAL_PREFERENCE.storytelling.rule,
    HENRY_MANGA_VISUAL_PREFERENCE.storytelling.dialogue,
    'Use approved Hanbao and Leo character references; the preference image controls format and mood only.',
  ].join('. '),
}

export function mangaPreferencePrompt() {
  const preference = HENRY_MANGA_VISUAL_PREFERENCE
  return [
    `Format: ${preference.format.layout}, ${preference.format.panelsPerPage} panels per page, ${preference.format.readingOrder}.`,
    `Panel treatment: ${preference.format.gutters}; ${preference.format.numbering}.`,
    `Story density: ${preference.storytelling.rule}; ${preference.storytelling.priority}.`,
    `Dialogue: ${preference.storytelling.dialogue}.`,
    `Math: ${preference.storytelling.mathText}.`,
    `Art direction: ${preference.artDirection.summary}; ${preference.artDirection.linework}; ${preference.artDirection.palette}; ${preference.artDirection.lighting}.`,
    `Backgrounds: ${preference.artDirection.backgrounds}.`,
    `Character policy: ${preference.characterPolicy.source}`,
    `Avoid: ${preference.artDirection.avoid.join('; ')}.`,
  ].join('\n')
}
