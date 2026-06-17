'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HomeButton } from '@/components/ui/HomeButton'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface BookSkin {
  id: string
  name: string
  description: string | null
  skin_type: 'cover' | 'page'
  image_url: string
  is_default: boolean
}

interface UserPrefs {
  cover_skin_id: string | null
  page_skin_id: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function BookSkinsUserPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [allSkins, setAllSkins] = useState<BookSkin[]>([])
  const [prefs, setPrefs] = useState<UserPrefs>({ cover_skin_id: null, page_skin_id: null })
  const [userId, setUserId] = useState<string | null>(null)

  // ── Load skins + user prefs ─────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Fetch all active skins
      const { data: skins } = await supabase
        .from('book_skins')
        .select('id, name, description, skin_type, image_url, is_default')
        .eq('is_active', true)
        .order('is_default', { ascending: false })  // default first
      setAllSkins((skins ?? []) as BookSkin[])

      // Fetch user's current preference (may not exist yet)
      const { data: prefRow } = await supabase
        .from('user_book_skin_preferences')
        .select('cover_skin_id, page_skin_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (prefRow) {
        setPrefs({ cover_skin_id: prefRow.cover_skin_id, page_skin_id: prefRow.page_skin_id })
      }

      setLoading(false)
    }
    load()
  }, [])

  // ── Save prefs ──────────────────────────────────────────────────────────────
  async function savePrefs() {
    if (!userId) return
    setSaving(true)
    setError(null)
    setSuccess(false)

    const { error: upsertErr } = await supabase
      .from('user_book_skin_preferences')
      .upsert({
        user_id: userId,
        cover_skin_id: prefs.cover_skin_id,
        page_skin_id: prefs.page_skin_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    setSaving(false)
    if (upsertErr) {
      setError('Failed to save: ' + upsertErr.message)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const coverSkins = allSkins.filter(s => s.skin_type === 'cover')
  const pageSkins  = allSkins.filter(s => s.skin_type === 'page')

  // The skin that will actually be shown (null = sitewide default)
  const effectiveCover = prefs.cover_skin_id ?? null
  const effectivePage  = prefs.page_skin_id  ?? null

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <HomeButton />
          <span className="text-gray-400">/</span>
          <h1 className="font-bold text-gray-900">Book &amp; Cover</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Intro */}
        <div className="text-center">
          <div className="text-5xl mb-3">📖</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Personalise Your Book</h2>
          <p className="text-sm text-gray-500">
            Choose how your challenge book looks. More skins available in the shop.
          </p>
        </div>

        {/* Error / success */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            ✅ Saved! Your book will use these skins next time you open a challenge.
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading your collection…</div>
        ) : (
          <>
            {/* ── Cover skin picker ── */}
            <SkinPicker
              title="📖 Book Cover"
              description="The cover you see before opening a challenge."
              skins={coverSkins}
              selectedId={effectiveCover}
              onSelect={(id) => setPrefs(p => ({ ...p, cover_skin_id: id }))}
              previewAspect={400 / 620}
              skinType="cover"
            />

            {/* ── Page skin picker ── */}
            <SkinPicker
              title="📄 Inner Page"
              description="The background of the open book pages."
              skins={pageSkins}
              selectedId={effectivePage}
              onSelect={(id) => setPrefs(p => ({ ...p, page_skin_id: id }))}
              previewAspect={400 / 620}
              skinType="page"
            />

            {/* Save button */}
            <div className="flex justify-center pt-2">
              <Button
                onClick={savePrefs}
                disabled={saving}
                isLoading={saving}
                size="lg"
                className="px-10"
              >
                {saving ? 'Saving…' : '💾 Save My Selection'}
              </Button>
            </div>

            {/* Coming soon note */}
            <Card className="bg-blue-50 border-blue-200">
              <Card.Body>
                <p className="text-sm text-blue-700 text-center">
                  🛍️ More cover and page designs will be available in the <strong>Shop</strong> to unlock with your points.
                </p>
              </Card.Body>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SkinPicker sub-component
// ─────────────────────────────────────────────────────────────────────────────
function SkinPicker({
  title,
  description,
  skins,
  selectedId,
  onSelect,
  previewAspect,
  skinType,
}: {
  title: string
  description: string
  skins: BookSkin[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  previewAspect: number  // width / height
  skinType: 'cover' | 'page'
}) {
  // Find the default skin for this type (may be null if none set)
  const defaultSkin = skins.find(s => s.is_default) ?? null

  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </Card.Header>
      <Card.Body>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

          {/* Always show the "Default" option first */}
          <SkinOption
            label="Default"
            sublabel={defaultSkin ? defaultSkin.name : 'Built-in parchment'}
            imageUrl={defaultSkin?.image_url ?? null}
            isSelected={selectedId === null}
            onClick={() => onSelect(null)}
            aspect={previewAspect}
            badge="⭐"
            skinType={skinType}
          />

          {/* User's owned skins — for now only defaults are available */}
          {skins.filter(s => !s.is_default).map(skin => (
            <SkinOption
              key={skin.id}
              label={skin.name}
              sublabel={skin.description ?? undefined}
              imageUrl={skin.image_url}
              isSelected={selectedId === skin.id}
              onClick={() => onSelect(skin.id)}
              aspect={previewAspect}
              skinType={skinType}
            />
          ))}

          {/* Placeholder to show the shop teaser */}
          <div
            className="rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-4 cursor-pointer hover:border-amber-300 hover:bg-amber-50 transition-colors"
            style={{ aspectRatio: String(previewAspect) }}
          >
            <div className="text-2xl mb-1">🔒</div>
            <p className="text-xs font-medium text-gray-500">More in Shop</p>
          </div>

        </div>
      </Card.Body>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual skin option card
// ─────────────────────────────────────────────────────────────────────────────
function SkinOption({
  label,
  sublabel,
  imageUrl,
  isSelected,
  onClick,
  aspect,
  badge,
  skinType,
}: {
  label: string
  sublabel?: string
  imageUrl: string | null
  isSelected: boolean
  onClick: () => void
  aspect: number
  badge?: string
  skinType: 'cover' | 'page'
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 overflow-hidden flex flex-col text-left transition-all focus:outline-none ${
        isSelected
          ? 'border-amber-500 shadow-lg shadow-amber-100'
          : 'border-gray-200 hover:border-amber-300'
      }`}
    >
      {/* Thumbnail */}
      <div
        className="relative w-full overflow-hidden bg-gray-100"
        style={{ paddingBottom: `${(1 / aspect) * 100}%` }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          /* Fallback — show the built-in default skin preview */
          <div
            className="absolute inset-0"
            style={{
              background: skinType === 'page'
                ? 'linear-gradient(to bottom, #faf6ee 0%, #f2e8d5 50%, #ede0c4 100%)'
                : 'linear-gradient(160deg, #c8b08a 0%, #b09060 35%, #9a7a48 70%, #7a5e30 100%)',
            }}
          />
        )}

        {/* Selected checkmark */}
        {isSelected && (
          <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
            ✓
          </div>
        )}

        {/* Badge (e.g. ⭐ for default) */}
        {badge && !isSelected && (
          <div className="absolute top-1.5 left-1.5 text-sm leading-none">
            {badge}
          </div>
        )}
      </div>

      {/* Label */}
      <div className={`px-2 py-2 text-xs font-semibold truncate ${isSelected ? 'text-amber-700 bg-amber-50' : 'text-gray-700 bg-white'}`}>
        {label}
        {sublabel && (
          <span className="block font-normal text-gray-400 truncate">{sublabel}</span>
        )}
      </div>
    </button>
  )
}
