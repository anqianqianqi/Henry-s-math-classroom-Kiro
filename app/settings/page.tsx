'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Card } from '@/components/ui/Card'
import NotificationPreferences from '@/components/NotificationPreferences'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      router.push('/login')
      return
    }

    setUser(user)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('id', user.id)
      .single()

    console.log('Settings - profile:', profile, 'error:', profileError)

    if (profile) {
      setProfile(profile)
      // Try to get nickname separately (column may not exist yet)
      const { data: nicknameData } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single()
      setNickname((nicknameData as any)?.nickname || '')
    }

    setLoading(false)
  }

  async function saveNickname() {
    if (!user) return
    setSaving(true)
    setSaveMsg('')

    const { error } = await supabase
      .from('profiles')
      .update({ nickname: nickname.trim() || null })
      .eq('id', user.id)

    setSaving(false)
    setSaveMsg(error ? 'Failed to save' : 'Saved!')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚙️</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button onClick={() => router.push('/dashboard')} variant="ghost" size="sm">
              ←
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl">⚙️</span>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold">👤 Profile</h2>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Full Name</p>
                <p className="text-gray-900">{profile?.full_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="text-gray-900">{profile?.email}</p>
              </div>
              <FormField
                label="Nickname (shown to classmates)"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Johnny"
                helperText="Optional — displayed instead of your full name to other students"
              />
              <div className="flex items-center gap-3">
                <Button onClick={saveNickname} isLoading={saving} size="sm">
                  Save Nickname
                </Button>
                {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
              </div>
            </div>
          </Card.Body>
        </Card>

        <NotificationPreferences />
      </main>
    </div>
  )
}
