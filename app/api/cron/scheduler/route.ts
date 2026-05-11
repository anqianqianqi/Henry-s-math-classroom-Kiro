import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateChallenge, GenerativeTemplate } from '@/lib/challenge-generator'

/**
 * Cron endpoint to run the challenge scheduler for ALL active classes.
 * 
 * Call this via a cron job (e.g., Vercel Cron, external cron service).
 * Recommended: run daily at midnight or early morning.
 * 
 * Security: Protected by CRON_SECRET header check.
 * 
 * Usage:
 *   GET /api/cron/scheduler
 *   Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  // Verify cron secret (skip in development)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const today = new Date().toISOString().split('T')[0]
  const dayOfWeek = new Date().getDay() // 0=Sun, 6=Sat

  // Get ALL active schedules across all classes
  const { data: schedules, error: schedulesError } = await supabase
    .from('class_challenge_schedules')
    .select('*')
    .eq('is_active', true)

  if (schedulesError) {
    return NextResponse.json({ error: schedulesError.message }, { status: 500 })
  }

  if (!schedules || schedules.length === 0) {
    return NextResponse.json({ message: 'No active schedules found', assigned: 0 })
  }

  let totalAssigned = 0
  const results: Array<{ scheduleId: string; classId: string; status: string }> = []

  for (const schedule of schedules) {
    // Check if we should run today
    if (!shouldRunToday(schedule, today, dayOfWeek)) {
      results.push({ scheduleId: schedule.id, classId: schedule.class_id, status: 'skipped (not due)' })
      continue
    }

    // Assign challenges
    for (let i = 0; i < (schedule.challenges_per_day || 1); i++) {
      const assigned = await assignOneChallenge(supabase, schedule, schedule.class_id, today)
      if (assigned) totalAssigned++
    }

    // Update last_assigned_at
    await supabase
      .from('class_challenge_schedules')
      .update({ last_assigned_at: new Date().toISOString() })
      .eq('id', schedule.id)

    results.push({ scheduleId: schedule.id, classId: schedule.class_id, status: 'assigned' })
  }

  return NextResponse.json({
    message: `Scheduler complete. ${totalAssigned} challenge(s) assigned.`,
    date: today,
    assigned: totalAssigned,
    schedules: results,
  })
}

function shouldRunToday(schedule: any, today: string, dayOfWeek: number): boolean {
  if (schedule.last_assigned_at) {
    const lastDate = schedule.last_assigned_at.split('T')[0]
    if (lastDate === today) return false
  }

  if (schedule.frequency === 'daily') return true
  if (schedule.frequency === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5
  if (schedule.frequency === 'weekly') return dayOfWeek === 1

  return false
}

async function assignOneChallenge(
  supabase: any,
  schedule: any,
  classId: string,
  today: string
): Promise<boolean> {
  const tagIds: string[] = schedule.tag_ids || []
  if (tagIds.length === 0) return false

  // Check for generative templates first
  const { data: templates } = await supabase
    .from('challenge_templates')
    .select('*')
    .eq('is_generative', true)
    .overlaps('tag_ids', tagIds)

  if (templates && templates.length > 0) {
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

    const challengeId = await generateChallenge(template, supabase, schedule.created_by)
    if (challengeId) {
      await supabase.from('challenge_assignments').insert({
        challenge_id: challengeId,
        class_id: classId,
        assigned_by: schedule.created_by,
      })
      await supabase.from('schedule_assignment_log').insert({
        schedule_id: schedule.id,
        challenge_id: challengeId,
        assigned_date: today,
      })
      return true
    }
  }

  // Fallback: pick from existing challenges matching tags
  const { data: allChallenges } = await supabase
    .from('daily_challenges')
    .select('id')
    .overlaps('tag_ids', tagIds)

  if (!allChallenges || allChallenges.length === 0) return false

  // Get already-used challenge IDs
  const { data: usedLog } = await supabase
    .from('schedule_assignment_log')
    .select('challenge_id')
    .eq('schedule_id', schedule.id)

  const usedIds = new Set(usedLog?.map((l: any) => l.challenge_id) || [])
  let available = allChallenges.filter((c: any) => !usedIds.has(c.id))

  // If pool exhausted, reset
  if (available.length === 0) {
    await supabase
      .from('schedule_assignment_log')
      .delete()
      .eq('schedule_id', schedule.id)
    available = allChallenges
  }

  const picked = available[Math.floor(Math.random() * available.length)]
  if (!picked) return false

  await supabase.from('challenge_assignments').insert({
    challenge_id: picked.id,
    class_id: classId,
    assigned_by: schedule.created_by,
  })

  await supabase.from('schedule_assignment_log').insert({
    schedule_id: schedule.id,
    challenge_id: picked.id,
    assigned_date: today,
  })

  return true
}
