'use client'

/**
 * The "New Feature" button and its panel.
 *
 * Shines for three days from the first time a given student sees it, then goes
 * quiet for them. Any change to the text creates a new announcement row, which
 * gives every student a fresh three days — see lib/actions/announcements.ts.
 *
 * ── FAILS CLOSED ────────────────────────────────────────────
 * For a student it renders nothing at all when there is no announcement, when
 * signed out, or when anything at all goes wrong. This sits in the header of
 * ~17 pages: a broken announcement must look like today's app, never like a
 * broken header. There is deliberately no error state.
 *
 * Staff are the exception — they see the button even with no announcement,
 * because the panel is the only place one can be written and hiding it would
 * leave no way to post the first.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useOnDemandTranslation } from '@/lib/i18n/useOnDemandTranslation'
import {
  canEditAnnouncements,
  deleteAnnouncement,
  getActiveAnnouncement,
  recordAnnouncementView,
  saveAnnouncement,
  type Announcement,
} from '@/lib/actions/announcements'

export function AnnouncementButton() {
  const { t, language } = useLanguage()

  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [open, setOpen] = useState(false)

  // Admin editing state
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const [row, editable] = await Promise.all([
      getActiveAnnouncement(),
      canEditAnnouncements(),
    ])
    setAnnouncement(row)
    setCanEdit(editable)
    setDraft(row?.body ?? '')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Start this reader's clock the first time the button is on screen — not when
   * it is clicked. Somebody who never opens it should still stop being shone at
   * after three days.
   */
  useEffect(() => {
    if (!announcement) return
    void recordAnnouncementView(announcement.id)
  }, [announcement?.id])

  // Close on click-away and on Escape, like the language switcher.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // The announcement text itself translates on demand, like a bubble room post.
  const localized = useOnDemandTranslation(
    'announcement',
    announcement?.id,
    announcement
      ? { text: announcement.body, text_en: announcement.body_en, text_zh: announcement.body_zh }
      : null,
    language,
  )

  // Students see nothing when there is nothing to announce. Staff always see
  // the button, because otherwise there would be no way to write the FIRST
  // announcement — the panel is the only place it can be composed.
  if (!announcement && !canEdit) return null

  async function handleSave() {
    setNotice(null)
    const trimmed = draft.trim()
    if (!trimmed) {
      setNotice(t('announce.errEmpty'))
      return
    }

    setBusy('saving')
    const result = await saveAnnouncement(trimmed)
    setBusy(null)

    if (result.error) {
      setNotice(t(result.error === 'UNAUTHORIZED' ? 'announce.errPermission' : 'announce.errSave'))
      return
    }
    if (result.data?.unchanged) {
      // Say so rather than claiming a save. "Saved!" here would leave you
      // unsure whether every student had just been notified again.
      setNotice(t('announce.unchanged'))
      return
    }

    await load()
    setOpen(false)
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setBusy('deleting')
    const result = await deleteAnnouncement()
    setBusy(null)
    setConfirmingDelete(false)

    if (result.error) {
      setNotice(t(result.error === 'UNAUTHORIZED' ? 'announce.errPermission' : 'announce.errSave'))
      return
    }
    setAnnouncement(null)
    setOpen(false)
  }

  function handleCancel() {
    setDraft(announcement?.body ?? '')
    setNotice(null)
    setConfirmingDelete(false)
    setOpen(false)
  }

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('announce.open')}
        className={`
          rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap
          transition-colors
          ${announcement?.shining
            ? 'announcement-shine'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}
        `}
      >
        ✨ {t('announce.button')}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('announce.title')}
          /* z-40: above every sticky header (z-10 … z-30), below modals (z-50)
             so an open modal is never covered by a header dropdown. */
          className="absolute left-0 z-40 mt-2 w-80 max-w-[85vw] rounded-2xl border border-gray-100 bg-white p-4 shadow-xl"
        >
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('announce.title')}</h2>

          {canEdit ? (
            <>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={5}
                placeholder={t('announce.editPlaceholder')}
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-400"
              />

              {notice && <p className="mt-1 text-xs text-gray-500">{notice}</p>}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy !== null}
                  className="rounded-xl bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                >
                  {busy === 'saving' ? t('announce.saving') : t('action.save')}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={busy !== null}
                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  {t('action.cancel')}
                </button>
                {/* Nothing to delete until one exists. */}
                {announcement && <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy !== null}
                  className="ml-auto rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  {busy === 'deleting'
                    ? t('announce.deleting')
                    : confirmingDelete
                      ? t('announce.confirmDelete')
                      : t('action.delete')}
                </button>}
              </div>
            </>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {localized.text || t('announce.none')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
