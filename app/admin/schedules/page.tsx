'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface Schedule {
  id: string
  class_id: string
  class_name?: string
  tag_ids: string[]
  frequency: string
  challenges_per_day: number
  is_active: boolean
  last_assigned_at: string | null
}

interface TagInfo {
  id: string
  name: string
}

interface ClassInfo {
  id: string
  name: string
}

interface TagGroupInfo {
  id: string
  name: string
  tag_ids: string[]
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [tags, setTags] = useState<TagInfo[]>([])
  const [tagGroups, setTagGroups] = useState<TagGroupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // New schedule form
  const [newClassId, setNewClassId] = useState('')
  const [newTagIds, setNewTagIds] = useState<string[]>([])
  const [newFrequency, setNewFrequency] = useState('daily')
  const [newPerDay, setNewPerDay] = useState(1)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTagIds, setEditTagIds] = useState<string[]>([])
  const [editFrequency, setEditFrequency] = useState('daily')
  const [editPerDay, setEditPerDay] = useState(1)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Load schedules with class names
    const { data: schedulesData } = await supabase
      .from('class_challenge_schedules')
      .select('*, classes(name)')
      .order('created_at', { ascending: false })

    const formatted = (schedulesData || []).map((s: any) => ({
      ...s,
      class_name: s.classes?.name || 'Unknown'
    }))
    setSchedules(formatted)

    // Load classes
    const { data: classesData } = await supabase
      .from('classes')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    setClasses(classesData || [])

    // Load tags
    const { data: tagsData } = await supabase
      .from('challenge_tags')
      .select('id, challenge_tag_names(language, name)')
      .order('created_at')
    const tagList = (tagsData || []).map((t: any) => {
      const en = t.challenge_tag_names?.find((n: any) => n.language === 'en')?.name
      const zh = t.challenge_tag_names?.find((n: any) => n.language === 'zh')?.name
      return { id: t.id, name: en || zh || t.id.slice(0, 8) }
    })
    setTags(tagList)

    // Load tag groups
    const { data: groupsData } = await supabase
      .from('tag_groups')
      .select('id, tag_group_names(language, name), tag_group_members(tag_id)')
      .order('created_at')
    const groupList = (groupsData || []).map((g: any) => {
      const en = g.tag_group_names?.find((n: any) => n.language === 'en')?.name
      const zh = g.tag_group_names?.find((n: any) => n.language === 'zh')?.name
      const tagIds = (g.tag_group_members || []).map((m: any) => m.tag_id)
      return { id: g.id, name: en || zh || 'Group', tag_ids: tagIds }
    })
    setTagGroups(groupList)

    setLoading(false)
  }

  async function createSchedule() {
    if (!newClassId) { setError('Select a class'); return }
    if (newTagIds.length === 0) { setError('Select at least one tag'); return }

    setCreating(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const { error: insertError } = await supabase
      .from('class_challenge_schedules')
      .insert({
        class_id: newClassId,
        tag_ids: newTagIds,
        frequency: newFrequency,
        challenges_per_day: newPerDay,
        created_by: user?.id
      })

    if (insertError) {
      setError(insertError.message)
    } else {
      setNewClassId('')
      setNewTagIds([])
      setNewFrequency('daily')
      setNewPerDay(1)
      await loadData()
    }
    setCreating(false)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase
      .from('class_challenge_schedules')
      .update({ is_active: !current })
      .eq('id', id)
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s))
  }

  async function deleteSchedule(id: string) {
    if (!confirm('Delete this schedule?')) return
    await supabase.from('class_challenge_schedules').delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
  }

  function startEdit(schedule: Schedule) {
    setEditingId(schedule.id)
    setEditTagIds([...schedule.tag_ids])
    setEditFrequency(schedule.frequency)
    setEditPerDay(schedule.challenges_per_day)
  }

  async function saveEdit(id: string) {
    await supabase
      .from('class_challenge_schedules')
      .update({ tag_ids: editTagIds, frequency: editFrequency, challenges_per_day: editPerDay })
      .eq('id', id)
    setEditingId(null)
    await loadData()
  }

  function toggleTag(tagId: string) {
    setNewTagIds(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <p className="text-gray-500">Loading schedules...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button onClick={() => router.push('/dashboard')} variant="ghost" size="sm">←</Button>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Challenge Scheduler</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Create new schedule */}
        <Card>
          <Card.Header>
            <Card.Title>Create Schedule</Card.Title>
            <p className="text-sm text-gray-600 mt-1">
              Auto-assign challenges from selected tags to a class on a recurring schedule.
            </p>
          </Card.Header>
          <Card.Body>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

            <div className="space-y-4">
              {/* Class */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={newClassId}
                  onChange={e => setNewClassId(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl bg-white"
                >
                  <option value="">Select a class...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (challenge pool)</label>
                {tagGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="text-xs text-gray-400 self-center mr-1">Groups:</span>
                    {tagGroups.map(group => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setNewTagIds(prev => [...new Set([...prev, ...group.tag_ids])])}
                        className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-xs hover:bg-blue-100 border border-blue-200"
                      >
                        📁 {group.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        newTagIds.includes(tag.id)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                  {tags.length === 0 && <p className="text-sm text-gray-400">No tags created yet. Go to Manage Tags first.</p>}
                </div>
              </div>

              {/* Frequency + per day */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select
                    value={newFrequency}
                    onChange={e => setNewFrequency(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl bg-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays only</option>
                    <option value="weekly">Weekly (Mondays)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Challenges per day</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={newPerDay}
                    onChange={e => setNewPerDay(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <Button onClick={createSchedule} disabled={creating} isLoading={creating}>
                + Create Schedule
              </Button>
            </div>
          </Card.Body>
        </Card>

        {/* Existing schedules */}
        <Card>
          <Card.Header>
            <Card.Title>Active Schedules ({schedules.filter(s => s.is_active).length})</Card.Title>
          </Card.Header>
          <Card.Body>
            {schedules.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No schedules yet.</p>
            ) : (
              <div className="space-y-3">
                {schedules.map(schedule => (
                  <div key={schedule.id} className={`p-4 rounded-xl border ${schedule.is_active ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    {editingId === schedule.id ? (
                      <div className="space-y-3">
                        <p className="font-medium text-gray-900">{schedule.class_name}</p>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Tags</label>
                          {tagGroups.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              <span className="text-xs text-gray-400 self-center mr-1">Groups:</span>
                              {tagGroups.map(group => (
                                <button
                                  key={group.id}
                                  type="button"
                                  onClick={() => setEditTagIds(prev => [...new Set([...prev, ...group.tag_ids])])}
                                  className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs hover:bg-blue-100 border border-blue-200"
                                >
                                  📁 {group.name}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {tags.map(tag => (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => setEditTagIds(prev => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium ${editTagIds.includes(tag.id) ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                              >
                                {tag.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Frequency</label>
                            <select value={editFrequency} onChange={e => setEditFrequency(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                              <option value="daily">Daily</option>
                              <option value="weekdays">Weekdays</option>
                              <option value="weekly">Weekly</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Per day</label>
                            <input type="number" min={1} max={5} value={editPerDay} onChange={e => setEditPerDay(parseInt(e.target.value) || 1)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(schedule.id)}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{schedule.class_name}</p>
                        <p className="text-sm text-gray-600">
                          {schedule.frequency} · {schedule.challenges_per_day}/day · {schedule.tag_ids.length} tag{schedule.tag_ids.length !== 1 ? 's' : ''}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {schedule.tag_ids.map(tid => {
                            const tag = tags.find(t => t.id === tid)
                            return <span key={tid} className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded-full text-xs">{tag?.name || tid.slice(0, 6)}</span>
                          })}
                        </div>
                        {schedule.last_assigned_at && (
                          <p className="text-xs text-gray-400 mt-1">Last ran: {new Date(schedule.last_assigned_at).toLocaleDateString()}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => startEdit(schedule)} className="text-sm text-primary-600 hover:text-primary-800">Edit</button>
                        <button
                          onClick={() => toggleActive(schedule.id, schedule.is_active)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${schedule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                        >
                          {schedule.is_active ? 'Active' : 'Paused'}
                        </button>
                        <button onClick={() => deleteSchedule(schedule.id)} className="text-sm text-red-500 hover:text-red-700">Delete</button>
                      </div>
                    </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>
      </main>
    </div>
  )
}
