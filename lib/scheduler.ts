import { SupabaseClient } from '@supabase/supabase-js'
import { generateChallenge, GenerativeTemplate } from './challenge-generator'

/**
 * Runs the challenge scheduler for a given class.
 * Called lazily when a student loads their challenges page.
 * 
 * For each active schedule on the class:
 * 1. Check if today needs an assignment (based on frequency + last_assigned_at)
 * 2. Pick a challenge from the tag pool that hasn't been used by this schedule
 * 3. If pool exhausted, loop back (reset log)
 * 4. Create the challenge_assignment and log it
 */
export async function runSchedulerForClass(supabase: SupabaseClient, classId: string) {
  const today = new Date().toISOString().split('T')[0]
  const dayOfWeek = new Date().getDay() // 0=Sun, 6=Sat

  // Get active schedules for this class
  const { data: schedules } = await supabase
    .from('class_challenge_schedules')
    .select('*')
    .eq('class_id', classId)
    .eq('is_active', true)

  if (!schedules || schedules.length === 0) return

  for (const schedule of schedules) {
    // Check if we should run today
    if (!shouldRunToday(schedule, today, dayOfWeek)) continue

    // Pick challenges (with generative template support)
    for (let i = 0; i < schedule.challenges_per_day; i++) {
      await assignOneChallengeWithGenerative(supabase, schedule, classId, today)
    }

    // Update last_assigned_at
    await supabase
      .from('class_challenge_schedules')
      .update({ last_assigned_at: new Date().toISOString() })
      .eq('id', schedule.id)
  }
}

function shouldRunToday(schedule: any, today: string, dayOfWeek: number): boolean {
  // Already ran today?
  if (schedule.last_assigned_at) {
    const lastDate = schedule.last_assigned_at.split('T')[0]
    if (lastDate === today) return false
  }

  // Check frequency
  if (schedule.frequency === 'daily') return true
  if (schedule.frequency === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5
  if (schedule.frequency === 'weekly') {
    // Run on Mondays only
    return dayOfWeek === 1
  }

  return false
}

async function assignOneChallengeWithGenerative(
  supabase: SupabaseClient,
  schedule: any,
  classId: string,
  today: string
) {
  const tagIds: string[] = schedule.tag_ids || []
  if (tagIds.length === 0) return

  // Check if any generative templates match the schedule's tags
  const { data: templates } = await supabase
    .from('challenge_templates')
    .select('*')
    .eq('is_generative', true)
    .overlaps('tag_ids', tagIds)

  if (templates && templates.length > 0) {
    // Pick a random generative template
    const rawTemplate = templates[Math.floor(Math.random() * templates.length)]

    const template: GenerativeTemplate = {
      id: rawTemplate.id,
      title_template: rawTemplate.title_template,
      description_template: rawTemplate.description_template,
      variables: rawTemplate.variables,
      answer_formula: rawTemplate.answer_formula,
      max_points: rawTemplate.max_points ?? 10,
      tag_ids: rawTemplate.tag_ids ?? [],
    }

    // Generate a new challenge from the template
    const challengeId = await generateChallenge(template, supabase, schedule.created_by)

    if (challengeId) {
      // Create challenge assignment for the class
      await supabase
        .from('challenge_assignments')
        .insert({
          challenge_id: challengeId,
          class_id: classId,
          assigned_by: schedule.created_by,
        })

      // Log the assignment
      await supabase
        .from('schedule_assignment_log')
        .insert({
          schedule_id: schedule.id,
          challenge_id: challengeId,
          assigned_date: today,
        })
      return
    }

    // Generation returned null — log failure and continue
    console.warn(
      `[scheduler] generative template ${template.id} failed to generate for schedule ${schedule.id}`
    )
  }

  // Fallback: use existing non-generative assignment logic
  await assignOneChallenge(supabase, schedule, classId, today)
}

async function assignOneChallenge(
  supabase: SupabaseClient,
  schedule: any,
  classId: string,
  today: string
) {
  const tagIds: string[] = schedule.tag_ids || []
  if (tagIds.length === 0) return

  // Get all challenges matching the tags
  const { data: allChallenges } = await supabase
    .from('daily_challenges')
    .select('id')
    .overlaps('tag_ids', tagIds)

  if (!allChallenges || allChallenges.length === 0) return

  // Get already-used challenge IDs for this schedule
  const { data: usedLog } = await supabase
    .from('schedule_assignment_log')
    .select('challenge_id')
    .eq('schedule_id', schedule.id)

  const usedIds = new Set(usedLog?.map(l => l.challenge_id) || [])

  // Filter to unused challenges
  let available = allChallenges.filter(c => !usedIds.has(c.id))

  // If pool exhausted, reset (loop back)
  if (available.length === 0) {
    // Clear the log for this schedule to start over
    await supabase
      .from('schedule_assignment_log')
      .delete()
      .eq('schedule_id', schedule.id)
    available = allChallenges
  }

  // Pick a random one
  const picked = available[Math.floor(Math.random() * available.length)]
  if (!picked) return

  // Create the assignment
  await supabase
    .from('challenge_assignments')
    .insert({
      challenge_id: picked.id,
      class_id: classId,
      assigned_by: schedule.created_by
    })

  // Also set the challenge_date to today if it's not set or is in the future
  await supabase
    .from('daily_challenges')
    .update({ challenge_date: today })
    .eq('id', picked.id)
    .gt('challenge_date', today)

  // Log it
  await supabase
    .from('schedule_assignment_log')
    .insert({
      schedule_id: schedule.id,
      challenge_id: picked.id,
      assigned_date: today
    })
}
