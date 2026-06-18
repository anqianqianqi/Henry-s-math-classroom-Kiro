'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  visibility: string | null
  shop_item_id: string | null
  created_at: string
}

// ── Sandbox state for the AI generator ───────────────────────────────────────
interface SandboxState {
  imageUrl: string
  prompt: string      // accumulated full prompt history
  iteration: number
}

export default function PetRoomPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [backgrounds, setBackgrounds] = useState<PetRoomBackground[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // ── AI sandbox (generate + iterate before saving) ─────────────────────────
  const [genOpen, setGenOpen] = useState(false)
  const [genPrompt, setGenPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [sandbox, setSandbox] = useState<SandboxState | null>(null)
  // Refine within sandbox
  const [refinePrompt, setRefinePrompt] = useState('')
  // Save modal
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')
  const [saveSetDefault, setSaveSetDefault] = useState(false)
  const [savingDesign, setSavingDesign] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Upload ────────────────────────────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadSetDefault, setUploadSetDefault] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

  // ── Admin card actions ────────────────────────────────────────────────────
  const [actionBg, setActionBg] = useState<PetRoomBackground | null>(null)
  const [actionWorking, setActionWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [sellPrice, setSellPrice] = useState('')
  const [showSellInput, setShowSellInput] = useState(false)

  // Purchased room IDs for non-admin users (shows "🛒 Owned" badge)
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data: roles } = await supabase.from('user_roles').select('roles!inner(name)').eq('user_id', user.id).is('class_id', null)
      const admin = (roles as any[])?.some((r: any) => r.roles?.name === 'administrator' || r.roles?.name === 'teacher')
      setIsAdmin(!!admin)
      await loadBgs(user.id, !!admin)
      setLoading(false)
    }
    load()
  }, [])

  // Auto-open the correct panel if arriving from a hub card link
  useEffect(() => {
    if (loading) return
    const panel = searchParams?.get('panel')
    if (panel === 'generate') setGenOpen(true)
    if (panel === 'upload') setUploadOpen(true)
  }, [loading, searchParams])

  async function loadBgs(uid?: string, adminRole?: boolean) {
    const targetUid = uid ?? userId
    const effectiveAdmin = adminRole !== undefined ? adminRole : isAdmin
    if (effectiveAdmin) {
      const { data: bgs } = await supabase
        .from('pet_room_backgrounds')
        .select('*')
        .order('created_at', { ascending: false })
      setBackgrounds((bgs || []) as PetRoomBackground[])
      if (targetUid) {
        const { data: pref } = await supabase.from('user_pet_room').select('background_id').eq('user_id', targetUid).maybeSingle()
        if (pref?.background_id) setSelectedId(pref.background_id)
        else {
          const def = ((bgs || []) as PetRoomBackground[]).find(b => b.is_default && b.is_active)
          if (def) setSelectedId(def.id)
        }
      }
    } else {
      // Public active rooms
      const { data: bgs } = await supabase
        .from('pet_room_backgrounds')
        .select('*')
        .eq('is_active', true)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })

      // Rooms this user purchased via redemptions — only if still active
      // (deactivated rooms are hidden even for owners; private rooms still show for owners)
      const { data: purchased } = targetUid ? await supabase
        .from('redemptions')
        .select('pet_room_background_id, pet_room_backgrounds:pet_room_background_id(*)')
        .eq('user_id', targetUid)
        .is('refunded_at', null)
        .not('pet_room_background_id', 'is', null)
        : { data: [] }

      const publicIds = new Set((bgs ?? []).map((b: any) => b.id))
      const purchasedRows = (purchased ?? [])
        .map((r: any) => r.pet_room_backgrounds)
        .filter((b: any) => b && b.is_active && !publicIds.has(b.id))  // must be active + not already in public list

      const allBgs = [...(bgs ?? []), ...purchasedRows] as PetRoomBackground[]
      setBackgrounds(allBgs)
      setPurchasedIds(new Set(purchasedRows.map((b: any) => b.id)))

      if (targetUid) {
        const { data: pref } = await supabase.from('user_pet_room').select('background_id').eq('user_id', targetUid).maybeSingle()
        if (pref?.background_id) {
          setSelectedId(pref.background_id)
        } else {
          const def = allBgs.find(b => b.is_default && b.is_active)
          if (def) setSelectedId(def.id)
        }
      }
    }
  }

  // ── Generate (sandbox) ────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!genPrompt.trim()) { setGenError('Enter a room description.'); return }
    setGenError(null); setGenerating(true)
    try {
      const res = await fetch('/api/preview-pet-room', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: genPrompt.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setSandbox({ imageUrl: data.image_url, prompt: data.prompt, iteration: 1 })
      setRefinePrompt('')
    } catch (err: any) { setGenError(err.message) }
    finally { setGenerating(false) }
  }

  // ── Refine within sandbox ─────────────────────────────────────────────────
  async function handleRefine() {
    if (!sandbox || !refinePrompt.trim()) return
    setGenError(null); setGenerating(true)
    try {
      const res = await fetch('/api/preview-pet-room', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: sandbox.prompt, sourceImageUrl: sandbox.imageUrl, changePrompt: refinePrompt.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setSandbox({ imageUrl: data.image_url, prompt: data.prompt, iteration: sandbox.iteration + 1 })
      setRefinePrompt('')
    } catch (err: any) { setGenError(err.message) }
    finally { setGenerating(false) }
  }

  // ── Save sandbox to collection ────────────────────────────────────────────
  async function handleSaveDesign() {
    if (!sandbox || !saveName.trim()) { setSaveError('Enter a name.'); return }
    setSaveError(null); setSavingDesign(true)
    try {
      if (saveSetDefault) await supabase.from('pet_room_backgrounds').update({ is_default: false }).eq('is_default', true)
      const { error: insertErr } = await supabase.from('pet_room_backgrounds').insert({
        name: saveName.trim(), description: saveDesc.trim() || null,
        image_url: sandbox.imageUrl, prompt: sandbox.prompt,
        is_default: saveSetDefault, is_active: true, visibility: 'admin_only', created_by: userId,
        frame_slots: [{ id: 'wall_frame', x: 60, y: 6, w: 20, h: 30, z_index: 2, label: 'Wall Picture', default_image_url: null }],
      })
      if (insertErr) throw new Error(insertErr.message)
      setSaveOpen(false); setSaveName(''); setSaveDesc(''); setSaveSetDefault(false)
      setSandbox(null); setGenPrompt(''); setGenOpen(false)
      await loadBgs(userId ?? undefined, isAdmin)
    } catch (err: any) { setSaveError(err.message) }
    finally { setSavingDesign(false) }
  }

  // ── Upload custom image ───────────────────────────────────────────────────
  async function handleUpload() {
    if (!uploadFile || !uploadName.trim()) { setUploadError('Choose an image and enter a name.'); return }
    setUploadError(null); setUploading(true)
    try {
      const fileName = `${userId}/pet-room-upload-${Date.now()}`
      const { error: storageErr } = await supabase.storage.from('challenge-images').upload(fileName, uploadFile, { contentType: uploadFile.type, upsert: false })
      if (storageErr) throw new Error('Upload failed: ' + storageErr.message)
      const { data: { publicUrl } } = supabase.storage.from('challenge-images').getPublicUrl(fileName)
      if (uploadSetDefault) await supabase.from('pet_room_backgrounds').update({ is_default: false }).eq('is_default', true)
      const { error: insertErr } = await supabase.from('pet_room_backgrounds').insert({
        name: uploadName.trim(), description: uploadDesc.trim() || null, image_url: publicUrl,
        is_default: uploadSetDefault, is_active: true, visibility: 'admin_only', created_by: userId,
        frame_slots: [{ id: 'wall_frame', x: 60, y: 6, w: 20, h: 30, z_index: 2, label: 'Wall Picture', default_image_url: null }],
      })
      if (insertErr) throw new Error(insertErr.message)
      setUploadSuccess(`✅ "${uploadName.trim()}" uploaded!`)
      setUploadFile(null); setUploadName(''); setUploadDesc(''); setUploadSetDefault(false)
      await loadBgs(userId ?? undefined, isAdmin)
    } catch (err: any) { setUploadError(err.message) }
    finally { setUploading(false) }
  }

  // ── Select room (user action) ─────────────────────────────────────────────
  async function handleSelect(bgId: string) {
    if (!userId || saving) return
    setSaving(true); setSelectedId(bgId)
    await supabase.from('user_pet_room').upsert({ user_id: userId, background_id: bgId }, { onConflict: 'user_id' })
    setSaving(false)
  }

  // ── Admin card actions ────────────────────────────────────────────────────
  async function adminAction(bg: PetRoomBackground, action: 'set_default' | 'make_public' | 'make_private' | 'toggle_active' | 'delete' | 'sell') {
    setActionWorking(true); setActionError(null)
    try {
      if (action === 'set_default') {
        await supabase.from('pet_room_backgrounds').update({ is_default: false }).eq('is_default', true)
        await supabase.from('pet_room_backgrounds').update({ is_default: true }).eq('id', bg.id)
      } else if (action === 'make_public') {
        await supabase.from('pet_room_backgrounds').update({ visibility: 'public' }).eq('id', bg.id)
      } else if (action === 'make_private') {
        await supabase.from('pet_room_backgrounds').update({ visibility: 'admin_only' }).eq('id', bg.id)
      } else if (action === 'toggle_active') {
        await supabase.from('pet_room_backgrounds').update({ is_active: !bg.is_active }).eq('id', bg.id)
      } else if (action === 'delete') {
        if (!confirm(`Delete "${bg.name}"? This cannot be undone.`)) { setActionWorking(false); return }
        await supabase.from('pet_room_backgrounds').delete().eq('id', bg.id)
        setActionBg(null)
      } else if (action === 'sell') {
        const price = parseInt(sellPrice, 10)
        if (isNaN(price) || price < 1) { setActionError('Enter a valid price.'); setActionWorking(false); return }
        const { data: newItem, error: itemErr } = await supabase.from('shop_items').insert({
          title: bg.name, description: bg.description || 'Pet room background', cost: price,
          image_url: bg.image_url, is_active: true, created_by: userId,
          category: 'other', commodity_type: 'standard', draws_per_redemption: 1,
        }).select('id').single()
        if (itemErr || !newItem) throw new Error('Shop item creation failed')
        await supabase.from('pet_room_backgrounds').update({ shop_item_id: newItem.id, visibility: 'public' }).eq('id', bg.id)
        setShowSellInput(false); setSellPrice('')
      }
      await loadBgs(userId ?? undefined, isAdmin)
      // Refresh actionBg with updated data
      const updated = backgrounds.find(b => b.id === bg.id)
      if (updated && action !== 'delete') {
        const { data: fresh } = await supabase.from('pet_room_backgrounds').select('*').eq('id', bg.id).single()
        if (fresh) setActionBg(fresh as PetRoomBackground)
      }
    } catch (err: any) { setActionError(err.message) }
    finally { setActionWorking(false) }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>
  }

  const visibleBgs = isAdmin ? backgrounds : backgrounds.filter(b => b.is_active)

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <PageHeader breadcrumbs={[{ label: 'Decorations', href: '/decorations' }, { label: 'Pet Room' }]} />
      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-500 mb-6">Choose a room background for your pet on the dashboard.</p>

        {/* ── Admin tools ──────────────────────────────────────────────────── */}
        {isAdmin && (
          <div className="mb-8 space-y-4">

            {/* Generate with AI — sandbox mode */}
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 overflow-hidden">
              <button className="w-full flex items-center justify-between px-5 py-4 text-left" onClick={() => setGenOpen(v => !v)}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✨</span>
                  <div>
                    <div className="font-bold text-amber-800">Generate Room with AI</div>
                    <div className="text-xs text-amber-600">Iterate until happy, then save — auto 1536×1024 landscape</div>
                  </div>
                </div>
                <span className="text-amber-600 font-bold text-lg">{genOpen ? '▲' : '▼'}</span>
              </button>

              {genOpen && (
                <div className="border-t border-amber-200 px-5 pb-5 space-y-4">
                  {genError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
                      <span>{genError}</span><button onClick={() => setGenError(null)} className="font-bold ml-3">✕</button>
                    </div>
                  )}

                  {/* Before first generation */}
                  {!sandbox && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-amber-800 mb-1">
                          Describe the room *
                          <span className="font-normal text-amber-500 ml-1">— composition rules added automatically</span>
                        </label>
                        <textarea value={genPrompt} onChange={e => setGenPrompt(e.target.value)}
                          placeholder="e.g. a cozy anime bedroom at night, moonlight through the window, bookshelves, warm lamp, picture frame on the wall"
                          rows={3} className="w-full px-3 py-2 border-2 border-amber-200 rounded-xl text-sm focus:border-amber-400 bg-white resize-none" />
                        <p className="text-xs text-amber-500 mt-1">💡 I'll add: 1536×1024 landscape, clear lower-centre for pet, wall frame, anime/Ghibli style.</p>
                      </div>
                      <button onClick={handleGenerate} disabled={generating || !genPrompt.trim()}
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-semibold rounded-xl text-sm transition-colors">
                        {generating ? '⏳ Generating… (~15s)' : '🎨 Generate Room'}
                      </button>
                    </div>
                  )}

                  {/* Sandbox — image preview + iterate */}
                  {sandbox && (
                    <div className="mt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-700">Iteration #{sandbox.iteration}</span>
                        <button onClick={() => { setSandbox(null); setGenPrompt(''); setRefinePrompt('') }}
                          className="text-xs text-gray-400 hover:text-gray-600">✕ Start over</button>
                      </div>

                      {/* Preview */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sandbox.imageUrl} alt="Preview" className="w-full rounded-xl border border-amber-200 cursor-zoom-in"
                        onClick={() => setLightbox(sandbox.imageUrl)} />

                      {/* Prompt history */}
                      <details className="text-xs text-amber-600">
                        <summary className="cursor-pointer font-semibold">📜 Prompt history</summary>
                        <pre className="mt-1 whitespace-pre-wrap bg-amber-50 rounded-lg p-2 text-xs text-amber-700 border border-amber-200">{sandbox.prompt}</pre>
                      </details>

                      {/* Refine input */}
                      <div>
                        <label className="block text-xs font-semibold text-amber-800 mb-1">What to change?</label>
                        <div className="flex gap-2">
                          <input type="text" value={refinePrompt} onChange={e => setRefinePrompt(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !generating && refinePrompt.trim() && handleRefine()}
                            placeholder="e.g. make it a night scene with stars visible through the window"
                            className="flex-1 px-3 py-2 border-2 border-amber-200 rounded-xl text-sm focus:border-amber-400 bg-white" />
                          <button onClick={handleRefine} disabled={generating || !refinePrompt.trim()}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-semibold rounded-xl text-sm transition-colors whitespace-nowrap">
                            {generating ? '⏳' : '✨ Refine'}
                          </button>
                        </div>
                      </div>

                      {/* Save design */}
                      <button onClick={() => { setSaveName(''); setSaveDesc(''); setSaveOpen(true); setSaveError(null) }}
                        className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-colors">
                        💾 Save Design to Collection
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Upload custom image */}
            <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 overflow-hidden">
              <button className="w-full flex items-center justify-between px-5 py-4 text-left" onClick={() => setUploadOpen(v => !v)}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📸</span>
                  <div>
                    <div className="font-bold text-gray-800">Upload Custom Image</div>
                    <div className="text-xs text-gray-500">Recommend 1536×1024 landscape</div>
                  </div>
                </div>
                <span className="text-gray-500 font-bold text-lg">{uploadOpen ? '▲' : '▼'}</span>
              </button>
              {uploadOpen && (
                <div className="border-t border-gray-200 px-5 pb-5 mt-4 space-y-3">
                  {uploadError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{uploadError}</div>}
                  {uploadSuccess && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{uploadSuccess}</div>}
                  <input type="text" value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="Room name *" className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm bg-white" />
                  <input type="text" value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} placeholder="Description (optional)" className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm bg-white" />
                  <input type="file" accept="image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-600" />
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
                    <input type="checkbox" checked={uploadSetDefault} onChange={e => setUploadSetDefault(e.target.checked)} className="accent-amber-600" />
                    Set as default
                  </label>
                  <button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadName.trim()}
                    className="w-full py-2.5 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-300 text-white font-semibold rounded-xl text-sm">
                    {uploading ? '⏳ Uploading…' : '⬆️ Upload'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Room collection ───────────────────────────────────────────── */}
        {visibleBgs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🏠</div>
            <p className="font-medium">No room backgrounds available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {visibleBgs.map(bg => {
              const isSelected = selectedId === bg.id
              const isPublic = bg.visibility === 'public'
              const isInactive = !bg.is_active
              const isOwned = purchasedIds.has(bg.id)
              return (
                <div key={bg.id}
                  onClick={() => !isInactive && handleSelect(bg.id)}
                  className={`relative rounded-2xl overflow-hidden border-4 transition-all ${isInactive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'border-primary-500 shadow-lg shadow-primary-200' : 'border-transparent hover:border-primary-300 hover:shadow-md'}`}>
                  <div className="relative aspect-[16/9] bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bg.image_url} alt={bg.name} className="w-full h-full object-cover"
                      onClick={e => { e.stopPropagation(); setLightbox(bg.image_url) }} />
                    {isInactive && <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center"><span className="text-white text-xs font-bold bg-gray-800/70 px-2 py-1 rounded">Inactive</span></div>}
                    {!isPublic && isAdmin && <div className="absolute top-2 left-2 text-xs bg-gray-800/70 text-white px-2 py-0.5 rounded font-semibold">🔒 Admin only</div>}
                    {isOwned && !isAdmin && <div className="absolute top-2 left-2 text-xs bg-purple-600/80 text-white px-2 py-0.5 rounded font-semibold">🛒 Owned</div>}
                  </div>
                  <div className={`px-4 py-3 flex items-center justify-between ${isSelected ? 'bg-primary-50' : 'bg-white'}`}>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{bg.name}</p>
                      {bg.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{bg.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {isSelected && <span className="text-xs font-bold text-primary-600 bg-primary-100 px-2 py-1 rounded-full">✓ Active</span>}
                      {bg.is_default && !isSelected && !isOwned && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Default</span>}
                      {isAdmin && (
                        <button onClick={e => { e.stopPropagation(); setActionBg(bg); setActionError(null); setShowSellInput(false); setSellPrice('') }}
                          className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 font-semibold transition-colors">
                          ⚙️ Manage
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {saving && <div className="fixed bottom-6 right-6 bg-primary-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">Saving…</div>}
      </main>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Room preview" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl select-none" onClick={e => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl" onClick={() => setLightbox(null)}>×</button>
        </div>
      )}

      {/* ── Save Design modal ──────────────────────────────────────────────── */}
      {saveOpen && sandbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !savingDesign && setSaveOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="font-bold text-gray-900">💾 Save Design to Collection</div>
              <button onClick={() => !savingDesign && setSaveOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-light">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {saveError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{saveError}</div>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sandbox.imageUrl} alt="Preview" className="w-full rounded-xl border border-gray-200 aspect-[3/2] object-cover" />
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Room Name *</label>
                <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} autoFocus
                  placeholder='e.g. "Cozy Night Library"'
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-green-400 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description (optional)</label>
                <input type="text" value={saveDesc} onChange={e => setSaveDesc(e.target.value)}
                  placeholder="Short description shown to users"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm bg-white" />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={saveSetDefault} onChange={e => setSaveSetDefault(e.target.checked)} className="accent-green-600" />
                Set as default room for new users
              </label>
              <p className="text-xs text-gray-400">Saved as <strong>admin-only</strong> initially. Use the ⚙️ Manage button to make it public or sell in shop.</p>
              <div className="flex gap-3">
                <button onClick={() => setSaveOpen(false)} disabled={savingDesign} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold rounded-xl text-sm">Cancel</button>
                <button onClick={handleSaveDesign} disabled={savingDesign || !saveName.trim()} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold rounded-xl text-sm">
                  {savingDesign ? '⏳ Saving…' : '💾 Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Manage modal ─────────────────────────────────────────────── */}
      {actionBg && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => !actionWorking && setActionBg(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <div className="font-bold text-gray-900">⚙️ {actionBg.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {actionBg.visibility === 'public' ? '👥 Public' : '🔒 Admin only'}
                  {actionBg.is_default ? ' · ⭐ Default' : ''}
                  {!actionBg.is_active ? ' · ❌ Inactive' : ''}
                  {actionBg.shop_item_id ? ' · 🛍️ In shop' : ''}
                </div>
              </div>
              <button onClick={() => !actionWorking && setActionBg(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-light">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {actionError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{actionError}</div>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={actionBg.image_url} alt={actionBg.name} className="w-full rounded-xl border border-gray-200 aspect-[3/2] object-cover" />

              <div className="grid grid-cols-2 gap-2">
                {/* Set default */}
                <button onClick={() => adminAction(actionBg, 'set_default')} disabled={actionWorking || actionBg.is_default}
                  className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-colors">
                  {actionBg.is_default ? '⭐ Is Default' : 'Set default'}
                </button>

                {/* Public/private toggle */}
                {actionBg.visibility === 'public' ? (
                  <button onClick={() => adminAction(actionBg, 'make_private')} disabled={actionWorking}
                    className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                    🔒 Make private
                  </button>
                ) : (
                  <button onClick={() => adminAction(actionBg, 'make_public')} disabled={actionWorking}
                    className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                    👥 Make public
                  </button>
                )}

                {/* Deactivate/activate */}
                <button onClick={() => adminAction(actionBg, 'toggle_active')} disabled={actionWorking}
                  className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  {actionBg.is_active ? 'Deactivate' : 'Activate'}
                </button>

                {/* Sell in shop */}
                {!actionBg.shop_item_id ? (
                  <button onClick={() => setShowSellInput(v => !v)} disabled={actionWorking}
                    className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-colors">
                    🛍️ Sell in shop
                  </button>
                ) : (
                  <button onClick={async () => {
                    if (!confirm('Remove from shop?')) return
                    setActionWorking(true)
                    await supabase.from('shop_items').update({ is_active: false }).eq('id', actionBg.shop_item_id!)
                    await supabase.from('pet_room_backgrounds').update({ shop_item_id: null }).eq('id', actionBg.id)
                    await loadBgs(userId ?? undefined, isAdmin)
                    const { data: fresh } = await supabase.from('pet_room_backgrounds').select('*').eq('id', actionBg.id).single()
                    if (fresh) setActionBg(fresh as PetRoomBackground)
                    setActionWorking(false)
                  }} disabled={actionWorking}
                    className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                    🛍️ In shop ✓
                  </button>
                )}

                {/* Delete */}
                <button onClick={() => adminAction(actionBg, 'delete')} disabled={actionWorking}
                  className="py-2 px-3 rounded-xl text-sm font-semibold border-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors col-span-2">
                  🗑️ Delete
                </button>
              </div>

              {/* Sell price input */}
              {showSellInput && (
                <div className="flex gap-2">
                  <input type="number" min={1} value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                    placeholder="Price (points)" className="flex-1 px-3 py-2 border-2 border-amber-200 rounded-xl text-sm bg-white" />
                  <button onClick={() => adminAction(actionBg, 'sell')} disabled={actionWorking || !sellPrice}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-semibold rounded-xl text-sm">
                    {actionWorking ? '⏳' : 'List'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
