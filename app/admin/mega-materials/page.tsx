'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase/client'
import type { MegaWorkflow, ChallengePick } from '@/lib/mega/types'

// ── Helpers ───────────────────────────────────────────────────────────────

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    step1_pending: '① Math Solver',
    step1_done:    '② Takeaway',
    step2_pending: '② Takeaway',
    step2_done:    '③ Story',
    step3_pending: '③ Story',
    step3_done:    '④ Mega',
    step4_pending: '④ Mega',
    completed:     '✓ Complete',
  }
  return map[status] ?? status
}

function statusColor(status: string): string {
  if (status === 'completed') return 'bg-green-100 text-green-700'
  return 'bg-amber-100 text-amber-700'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Notification ──────────────────────────────────────────────────────────

function Notification({ message, type, onClose }: {
  message: string; type: 'success' | 'error'; onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-3 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
      {message}
      <button onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none">×</button>
    </div>
  )
}

// ── Challenge Picker Modal ────────────────────────────────────────────────

function ChallengePicker({ items, loading, search, onSearch, onCreate, onClose }: {
  items: ChallengePick[]
  loading: boolean
  search: string
  onSearch: (v: string) => void
  onCreate: (pick: ChallengePick) => void
  onClose: () => void
}) {
  const filtered = items.filter(i =>
    i.title.toLowerCase().includes(search.toLowerCase())
  )
  const dailyChallenges = filtered.filter(i => i.source === 'daily_challenge')
  const bankItems       = filtered.filter(i => i.source === 'bank_item')

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Pick a challenge</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <input
            autoFocus
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search challenges..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading challenges...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No challenges found</p>
          ) : (
            <>
              {dailyChallenges.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Daily Challenges</p>
                  <div className="space-y-1">
                    {dailyChallenges.map(item => (
                      <button
                        key={item.id}
                        onClick={() => onCreate(item)}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-indigo-50 text-sm text-gray-800 transition"
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {bankItems.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Challenge Bank</p>
                  <div className="space-y-1">
                    {bankItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => onCreate(item)}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-indigo-50 text-sm text-gray-800 transition"
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function MegaMaterialsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [workflows, setWorkflows]       = useState<MegaWorkflow[]>([])
  const [loading, setLoading]           = useState(true)
  const [showPicker, setShowPicker]     = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerItems, setPickerItems]   = useState<ChallengePick[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [creating, setCreating]         = useState(false)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // ── Auth guard (teacher/admin only) ──────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userRoles } = await supabase
        .from('user_roles').select('role_id').eq('user_id', user.id).is('class_id', null)
      if (!userRoles?.length) { router.push('/login'); return }

      const { data: roleData } = await supabase
        .from('roles').select('name').in('id', userRoles.map((r: any) => r.role_id))
      const isTeacher = roleData?.some((r: any) => ['teacher', 'administrator'].includes(r.name))
      if (!isTeacher) { router.push('/login'); return }

      await loadWorkflows()
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load workflows ────────────────────────────────────────────────────
  const loadWorkflows = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    try {
      const res = await fetch('/api/mega', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.ok) setWorkflows(data.workflows ?? [])
    } catch (err) {
      console.error('Failed to load mega workflows:', err)
    }
  }, [supabase])

  // ── Load picker items ─────────────────────────────────────────────────
  async function openPicker() {
    setShowPicker(true)
    setPickerSearch('')
    if (pickerItems.length > 0) return   // already loaded
    setPickerLoading(true)
    try {
      const [{ data: daily }, { data: bank }] = await Promise.all([
        supabase.from('daily_challenges').select('id, title, description, image_url')
          .order('created_at', { ascending: false }).limit(200),
        supabase.from('challenge_bank').select('id, title, description, image_url')
          .order('created_at', { ascending: false }).limit(200),
      ])
      const merged: ChallengePick[] = [
        ...(daily ?? []).map((c: any) => ({ ...c, source: 'daily_challenge' as const })),
        ...(bank  ?? []).map((c: any) => ({ ...c, source: 'bank_item'       as const })),
      ]
      setPickerItems(merged)
    } catch (err) {
      console.error('Failed to load challenges for picker:', err)
    } finally {
      setPickerLoading(false)
    }
  }

  // ── Create workflow ───────────────────────────────────────────────────
  async function handleCreate(pick: ChallengePick) {
    setCreating(true)
    setShowPicker(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch('/api/mega', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source:       pick.source,
          challenge_id: pick.source === 'daily_challenge' ? pick.id : undefined,
          bank_item_id: pick.source === 'bank_item'       ? pick.id : undefined,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Failed to create workflow')
      router.push(`/admin/mega-materials/${data.workflow_id}`)
    } catch (err: any) {
      setNotification({ message: err.message, type: 'error' })
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">

        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="text-sm text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1"
            >
              ← Back
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📚 Mega Materials</h1>
            <p className="text-gray-500 text-sm mt-1">Pick a challenge — AI builds a complete teaching package in 4 steps.</p>
          </div>
          <button
            onClick={openPicker}
            disabled={creating}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {creating ? 'Creating...' : '+ New Mega'}
          </button>
        </div>

        {/* Workflow list */}
        {workflows.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">📖</p>
            <p className="font-medium">No Megas yet</p>
            <p className="text-sm mt-1">Click &ldquo;+ New Mega&rdquo; to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map((wf: any) => (
              <div
                key={wf.id}
                onClick={() => router.push(`/admin/mega-materials/${wf.id}`)}
                className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between hover:shadow-md hover:border-indigo-200 cursor-pointer transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{wf.challenge_title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{relativeTime(wf.updated_at)}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(wf.status)}`}>
                    {statusLabel(wf.status)}
                  </span>
                  <span className="text-gray-300 text-lg">→</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Challenge picker modal */}
        {showPicker && (
          <ChallengePicker
            items={pickerItems}
            loading={pickerLoading}
            search={pickerSearch}
            onSearch={setPickerSearch}
            onCreate={handleCreate}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </div>
  )
}
