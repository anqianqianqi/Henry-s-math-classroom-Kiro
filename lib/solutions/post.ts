'use client'

/**
 * Posting confirmed crops as the student's submissions.
 *
 * One submission per accepted problem, exactly what the challenge page writes
 * when a student submits there by hand — same table, same columns, same
 * teacher notification, same pet XP. A submission made this way should be
 * indistinguishable afterwards from one made the ordinary way, because
 * everything downstream (grading, the study curve, the shop) reads those rows
 * and knows nothing about how they arrived.
 *
 * ── ONLY EVER YOUR OWN WORK ─────────────────────────────────
 * user_id is the signed-in user and nothing else. RLS says as much —
 * "Users can create submissions" checks auth.uid() = user_id — so a request to
 * post as somebody else fails at the database rather than quietly succeeding.
 * That is deliberate: this feature posts work under a name, and the only name
 * it can post under is the one holding the session.
 */

import { createClient } from '@/lib/supabase/client'

export interface AcceptedCrop {
  challengeId: string
  /** The crop, already cut from the page at full resolution. */
  blob: Blob
  /** Set when this problem already had a submission that is being replaced. */
  replaces?: string
  /** Carried onto the row so a re-published bank problem keeps its work. */
  bankItemId?: string | null
}

export interface PostOutcome {
  posted: string[]
  failed: { challengeId: string; reason: string }[]
}

/**
 * The text stored beside the picture.
 *
 * content is NOT NULL on challenge_submissions, and there is no typed working
 * here — the answer IS the photograph. An empty string keeps the column happy
 * and renders as nothing, which is what should appear above the image.
 * Deliberately not a sentence like "uploaded from a scan": that would be UI
 * text written into the database, frozen in whichever language the student
 * happened to be using, and read back to everyone else in that language.
 */
const NO_TYPED_WORKING = ''

/** Where a student's uploaded crops live in the images bucket. */
function cropPath(userId: string, challengeId: string): string {
  return `${userId}/solutions/${challengeId}-${Date.now()}.jpg`
}

export async function postCrops(userId: string, crops: AcceptedCrop[]): Promise<PostOutcome> {
  const supabase = createClient()
  const outcome: PostOutcome = { posted: [], failed: [] }

  for (const crop of crops) {
    try {
      const path = cropPath(userId, crop.challengeId)
      const { error: uploadError } = await supabase.storage
        .from('challenge-images')
        .upload(path, crop.blob, { contentType: 'image/jpeg' })
      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage.from('challenge-images').getPublicUrl(path)
      const imageUrl = urlData.publicUrl

      if (crop.replaces) {
        const { error } = await supabase
          .from('challenge_submissions')
          .update({ image_url: imageUrl })
          .eq('id', crop.replaces)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('challenge_submissions').insert({
          challenge_id: crop.challengeId,
          user_id: userId,
          content: NO_TYPED_WORKING,
          image_url: imageUrl,
          ...(crop.bankItemId ? { bank_item_id: crop.bankItemId } : {}),
        })
        if (error) throw new Error(error.message)
      }

      outcome.posted.push(crop.challengeId)

      /*
        The same two side effects the challenge page fires, and for the same
        reason: a teacher watches for the notification, and a student who did
        the work is owed the XP whichever door they came in by. Both are
        deliberately not awaited into the failure path — a submission that
        landed has landed, and losing the XP is not worth reporting it as
        failed and inviting a second attempt.
      */
      void notifyTeachers(supabase, crop.challengeId, userId)
      void fetch('/api/pet/challenge-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: crop.challengeId }),
      }).catch(() => {})
    } catch (err: any) {
      outcome.failed.push({ challengeId: crop.challengeId, reason: String(err?.message ?? err) })
    }
  }

  if (outcome.posted.length) {
    setTimeout(() => window.dispatchEvent(new CustomEvent('didi-pet-refresh')), 500)
  }

  return outcome
}

/** Mirrors notifyTeachers on the challenge page. Best effort, never fatal. */
async function notifyTeachers(
  supabase: ReturnType<typeof createClient>,
  challengeId: string,
  userId: string,
): Promise<void> {
  try {
    const [{ data: challenge }, { data: profile }] = await Promise.all([
      supabase.from('daily_challenges').select('title, created_by').eq('id', challengeId).maybeSingle(),
      supabase.from('profiles').select('full_name, nickname').eq('id', userId).maybeSingle(),
    ])

    const teacherId = (challenge as any)?.created_by
    if (!teacherId) return

    const name = (profile as any)?.nickname || (profile as any)?.full_name || 'A student'
    await supabase.from('notifications').insert({
      user_id: teacherId,
      type: 'submission_received',
      title: 'New Submission',
      message: `${name} submitted a solution for "${(challenge as any)?.title ?? 'a challenge'}"`,
      link: `/challenges/${challengeId}`,
    })
  } catch {
    // A missing notification must never cost the student their submission.
  }
}
