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
  prompt: string | null
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
  const [isAdmin, setIsAdmin] = useState(false)

  // Admin: generate with AI
  const [genOpen, setGenOpen] = useState(false)
  const [genPrompt, setGenPrompt] = useState('')
  const [genName, setGenName] = useState('')
  const [genDesc, setGenDesc] = useState('')
  const [genSetDefault, setGenSetDefault] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [genSuccess, setGenSuccess] = useState<string | null>(null)

  // Admin: upload image
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadSetDefault, setUploadSetDefault] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

  // Admin: refine existing room
  const [refineTarget, setRefineTarget] = useState<PetRoomBackground | null>(null)
  const [refineChangePrompt, setRefineChangePrompt] = useState('')
  const [refineName, setRefineName] = useState('')
  const [refineDesc, setRefineDesc] = useState('')
  const [refineSetDefault, setRefineSetDefault] = useState(false)
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)
  const [refineSuccess, setRefineSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Check admin/teacher role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('roles!inner(name)')
        .eq('user_id', user.id)
        .is('class_id', null)
      const admin = (roles as any[])?.some((r: any) => r.roles?.name === 'administrator' || r.roles?.name === 'teacher')
      setIsAdmin(!!admin)

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

  async function refreshBackgrounds() {
    const { data: bgs } = await supabase
      .from('pet_room_backgrounds')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setBackgrounds(bgs || [])
  }

  async function handleGenerate() {
    if (!genPrompt.trim() || !genName.trim()) {
      setGenError('Please enter a name and a description for the room.')
      return
    }
    setGenError(null)
    setGenSuccess(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-pet-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: genPrompt.trim(),
          name: genName.trim(),
          description: genDesc.trim() || undefined,
          setDefault: genSetDefault,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      setGenSuccess(`✅ "${data.name}" generated and added to the room list!`)
      setGenPrompt(''); setGenName(''); setGenDesc(''); setGenSetDefault(false)
      await refreshBackgrounds()
    } catch (err: any) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleUpload() {
    if (!uploadFile || !uploadName.trim()) {
      setUploadError('Please choose an image and enter a name.')
      return
    }
    setUploadError(null)
    setUploadSuccess(null)
    setUploading(true)
    try {
      const fileName = `pet-room-bg-${Date.now()}.png`
      const { error: storageErr } = await supabase.storage
        .from('challenge-images')
        .upload(fileName, uploadFile, { contentType: uploadFile.type, upsert: false })
      if (storageErr) throw new Error('Storage upload failed: ' + storageErr.message)
      const { data: { publicUrl } } = supabase.storage.from('challenge-images').getPublicUrl(fileName)

      if (uploadSetDefault) {
        await supabase.from('pet_room_backgrounds').update({ is_default: false }).eq('is_default', true)
      }

      const { error: insertErr } = await supabase
        .from('pet_room_backgrounds')
        .insert({
          name: uploadName.trim(),
          description: uploadDesc.trim() || null,
          image_url: publicUrl,
          is_default: uploadSetDefault,
          is_active: true,
          created_by: userId,
          frame_slots: [{ id: 'wall_frame', x: 60, y: 6, w: 20, h: 30, z_index: 2, label: 'Wall Picture', default_image_url: null }],
        })
      if (insertErr) throw new Error('DB insert failed: ' + insertErr.message)

      setUploadSuccess(`✅ "${uploadName.trim()}" uploaded!`)
      setUploadFile(null); setUploadName(''); setUploadDesc(''); setUploadSetDefault(false)
      await refreshBackgrounds()
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleRefine() {
    if (!refineTarget) return
    if (!refineChangePrompt.trim()) { setRefineError('Describe what to change.'); return }
    if (!refineName.trim()) { setRefineError('Enter a name for the refined version.'); return }
    setRefineError(null); setRefineSuccess(null); setRefining(true)
    try {
      const res = await fetch('/api/refine-pet-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: refineTarget.id,
          changePrompt: refineChangePrompt.trim(),
          name: refineName.trim(),
          description: refineDesc.trim() || undefined,
          setDefault: refineSetDefault,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      setRefineSuccess(`✅ "${data.name}" refined and added!`)
      setRefineChangePrompt(''); setRefineName(''); setRefineDesc(''); setRefineSetDefault(false)
      setRefineTarget(null)
      await refreshBackgrounds()
    } catch (err: any) {
      setRefineError(err.message)
    } finally {
      setRefining(false)
    }
  }

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

        {/* ── Admin: Generate / Upload section ────────────────────────────── */}
        {isAdmin && (
          <div className="mb-8 space-y-4">
            {/* Generate with AI */}
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                onClick={() => setGenOpen(v => !v)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✨</span>
                  <div>
                    <div className="font-bold text-amber-800">Generate Room with AI</div>
                    <div className="text-xs text-amber-600">
                      Describe a room — image is auto-generated at <strong>1536×1024</strong> (landscape, fits the pet area perfectly)
                    </div>
                  </div>
                </div>
                <span className="text-amber-600 font-bold text-lg">{genOpen ? '▲' : '▼'}</span>
              </button>

              {genOpen && (
                <div className="px-5 pb-5 space-y-3 border-t border-amber-200">
                  {genError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
                      <span>{genError}</span>
                      <button onClick={() => setGenError(null)} className="font-bold ml-3">✕</button>
                    </div>
                  )}
                  {genSuccess && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex justify-between">
                      <span>{genSuccess}</span>
                      <button onClick={() => setGenSuccess(null)} className="font-bold ml-3">✕</button>
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-amber-800 mb-1">Room Name *</label>
                    <input
                      type="text"
                      value={genName}
                      onChange={e => setGenName(e.target.value)}
                      placeholder='e.g. "Night Library"'
                      className="w-full px-3 py-2 border-2 border-amber-200 rounded-xl text-sm focus:border-amber-400 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-800 mb-1">
                      Describe the room *
                      <span className="font-normal text-amber-500 ml-1">— pet area composition rules are added automatically</span>
                    </label>
                    <textarea
                      value={genPrompt}
                      onChange={e => setGenPrompt(e.target.value)}
                      placeholder="e.g. a cozy anime bedroom at night, moonlight through the window, bookshelves, warm lamp, a picture frame on the wall"
                      rows={3}
                      className="w-full px-3 py-2 border-2 border-amber-200 rounded-xl text-sm focus:border-amber-400 bg-white resize-none"
                    />
                    <p className="text-xs text-amber-500 mt-1">
                      💡 I'll automatically add: landscape orientation (1536×1024), clear lower-centre for the pet, wall frame placeholder, anime/Ghibli style.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-800 mb-1">Description (optional)</label>
                    <input
                      type="text"
                      value={genDesc}
                      onChange={e => setGenDesc(e.target.value)}
                      placeholder="Short description shown to users"
                      className="w-full px-3 py-2 border-2 border-amber-200 rounded-xl text-sm focus:border-amber-400 bg-white"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-amber-800">
                    <input type="checkbox" checked={genSetDefault} onChange={e => setGenSetDefault(e.target.checked)} className="accent-amber-600" />
                    Set as default room for new users
                  </label>

                  <button
                    onClick={handleGenerate}
                    disabled={generating || !genPrompt.trim() || !genName.trim()}
                    className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-semibold rounded-xl text-sm transition-colors"
                  >
                    {generating ? '⏳ Generating… (may take ~15s)' : '🎨 Generate Room Image'}
                  </button>
                </div>
              )}
            </div>

            {/* Upload image */}
            <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                onClick={() => setUploadOpen(v => !v)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📸</span>
                  <div>
                    <div className="font-bold text-gray-800">Upload Custom Image</div>
                    <div className="text-xs text-gray-500">Upload your own room background (recommend 1536×1024 or any landscape image)</div>
                  </div>
                </div>
                <span className="text-gray-500 font-bold text-lg">{uploadOpen ? '▲' : '▼'}</span>
              </button>

              {uploadOpen && (
                <div className="px-5 pb-5 space-y-3 border-t border-gray-200">
                  {uploadError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
                      <span>{uploadError}</span>
                      <button onClick={() => setUploadError(null)} className="font-bold ml-3">✕</button>
                    </div>
                  )}
                  {uploadSuccess && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex justify-between">
                      <span>{uploadSuccess}</span>
                      <button onClick={() => setUploadSuccess(null)} className="font-bold ml-3">✕</button>
                    </div>
                  )}
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Room Name *</label>
                    <input type="text" value={uploadName} onChange={e => setUploadName(e.target.value)}
                      placeholder='e.g. "Cherry Blossom Room"'
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Description (optional)</label>
                    <input type="text" value={uploadDesc} onChange={e => setUploadDesc(e.target.value)}
                      placeholder="Short description"
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Image *</label>
                    <input type="file" accept="image/*"
                      onChange={e => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full text-sm text-gray-600" />
                    <p className="text-xs text-gray-400 mt-1">Recommended: 1536×1024px landscape. Any size works — it will be scaled to cover.</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-gray-700">
                    <input type="checkbox" checked={uploadSetDefault} onChange={e => setUploadSetDefault(e.target.checked)} className="accent-amber-600" />
                    Set as default room for new users
                  </label>
                  <button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadName.trim()}
                    className="w-full py-2.5 px-4 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-300 text-white font-semibold rounded-xl text-sm transition-colors">
                    {uploading ? '⏳ Uploading…' : '⬆️ Upload Room Image'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {isAdmin && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setRefineTarget(bg)
                            setRefineName(bg.name + ' v2')
                            setRefineDesc(bg.description || '')
                            setRefineChangePrompt('')
                            setRefineError(null)
                            setRefineSuccess(null)
                          }}
                          className="text-xs px-2 py-1 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 font-semibold transition-colors"
                          title="Refine this image with AI"
                        >
                          ✏️ Refine
                        </button>
                      )}
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

      {/* Refine modal — shown when admin clicks ✏️ Refine on a room card */}
      {refineTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
          onClick={() => !refining && setRefineTarget(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <div className="font-bold text-gray-900">✏️ Refine: {refineTarget.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">Creates a new room based on the existing image — original is preserved</div>
              </div>
              <button onClick={() => !refining && setRefineTarget(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-light">×</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {refineError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
                  <span>{refineError}</span>
                  <button onClick={() => setRefineError(null)} className="font-bold ml-3">✕</button>
                </div>
              )}
              {refineSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex justify-between">
                  <span>{refineSuccess}</span>
                  <button onClick={() => setRefineSuccess(null)} className="font-bold ml-3">✕</button>
                </div>
              )}

              {/* Source image thumbnail */}
              <div className="flex gap-3 items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={refineTarget.image_url} alt={refineTarget.name}
                  className="w-24 h-16 object-cover rounded-lg border border-gray-200 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-700">Source: {refineTarget.name}</p>
                  {refineTarget.prompt && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">Original prompt: {refineTarget.prompt}</p>
                  )}
                </div>
              </div>

              {/* What to change */}
              <div>
                <label className="block text-xs font-semibold text-purple-800 mb-1">
                  What to change *
                </label>
                <textarea
                  value={refineChangePrompt}
                  onChange={e => setRefineChangePrompt(e.target.value)}
                  placeholder="e.g. make the lighting warmer with soft candlelight, add a cat sitting on the bookshelf, change the window view to a night sky with stars"
                  rows={3}
                  className="w-full px-3 py-2 border-2 border-purple-200 rounded-xl text-sm focus:border-purple-400 bg-white resize-none"
                  autoFocus
                />
                <p className="text-xs text-purple-400 mt-1">
                  💡 Be specific. The model uses the existing image as context and applies only what you describe.
                </p>
              </div>

              {/* Name for new version */}
              <div>
                <label className="block text-xs font-semibold text-purple-800 mb-1">Name for refined version *</label>
                <input type="text" value={refineName} onChange={e => setRefineName(e.target.value)}
                  placeholder='e.g. "Cozy Room — Candlelight"'
                  className="w-full px-3 py-2 border-2 border-purple-200 rounded-xl text-sm focus:border-purple-400 bg-white" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-purple-800 mb-1">Description (optional)</label>
                <input type="text" value={refineDesc} onChange={e => setRefineDesc(e.target.value)}
                  placeholder="Short description shown to users"
                  className="w-full px-3 py-2 border-2 border-purple-200 rounded-xl text-sm focus:border-purple-400 bg-white" />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-purple-800">
                <input type="checkbox" checked={refineSetDefault} onChange={e => setRefineSetDefault(e.target.checked)} className="accent-purple-600" />
                Set refined version as default
              </label>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setRefineTarget(null)} disabled={refining}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold rounded-xl text-sm transition-colors">
                  Cancel
                </button>
                <button onClick={handleRefine} disabled={refining || !refineChangePrompt.trim() || !refineName.trim()}
                  className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-xl text-sm transition-colors">
                  {refining ? '⏳ Refining… (~15s)' : '✨ Apply Refinement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
