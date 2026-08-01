import { describe, expect, it } from 'vitest'
import { canAnswerBubble } from '../utils/bubbleAnswerPermission'

/**
 * The rule is three clauses long, but each one is a person who either can or
 * cannot help a classmate — worth pinning individually, because loosening any
 * of them by accident reopens the room to unreviewed answers.
 */

describe('canAnswerBubble', () => {
  it('refuses a student without the badge', () => {
    // The whole point of the change.
    expect(canAnswerBubble({ isOwner: false, role: 'student', isTA: false })).toBe(false)
  })

  it('allows a TA', () => {
    expect(canAnswerBubble({ isOwner: false, role: 'student', isTA: true })).toBe(true)
  })

  it('allows a teacher', () => {
    expect(canAnswerBubble({ isOwner: false, role: 'teacher', isTA: false })).toBe(true)
  })

  it('allows the asker in their own thread', () => {
    // A TA asking "what have you tried?" needs the asker to be able to answer;
    // without this the thread dies at the first clarifying question.
    expect(canAnswerBubble({ isOwner: true, role: 'student', isTA: false })).toBe(true)
  })

  it('does not let owning one question unlock the rest of the room', () => {
    // isOwner is per-question, so the same student is allowed here and refused
    // one bubble over. This is the pair that catches it being read as a
    // standing permission.
    const asker = { role: 'student' as const, isTA: false }
    expect(canAnswerBubble({ ...asker, isOwner: true })).toBe(true)
    expect(canAnswerBubble({ ...asker, isOwner: false })).toBe(false)
  })

  it('allows a teacher who is also a badge holder', () => {
    expect(canAnswerBubble({ isOwner: false, role: 'teacher', isTA: true })).toBe(true)
  })
})
