/**
 * Tests for Occurrence Generation Utilities
 */

import {
  generateOccurrences,
  updateOccurrenceStatuses,
  getUpcomingOccurrences,
  getPastOccurrences,
  calculateOccurrenceCount,
  formatOccurrenceDisplay,
  type ScheduleSlot,
  type ClassOccurrence
} from '../occurrences'

describe('generateOccurrences', () => {
  const classId = 'test-class-123'

  test('generates correct number of occurrences for single day per week', () => {
    const schedule: ScheduleSlot[] = [
      { day: 'Monday', startTime: '15:00', endTime: '16:00' }
    ]
    const startDate = new Date('2026-01-05') // Monday
    const endDate = new Date('2026-02-23') // 8 weeks later
    
    const occurrences = generateOccurrences(classId, schedule, startDate, endDate)
    
    expect(occurrences).toHaveLength(8)
    expect(occurrences[0].occurrence_date).toBe('2026-01-05')
    expect(occurrences[7].occurrence_date).toBe('2026-02-23')
  })

  test('generates occurrences for multiple days per week', () => {
    const schedule: ScheduleSlot[] = [
      { day: 'Monday', startTime: '15:00', endTime: '16:00' },
      { day: 'Wednesday', startTime: '15:00', endTime: '16:00' }
    ]
    const startDate = new Date('2026-01-05') // Monday
    const endDate = new Date('2026-01-28') // 4 weeks later
    
    const occurrences = generateOccurrences(classId, schedule, startDate, endDate)
    
    expect(occurrences).toHaveLength(8) // 2 per week × 4 weeks
  })

  test('assigns sequential session numbers', () => {
    const schedule: ScheduleSlot[] = [
      { day: 'Monday', startTime: '15:00', endTime: '16:00' },
      { day: 'Wednesday', startTime: '15:00', endTime: '16:00' }
    ]
    const startDate = new Date('2026-01-05')
    const endDate = new Date('2026-01-28')
    
    const occurrences = generateOccurrences(classId, schedule, startDate, endDate)
    
    occurrences.forEach((occ, index) => {
      expect(occ.session_number).toBe(index + 1)
    })
  })

  test('sorts occurrences by date and time', () => {
    const schedule: ScheduleSlot[] = [
      { day: 'Wednesday', startTime: '15:00', endTime: '16:00' },
      { day: 'Monday', startTime: '10:00', endTime: '11:00' }
    ]
    const startDate = new Date('2026-01-05') // Monday
    const endDate = new Date('2026-01-14')
    
    const occurrences = generateOccurrences(classId, schedule, startDate, endDate)
    
    // First occurrence should be Monday Jan 5 at 10:00
    expect(occurrences[0].occurrence_date).toBe('2026-01-05')
    expect(occurrences[0].start_time).toBe('10:00:00')
    
    // Second should be Wednesday Jan 7 at 15:00
    expect(occurrences[1].occurrence_date).toBe('2026-01-07')
    expect(occurrences[1].start_time).toBe('15:00:00')
  })

  test('handles start date not matching schedule day', () => {
    const schedule: ScheduleSlot[] = [
      { day: 'Wednesday', startTime: '15:00', endTime: '16:00' }
    ]
    const startDate = new Date('2026-01-05') // Monday
    const endDate = new Date('2026-01-28')
    
    const occurrences = generateOccurrences(classId, schedule, startDate, endDate)
    
    // First occurrence should be Wednesday Jan 7 (first Wednesday after start)
    expect(occurrences[0].occurrence_date).toBe('2026-01-07')
  })

  test('formats times correctly', () => {
    const schedule: ScheduleSlot[] = [
      { day: 'Monday', startTime: '09:00', endTime: '10:30' }
    ]
    const startDate = new Date('2026-01-05')
    const endDate = new Date('2026-01-05')
    
    const occurrences = generateOccurrences(classId, schedule, startDate, endDate)
    
    expect(occurrences[0].start_time).toBe('09:00:00')
    expect(occurrences[0].end_time).toBe('10:30:00')
  })

  test('sets all occurrences to upcoming status', () => {
    const schedule: ScheduleSlot[] = [
      { day: 'Monday', startTime: '15:00', endTime: '16:00' }
    ]
    const startDate = new Date('2026-01-05')
    const endDate = new Date('2026-01-12')
    
    const occurrences = generateOccurrences(classId, schedule, startDate, endDate)
    
    occurrences.forEach(occ => {
      expect(occ.status).toBe('upcoming')
    })
  })

  test('includes class_id in all occurrences', () => {
    const schedule: ScheduleSlot[] = [
      { day: 'Monday', startTime: '15:00', endTime: '16:00' }
    ]
    const startDate = new Date('2026-01-05')
    const endDate = new Date('2026-01-12')
    
    const occurrences = generateOccurrences(classId, schedule, startDate, endDate)
    
    occurrences.forEach(occ => {
      expect(occ.class_id).toBe(classId)
    })
  })

  test('throws error for empty schedule', () => {
    expect(() => {
      generateOccurrences(classId, [], new Date(), new Date())
    }).toThrow('Schedule must have at least one time slot')
  })

  test('throws error for invalid day name', () => {
    const schedule: ScheduleSlot[] = [
      { day: 'Funday', startTime: '15:00', endTime: '16:00' }
    ]
    
    expect(() => {
      generateOccurrences(classId, schedule, new Date(), new Date())
    }).toThrow('Invalid day')
  })

  test('throws error for end date before start date', () => {
    const schedule: ScheduleSlot[] = [
      { day: 'Monday', startTime: '15:00', endTime: '16:00' }
    ]
    
    expect(() => {
      generateOccurrences(
        classId,
        schedule,
        new Date('2026-02-01'),
        new Date('2026-01-01')
      )
    }).toThrow('End date must be after start date')
  })

  test('accepts ISO date strings', () => {
    const schedule: ScheduleSlot[] = [
      { day: 'Monday', startTime: '15:00', endTime: '16:00' }
    ]
    
    const occurrences = generateOccurrences(
      classId,
      schedule,
      '2026-01-05',
      '2026-01-12'
    )
    
    expect(occurrences).toHaveLength(2)
  })
})

describe('updateOccurrenceStatuses', () => {
  test('marks past occurrences as completed', () => {
    const occurrences: ClassOccurrence[] = [
      {
        class_id: 'test',
        occurrence_date: '2020-01-01',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 1,
        status: 'upcoming'
      },
      {
        class_id: 'test',
        occurrence_date: '2030-01-01',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 2,
        status: 'upcoming'
      }
    ]
    
    const updated = updateOccurrenceStatuses(occurrences)
    
    expect(updated[0].status).toBe('completed')
    expect(updated[1].status).toBe('upcoming')
  })

  test('preserves cancelled status', () => {
    const occurrences: ClassOccurrence[] = [
      {
        class_id: 'test',
        occurrence_date: '2020-01-01',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 1,
        status: 'cancelled'
      }
    ]
    
    const updated = updateOccurrenceStatuses(occurrences)
    
    expect(updated[0].status).toBe('cancelled')
  })
})

describe('getUpcomingOccurrences', () => {
  test('returns only future occurrences', () => {
    const occurrences: ClassOccurrence[] = [
      {
        class_id: 'test',
        occurrence_date: '2020-01-01',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 1,
        status: 'completed'
      },
      {
        class_id: 'test',
        occurrence_date: '2030-01-01',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 2,
        status: 'upcoming'
      },
      {
        class_id: 'test',
        occurrence_date: '2030-01-08',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 3,
        status: 'upcoming'
      }
    ]
    
    const upcoming = getUpcomingOccurrences(occurrences)
    
    expect(upcoming).toHaveLength(2)
    expect(upcoming[0].occurrence_date).toBe('2030-01-01')
  })

  test('respects limit parameter', () => {
    const occurrences: ClassOccurrence[] = Array.from({ length: 10 }, (_, i) => ({
      class_id: 'test',
      occurrence_date: `2030-01-${String(i + 1).padStart(2, '0')}`,
      start_time: '15:00:00',
      end_time: '16:00:00',
      session_number: i + 1,
      status: 'upcoming' as const
    }))
    
    const upcoming = getUpcomingOccurrences(occurrences, 3)
    
    expect(upcoming).toHaveLength(3)
  })

  test('excludes cancelled occurrences', () => {
    const occurrences: ClassOccurrence[] = [
      {
        class_id: 'test',
        occurrence_date: '2030-01-01',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 1,
        status: 'cancelled'
      },
      {
        class_id: 'test',
        occurrence_date: '2030-01-08',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 2,
        status: 'upcoming'
      }
    ]
    
    const upcoming = getUpcomingOccurrences(occurrences)
    
    expect(upcoming).toHaveLength(1)
    expect(upcoming[0].session_number).toBe(2)
  })
})

describe('getPastOccurrences', () => {
  test('returns only past occurrences', () => {
    const occurrences: ClassOccurrence[] = [
      {
        class_id: 'test',
        occurrence_date: '2020-01-01',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 1,
        status: 'completed'
      },
      {
        class_id: 'test',
        occurrence_date: '2020-01-08',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 2,
        status: 'completed'
      },
      {
        class_id: 'test',
        occurrence_date: '2030-01-01',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 3,
        status: 'upcoming'
      }
    ]
    
    const past = getPastOccurrences(occurrences)
    
    expect(past).toHaveLength(2)
  })

  test('returns most recent first', () => {
    const occurrences: ClassOccurrence[] = [
      {
        class_id: 'test',
        occurrence_date: '2020-01-01',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 1,
        status: 'completed'
      },
      {
        class_id: 'test',
        occurrence_date: '2020-01-08',
        start_time: '15:00:00',
        end_time: '16:00:00',
        session_number: 2,
        status: 'completed'
      }
    ]
    
    const past = getPastOccurrences(occurrences)
    
    expect(past[0].occurrence_date).toBe('2020-01-08') // Most recent first
    expect(past[1].occurrence_date).toBe('2020-01-01')
  })
})

describe('calculateOccurrenceCount', () => {
  test('returns correct count without generating full objects', () => {
    const schedule: ScheduleSlot[] = [
      { day: 'Monday', startTime: '15:00', endTime: '16:00' },
      { day: 'Wednesday', startTime: '15:00', endTime: '16:00' }
    ]
    
    const count = calculateOccurrenceCount(
      schedule,
      new Date('2026-01-05'),
      new Date('2026-01-28')
    )
    
    expect(count).toBe(8) // 2 per week × 4 weeks
  })

  test('returns 0 for invalid inputs', () => {
    const count = calculateOccurrenceCount(
      [],
      new Date('2026-01-05'),
      new Date('2026-01-28')
    )
    
    expect(count).toBe(0)
  })
})

describe('formatOccurrenceDisplay', () => {
  test('formats occurrence for display', () => {
    const occurrence: ClassOccurrence = {
      class_id: 'test',
      occurrence_date: '2026-03-10',
      start_time: '15:00:00',
      end_time: '16:00:00',
      session_number: 1,
      status: 'upcoming'
    }
    
    const formatted = formatOccurrenceDisplay(occurrence)
    
    expect(formatted).toContain('Tuesday')
    expect(formatted).toContain('March 10')
    expect(formatted).toContain('3:00 PM')
    expect(formatted).toContain('4:00 PM')
  })

  test('handles morning times', () => {
    const occurrence: ClassOccurrence = {
      class_id: 'test',
      occurrence_date: '2026-03-10',
      start_time: '09:00:00',
      end_time: '10:30:00',
      session_number: 1,
      status: 'upcoming'
    }
    
    const formatted = formatOccurrenceDisplay(occurrence)
    
    expect(formatted).toContain('9:00 AM')
    expect(formatted).toContain('10:30 AM')
  })
})
