// app/api/themes/route.ts
//
// GET  — the theme library the admin designers draw from: the TypeScript
//        constants UNION the promoted rows, plus the classification cells the
//        site has already visited.
// POST — promote a recipe into a theme, folding it into a theme of the same
//        name if one exists.
//
// ── WHY THE CONSTANTS ARE NOT MIGRATED IN ──────────────────────────────────
// The ten hand-authored worlds stay in themes.ts. They are reviewable in code,
// they cannot be broken by a bad UPDATE, and they are what the model is shown
// as voice examples. The database holds only what admins have added since, so
// "reset to the original library" is deactivating rows rather than a restore.

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ROOM_THEMES, type RoomTheme } from '@/lib/challengeRoom/themes'
import { BOOK_THEMES, type BookTheme } from '@/lib/challengeRoom/bookThemes'
import { validateRoomSpec } from '@/lib/challengeRoom/prompt'
import { validateBookSpec } from '@/lib/challengeRoom/bookPrompt'
import { CELL_COUNT, parseVector } from '@/lib/challengeRoom/axes'
import {
  bookThemeIsUsable,
  bookThemeToRow,
  mergeBookTheme,
  mergeRoomTheme,
  roomThemeIsUsable,
  roomThemeToRow,
  rowToBookTheme,
  rowToRoomTheme,
} from '@/lib/challengeRoom/themeRows'
import type { AxisVector, BookSpec, RoomSpec } from '@/lib/types/challengeRoom'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('roles!inner(name)')
    .eq('user_id', session.user.id)
    .is('class_id', null)

  const isAdmin = (roles as any[])?.some((r: any) =>
    r.roles?.name === 'administrator' || r.roles?.name === 'teacher',
  )
  if (!isAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden — admins/teachers only' }, { status: 403 }) }
  }
  return { supabase, userId: session.user.id }
}

export async function GET() {
  try {
    const gate = await requireAdmin()
    if ('error' in gate) return gate.error
    const { supabase } = gate

    const [roomRows, bookRows, savedRooms, savedBundles] = await Promise.all([
      supabase.from('challenge_room_themes').select('*').eq('is_active', true),
      supabase.from('book_bundle_themes').select('*').eq('is_active', true),
      supabase.from('challenge_rooms').select('recipe'),
      supabase.from('book_texture_packages').select('recipe'),
    ])

    /*
     * A missing table is not an error here. The migration is applied by hand
     * against a single production database, so between deploying this code and
     * running the SQL the admin pages would otherwise be dead. Falling back to
     * the constants keeps the designers working, minus promotion.
     */
    const rooms: RoomTheme[] = [
      ...ROOM_THEMES,
      ...(roomRows.data ?? []).map(rowToRoomTheme).filter(roomThemeIsUsable),
    ]
    const books: BookTheme[] = [
      ...BOOK_THEMES,
      ...(bookRows.data ?? []).map(rowToBookTheme).filter(bookThemeIsUsable),
    ]

    if (roomRows.error) console.warn('[themes] room theme rows unavailable:', roomRows.error.message)
    if (bookRows.error) console.warn('[themes] book theme rows unavailable:', bookRows.error.message)

    // Cells the site has already landed on, from every place one is recorded.
    const seen: AxisVector[] = []
    const collect = (value: unknown) => {
      const v = parseVector(value)
      if (v) seen.push(v)
    }
    for (const row of roomRows.data ?? []) collect((row as any).axes)
    for (const row of bookRows.data ?? []) collect((row as any).axes)
    for (const row of savedRooms.data ?? []) collect((row as any).recipe?.axes)
    for (const row of savedBundles.data ?? []) collect((row as any).recipe?.axes)

    return NextResponse.json({
      rooms,
      books,
      seenVectors: seen,
      cellCount: CELL_COUNT,
      promotable: !roomRows.error && !bookRows.error,
    })
  } catch (err: any) {
    console.error('[themes] GET failed:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin()
    if ('error' in gate) return gate.error
    const { supabase, userId } = gate

    const body = await request.json().catch(() => ({}))
    const kind: string = body.kind
    if (kind !== 'room' && kind !== 'book') {
      return NextResponse.json({ error: "kind must be 'room' or 'book'" }, { status: 400 })
    }

    const table = kind === 'room' ? 'challenge_room_themes' : 'book_bundle_themes'

    if (kind === 'room') {
      const spec = body.spec as RoomSpec
      if (!spec) return NextResponse.json({ error: 'spec is required' }, { status: 400 })
      const invalid = validateRoomSpec(spec)
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

      const { data: existingRow } = await supabase
        .from(table).select('*').eq('name', spec.name.trim()).maybeSingle()

      const merged = mergeRoomTheme(existingRow ? rowToRoomTheme(existingRow as any) : null, spec)
      if (!roomThemeIsUsable(merged)) {
        return NextResponse.json({ error: 'That recipe does not carry enough to make a theme.' }, { status: 400 })
      }

      const payload = roomThemeToRow(merged, spec.axes)
      const { error } = existingRow
        ? await supabase.from(table)
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', (existingRow as any).id)
        : await supabase.from(table).insert({ ...payload, created_by: userId })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ theme: merged, created: !existingRow })
    }

    const spec = body.spec as BookSpec
    if (!spec) return NextResponse.json({ error: 'spec is required' }, { status: 400 })
    const invalid = validateBookSpec(spec)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const { data: existingRow } = await supabase
      .from(table).select('*').eq('name', spec.name.trim()).maybeSingle()

    const merged = mergeBookTheme(existingRow ? rowToBookTheme(existingRow as any) : null, spec)
    if (!bookThemeIsUsable(merged)) {
      return NextResponse.json({ error: 'That recipe does not carry enough to make a theme.' }, { status: 400 })
    }

    const payload = bookThemeToRow(merged, spec.axes)
    const { error } = existingRow
      ? await supabase.from(table)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', (existingRow as any).id)
      : await supabase.from(table).insert({ ...payload, created_by: userId })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ theme: merged, created: !existingRow })
  } catch (err: any) {
    console.error('[themes] POST failed:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
