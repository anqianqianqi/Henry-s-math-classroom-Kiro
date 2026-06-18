'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'

interface PetRoomBackground {
  id: string
  name: string
  description: string | null
  image_url: string
  is_default: boolean
  is_active: boolean
  created_at: string
}

export default function PetRoomPage() {
  const router = useRouter()
  const supabase = createClient()

  const [backgrounds, setBackgrounds] = useState<PetRoomBackground[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Load available backgrounds
      const { data: bgs } = await supabase
        .from('pet_room_backgrounds')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setBackgrounds(bgs || [])

      // Load user's current selection
      const { data: pref } = await supabase
        .from('user_pet_room')
        .select('background_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (pref?.background_id) {
        setSelectedId(pref.background_id)
      } else {
        // Default to the first default background
        const defaultBg = (bgs || []).find(b => b.is_default)
        if (defaultBg) setSelectedId(defaultBg.id)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSelect(bgId: string) {
    if (!userId || saving) return
    setSaving(true)
    setSelectedId(bgId)
    await supabase
      .from('user_pet_room')
      .upsert({ user_id: userId, background_id: bgId }, { onConflict: 'user_id' })
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <PageHeader
        breadcrumbs={[
          { label: 'Decorations', href: '/decorations' },
          { label: 'Pet Room' },
        ]}
      />

      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500 mb-6">Choose a room background for your pet on the dashboard.</p>

        {backgrounds.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🏠</div>
            <p className="font-medium">No room backgrounds available yet.</p>
            <p className="text-sm mt-1">Check back soon — new rooms will be added!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {backgrounds.map(bg => {
              const isSelected = selectedId === bg.id
              return (
                <div
                  key={bg.id}
                  onClick={() => handleSelect(bg.id)}
                  className={`relative rounded-2xl overflow-hidden cursor-pointer border-4 transition-all ${
                    isSelected
                      ? 'border-primary-500 shadow-lg shadow-primary-200'
                      : 'border-transparent hover:border-primary-300 hover:shadow-md'
                  }`}
                >
                  {/* Preview image */}
                  <div className="relative aspect-[16/9] bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bg.image_url}
                      alt={bg.name}
                      className="w-full h-full object-cover"
                      onClick={e => { e.stopPropagation(); setLightbox(bg.image_url) }}
                    />
                    {/* Zoom hint */}
                    <div className="absolute top-2 right-2 bg-black/40 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none">
                      🔍 Click to zoom
                    </div>
                  </div>

                  {/* Info bar */}
                  <div className={`px-4 py-3 flex items-center justify-between ${isSelected ? 'bg-primary-50' : 'bg-white'}`}>
                    <div>
                      <p className="font-semibold text-gray-900">{bg.name}</p>
                      {bg.description && <p className="text-xs text-gray-500 mt-0.5">{bg.description}</p>}
                    </div>
                    {isSelected && (
                      <span className="text-xs font-bold text-primary-600 bg-primary-100 px-2 py-1 rounded-full">
                        ✓ Active
                      </span>
                    )}
                    {bg.is_default && !isSelected && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Default</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {saving && (
          <div className="fixed bottom-6 right-6 bg-primary-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">
            Saving…
          </div>
        )}
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Room preview"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl select-none"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl"
            onClick={() => setLightbox(null)}
          >×</button>
        </div>
      )}
    </div>
  )
}
