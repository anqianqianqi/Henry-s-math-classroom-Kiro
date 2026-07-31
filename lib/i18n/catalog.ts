/**
 * UI string catalog: English and Simplified Chinese.
 *
 * ── HOW TO CHANGE A TRANSLATION ─────────────────────────────
 * Every translated string in the app lives in lib/i18n/messages/. Find the key
 * and edit its `zh` value — that is the only edit needed, because pages
 * reference keys, never literal Chinese. Nothing is translated inline in a page
 * file, deliberately, so there is exactly one place to look.
 *
 *   messages/common.ts       actions, status, navigation
 *   messages/dashboard.ts    dashboard tiles and stats
 *   messages/challenges.ts   challenge list, detail, book/room reading
 *   messages/decorations.ts  decorations hub, skins, rooms, bundles
 *   messages/bubbleRoom.ts   Q&A room
 *   messages/shop.ts         shop and inventory
 *   messages/classes.ts      classes, enrolment, grading
 *   messages/admin.ts        teacher/admin tooling
 *
 * ── WHAT IS NOT HERE ────────────────────────────────────────
 * Author-written content, which a catalog cannot cover: class names, challenge
 * titles, hints, comments, shop item names, room and bundle names. Those are
 * free text in the database and show as typed. Challenge problems already carry
 * both languages in their .henryproblem snapshot, and tag names have their own
 * per-language rows in challenge_tag_names.
 */

import { common } from './messages/common'
import { dashboard } from './messages/dashboard'
import { challenges } from './messages/challenges'
import { decorations } from './messages/decorations'
import { bubbleRoom } from './messages/bubbleRoom'
import { shop } from './messages/shop'
import { classes } from './messages/classes'
import { admin } from './messages/admin'

export type Language = 'en' | 'zh'

export const LANGUAGES: { code: Language; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'zh', label: '简体中文', short: 'CN' },
]

export const catalog = {
  ...common,
  ...dashboard,
  ...challenges,
  ...decorations,
  ...bubbleRoom,
  ...shop,
  ...classes,
  ...admin,
} as const

export type TranslationKey = keyof typeof catalog

/**
 * Resolve a key. Falls back to English when a zh value is missing or empty, so
 * a partly-translated catalog reads as partly-English rather than showing raw
 * keys to a student.
 */
export function translate(key: TranslationKey, language: Language): string {
  const entry = catalog[key] as { en: string; zh: string } | undefined
  if (!entry) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[i18n] missing catalog key: ${key}`)
    }
    return key
  }
  return entry[language] || entry.en
}
