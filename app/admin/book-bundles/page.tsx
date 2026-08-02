'use client'

export const dynamic = 'force-dynamic'

/**
 * Admin: BookSkinBundle designer — the cover + inner-page pair a ChallengeRoom
 * maps onto the book.
 *
 * This is the second kind of book art on the site, not a replacement for the
 * first. /admin/book-skins makes book-SHAPED transparent PNGs composited in the
 * DOM with a title layout and overlay objects. These are full-bleed 3:4 UV
 * textures with art running to every edge and no title zone — they only make
 * sense mapped onto the 3D book, which is why they need their own table and
 * their own designer.
 *
 * Both halves come from one BookSpec so the pair matches: same paper, same
 * frame, same palette, with the corner clusters only on the cover.
 */

import { ART_STYLES } from '@/lib/art-styles'
import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { BOOK_THEMES, randomBookSpec } from '@/lib/challengeRoom/bookThemes'
import { validateBookSpec } from '@/lib/challengeRoom/bookPrompt'
import type { BookSpec, BookTexturePackage } from '@/lib/types/challengeRoom'

type Half = 'cover' | 'inner'

export default function BookBundlesAdminPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = createClient()

  const [checkingRole, setCheckingRole] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const [spec, setSpec] = useState<BookSpec>(() => randomBookSpec())
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [innerUrl, setInnerUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<Half | null>(null)
  const [changePrompt, setChangePrompt] = useState<Record<Half, string>>({ cover: '', inner: '' })

  const [packages, setPackages] = useState<BookTexturePackage[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'admin_only' | 'public'>('admin_only')
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: roles } = await supabase
        .from('user_roles')
        .select('roles!inner(name)')
        .eq('user_id', user.id)
        .is('class_id', null)
      setIsAdmin(!!(roles as any[])?.some(
        r => r.roles?.name === 'administrator' || r.roles?.name === 'teacher',
      ))
      setCheckingRole(false)
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadPackages = useCallback(async () => {
    const { data } = await supabase
      .from('book_texture_packages')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setPackages(data as BookTexturePackage[])
  }, [supabase])

  useEffect(() => { if (isAdmin) loadPackages() }, [isAdmin, loadPackages])

  async function generate(kind: Half, refine: boolean) {
    setError(null)
    setSuccess(null)

    const invalid = validateBookSpec(spec)
    if (invalid) { setError(invalid); return }

    const source = kind === 'cover' ? coverUrl : innerUrl
    if (refine && !changePrompt[kind].trim()) {
      setError(t('design.describeChange'))
      return
    }

    setBusy(kind)
    try {
      const res = await fetch('/api/preview-book-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          spec,
          ...(refine && source ? { sourceImageUrl: source, changePrompt: changePrompt[kind].trim() } : {}),
        }),
      })
      const payload = await res.json()
      if (!res.ok) { setError(payload.error || 'Generation failed.'); return }

      if (kind === 'cover') setCoverUrl(payload.image_url)
      else setInnerUrl(payload.image_url)
      setChangePrompt(prev => ({ ...prev, [kind]: '' }))
      if (!name.trim()) setName(spec.name)
      setSuccess(kind === 'cover' ? 'Cover generated.' : 'Inner page generated.')
    } catch (err: any) {
      setError(err.message || 'Generation failed.')
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    setError(null)
    setSuccess(null)
    if (!coverUrl || !innerUrl) {
      setError(t('bundle.needBoth'))
      return
    }
    if (!name.trim()) { setError('Give the bundle a name.'); return }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Your session expired. Please sign in again.'); return }

      const { error: insertErr } = await supabase.from('book_texture_packages').insert({
        name: name.trim(),
        description: description.trim() || null,
        cover_url: coverUrl,
        inner_url: innerUrl,
        recipe: spec,
        visibility,
        is_active: true,
        created_by: user.id,
      })
      if (insertErr) { setError('Failed to save: ' + insertErr.message); return }

      setSuccess(`"${name.trim()}" saved.`)
      setDescription('')
      await loadPackages()
    } catch (err: any) {
      setError(err.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(pkg: BookTexturePackage) {
    const { error: updateErr } = await supabase
      .from('book_texture_packages')
      .update({ is_active: !pkg.is_active })
      .eq('id', pkg.id)
    if (updateErr) setError('Update failed: ' + updateErr.message)
    else await loadPackages()
  }

  function reopen(pkg: BookTexturePackage) {
    setCoverUrl(pkg.cover_url)
    setInnerUrl(pkg.inner_url)
    if (pkg.recipe) setSpec(pkg.recipe)
    setName(pkg.name)
    setDescription(pkg.description ?? '')
    setVisibility(pkg.visibility)
    setSuccess(`Loaded "${pkg.name}" — saving creates a new bundle.`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const field = (label: string, key: keyof BookSpec, multiline = false) => (
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

  const clusterField = (label: string, index: 0 | 1 | 2 | 3) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        type="text"
        value={spec.cornerClusters[index]}
        onChange={e => {
          const next = [...spec.cornerClusters] as BookSpec['cornerClusters']
          next[index] = e.target.value
          setSpec({ ...spec, cornerClusters: next })
        }}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
    </div>
  )

  const half = (kind: Half, url: string | null, label: string, hint: string) => (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
        <span className="text-[11px] text-gray-400">1536 × 2048</span>
      </div>

      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="w-full rounded-lg border border-gray-100" style={{ aspectRatio: '3 / 4', objectFit: 'cover' }} />
      ) : (
        <div
          className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center"
          style={{ aspectRatio: '3 / 4' }}
        >
          <p className="text-xs text-gray-400">{hint}</p>
        </div>
      )}

      <Button
        variant={url ? 'secondary' : 'primary'}
        size="sm"
        onClick={() => generate(kind, false)}
        isLoading={busy === kind}
        disabled={busy !== null}
        className="w-full"
      >
        {url ? t('design.regenerate') : t('bundle.generateLabel', { what: label.toLowerCase() })}
      </Button>

      {url && (
        <div className="space-y-1.5">
          <textarea
            rows={2}
            value={changePrompt[kind]}
            onChange={e => setChangePrompt(prev => ({ ...prev, [kind]: e.target.value }))}
            placeholder={t('bundle.refinePlaceholder')}
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generate(kind, true)}
            isLoading={busy === kind}
            disabled={busy !== null || !changePrompt[kind].trim()}
            className="w-full"
          >
            {t('design.refine')}
          </Button>
        </div>
      )}
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
        <PageHeader breadcrumbs={[{ label: t('nav.decorations'), href: '/decorations' }, { label: t('bundle.pageTitle') }]} />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <Card><Card.Body>
            <p className="text-sm text-gray-600">{t('design.teachersOnly')}</p>
          </Card.Body></Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <PageHeader breadcrumbs={[{ label: t('nav.decorations'), href: '/decorations' }, { label: t('bundle.pageTitle') }]} />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            <strong>These are ChallengeRoom textures, not book skins.</strong> They wrap the
            3D book edge to edge, so they only appear for students who have a challenge room
            selected. For the flat book on the normal challenge page, use{' '}
            <a href="/admin/book-skins" className="underline">{t('bundle.uploadInstead')}</a>.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Recipe ─────────────────────────────────────────────────── */}
          <Card>
            <Card.Body className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-gray-900">{t('bundle.recipe')}</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  /* avoid: re-rolling the theme already on screen is the one
                     outcome that reads as a broken button. */
                  onClick={() => setSpec(prev => randomBookSpec(undefined, { avoid: prev.name }))}
                >
                  🎲 Randomise
                </Button>
              </div>

              {/* Style is a real axis now — the prompt no longer forces
                  watercolour on everything. */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500">{t('design.artStyle')}</span>
                {ART_STYLES.map(style => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSpec(prev => {
                      const theme = BOOK_THEMES.find(x => x.name === prev.name)
                      return theme ? randomBookSpec(theme, { style: style.id })
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
                {BOOK_THEMES.map(theme => (
                  <button
                    key={theme.name}
                    type="button"
                    onClick={() => setSpec(randomBookSpec(theme))}
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
                {field(t('bundle.collectionName'), 'name')}
                {field(t('design.mood'), 'mood')}
                {field(t('design.palette'), 'palette')}
                {field(t('bundle.paper'), 'paper')}
                {field(t('bundle.frame'), 'frame')}
                {field(t('bundle.innerAccent'), 'innerAccent')}

                <p className="pt-1 text-xs font-medium text-gray-500">
                  Corner clusters — cover only; the inner page stays clear of them
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {clusterField(t('bundle.topLeft'), 0)}
                  {clusterField(t('bundle.topRight'), 1)}
                  {clusterField(t('bundle.bottomLeft'), 2)}
                  {clusterField(t('bundle.bottomRight'), 3)}
                </div>

                {field(t('bundle.extraArt'), 'notes', true)}
              </div>
            </Card.Body>
          </Card>

          {/* ── The pair ───────────────────────────────────────────────── */}
          <Card>
            <Card.Body className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">{t('bundle.coverAndInner')}</h2>
              <div className="grid grid-cols-2 gap-4">
                {half('cover', coverUrl, 'Cover', 'Shows on the closed book. Four corner clusters, empty centre.')}
                {half('inner', innerUrl, 'Inner page', 'Both open pages. Must stay ~75% blank — the problem is printed onto it.')}
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* ── Save ─────────────────────────────────────────────────────── */}
        {(coverUrl || innerUrl) && (
          <Card>
            <Card.Body className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">{t('bundle.save')}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('design.name')}</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('design.descriptionOptional')}</label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('design.visibility')}</label>
                  <select value={visibility} onChange={e => setVisibility(e.target.value as 'admin_only' | 'public')}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900">
                    <option value="admin_only">{t('design.adminOnly')}</option>
                    <option value="public">{t('design.public')}</option>
                  </select>
                </div>
              </div>
              <Button variant="primary" onClick={save} isLoading={saving} disabled={saving || !coverUrl || !innerUrl}>
                {t('bundle.save')}
              </Button>
              {(!coverUrl || !innerUrl) && (
                <p className="text-xs text-amber-700">
                  Both halves are required — the room maps the cover onto the closed book and
                  the inner page onto both open pages.
                </p>
              )}
            </Card.Body>
          </Card>
        )}

        {/* ── Saved bundles ────────────────────────────────────────────── */}
        <Card>
          <Card.Body className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">Saved bundles ({packages.length})</h2>
            {packages.length === 0 ? (
              <p className="text-sm text-gray-400">{t('bundle.none')}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {packages.map(pkg => (
                  <div key={pkg.id} className="overflow-hidden rounded-xl border border-gray-100">
                    <div className="grid grid-cols-2 gap-px bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pkg.cover_url} alt={`${pkg.name} cover`} className="aspect-[3/4] w-full object-cover" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pkg.inner_url} alt={`${pkg.name} inner page`} className="aspect-[3/4] w-full object-cover" />
                    </div>
                    <div className="space-y-2 p-3">
                      <p className="truncate text-sm font-semibold text-gray-900">{pkg.name}</p>
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        <span className={`rounded-full px-2 py-0.5 ${pkg.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {pkg.is_active ? 'active' : 'inactive'}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                          {pkg.visibility === 'public' ? 'public' : 'admin only'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => reopen(pkg)}>{t('design.reopen')}</Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(pkg)}>
                          {pkg.is_active ? 'Deactivate' : 'Activate'}
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
