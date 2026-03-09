/**
 * Class Occurrence Generation Utilities
 * 
 * Automatically generates individual class sessions (occurrences) from a class schedule.
 * 
 * Example:
 * Schedule: Monday 3-4pm, Wednesday 3-4pm
 * Date range: Jan 1 - May 30 (20 weeks)
 * Result: 40 occurrences (2 per week × 20 weeks)
 */

export interface ScheduleSlot {
  day: string // "Monday", "Tuesday", etc.
  startTime: string // "15:00" (24-hour format)
  endTime: string // "16:00"
}

export interface ClassOccurrence {
  class_id: string
  occurrence_date: string // ISO date: "2026-03-10"
  start_time: string // "15:00:00"
  end_time: string // "16:00:00"
  session_number: number
  status: 'upcoming' | 'completed' | 'cancelled'
}

/**
 * Map day names to JavaScript day numbers
 * JavaScript: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
const DAY_MAP: Record<string, number> = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6
}

/**
 * Generate class occurrences from schedule and date range
 * 
 * @param classId - UUID of the class
 * @param schedule - Array of schedule slots (day, startTime, endTime)
 * @param startDate - First day of class (Date object or ISO string)
 * @param endDate - Last day of class (Date object or ISO string)
 * @returns Array of occurrence objects ready to insert into database
 * 
 * @example
 * const occurrences = generateOccurrences(
 *   'class-123',
 *   [
 *     { day: 'Monday', startTime: '15:00', endTime: '16:00' },
 *     { day: 'Wednesday', startTime: '15:00', endTime: '16:00' }
 *   ],
 *   new Date('2026-01-05'),
 *   new Date('2026-05-30')
 * )
 * // Returns ~40 occurrences
 */
export function generateOccurrences(
  classId: string,
  schedule: ScheduleSlot[],
  startDate: Date | string,
  endDate: Date | string
): ClassOccurrence[] {
  // Validate inputs
  if (!classId) {
    throw new Error('classId is required')
  }
  
  if (!schedule || schedule.length === 0) {
    throw new Error('Schedule must have at least one time slot')
  }

  // Convert to Date objects if strings
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate

  // Validate date range
  if (isNaN(start.getTime())) {
    throw new Error('Invalid start date')
  }
  
  if (isNaN(end.getTime())) {
    throw new Error('Invalid end date')
  }

  if (end < start) {
    throw new Error('End date must be after start date')
  }

  // Validate schedule slots
  for (const slot of schedule) {
    if (!slot.day || !DAY_MAP.hasOwnProperty(slot.day)) {
      throw new Error(`Invalid day: ${slot.day}. Must be one of: ${Object.keys(DAY_MAP).join(', ')}`)
    }
    if (!slot.startTime || !slot.endTime) {
      throw new Error('Each schedule slot must have startTime and endTime')
    }
  }

  const occurrences: ClassOccurrence[] = []

  // For each schedule slot, find all matching dates
  for (const slot of schedule) {
    const targetDay = DAY_MAP[slot.day]
    
    // Start from the first date
    let currentDate = new Date(start)
    
    // Advance to first occurrence of target day
    while (currentDate.getDay() !== targetDay && currentDate <= end) {
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    // Generate occurrences for this day of week
    while (currentDate <= end) {
      occurrences.push({
        class_id: classId,
        occurrence_date: formatDate(currentDate),
        start_time: formatTime(slot.startTime),
        end_time: formatTime(slot.endTime),
        session_number: 0, // Will be set after sorting
        status: 'upcoming'
      })
      
      // Move to next week (same day)
      currentDate.setDate(currentDate.getDate() + 7)
    }
  }

  // Sort by date and time
  occurrences.sort((a, b) => {
    const dateCompare = a.occurrence_date.localeCompare(b.occurrence_date)
    if (dateCompare !== 0) return dateCompare
    return a.start_time.localeCompare(b.start_time)
  })

  // Assign sequential session numbers
  occurrences.forEach((occurrence, index) => {
    occurrence.session_number = index + 1
  })

  return occurrences
}

/**
 * Format Date object to ISO date string (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format time string to HH:MM:SS format
 * Accepts: "15:00", "3:00 PM", "15:00:00"
 * Returns: "15:00:00"
 */
function formatTime(time: string): string {
  // If already in HH:MM:SS format, return as-is
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    return time
  }
  
  // If in HH:MM format, add seconds
  if (/^\d{1,2}:\d{2}$/.test(time)) {
    const [hours, minutes] = time.split(':')
    return `${hours.padStart(2, '0')}:${minutes}:00`
  }
  
  // If in 12-hour format (e.g., "3:00 PM"), convert to 24-hour
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (match) {
    let hours = parseInt(match[1])
    const minutes = match[2]
    const period = match[3]?.toUpperCase()
    
    if (period === 'PM' && hours !== 12) {
      hours += 12
    } else if (period === 'AM' && hours === 12) {
      hours = 0
    }
    
    return `${String(hours).padStart(2, '0')}:${minutes}:00`
  }
  
  throw new Error(`Invalid time format: ${time}. Expected HH:MM or HH:MM:SS`)
}

/**
 * Update occurrence status based on current date
 * Occurrences in the past should be marked as 'completed'
 * 
 * @param occurrences - Array of occurrences to update
 * @returns Updated occurrences with correct status
 */
export function updateOccurrenceStatuses(
  occurrences: ClassOccurrence[]
): ClassOccurrence[] {
  const today = formatDate(new Date())
  
  return occurrences.map(occurrence => {
    if (occurrence.status === 'cancelled') {
      return occurrence // Don't change cancelled status
    }
    
    if (occurrence.occurrence_date < today) {
      return { ...occurrence, status: 'completed' }
    }
    
    return { ...occurrence, status: 'upcoming' }
  })
}

/**
 * Get upcoming occurrences (future dates only)
 * 
 * @param occurrences - Array of all occurrences
 * @param limit - Maximum number to return (default: 5)
 * @returns Array of upcoming occurrences
 */
export function getUpcomingOccurrences(
  occurrences: ClassOccurrence[],
  limit: number = 5
): ClassOccurrence[] {
  const today = formatDate(new Date())
  
  return occurrences
    .filter(occ => occ.occurrence_date >= today && occ.status !== 'cancelled')
    .slice(0, limit)
}

/**
 * Get past occurrences (past dates only)
 * 
 * @param occurrences - Array of all occurrences
 * @returns Array of past occurrences (most recent first)
 */
export function getPastOccurrences(
  occurrences: ClassOccurrence[]
): ClassOccurrence[] {
  const today = formatDate(new Date())
  
  return occurrences
    .filter(occ => occ.occurrence_date < today)
    .reverse() // Most recent first
}

/**
 * Calculate total number of occurrences for a schedule and date range
 * Useful for displaying "24 sessions" before generating
 * 
 * @param schedule - Array of schedule slots
 * @param startDate - First day of class
 * @param endDate - Last day of class
 * @returns Total number of occurrences
 */
export function calculateOccurrenceCount(
  schedule: ScheduleSlot[],
  startDate: Date | string,
  endDate: Date | string
): number {
  try {
    const occurrences = generateOccurrences('temp', schedule, startDate, endDate)
    return occurrences.length
  } catch (error) {
    return 0
  }
}

/**
 * Format occurrence for display
 * 
 * @param occurrence - Occurrence object
 * @returns Formatted string like "Monday, March 10 • 3:00 PM - 4:00 PM"
 */
export function formatOccurrenceDisplay(occurrence: ClassOccurrence): string {
  const date = new Date(occurrence.occurrence_date)
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  
  // Convert 24-hour time to 12-hour format
  const startTime = formatTime12Hour(occurrence.start_time)
  const endTime = formatTime12Hour(occurrence.end_time)
  
  return `${dayName}, ${dateStr} • ${startTime} - ${endTime}`
}

/**
 * Convert 24-hour time to 12-hour format
 * "15:00:00" → "3:00 PM"
 */
function formatTime12Hour(time: string): string {
  const [hoursStr, minutesStr] = time.split(':')
  let hours = parseInt(hoursStr)
  const minutes = minutesStr
  
  const period = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12 // Convert 0 to 12, keep 1-11
  
  return `${hours}:${minutes} ${period}`
}
