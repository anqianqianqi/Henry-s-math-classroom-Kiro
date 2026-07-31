'use client'

/**
 * A student's solution or a comment on one, in the reader's language.
 *
 * These tables name their prose `content` while the bubble room names its
 * `text`, so the columns are adapted here rather than teaching the hook about
 * two shapes — the difference is a naming accident, not a real distinction.
 *
 * A component rather than a bare hook call because every one of these renders
 * inside a .map(), where hooks cannot go. It also keeps the fetch scoped: one
 * request per comment actually on screen, not one for the whole thread.
 */

import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useOnDemandTranslation, type PostKind } from '@/lib/i18n/useOnDemandTranslation'

export interface TranslatedContentProps {
  /** Which table this row lives in — picks the columns the API will fill. */
  kind: Extract<PostKind, 'submission' | 'comment'>
  id: string
  content: string
  contentEn?: string | null
  contentZh?: string | null
  className?: string
}

export function TranslatedContent({
  kind,
  id,
  content,
  contentEn,
  contentZh,
  className,
}: TranslatedContentProps) {
  const { language } = useLanguage()
  const { text } = useOnDemandTranslation(
    kind,
    id,
    { text: content, text_en: contentEn, text_zh: contentZh },
    language,
  )

  return <p className={className}>{text}</p>
}
