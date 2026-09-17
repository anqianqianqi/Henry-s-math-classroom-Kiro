export const HENRY_MANGA_PREFERENCE_KEY = 'henry-classroom-default-v1'

export const HENRY_MANGA_VISUAL_PREFERENCE = {
  key: HENRY_MANGA_PREFERENCE_KEY,
  name: 'Henry warm classroom manga',
  referenceImageUrl: '/manga/preferences/henry-preferred-comic-reference.png',
  format: {
    layout: 'adaptive 2-column manga pages',
    preferredPanelsPerPage: 6,
    panelsPerPageRange: '4–8',
    totalPanelRange: '6–18',
    aspectRatio: '3:2',
    readingOrder: 'left-to-right, top-to-bottom',
    continuation: 'Add pages freely when more context, dialogue or intermediate reasoning makes the story easier to understand.',
    gutters: 'wide warm-white gutters with thin, slightly hand-drawn black panel borders',
    numbering: 'small yellow circular panel number in the upper-left corner',
  },
  storytelling: {
    density: 'visually low, narratively complete',
    rule: 'one story beat, one main action and one math idea per panel',
    priority: 'story first; keep the scene cute and immediately readable',
    storyEnergy: 'Prefer vivid character-driven metaphors that let the mathematical objects act, react or play a story role when the mapping is natural—for example fixed units of water becoming water-baby passengers. Let the math transformation create the comedy and discovery. The metaphor must preserve every quantity, operation, direction, constraint and stopping condition; never add decorative copies of countable objects or let cuteness obscure the original problem.',
    explanation: 'Use a simple board, card, token or transformation only when it clarifies the current math idea. Never hide an unfamiliar reasoning step behind repeat or one more try: show the starting state, operation, why it works, and resulting state. Expand into a strip or additional panels instead of shrinking essential text.',
    dialogue: 'Write natural spoken exchanges driven by what the characters are doing, noticing or asking, not advertising copy, worksheet text or a teacher monologue. Introduce rules through action and short responses across panels; do not dump every rule into one bubble. Keep mathematical constraints exact. Never remove an explanation merely to make the comic shorter.',
    dialogueLayout: 'Compose editable dialogue as part of the scene: fit organic rounded bubbles to the copy, use comfortable padding and short speaker-directed tails, preserve left-to-right reading order, and avoid covering faces, hands or mathematical props. Prioritize readability at whole-page viewing size without zoom: use large bold near-black dialogue and quantity labels, reflow or shorten lines rather than shrinking the font, and check the assembled page at its intended display size. Avoid oversized UI-like text boxes and pasted-on captions. Translate idiomatically and reflow each language.',
    mathText: 'show only the essential equation for the current beat; typeset exact math separately when possible',
    propContinuity: 'When mathematical props have different capacities, lengths or sizes, give them persistently different outer silhouettes across every panel. Keep source and target direction explicit; internal fill level must never change the prop’s physical dimensions.',
    answerReveal: 'last_panel',
    outputLanguages: ['zh', 'en'],
    translationPolicy: 'After storyboard approval, render separate Chinese and English editions from the same locked panels. Translate copy only; preserve character poses, camera, visual math, pacing and answer exactly.',
    narrativeContract: 'Before the mathematical action begins, make the character objective explicit: the task, target scope, where the result is observed, the visible success criterion, why every required result must be found, and a natural story reason for the operation constraints. The story must still be understandable if the original worksheet prompt is hidden.',
  },
  artDirection: {
    summary: 'warm, cute Japanese children’s manga with clean expressive black contours, simple flat pastel color and light soft shading; avoid elaborate watercolor textures',
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
  outputLanguages: [...HENRY_MANGA_VISUAL_PREFERENCE.storytelling.outputLanguages],
  translationPolicy: HENRY_MANGA_VISUAL_PREFERENCE.storytelling.translationPolicy,
  generationMode: null,
  imagePolicy: 'Generate exactly one text-free illustration per panel. Never generate a complete comic page. Bulk mode schedules multiple independent panel calls.',
  artDirection: [
    HENRY_MANGA_VISUAL_PREFERENCE.artDirection.summary,
    HENRY_MANGA_VISUAL_PREFERENCE.artDirection.linework,
    HENRY_MANGA_VISUAL_PREFERENCE.artDirection.palette,
    HENRY_MANGA_VISUAL_PREFERENCE.artDirection.lighting,
    HENRY_MANGA_VISUAL_PREFERENCE.artDirection.backgrounds,
    HENRY_MANGA_VISUAL_PREFERENCE.storytelling.rule,
    HENRY_MANGA_VISUAL_PREFERENCE.storytelling.dialogue,
    HENRY_MANGA_VISUAL_PREFERENCE.storytelling.propContinuity,
    'Use approved Hanbao and Leo character references; the preference image controls format and mood only.',
  ].join('. '),
}

export function mangaPreferencePrompt() {
  const preference = HENRY_MANGA_VISUAL_PREFERENCE
  return [
    `Format: ${preference.format.layout}, usually ${preference.format.preferredPanelsPerPage} panels per page (range ${preference.format.panelsPerPageRange}), ${preference.format.readingOrder}.`,
    `Length: choose ${preference.format.totalPanelRange} total panels according to the teaching needs. ${preference.format.continuation}`,
    `Panel treatment: ${preference.format.gutters}; ${preference.format.numbering}.`,
    `Story density: ${preference.storytelling.rule}; ${preference.storytelling.priority}.`,
    `Story energy: ${preference.storytelling.storyEnergy}`,
    `Narrative contract: ${preference.storytelling.narrativeContract}`,
    `Dialogue: ${preference.storytelling.dialogue}.`,
    `Dialogue layout: ${preference.storytelling.dialogueLayout}`,
    `Math: ${preference.storytelling.mathText}.`,
    `Explanation continuity: ${preference.storytelling.explanation}`,
    `Math prop continuity: ${preference.storytelling.propContinuity}`,
    `Languages: ${preference.storytelling.translationPolicy}`,
    `Art direction: ${preference.artDirection.summary}; ${preference.artDirection.linework}; ${preference.artDirection.palette}; ${preference.artDirection.lighting}.`,
    `Backgrounds: ${preference.artDirection.backgrounds}.`,
    `Character policy: ${preference.characterPolicy.source}`,
    `Avoid: ${preference.artDirection.avoid.join('; ')}.`,
  ].join('\n')
}
