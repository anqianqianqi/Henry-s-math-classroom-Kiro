'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Types ─────────────────────────────────────────────────────────────────

interface ChallengeEntry {
  challengeId: string
  bankItemId: string
  title: string
  submittedAt: string | null
  points: number | null
  maxPoints: number
  scorePct: number | null
}

interface TagStat {
  tagId: string
  tagName: string
  totalAssigned: number
  attempted: number
  graded: number
  avgScorePct: number | null
  completionPct: number
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

const COLLAPSED_TAG_COUNT = 2

// ─── Component ─────────────────────────────────────────────────────────────

export default function StudentStudyCurve({ userId }: { userId: string }) {
  const [tagStats, setTagStats] = useState<TagStat[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())
  const [showAllTags, setShowAllTags] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    if (userId) loadStats()
  }, [userId])

  async function loadStats() {
    try {
      setLoading(true)

      const { data: memberships } = await supabase
        .from('class_members')
        .select('class_id')
        .eq('user_id', userId)

      const classIds = memberships?.map((m: any) => m.class_id) ?? []

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

      if (assignedChallengeIds.length === 0) { setTagStats([]); setLoading(false); return }

      const { data: challenges } = await supabase
        .from('daily_challenges')
        .select('id, title, tag_ids, max_points, source_bank_id')
        .in('id', assignedChallengeIds)
        .eq('is_hidden', false)

      if (!challenges || challenges.length === 0) { setTagStats([]); setLoading(false); return }

      const bankIds = [...new Set(challenges.filter((c: any) => c.source_bank_id).map((c: any) => c.source_bank_id))]
      const bankItemsMap = new Map<string, { title: string; tag_ids: string[]; max_points: number }>()
      if (bankIds.length > 0) {
        const { data: bankItems } = await supabase
          .from('challenge_bank')
          .select('id, title, tag_ids, max_points')
          .in('id', bankIds)
        for (const item of bankItems ?? []) bankItemsMap.set(item.id, item)
      }

      const { data: submissions } = await supabase
        .from('challenge_submissions')
        .select('challenge_id, bank_item_id, points, submitted_at')
        .eq('user_id', userId)
        .in('challenge_id', assignedChallengeIds)

      const subByChallenge = new Map<string, any>()
      const subByBank = new Map<string, any>()
      for (const s of submissions ?? []) {
        if (s.bank_item_id) subByBank.set(s.bank_item_id, s)
        if (s.challenge_id) subByChallenge.set(s.challenge_id, s)
      }

      const allTagIds = new Set<string>()
      for (const c of challenges) {
        const tagSrc = (c.source_bank_id && bankItemsMap.get(c.source_bank_id)?.tag_ids) || c.tag_ids || []
        for (const tid of tagSrc) allTagIds.add(tid)
      }

      if (allTagIds.size === 0) { setTagStats([]); setLoading(false); return }

      let lang = 'en'
      try { lang = localStorage.getItem('lang') || 'en' } catch (_) {}

      const { data: tagNames } = await supabase
        .from('challenge_tag_names')
        .select('tag_id, name, language')
        .in('tag_id', [...allTagIds])

      const tagNameMap = new Map<string, string>()
      for (const tn of tagNames ?? []) {
        const existing = tagNameMap.get(tn.tag_id)
        if (!existing || tn.language === lang || (tn.language === 'en' && existing === undefined)) {
          tagNameMap.set(tn.tag_id, tn.name)
        }
        if (tn.language === lang) tagNameMap.set(tn.tag_id, tn.name)
      }

      const tagMap = new Map<string, TagStat>()

      for (const challenge of challenges) {
        const bankItem = challenge.source_bank_id ? bankItemsMap.get(challenge.source_bank_id) : null
        const tagIds: string[] = (bankItem?.tag_ids || challenge.tag_ids || [])
        const maxPoints = bankItem?.max_points ?? challenge.max_points ?? 100

        const sub = (challenge.source_bank_id && subByBank.get(challenge.source_bank_id))
          || subByChallenge.get(challenge.id)
          || null

        const entry: ChallengeEntry = {
          challengeId: challenge.id,
          bankItemId: challenge.source_bank_id ?? challenge.id,
          title: challenge.title,
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
          const alreadyCounted = stat.challenges.some(e => e.bankItemId === entry.bankItemId)
          if (!alreadyCounted) {
            stat.totalAssigned++
            if (entry.submittedAt) stat.attempted++
            if (entry.scorePct !== null) stat.graded++
            stat.challenges.push({ ...entry })
          }
        }
      }

      for (const stat of tagMap.values()) {
        stat.completionPct = stat.totalAssigned > 0
          ? Math.round((stat.attempted / stat.totalAssigned) * 100)
          : 0
        const gradedChallenges = stat.challenges.filter(c => c.scorePct !== null)
        stat.avgScorePct = gradedChallenges.length > 0
          ? Math.round(gradedChallenges.reduce((s, c) => s + c.scorePct!, 0) / gradedChallenges.length)
          : null
        stat.challenges.sort((a, b) => {
          if (a.submittedAt && !b.submittedAt) return -1
          if (!a.submittedAt && b.submittedAt) return 1
          if (a.submittedAt && b.submittedAt) return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
          return 0
        })
      }

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
      next.has(tagId) ? next.delete(tagId) : next.add(tagId)
      return next
    })
  }

  const gradedTags = tagStats.filter(t => t.avgScorePct !== null)
  const weakest = gradedTags.slice(0, 2)
  const strongest = gradedTags.length > 0 ? gradedTags[gradedTags.length - 1] : null
  const lowCompletion = tagStats.filter(t => t.completionPct < 60 && t.totalAssigned >= 2).slice(0, 2)

  const visibleTags = showAllTags ? tagStats : tagStats.slice(0, COLLAPSED_TAG_COUNT)
  const hiddenCount = tagStats.length - COLLAPSED_TAG_COUNT

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-5/6" />
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (tagStats.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center text-gray-500">
        <div className="text-4xl mb-2">📊</div>
        <p className="font-medium">No stats yet</p>
        <p className="text-sm mt-1">Complete some challenges to see your study curve here.</p>
      </div>
    )
  }

  // ── Main card ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      {/* ── Recommendation banner ──────────────────────────────────────── */}
      {(weakest.length > 0 || lowCompletion.length > 0) && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100 px-4 py-3">
          <p className="text-xs font-semibold text-indigo-800 mb-1.5">📈 Personalized recommendations</p>
          <ul className="space-y-1 text-xs text-indigo-700">
            {weakest.map(t => (
              <li key={t.tagId}>
                🎯 Focus on <strong>{t.tagName}</strong> — avg score{' '}
                <strong>{t.avgScorePct}%</strong>. More practice will help.
              </li>
            ))}
            {strongest && gradedTags.length > 1 && (
              <li>
                ⭐ Keep it up in <strong>{strongest.tagName}</strong> —{' '}
                scoring <strong>{strongest.avgScorePct}%</strong>!
              </li>
            )}
            {lowCompletion.map(t => (
              <li key={t.tagId}>
                📝 Only <strong>{t.attempted}/{t.totalAssigned}</strong> done in{' '}
                <strong>{t.tagName}</strong>. Try a few more.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Tag rows ───────────────────────────────────────────────────── */}
      <div className="divide-y divide-gray-50">
        {visibleTags.map((stat, idx) => {
          const isExpanded = expandedTags.has(stat.tagId)
          const isGrowthArea = gradedTags.length > 0 && stat.avgScorePct !== null && idx < Math.min(2, gradedTags.length)

          return (
            <div key={stat.tagId}>
              {/* Tag header row — click to expand challenge list */}
              <button
                onClick={() => toggleTag(stat.tagId)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {isGrowthArea && (
                      <span className="shrink-0 text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                        Growth area
                      </span>
                    )}
                    <span className="font-semibold text-gray-900 truncate text-sm">{stat.tagName}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {stat.attempted}/{stat.totalAssigned}
                    </span>
                    {stat.avgScorePct !== null ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${scoreColor(stat.avgScorePct)}`}>
                        {stat.avgScorePct}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">ungraded</span>
                    )}
                    <span className="text-gray-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Progress bars */}
                <div className="mt-2 flex gap-2 items-center">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                      <span>Completion</span>
                      <span>{stat.completionPct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${stat.completionPct}%` }} />
                    </div>
                  </div>
                  {stat.avgScorePct !== null && (
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                        <span>Avg score</span>
                        <span className="italic">{scoreLabel(stat.avgScorePct)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${scoreColor(stat.avgScorePct)}`} style={{ width: `${stat.avgScorePct}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <p className={`text-[10px] mt-1 ${reliabilityColor(stat.attempted)}`}>
                  {reliabilityLabel(stat.attempted)} ({stat.attempted} attempt{stat.attempted !== 1 ? 's' : ''})
                  {stat.graded < stat.attempted && stat.attempted > 0 ? ` · ${stat.graded} graded` : ''}
                </p>
              </button>

              {/* Expanded challenge list */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 divide-y divide-gray-100">
                  {stat.challenges.map(c => (
                    <button
                      key={c.challengeId}
                      onClick={() => router.push(`/challenges/${c.challengeId}`)}
                      className="w-full text-left px-5 py-2 hover:bg-white transition-colors flex items-center justify-between gap-3 group"
                    >
                      <span className="text-sm text-gray-700 truncate group-hover:text-indigo-600 transition-colors">
                        {c.title}
                      </span>
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
                              {new Date(c.submittedAt).toLocaleDateString()}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                            Not done
                          </span>
                        )}
                        <span className="text-gray-300 group-hover:text-gray-500 text-xs transition-colors">→</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Show more / less toggle ────────────────────────────────────── */}
      {tagStats.length > COLLAPSED_TAG_COUNT && (
        <button
          onClick={() => setShowAllTags(v => !v)}
          className="w-full px-4 py-2.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition-colors border-t border-gray-100 text-center"
        >
          {showAllTags
            ? '▲ Show less'
            : `▼ Show all ${tagStats.length} topics (+${hiddenCount} more)`}
        </button>
      )}
    </div>
  )
}
