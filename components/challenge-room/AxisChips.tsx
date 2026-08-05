'use client'

/**
 * The seven coordinates a recipe was invented from, as chips.
 *
 * Worth the screen space because it turns a black box into a control. Without
 * it "Invent" produces a theme from nowhere and the only response to disliking
 * one is to press the button again. With it the admin can see that they got
 * {history, textile, dense} and decide whether the brief was wrong or the
 * writing was — and, once the family picker is wired to it, re-roll one axis
 * instead of the whole thing.
 */

import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { AXIS_NAMES, type AxisVector } from '@/lib/challengeRoom/axes'
import type { TranslationKey } from '@/lib/i18n/catalog'

export function AxisChips({ vector }: { vector: AxisVector | null }) {
  const { t } = useLanguage()
  if (!vector) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5" title={t('design.rolledCellHint')}>
      <span className="text-xs font-medium text-gray-500">{t('design.rolledCell')}</span>
      {AXIS_NAMES.map(axis => (
        <span
          key={axis}
          /*
           * Cast because the key is assembled at runtime. axes.test.ts walks
           * every cell and asserts the catalog has an entry for it, so a new
           * axis value ships with its translations or fails the build — which
           * is the guarantee the type would have given.
           */
          title={t(`axis.${axis}` as TranslationKey)}
          className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600"
        >
          {t(`axis.${axis}.${vector[axis]}` as TranslationKey)}
        </span>
      ))}
    </div>
  )
}
