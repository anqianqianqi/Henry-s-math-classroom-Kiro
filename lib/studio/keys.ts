/**
 * The desk's keyboard: which key means what, given where the cursor is.
 *
 * Pure, so the mapping is one table with tests rather than a knot of
 * conditions inside an event handler. The rule that matters most: a key is a
 * shortcut only while no box has focus. Inside the comment box every letter is
 * a letter, and only Esc (leave) and Ctrl+Enter (save) mean anything.
 */

export type FieldKind = 'none' | 'score' | 'comment' | 'other'

export type DeskAction =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'save' }
  | { type: 'accept' }
  | { type: 'focusComment' }
  | { type: 'flag' }
  | { type: 'skip' }
  | { type: 'runTa' }
  | { type: 'blur' }
  | { type: 'digit'; digit: number }
  | { type: 'backspace' }

export interface KeyContext {
  key: string
  ctrl: boolean
  meta: boolean
  alt: boolean
  field: FieldKind
}

export const SCORE_FIELD_ID = 'studio-score'
export const COMMENT_FIELD_ID = 'studio-comment'

/** Where a key event landed, from the element's id and tag. */
export function fieldFrom(id: string | null | undefined, tagName: string | null | undefined, editable = false): FieldKind {
  if (id === SCORE_FIELD_ID) return 'score'
  if (id === COMMENT_FIELD_ID) return 'comment'
  const tag = (tagName || '').toUpperCase()
  if (editable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return 'other'
  return 'none'
}

export function interpretKey(k: KeyContext): DeskAction | null {
  if (k.alt || k.meta) return null
  if (k.key === 'Escape') return k.field === 'none' ? null : { type: 'blur' }

  if (k.field === 'comment') {
    return k.key === 'Enter' && k.ctrl ? { type: 'save' } : null
  }
  if (k.field === 'score') {
    return k.key === 'Enter' ? { type: 'save' } : null
  }
  if (k.field === 'other') return null
  if (k.ctrl) return k.key === 'Enter' ? { type: 'save' } : null

  if (/^[0-9]$/.test(k.key)) return { type: 'digit', digit: Number(k.key) }
  switch (k.key) {
    case 'j':
    case 'ArrowDown':
      return { type: 'next' }
    case 'k':
    case 'ArrowUp':
      return { type: 'prev' }
    case 'Enter':
      return { type: 'save' }
    case 'a':
      return { type: 'accept' }
    case 'c':
      return { type: 'focusComment' }
    case 'f':
      return { type: 'flag' }
    case 's':
      return { type: 'skip' }
    case 't':
      return { type: 'runTa' }
    case 'Backspace':
      return { type: 'backspace' }
    default:
      return null
  }
}
