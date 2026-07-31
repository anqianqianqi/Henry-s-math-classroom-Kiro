'use client'

export const dynamic = 'force-dynamic'

/**
 * Challenge Room collection management.
 *
 * Holds BOTH the room and the bundle, because they are a matched pair rather
 * than two independent decorations: a bundle is the art on the book that stands
 * in the room, and the database refuses a bundle without a room
 * (ubsp_package_requires_room). Splitting them across two pages would let you
 * pick one half and be told on save that the other was required.
 *
 * The classic cover collection stays on /book-skins — those skins apply to the
 * flat book, which is what you get when no room is selected.
 */

import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { RoomCollection } from '@/components/challenge-room/RoomCollection'
import { BundleCollection } from '@/components/challenge-room/BundleCollection'

interface Prefs {
  challenge_room_id: string | null
  texture_package_id: string | null
  /** NoChallengeRoom — see supabase/add-challenge-room-opt-out.sql. */
  challenge_room_opt_out: boolean
}

export default function ChallengeRoomsPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>({ challenge_room_id: null, texture_package_id: null, challenge_room_opt_out: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [{ data: roles }, { data: prefRow }] = await Promise.all([
        supabase.from('user_roles').select('roles!inner(name)').eq('user_id', user.id).is('class_id', null),
        supabase
          .from('user_book_skin_preferences')
          .select('challenge_room_id, texture_package_id, challenge_room_opt_out')
          .eq('user_id', user.id)
          .maybeSingle(),
      ])

      setIsAdmin(!!(roles as any[])?.some(
        r => r.roles?.name === 'administrator' || r.roles?.name === 'teacher',
      ))
      if (prefRow) {
        setPrefs({
          challenge_room_id: (prefRow as any).challenge_room_id ?? null,
          texture_package_id: (prefRow as any).texture_package_id ?? null,
          challenge_room_opt_out: !!(prefRow as any).challenge_room_opt_out,
        })
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = useCallback(async (next: Prefs) => {
    if (!userId) return
    setSaving(true)
    setError(null)
    // Only the two columns this page owns — a partial upsert would null the
    // cover/page skin choices made on /book-skins.
    const { error: upsertErr } = await supabase
      .from('user_book_skin_preferences')
      .upsert({
        user_id: userId,
        challenge_room_id: next.challenge_room_id,
        texture_package_id: next.texture_package_id,
        challenge_room_opt_out: next.challenge_room_opt_out,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    setSaving(false)
    if (upsertErr) setError('Failed to save: ' + upsertErr.message)
  }, [supabase, userId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-blue/10">
      <PageHeader breadcrumbs={[{ label: t('nav.decorations'), href: '/decorations' }, { label: t('decor.roomHeading') }]} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="mb-6 text-sm text-gray-500">
          {t('roomPage.introA')}{' '}
          <a href="/book-skins" className="text-primary-600 underline">{t('roomPage.introLink')}</a>{t('roomPage.introB')}
        </p>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-gray-400">{t('decor.loadingCollection')}</div>
        ) : (
          <>
            <RoomCollection
              isAdmin={isAdmin}
              selectedId={prefs.challenge_room_id}
              onSelect={(id) => {
                // Dropping the room drops the bundle with it, or the save is
                // rejected by ubsp_package_requires_room.
                const next: Prefs = {
                  ...prefs,
                  challenge_room_id: id,
                  texture_package_id: id ? prefs.texture_package_id : null,
                }
                setPrefs(next)
                save(next)
              }}
              optOut={prefs.challenge_room_opt_out}
              onOptOutChange={(optOut) => {
                // The room selection is kept, so switching back restores the
                // room they had rather than dropping them on the default.
                const next: Prefs = { ...prefs, challenge_room_opt_out: optOut }
                setPrefs(next)
                save(next)
              }}
            />

            <BundleCollection
              isAdmin={isAdmin}
              selectedId={prefs.texture_package_id}
              hasRoom={!!prefs.challenge_room_id}
              onSelect={(id) => {
                const next: Prefs = { ...prefs, texture_package_id: id }
                setPrefs(next)
                save(next)
              }}
            />
          </>
        )}

        {saving && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
            Saving…
          </div>
        )}
      </main>
    </div>
  )
}
