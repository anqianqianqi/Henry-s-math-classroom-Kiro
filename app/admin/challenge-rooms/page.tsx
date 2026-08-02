'use client'

export const dynamic = 'force-dynamic'

/**
 * Admin: ChallengeRoom designer.
 *
 * Mirrors the storyframe studio workflow, minus the model upload — there is one
 * shared book GLB, so the admin only designs the room plate and tunes where the
 * book sits on it:
 *
 *   1. roll or hand-write a RoomSpec
 *   2. generate the 3:2 plate (optionally refine it)
 *   3. drag / scale / tilt the book against the plate, scrub the flip animation
 *   4. save the plate + placement + animation to challenge_rooms
 */

import { ART_STYLES } from '@/lib/art-styles'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useRouter } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'

/**
 * three.js is ~170 kB — keep it out of the initial bundle, and out of SSR
 * entirely since it touches WebGL. The student-facing challenge page must load
 * the stage the same way so nobody downloads it without owning a room.
 */
const RoomPlacementStage = dynamicImport(
  () => import('@/components/challenge-room/RoomPlacementStage').then(m => m.RoomPlacementStage),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center rounded-xl bg-gray-900"
        style={{ aspectRatio: '3 / 2' }}
      >
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
      </div>
    ),
  },
)
import { ROOM_THEMES, randomRoomSpec } from '@/lib/challengeRoom/themes'
import { validateRoomSpec } from '@/lib/challengeRoom/prompt'
import { bookModelUrl, MODEL_SETUP_HINT } from '@/lib/challengeRoom/model'
import {
  DEFAULT_RADIO_PALETTE,
  DEFAULT_RADIO_PLACEMENT,
  RADIO_MODEL_URL,
  RADIO_PALETTES,
  radioPaletteUrl,
} from '@/lib/challengeRoom/radio'
import {
  BOOK_MODEL_KEY,
  DEFAULT_ANIMATION,
  DEFAULT_PLACEMENT,
  DEFAULT_SHADOW_DEPTH,
  SPREAD_FRAME,
  type AnimationConfig,
  type ChallengeRoom,
  type Placement,
  type RoomSpec,
} from '@/lib/types/challengeRoom'

interface TexturePackageOption {
  id: string
  name: string
  cover_url: string
  inner_url: string
}

export default function ChallengeRoomsAdminPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = createClient()

  const [checkingRole, setCheckingRole] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const [spec, setSpec] = useState<RoomSpec>(() => randomRoomSpec())
  const [plateUrl, setPlateUrl] = useState<string | null>(null)
  const [compiledPrompt, setCompiledPrompt] = useState('')
  const [changePrompt, setChangePrompt] = useState('')
  const [generating, setGenerating] = useState(false)

  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT)
  const [animation, setAnimation] = useState<AnimationConfig>(DEFAULT_ANIMATION)
  const [frame, setFrame] = useState(SPREAD_FRAME)
  const [playing, setPlaying] = useState(false)

  /**
   * The room being retuned, or null when the next save creates a new one.
   *
   * Students' preferences point at a specific challenge_rooms row, so editing
   * has to write back to that row — saving a copy would leave everyone who had
   * chosen the original on the version without the change.
   */
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)

  /*
    The radio on the sill.

    null is a room WITHOUT one, and that is the default — so a room only gains
    a radio when someone deliberately adds it here. The same six controls below
    point at whichever object `target` names, rather than the form growing a
    second copy of the whole placement rig.
  */
  const [radioPlacement, setRadioPlacement] = useState<Placement | null>(null)
  const [target, setTarget] = useState<'book' | 'radio'>('book')
  const [radioPaletteId, setRadioPaletteId] = useState(DEFAULT_RADIO_PALETTE)
  const editing = target === 'radio' && radioPlacement ? radioPlacement : placement
  const setEditing = (next: Placement) =>
    target === 'radio' && radioPlacement ? setRadioPlacement(next) : setPlacement(next)

  const [packages, setPackages] = useState<TexturePackageOption[]>([])
  const [packageId, setPackageId] = useState<string>('')

  const [rooms, setRooms] = useState<ChallengeRoom[]>([])
  const [roomName, setRoomName] = useState('')
  const [roomDescription, setRoomDescription] = useState('')
  const [visibility, setVisibility] = useState<'admin_only' | 'public'>('admin_only')
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const modelUrl = useMemo(() => bookModelUrl(), [])
  const selectedPackage = packages.find(p => p.id === packageId) ?? null

  // ── Admin gate ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: roles } = await supabase
        .from('user_roles')
        .select('roles!inner(name)')
        .eq('user_id', user.id)
        .is('class_id', null)
      const admin = (roles as any[])?.some(
        r => r.roles?.name === 'administrator' || r.roles?.name === 'teacher',
      )
      setIsAdmin(!!admin)
      setCheckingRole(false)
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadRooms = useCallback(async () => {
    const { data } = await supabase
      .from('challenge_rooms')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setRooms(data as ChallengeRoom[])
  }, [supabase])

  const loadPackages = useCallback(async () => {
    const { data } = await supabase
      .from('book_texture_packages')
      .select('id, name, cover_url, inner_url')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (data) {
      setPackages(data as TexturePackageOption[])
      if (data.length > 0) setPackageId(prev => prev || (data[0] as any).id)
    }
  }, [supabase])

  useEffect(() => {
    if (!isAdmin) return
    loadRooms()
    loadPackages()
  }, [isAdmin, loadRooms, loadPackages])

  // ── Generate / refine ─────────────────────────────────────────────────────
  async function generate(refine: boolean) {
    setError(null)
    setSuccess(null)

    const invalid = validateRoomSpec(spec)
    if (invalid) {
      setError(invalid)
      return
    }
    if (refine && !changePrompt.trim()) {
      setError(t('design.describeChange'))
      return
    }

    setGenerating(true)
    try {
      const res = await fetch('/api/preview-challenge-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec,
          ...(refine && plateUrl
            ? { sourceImageUrl: plateUrl, changePrompt: changePrompt.trim() }
            : {}),
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error || 'Generation failed.')
        return
      }
      setPlateUrl(payload.image_url)
      setCompiledPrompt(payload.prompt ?? '')
      setChangePrompt('')
      if (!roomName.trim()) setRoomName(spec.name)
      setSuccess(refine ? 'Room refined.' : 'Room generated. Now position the book.')
    } catch (err: any) {
      setError(err.message || 'Generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save() {
    setError(null)
    setSuccess(null)

    if (!plateUrl) {
      setError(t('roomAdmin.needPlate'))
      return
    }
    if (!roomName.trim()) {
      setError('Give the room a name.')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Your session expired. Please sign in again.')
        return
      }

      const fields = {
        name: roomName.trim(),
        description: roomDescription.trim() || null,
        room_url: plateUrl,
        recipe: spec,
        placement,
        radio_placement: radioPlacement,
        animation,
        model_key: BOOK_MODEL_KEY,
        visibility,
      }

      /*
        Retuning UPDATES the room it was loaded from.

        It used to insert unconditionally, so the only way to adjust a saved
        room's placement was to save a second copy of it and deactivate the
        first — which is not retuning, and is how a list of near-duplicate rooms
        happens. Students hold challenge_room_id against a specific row, so a
        duplicate also silently leaves everyone who chose the old one on the
        untouched version.
      */
      const { error: saveErr } = editingRoomId
        ? await supabase.from('challenge_rooms').update(fields).eq('id', editingRoomId)
        : await supabase.from('challenge_rooms').insert({ ...fields, is_active: true, created_by: user.id })

      if (saveErr) {
        setError('Failed to save: ' + saveErr.message)
        return
      }

      setSuccess(editingRoomId
        ? t('roomAdmin.roomUpdated', { name: roomName.trim() })
        : t('roomAdmin.roomSaved', { name: roomName.trim() }))
      if (!editingRoomId) setRoomDescription('')
      await loadRooms()
    } catch (err: any) {
      setError(err.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(room: ChallengeRoom) {
    const { error: updateErr } = await supabase
      .from('challenge_rooms')
      .update({ is_active: !room.is_active })
      .eq('id', room.id)
    if (updateErr) setError('Update failed: ' + updateErr.message)
    else await loadRooms()
  }

  /** Load a saved room back into the editor so its placement can be retuned. */
  function editRoom(room: ChallengeRoom) {
    setPlateUrl(room.room_url)
    if (room.recipe) setSpec(room.recipe)
    setPlacement(room.placement ?? DEFAULT_PLACEMENT)
    setRadioPlacement((room as any).radio_placement ?? null)
    setTarget('book')
    setAnimation(room.animation ?? DEFAULT_ANIMATION)
    setRoomName(room.name)
    setRoomDescription(room.description ?? '')
    setVisibility(room.visibility)
    setFrame(room.animation?.endFrame ?? SPREAD_FRAME)
    setPlaying(false)
    setEditingRoomId(room.id)
    setSuccess(t('roomAdmin.loadedForRetune', { name: room.name }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Drop the link to the loaded room, so the next save makes a new one. */
  function stopEditing() {
    setEditingRoomId(null)
    setSuccess(null)
  }

  const field = (label: string, key: keyof RoomSpec, multiline = false) => (
    <div className="space-y-1" key={key}>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {multiline ? (
        <textarea
          rows={2}
          value={(spec[key] as string) ?? ''}
          onChange={e => setSpec({ ...spec, [key]: e.target.value })}
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
      ) : (
        <input
          type="text"
          value={(spec[key] as string) ?? ''}
          onChange={e => setSpec({ ...spec, [key]: e.target.value })}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
      )}
    </div>
  )

  const objectField = (
    label: string,
    side: 'leftObjects' | 'rightObjects',
    index: 0 | 1,
  ) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        type="text"
        value={spec[side][index]}
        onChange={e => {
          const next: [string, string] = [...spec[side]] as [string, string]
          next[index] = e.target.value
          setSpec({ ...spec, [side]: next })
        }}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
    </div>
  )

  if (checkingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader breadcrumbs={[{ label: t('nav.decorations'), href: '/decorations' }, { label: t('roomAdmin.pageTitle') }]} />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <Card>
            <Card.Body>
              <p className="text-sm text-gray-600">{t('design.teachersOnly')}</p>
            </Card.Body>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <PageHeader
        breadcrumbs={[{ label: t('nav.decorations'), href: '/decorations' }, { label: t('roomAdmin.pageTitle') }]}
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-gray-500">
          Design the 3D challenge room: generate a background plate, then position the animated book on it.
        </p>

        {!modelUrl && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">{t('roomAdmin.modelMissing')}</p>
            <p className="mt-1 text-xs text-amber-700">{MODEL_SETUP_HINT}</p>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Spec form ──────────────────────────────────────────────── */}
          <Card>
            <Card.Body className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-gray-900">{t('roomAdmin.recipe')}</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  /* avoid: the dice landing on the theme already on screen is
                     the one outcome that reads as a broken button. */
                  onClick={() => setSpec(prev => randomRoomSpec(undefined, { avoid: prev.name }))}
                >
                  🎲 Randomise
                </Button>
              </div>

              {/* Style is its own axis now, so it gets its own row. Picking one
                  re-rolls the current theme with that style forced. */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500">{t('design.artStyle')}</span>
                {ART_STYLES.map(style => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSpec(prev => {
                      const theme = ROOM_THEMES.find(x => x.name === prev.name)
                      return theme ? randomRoomSpec(theme, { style: style.id })
                                   : { ...prev, artStyle: style.id }
                    })}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      spec.artStyle === style.id
                        ? 'border-primary-400 bg-primary-50 font-semibold text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {style.emoji} {style.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {ROOM_THEMES.map(theme => (
                  <button
                    key={theme.name}
                    type="button"
                    onClick={() => setSpec(randomRoomSpec(theme))}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      spec.name === theme.name
                        ? 'border-primary-400 bg-primary-50 font-semibold text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {field(t('roomAdmin.themeName'), 'name')}
                {field(t('design.mood'), 'mood')}
                {field(t('design.palette'), 'palette')}
                {field(t('roomAdmin.architecture'), 'architecture', true)}
                {field(t('roomAdmin.materials'), 'materials')}
                {field(t('roomAdmin.aperture'), 'aperture')}
                {field(t('roomAdmin.lighting'), 'lighting')}
                {field(t('roomAdmin.outsideView'), 'outsideView')}
                {field(t('roomAdmin.accent'), 'accent')}

                <div className="grid grid-cols-2 gap-3">
                  {objectField(t('roomAdmin.leftObject', { n: 1 }), 'leftObjects', 0)}
                  {objectField(t('roomAdmin.leftObject', { n: 2 }), 'leftObjects', 1)}
                  {objectField(t('roomAdmin.rightObject', { n: 1 }), 'rightObjects', 0)}
                  {objectField(t('roomAdmin.rightObject', { n: 2 }), 'rightObjects', 1)}
                </div>

                {field('Extra art direction (optional)', 'notes', true)}
              </div>

              <Button
                variant="primary"
                onClick={() => generate(false)}
                isLoading={generating}
                disabled={generating}
                className="w-full"
              >
                {plateUrl ? t('roomAdmin.generateNewPlate') : t('roomAdmin.generatePlate')}
              </Button>

              {plateUrl && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <label className="text-xs font-medium text-gray-600">
                    Refine this plate (keeps the camera and empty centre)
                  </label>
                  <textarea
                    rows={2}
                    value={changePrompt}
                    onChange={e => setChangePrompt(e.target.value)}
                    placeholder={t('roomAdmin.refinePlaceholder')}
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => generate(true)}
                    isLoading={generating}
                    disabled={generating || !changePrompt.trim()}
                    className="w-full"
                  >
                    {t('design.refine')}
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* ── Stage + placement ──────────────────────────────────────── */}
          <div className="space-y-4">
            <Card>
              <Card.Body className="space-y-3">
                <h2 className="text-lg font-bold text-gray-900">{t('roomAdmin.placement')}</h2>

                {!plateUrl ? (
                  <div
                    className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-center"
                    style={{ aspectRatio: '3 / 2' }}
                  >
                    <p className="max-w-xs text-sm text-gray-400">
                      Generate a room plate to start positioning the book.
                    </p>
                  </div>
                ) : !modelUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={plateUrl} alt="Room plate" className="w-full rounded-xl" />
                    <p className="text-xs text-amber-700">
                      Plate generated. Configure the book model to position the book.
                    </p>
                  </>
                ) : (
                  <>
                    <RoomPlacementStage
                      roomUrl={plateUrl}
                      modelUrl={modelUrl}
                      coverUrl={selectedPackage?.cover_url}
                      innerUrl={selectedPackage?.inner_url}
                      placement={placement}
                      onPlacementChange={setPlacement}
                      animation={animation}
                      frame={frame}
                      onFrameChange={setFrame}
                      playing={playing}
                      onPlayingChange={setPlaying}
                      // Dragging moves whichever object is selected below.
                      interactive={target === 'book'}
                      radioInteractive={target === 'radio'}
                      radioUrl={radioPlacement ? RADIO_MODEL_URL : null}
                      radioTextureUrl={radioPaletteUrl(radioPaletteId)}
                      radioPlacement={radioPlacement}
                      onRadioPlacementChange={setRadioPlacement}
                    />
                    <p className="text-xs text-gray-400">
                      {t('roomAdmin.dragHint')}
                    </p>

                    {/* ── What the sliders and the drag act on ─────────── */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTarget('book')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          target === 'book'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        📖 {t('roomAdmin.targetBook')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // First click on an empty room both adds the radio and
                          // selects it — otherwise the toggle would appear to do
                          // nothing at all.
                          if (!radioPlacement) setRadioPlacement(DEFAULT_RADIO_PLACEMENT)
                          setTarget('radio')
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          target === 'radio'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        📻 {radioPlacement ? t('roomAdmin.targetRadio') : t('roomAdmin.addRadio')}
                      </button>
                      {radioPlacement && (
                        <>
                          <select
                            value={radioPaletteId}
                            onChange={e => setRadioPaletteId(e.target.value)}
                            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-900"
                            aria-label={t('radio.palette')}
                          >
                            {RADIO_PALETTES.map(p => (
                              <option key={p.id} value={p.id}>{t(p.labelKey)}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => { setRadioPlacement(null); setTarget('book') }}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                          >
                            {t('roomAdmin.removeRadio')}
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{t('roomAdmin.radioPaletteHint')}</p>
                  </>
                )}

                {packages.length > 0 && plateUrl && modelUrl && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">{t('roomAdmin.previewWithPackage')}</label>
                    <select
                      value={packageId}
                      onChange={e => setPackageId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">{t('roomAdmin.plainPages')}</option>
                      {packages.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </Card.Body>
            </Card>

            {plateUrl && modelUrl && (
              <Card>
                <Card.Body className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => { setPlaying(!playing) }}>
                      {playing ? '⏸ Pause' : '▶ Play flip'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setPlaying(false); setFrame(animation.startFrame) }}
                    >
                      ⏮ Closed
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setPlaying(false); setFrame(animation.endFrame) }}
                    >
                      ⏭ Open spread
                    </Button>
                    {/* Resets whatever is selected, not always the book. */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(
                        target === 'radio' ? DEFAULT_RADIO_PLACEMENT : DEFAULT_PLACEMENT,
                      )}
                    >
                      {t('roomAdmin.resetPlacement')}
                    </Button>
                  </div>

                  {/* Which object every control below moves. The sliders live in
                      a different card from the toggle, so without this it is not
                      obvious that they follow it. */}
                  <div className="rounded-lg bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700">
                    {target === 'radio' ? `📻 ${t('roomAdmin.targetRadio')}` : `📖 ${t('roomAdmin.targetBook')}`}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Frame</span>
                      <span className="font-mono">{frame} / {animation.endFrame}</span>
                    </div>
                    <input
                      type="range"
                      min={animation.startFrame}
                      max={animation.endFrame}
                      value={Math.min(frame, animation.endFrame)}
                      onChange={e => { setPlaying(false); setFrame(Number(e.target.value)) }}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-400">
                      Frame {SPREAD_FRAME} is the settled two-page spread — the pose students work on.
                    </p>
                  </div>

                  {/* One rig, pointed at whichever object the toggle above selected. */}
                  <div className="grid grid-cols-2 gap-3">
                    <Slider label="X" value={editing.x} min={-3} max={3} step={0.01}
                      onChange={v => setEditing({ ...editing, x: v })} />
                    <Slider label="Y" value={editing.y} min={-3} max={3} step={0.01}
                      onChange={v => setEditing({ ...editing, y: v })} />
                    <Slider label="Scale" value={editing.scale} min={0.2} max={4} step={0.01}
                      onChange={v => setEditing({ ...editing, scale: v })} />
                    <Slider label="Tilt°" value={editing.tilt} min={-90} max={90} step={1}
                      onChange={v => setEditing({ ...editing, tilt: v })} />
                    <Slider label="Turn°" value={editing.turn} min={-180} max={180} step={1}
                      onChange={v => setEditing({ ...editing, turn: v })} />
                    <Slider label="Roll°" value={editing.roll} min={-180} max={180} step={1}
                      onChange={v => setEditing({ ...editing, roll: v })} />
                  </div>

                  {/* Only the book casts a shadow, so this belongs to it alone. */}
                  {target === 'book' && (
                    <div className="space-y-1">
                      <Slider
                        label={t('roomAdmin.shadowDepth')}
                        value={placement.shadowDepth ?? DEFAULT_SHADOW_DEPTH}
                        min={-3} max={0} step={0.01}
                        onChange={v => setPlacement({ ...placement, shadowDepth: v })}
                      />
                      <p className="text-xs text-gray-400">{t('roomAdmin.shadowDepthHint')}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                    <Slider label="Playback fps" value={animation.playbackFps} min={12} max={120} step={1}
                      onChange={v => setAnimation({ ...animation, playbackFps: v })} />
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={animation.loop}
                          onChange={e => setAnimation({ ...animation, loop: e.target.checked })}
                        />
                        Loop the flip (off = rest on the spread)
                      </label>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            )}
          </div>
        </div>

        {/* ── Save ─────────────────────────────────────────────────────── */}
        {plateUrl && (
          <Card>
            <Card.Body className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">{t('roomAdmin.save')}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('design.name')}</label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={e => setRoomName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('design.descriptionOptional')}</label>
                  <input
                    type="text"
                    value={roomDescription}
                    onChange={e => setRoomDescription(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('design.visibility')}</label>
                  <select
                    value={visibility}
                    onChange={e => setVisibility(e.target.value as 'admin_only' | 'public')}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="admin_only">{t('design.adminOnly')}</option>
                    <option value="public">{t('design.public')}</option>
                  </select>
                </div>
              </div>
              {/* The button says which of the two things it will do, because
                  "Save" over a loaded room used to quietly mean "duplicate". */}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={save} isLoading={saving} disabled={saving}>
                  {editingRoomId ? t('roomAdmin.updateRoom') : t('roomAdmin.save')}
                </Button>
                {editingRoomId && (
                  <>
                    <Button variant="ghost" size="sm" onClick={stopEditing} disabled={saving}>
                      {t('roomAdmin.saveAsNew')}
                    </Button>
                    <span className="text-xs text-gray-400">{t('roomAdmin.editingHint')}</span>
                  </>
                )}
              </div>
              {compiledPrompt && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer">View compiled prompt</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3">
                    {compiledPrompt}
                  </pre>
                </details>
              )}
            </Card.Body>
          </Card>
        )}

        {/* ── Existing rooms ───────────────────────────────────────────── */}
        <Card>
          <Card.Body className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">Saved rooms ({rooms.length})</h2>
            {rooms.length === 0 ? (
              <p className="text-sm text-gray-400">{t('roomAdmin.none')}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map(room => (
                  <div key={room.id} className="overflow-hidden rounded-xl border border-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={room.room_url} alt={room.name} className="aspect-[3/2] w-full object-cover" />
                    <div className="space-y-2 p-3">
                      <p className="truncate text-sm font-semibold text-gray-900">{room.name}</p>
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        <span className={`rounded-full px-2 py-0.5 ${room.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {room.is_active ? 'active' : 'inactive'}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                          {room.visibility === 'public' ? 'public' : 'admin only'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => editRoom(room)}>{t('roomAdmin.retune')}</Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(room)}>
                          {room.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </div>
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

function Slider({
  label, value, min, max, step, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}
