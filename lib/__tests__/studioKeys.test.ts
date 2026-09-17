import { describe, it, expect } from 'vitest'
import { COMMENT_FIELD_ID, SCORE_FIELD_ID, fieldFrom, interpretKey, type FieldKind } from '@/lib/studio/keys'

/**
 * The desk's keyboard, as a table. The rule that matters: letters are
 * shortcuts only while no box has focus, so typing a comment can never grade
 * the wrong student.
 */

function key(k: string, field: FieldKind = 'none', mods: Partial<{ ctrl: boolean; meta: boolean; alt: boolean }> = {}) {
  return interpretKey({ key: k, ctrl: false, meta: false, alt: false, field, ...mods })
}

describe('fieldFrom', () => {
  it('tells the score box, the comment box, any other box, and the page apart', () => {
    expect(fieldFrom(SCORE_FIELD_ID, 'INPUT')).toBe('score')
    expect(fieldFrom(COMMENT_FIELD_ID, 'TEXTAREA')).toBe('comment')
    expect(fieldFrom('search', 'input')).toBe('other')
    expect(fieldFrom('', 'SELECT')).toBe('other')
    expect(fieldFrom('', 'DIV', true)).toBe('other')
    expect(fieldFrom('', 'BUTTON')).toBe('none')
    expect(fieldFrom(undefined, undefined)).toBe('none')
  })
})

describe('interpretKey with nothing focused', () => {
  it('moves, saves, and reaches every action from one key', () => {
    expect(key('j')).toEqual({ type: 'next' })
    expect(key('ArrowDown')).toEqual({ type: 'next' })
    expect(key('k')).toEqual({ type: 'prev' })
    expect(key('ArrowUp')).toEqual({ type: 'prev' })
    expect(key('Enter')).toEqual({ type: 'save' })
    expect(key('a')).toEqual({ type: 'accept' })
    expect(key('c')).toEqual({ type: 'focusComment' })
    expect(key('f')).toEqual({ type: 'flag' })
    expect(key('s')).toEqual({ type: 'skip' })
    expect(key('t')).toEqual({ type: 'runTa' })
    expect(key('Backspace')).toEqual({ type: 'backspace' })
  })

  it('turns digits into score entry', () => {
    expect(key('0')).toEqual({ type: 'digit', digit: 0 })
    expect(key('9')).toEqual({ type: 'digit', digit: 9 })
  })

  it('ignores letters it has no meaning for, and Escape with nothing to leave', () => {
    expect(key('x')).toBeNull()
    expect(key('Escape')).toBeNull()
    expect(key('Tab')).toBeNull()
  })

  it('leaves browser shortcuts alone', () => {
    expect(key('j', 'none', { meta: true })).toBeNull()
    expect(key('a', 'none', { alt: true })).toBeNull()
    expect(key('s', 'none', { ctrl: true })).toBeNull()
    expect(key('Enter', 'none', { ctrl: true })).toEqual({ type: 'save' })
  })
})

describe('interpretKey inside a box', () => {
  it('lets every letter be a letter in the comment, except Esc and Ctrl+Enter', () => {
    for (const k of ['j', 'a', 's', '7', 'Enter', 'Backspace']) expect(key(k, 'comment')).toBeNull()
    expect(key('Escape', 'comment')).toEqual({ type: 'blur' })
    expect(key('Enter', 'comment', { ctrl: true })).toEqual({ type: 'save' })
  })

  it('saves on Enter from the score box and otherwise stays out of the way', () => {
    expect(key('Enter', 'score')).toEqual({ type: 'save' })
    expect(key('7', 'score')).toBeNull()
    expect(key('j', 'score')).toBeNull()
    expect(key('Escape', 'score')).toEqual({ type: 'blur' })
  })

  it('does nothing in the search or date boxes except leave them', () => {
    expect(key('Enter', 'other')).toBeNull()
    expect(key('j', 'other')).toBeNull()
    expect(key('Escape', 'other')).toEqual({ type: 'blur' })
  })
})
