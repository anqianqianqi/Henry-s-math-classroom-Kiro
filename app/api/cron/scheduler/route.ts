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
  // Verify cron secret
  // Vercel Cron sends the secret via 'authorization' header as 'Bearer <CRON_SECRET>'
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const isValidBearer = authHeader === `Bearer ${cronSecret}`
    const isValidVercelCron = request.headers.get('x-vercel-cron') === '1'
    
    if (!isValidBearer && !isValidVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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
  const results: Array<{ scheduleId: string; classId: string; status: string; challengeId?: string; challengeTitle?: string; error?: string }> = []

  for (const schedule of schedules) {
    // Check if we should run today
    if (!shouldRunToday(schedule, today, dayOfWeek)) {
      results.push({ scheduleId: schedule.id, classId: schedule.class_id, status: 'skipped (not due)' })
      continue
    }

    // Assign challenges
    for (let i = 0; i < (schedule.challenges_per_day || 1); i++) {
      const result = await assignOneChallenge(supabase, schedule, schedule.class_id, today)
      if (result) {
        totalAssigned++
        results.push({ scheduleId: schedule.id, classId: schedule.class_id, status: 'assigned', challengeId: result.challengeId, challengeTitle: result.title })
      } else {
        results.push({ scheduleId: schedule.id, classId: schedule.class_id, status: 'pool_exhausted - skipped' })
      }
    }

    // Update last_assigned_at
    await supabase
      .from('class_challenge_schedules')
      .update({ last_assigned_at: new Date().toISOString() })
      .eq('id', schedule.id)
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
): Promise<{ challengeId: string; title: string } | null> {
  const tagIds: string[] = schedule.tag_ids || []
  if (tagIds.length === 0) return null

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
      // Get the challenge title for debugging
      const { data: challenge } = await supabase
        .from('daily_challenges')
        .select('title')
        .eq('id', challengeId)
        .single()

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
      return { challengeId, title: challenge?.title || 'unknown' }
    }
  }

  // Fallback: pick from existing challenges matching tags
  const { data: allChallenges } = await supabase
    .from('daily_challenges')
    .select('id, title')
    .overlaps('tag_ids', tagIds)

  if (!allChallenges || allChallenges.length === 0) return null

  // Get already-used challenge IDs
  const { data: usedLog } = await supabase
    .from('schedule_assignment_log')
    .select('challenge_id')
    .eq('schedule_id', schedule.id)

  const usedIds = new Set(usedLog?.map((l: any) => l.challenge_id) || [])
  let available = allChallenges.filter((c: any) => !usedIds.has(c.id))

  // If pool exhausted, try generative templates without tag filter as last resort
  if (available.length === 0) {
    // Try generative templates without tag constraint (they generate infinite unique challenges)
    const { data: anyTemplates } = await supabase
      .from('challenge_templates')
      .select('*')
      .eq('is_generative', true)

    if (anyTemplates && anyTemplates.length > 0) {
      const rawTemplate = anyTemplates[Math.floor(Math.random() * anyTemplates.length)]
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
        const { data: challenge } = await supabase
          .from('daily_challenges')
          .select('title')
          .eq('id', challengeId)
          .single()

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
        return { challengeId, title: challenge?.title || 'unknown' }
      }
    }

    // Truly exhausted - no templates available either
    await supabase
      .from('class_challenge_schedules')
      .update({ pool_exhausted: true })
      .eq('id', schedule.id)
    return null
  }

  // Clear exhausted flag if we have challenges available
  if (schedule.pool_exhausted) {
    await supabase
      .from('class_challenge_schedules')
      .update({ pool_exhausted: false })
      .eq('id', schedule.id)
  }

  const picked = available[Math.floor(Math.random() * available.length)]
  if (!picked) return null

  // Update challenge_date to today so it appears as today's challenge
  await supabase
    .from('daily_challenges')
    .update({ challenge_date: today })
    .eq('id', picked.id)

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

  return { challengeId: picked.id, title: picked.title }
}
