'use client'

/**
 * The painted icon on a dashboard tile, and the number beside it.
 *
 * ── WHY THE NUMBER LIVES HERE ───────────────────────────────
 * The tile hides its labels until you point at it — see .card-reveal in
 * globals.css, which keeps only the FIRST child of the body visible. The
 * number used to sit in the label below, so a student could not see their
 * score or their balance without hovering the card first. Putting it beside
 * the icon makes it part of what stays, which is what a number on a tile is
 * for.
 *
 * ── WHY SOME TILES CARRY TWO ────────────────────────────────
 * A total score is two totals — problems and TA work — and so is a shop
 * balance. They were rendered as "340 / 12", one number pretending to be two,
 * with a single icon for both. Each now travels with its own icon, so which
 * number is which is visible rather than remembered.
 */

export interface TileStat {
  /** File stem in /public/dashboard-emoji. */
  icon: string
  /** Shown beside the icon. Omit for a tile whose value is its title. */
  value?: React.ReactNode
  /** What the icon depicts — these carry meaning, so they are not decorative. */
  alt: string
}

export function TileHead({ items }: { items: TileStat[] }) {
  return (
    <div className="mb-2 flex items-center justify-center gap-4">
      {items.map(item => (
        <span key={item.icon} className="flex items-center gap-1.5">
          {/*
            Plain <img> with explicit dimensions rather than next/image: these
            are small fixed-size local PNGs, and the width/height attributes
            already reserve the space next/image would be reserving for us.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/dashboard-emoji/${item.icon}.png`}
            alt={item.alt}
            width={64}
            height={64}
            className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
          />
          {item.value !== undefined && (
            <span className="text-3xl font-bold leading-none text-gray-900">{item.value}</span>
          )}
        </span>
      ))}
    </div>
  )
}
