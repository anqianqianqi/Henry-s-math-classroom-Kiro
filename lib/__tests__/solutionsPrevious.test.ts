import { describe, it, expect } from 'vitest'
import { matchPrevious } from '@/lib/solutions/previous'

const adhoc = { id: 'c1', source_bank_id: null }
const fromBank = { id: 'c2', source_bank_id: 'b2' }

describe('matchPrevious', () => {
  it('matches an ad-hoc problem on the challenge id', () => {
    const rows = [{ id: 's1', challenge_id: 'c1', bank_item_id: null }]
    expect(matchPrevious([adhoc], rows).get('c1')?.id).toBe('s1')
  })

  /*
    The bug this exists for. A bank-sourced problem that has been republished
    has a submission whose challenge_id is NULL — it hangs on bank_item_id
    alone — so looking under the challenge id found nothing, and the review
    claimed the problem had never been answered.
  */
  it('matches a bank problem whose challenge_id is null', () => {
    const rows = [{ id: 's2', challenge_id: null, bank_item_id: 'b2' }]
    expect(matchPrevious([fromBank], rows).get('c2')?.id).toBe('s2')
  })

  it('matches a bank problem still pointing at its instance', () => {
    const rows = [{ id: 's3', challenge_id: 'c2', bank_item_id: 'b2' }]
    expect(matchPrevious([fromBank], rows).get('c2')?.id).toBe('s3')
  })

  // A row written before the bank migration has no bank_item_id yet.
  it('falls back to the challenge id for a bank problem with an old row', () => {
    const rows = [{ id: 's4', challenge_id: 'c2', bank_item_id: null }]
    expect(matchPrevious([fromBank], rows).get('c2')?.id).toBe('s4')
  })

  it('prefers the bank row when both exist', () => {
    const rows = [
      { id: 'old', challenge_id: 'c2', bank_item_id: null },
      { id: 'bank', challenge_id: null, bank_item_id: 'b2' },
    ]
    expect(matchPrevious([fromBank], rows).get('c2')?.id).toBe('bank')
  })

  it('finds nothing when nothing was submitted', () => {
    expect(matchPrevious([adhoc, fromBank], []).size).toBe(0)
  })

  // Two problems from the same bank item must not collect each other's rows
  // through a null key.
  it('does not match on null keys', () => {
    const rows = [{ id: 's5', challenge_id: null, bank_item_id: null }]
    expect(matchPrevious([adhoc, fromBank], rows).size).toBe(0)
  })

  it('keeps each problem to its own submission', () => {
    const problems = [adhoc, fromBank, { id: 'c3', source_bank_id: 'b3' }]
    const rows = [
      { id: 's1', challenge_id: 'c1', bank_item_id: null },
      { id: 's2', challenge_id: null, bank_item_id: 'b2' },
    ]
    const found = matchPrevious(problems, rows)
    expect(found.get('c1')?.id).toBe('s1')
    expect(found.get('c2')?.id).toBe('s2')
    expect(found.has('c3')).toBe(false)
  })
})
