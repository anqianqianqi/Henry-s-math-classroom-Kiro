'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Types ─────────────────────────────────────────────────────────────────

interface ChallengeEntry {
  challengeId: string   // daily_challenge id (for linking)
  bankItemId: string    // challenge_bank id
  title: string
  submittedAt: string | null
  points: number | null
  maxPoints: number
  scorePct: number | null // null = not graded
}

interface TagStat {
  tagId: string
  tagName: string
  totalAssigned: number         // how many challenges with this tag were assigned to student
  attempted: number             // how many they submitted
  graded: number                // how many have a points value
  avgScorePct: number | null    // weighted avg score %  (null if no graded)
  completionPct: number         // attempted / totalAssigned * 100
  challenges: ChallengeEntry[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function scoreColor(pct: number): string {
  if (pct >= 85) return 'bg-green-500'
  if (pct >= 65) return 'bg-yellow-400'
  return 'bg-red-400'
}

function scoreLabel(pct: number): string {
  if (pct >= 90) return 'Excellent'
  if (pct >= 75) return 'Good'
  if (pct >= 60) return 'Developing'
  return 'Needs work'
}

function reliabilityLabel(attempted: number): string {
  if (attempted >= 8) return 'Strong data'
  if (attempted >= 4) return 'Some data'
  return 'Limited data'
}

function reliabilityColor(attempted: number): string {
  if (attempted >= 8) return 'text-green-600'
  if (attempted >= 4) return 'text-yellow-600'
  return 'text-gray-400'
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function StudentStudyCurve({ userId }: { userId: string }) {
  const [tagStats, setTagStats] = useState<TagStat[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    if (userId) loadStats()
  }, [userId])

  async function loadStats() {
    try {
      setLoading(true)

      // 1. Get all class_ids this student belongs to
      const { data: memberships } = await supabase
        .from('class_members')
        .select('class_id')
        .eq('user_id', userId)

      const classIds = memberships?.map((m: any) => m.class_id) ?? []

      // 2. Get all challenge_ids assigned to student via class OR individually
      const [classAssignmentsRes, individualRes] = await Promise.all([
        classIds.length > 0
          ? supabase.from('challenge_assignments').select('challenge_id').in('class_id', classIds)
          : Promise.resolve({ data: [] }),
        supabase.from('challenge_student_assignments').select('challenge_id').eq('student_id', userId),
      ])

      const assignedChallengeIds = [
        ...new Set([
          ...((classAssignmentsRes.data ?? []).map((r: any) => r.challenge_id)),
          ...((individualRes.data ?? []).map((r: any) => r.challenge_id)),
        ]),
      ]

      if (assignedChallengeIds.length === 0) {
        setTagStats([])
        setLoading(false)
        return
      }

      // 3. Fetch daily_challenge info for those ids (with their tag_ids + source_bank_id)
      const { data: challenges } = await supabase
        .from('daily_challenges')
        .select('id, title, tag_ids, max_points, source_bank_id')
        .in('id', assignedChallengeIds)
        .eq('is_hidden', false)

      if (!challenges || challenges.length === 0) {
        setTagStats([])
        setLoading(false)
        return
      }

      // 4. Also fetch bank items directly assigned (some challenges have no source_bank_id —
      //    but they still have tag_ids on the daily_challenge itself)
      //    For bank-sourced challenges also pull bank item info for max_points fallback
      const bankIds = [...new Set(challenges.filter((c: any) => c.source_bank_id).map((c: any) => c.source_bank_id))]
      const bankItemsMap = new Map<string, { title: string; tag_ids: string[]; max_points: number }>()
      if (bankIds.length > 0) {
        const { data: bankItems } = await supabase
          .from('challenge_bank')
          .select('id, title, tag_ids, max_points')
          .in('id', bankIds)
        for (const item of bankItems ?? []) {
          bankItemsMap.set(item.id, item)
        }
      }

      // 5. Fetch all student submissions for these challenges in one query
      const { data: submissions } = await supabase
        .from('challenge_submissions')
        .select('challenge_id, bank_item_id, points, submitted_at')
        .eq('user_id', userId)
        .in('challenge_id', assignedChallengeIds)

      // Build a lookup: challenge_id → submission (and bank_item_id → submission for dedup)
      const subByChallenge = new Map<string, any>()
      const subByBank = new Map<string, any>()
      for (const s of submissions ?? []) {
        if (s.bank_item_id) {
          subByBank.set(s.bank_item_id, s)
        }
        if (s.challenge_id) {
          subByChallenge.set(s.challenge_id, s)
        }
      }

      // 6. Collect all tag UUIDs used across these challenges
      const allTagIds = new Set<string>()
      for (const c of challenges) {
        // Prefer bank item's tag_ids if it exists, otherwise use daily_challenge tag_ids
        const tagSrc = (c.source_bank_id && bankItemsMap.get(c.source_bank_id)?.tag_ids) || c.tag_ids || []
        for (const tid of tagSrc) allTagIds.add(tid)
      }

      if (allTagIds.size === 0) {
        setTagStats([])
        setLoading(false)
        return
      }

      // 7. Fetch tag names (prefer language stored in localStorage, default 'en')
      let lang = 'en'
      try { lang = localStorage.getItem('lang') || 'en' } catch (_) {}

      const { data: tagNames } = await supabase
        .from('challenge_tag_names')
        .select('tag_id, name, language')
        .in('tag_id', [...allTagIds])

      // Build tag name map: id → name (prefer user lang, fallback en, fallback any)
      const tagNameMap = new Map<string, string>()
      for (const tn of tagNames ?? []) {
        const existing = tagNameMap.get(tn.tag_id)
        if (!existing || tn.language === lang || (tn.language === 'en' && existing === undefined)) {
          tagNameMap.set(tn.tag_id, tn.name)
        }
        // prefer user lang over en
        if (tn.language === lang) tagNameMap.set(tn.tag_id, tn.name)
      }

      // 8. Build per-tag stats
      const tagMap = new Map<string, TagStat>()

      for (const challenge of challenges) {
        const bankItem = challenge.source_bank_id ? bankItemsMap.get(challenge.source_bank_id) : null
        const tagIds: string[] = (bankItem?.tag_ids || challenge.tag_ids || [])
        const maxPoints = bankItem?.max_points ?? challenge.max_points ?? 100
        const title = challenge.title

        // Find submission: prefer bank-linked, fallback challenge-linked
        const sub = (challenge.source_bank_id && subByBank.get(challenge.source_bank_id))
          || subByChallenge.get(challenge.id)
          || null

        const entry: ChallengeEntry = {
          challengeId: challenge.id,
          bankItemId: challenge.source_bank_id ?? challenge.id,
          title,
          submittedAt: sub?.submitted_at ?? null,
          points: sub?.points ?? null,
          maxPoints,
          scorePct: (sub?.points != null && maxPoints > 0)
            ? Math.round((sub.points / maxPoints) * 100)
            : null,
        }

        for (const tagId of tagIds) {
          if (!tagNameMap.has(tagId)) continue

          if (!tagMap.has(tagId)) {
            tagMap.set(tagId, {
              tagId,
              tagName: tagNameMap.get(tagId)!,
              totalAssigned: 0,
              attempted: 0,
              graded: 0,
              avgScorePct: null,
              completionPct: 0,
              challenges: [],
            })
          }

          const stat = tagMap.get(tagId)!

          // Deduplicate by bankItemId — if same bank problem appears in multiple daily instances,
          // only count it once (we track by bankItemId)
          const alreadyCounted = stat.challenges.some(e => e.bankItemId === entry.bankItemId)
          if (!alreadyCounted) {
            stat.totalAssigned++
            if (entry.submittedAt) stat.attempted++
            if (entry.scorePct !== null) stat.graded++
            stat.challenges.push({ ...entry })
          }
        }
      }

      // 9. Compute averages and completion %
      for (const stat of tagMap.values()) {
        stat.completionPct = stat.totalAssigned > 0
          ? Math.round((stat.attempted / stat.totalAssigned) * 100)
          : 0

        const gradedChallenges = stat.challenges.filter(c => c.scorePct !== null)
        if (gradedChallenges.length > 0) {
          stat.avgScorePct = Math.round(
            gradedChallenges.reduce((s, c) => s + c.scorePct!, 0) / gradedChallenges.length
          )
        } else {
          stat.avgScorePct = null
        }

        // Sort challenges: submitted first (desc by date), then unsubmitted
        stat.challenges.sort((a, b) => {
          if (a.submittedAt && !b.submittedAt) return -1
          if (!a.submittedAt && b.submittedAt) return 1
          if (a.submittedAt && b.submittedAt) return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
          return 0
        })
      }

      // 10. Sort tags: by avgScorePct ascending (growth areas first), ungraded last
      const sorted = [...tagMap.values()].sort((a, b) => {
        if (a.avgScorePct === null && b.avgScorePct === null) return b.totalAssigned - a.totalAssigned
        if (a.avgScorePct === null) return 1
        if (b.avgScorePct === null) return -1
        return a.avgScorePct - b.avgScorePct
      })

      setTagStats(sorted)
    } catch (err) {
      console.error('Failed to load study curve stats:', err)
    } finally {
      setLoading(false)
    }
  }

  function toggleTag(tagId: string) {
    setExpandedTags(prev => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }

  // ── Recommendations ──────────────────────────────────────────────────────
  const gradedTags = tagStats.filter(t => t.avgScorePct !== null)
  const weakest = gradedTags.slice(0, 2)   // already sorted asc
  const strongest = gradedTags.length > 0 ? gradedTags[gradedTags.length - 1] : null
  const lowCompletion = tagStats
    .filter(t => t.completionPct < 60 && t.totalAssigned >= 2)
    .slice(0, 2)

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-white rounded-2xl p-4 shadow-sm">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (tagStats.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-gray-500">
        <div className="text-4xl mb-2">📊</div>
        <p className="font-medium">No stats yet</p>
        <p className="text-sm mt-1">Complete some challenges to see your study curve here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Recommendation banner ─────────────────────────────────────────── */}
      {(weakest.length > 0 || lowCompletion.length > 0) && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4">
          <p className="text-sm font-semibold text-indigo-800 mb-2">📈 Personalized recommendations</p>
          <ul className="space-y-1.5 text-sm text-indigo-700">
            {weakest.map(t => (
              <li key={t.tagId}>
                🎯 Focus on <strong>{t.tagName}</strong> — your avg score is{' '}
                <strong>{t.avgScorePct}%</strong>. Practice more problems in this area.
              </li>
            ))}
            {strongest && gradedTags.length > 1 && (
              <li>
                ⭐ Keep it up in <strong>{strongest.tagName}</strong> —{' '}
                you&apos;re scoring <strong>{strongest.avgScorePct}%</strong> there!
              </li>
            )}
            {lowCompletion.map(t => (
              <li key={t.tagId}>
                📝 You&apos;ve only attempted{' '}
                <strong>{t.attempted}/{t.totalAssigned}</strong> challenges in{' '}
                <strong>{t.tagName}</strong>. Try doing more to build solid data.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Per-tag rows ──────────────────────────────────────────────────── */}
      {tagStats.map((stat, idx) => {
        const isExpanded = expandedTags.has(stat.tagId)
        const isGrowthArea = gradedTags.length > 0 && stat.avgScorePct !== null && idx < Math.min(2, gradedTags.length)

        return (
          <div
            key={stat.tagId}
            className={`bg-white rounded-2xl shadow-sm overflow-hidden border transition-all ${
              isGrowthArea ? 'border-orange-200' : 'border-transparent'
            }`}
          >
            {/* ── Row header — click to expand ──────────────────────────── */}
            <button
              onClick={() => toggleTag(stat.tagId)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
              aria-expanded={isExpanded}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {isGrowthArea && (
                    <span className="shrink-0 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                      Growth area
                    </span>
                  )}
                  <span className="font-semibold text-gray-900 truncate">{stat.tagName}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Completion pill */}
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {stat.attempted}/{stat.totalAssigned} done
                  </span>

                  {/* Score pill */}
                  {stat.avgScorePct !== null ? (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${scoreColor(stat.avgScorePct)}`}>
                      {stat.avgScorePct}%
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 italic">ungraded</span>
                  )}

                  <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Progress bar row */}
              <div className="mt-2 flex gap-2 items-center">
                {/* Completion bar */}
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                    <span>Completion</span>
                    <span>{stat.completionPct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all"
                      style={{ width: `${stat.completionPct}%` }}
                    />
                  </div>
                </div>

                {/* Score bar */}
                {stat.avgScorePct !== null && (
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                      <span>Avg score</span>
                      <span className="text-[10px] italic">{scoreLabel(stat.avgScorePct)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${scoreColor(stat.avgScorePct)}`}
                        style={{ width: `${stat.avgScorePct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Reliability note */}
              <p className={`text-[10px] mt-1 ${reliabilityColor(stat.attempted)}`}>
                {reliabilityLabel(stat.attempted)} ({stat.attempted} attempt{stat.attempted !== 1 ? 's' : ''})
                {stat.graded < stat.attempted && stat.attempted > 0
                  ? ` · ${stat.graded} graded`
                  : ''}
              </p>
            </button>

            {/* ── Expanded challenge list ────────────────────────────────── */}
            {isExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {stat.challenges.map(c => (
                  <button
                    key={c.challengeId}
                    onClick={() => router.push(`/challenges/${c.challengeId}`)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-gray-700 truncate group-hover:text-primary-700 transition-colors">
                        {c.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {c.submittedAt ? (
                        <>
                          {c.scorePct !== null ? (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${scoreColor(c.scorePct)}`}>
                              {c.scorePct}%
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">pending grade</span>
                          )}
                          <span className="text-[10px] text-gray-400">
                            {c.submittedAt ? new Date(c.submittedAt).toLocaleDateString() : ''}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                          Not done
                        </span>
                      )}
                      <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-xs">→</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
