/**
 * Wrapping math placeholders so a translation engine treats them as opaque.
 *
 * Pure and dependency-free so it can be tested without an API key — the round
 * trip is the part that must not break, and it is exactly the part that is easy
 * to get subtly wrong.
 *
 * Masking already replaces expressions with ⟦M0⟧ before anything is sent. The
 * wrapper is a second line of defence for engines that support ignore-tags:
 * DeepL is told `tag_handling=xml, ignore_tags=x`, so <x>⟦M0⟧</x> is passed
 * through as one unit and cannot be reflowed into surrounding words or have its
 * digits localised.
 */

/** Wrap every ⟦Mn⟧ placeholder in an ignore tag. */
export function wrapForIgnore(text: string, tag = 'x'): string {
  return text.replace(/⟦M(\d+)⟧/g, `<${tag}>⟦M$1⟧</${tag}>`)
}

/**
 * Remove the ignore tags again.
 *
 * Tolerant on purpose: engines sometimes return a self-closing form, change the
 * spacing, or drop one half of a pair. Anything that still leaves the ⟦Mn⟧
 * intact is recoverable, and unmaskMath does the real restoration afterwards.
 */
export function stripIgnoreTags(text: string, tag = 'x'): string {
  return text.replace(new RegExp(`</?\\s*${tag}\\s*/?>`, 'g'), '')
}
