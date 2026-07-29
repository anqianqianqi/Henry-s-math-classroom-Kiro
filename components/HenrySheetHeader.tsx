'use client'

/**
 * The decorated header strip at the top of a Henry Math worksheet.
 *
 * Nothing here is hard-coded: the strip's size, its orange cap, every dot,
 * sparkle and highlighter swipe, the logo and the green rule all come from the
 * HenrySheetTheme passed in. To restyle the sheet, edit lib/henry-theme.ts or
 * pass a different theme — this component does not need to change.
 */

import type {
  HeaderOrnament,
  HenryPalette,
  HenrySheetTheme,
} from '@/lib/henry-theme'
import { themeColor } from '@/lib/henry-theme'

function Ornament({
  ornament,
  palette,
}: {
  ornament: HeaderOrnament
  palette: HenryPalette
}) {
  const color = themeColor(palette, ornament.color, ornament.opacity)

  if (ornament.kind === 'bar') {
    return (
      <span
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          left: `${ornament.x}%`,
          top: `${ornament.y}%`,
          width: `${ornament.w}%`,
          height: `${ornament.h}%`,
          background: color,
        }}
      />
    )
  }

  if (ornament.kind === 'dot') {
    return (
      <span
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          left: `${ornament.x}%`,
          top: `${ornament.y}%`,
          // Sizes are percentages of the strip HEIGHT. A percentage width
          // would resolve against the strip's width instead, which is ~14x
          // larger — so set height and let aspect-ratio derive the width.
          height: `${ornament.size}%`,
          aspectRatio: '1 / 1',
          background: color,
          transform: 'translate(-50%, -50%)',
        }}
      />
    )
  }

  // sparkle — a plus, matching draw_sparkle()
  return (
    <span
      aria-hidden="true"
      className="absolute"
      style={{
        left: `${ornament.x}%`,
        top: `${ornament.y}%`,
        // As above: size off the strip height, not its width.
        height: `${ornament.size}%`,
        aspectRatio: '1 / 1',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <span
        className="absolute"
        style={{
          left: 0, right: 0, top: '50%',
          height: '1.5px', marginTop: '-0.75px',
          background: color, borderRadius: '1px',
        }}
      />
      <span
        className="absolute"
        style={{
          top: 0, bottom: 0, left: '50%',
          width: '1.5px', marginLeft: '-0.75px',
          background: color, borderRadius: '1px',
        }}
      />
    </span>
  )
}

export function HenrySheetHeader({ theme }: { theme: HenrySheetTheme }) {
  const { palette, header } = theme

  return (
    <div>
      <div className="relative flex items-center">
        {/* Strip */}
        <div
          className="henry-header-strip relative flex-1 min-w-0 overflow-hidden flex items-center"
          style={{
            height: header.height,
            borderRadius: header.radius,
            background: palette.card,
            border: `1px solid ${palette.border}`,
            // Leave room so the logo laps over the end without covering text
            paddingRight: header.logo ? header.logo.size : undefined,
          }}
        >
          {/* Orange cap down the left edge */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0"
            style={{
              width: `${header.accentWidth}%`,
              background: palette[header.accentColor],
            }}
          />

          {header.ornaments.map((ornament, i) => (
            <Ornament key={i} ornament={ornament} palette={palette} />
          ))}

          {/* Title, above the decorations */}
          <span
            className="relative font-bold tracking-wide truncate"
            style={{
              color: palette.green,
              marginLeft: `calc(${header.accentWidth}% + 0.6em)`,
              fontSize: '1.12em',
            }}
          >
            Henry&apos;s Math
            {/* Dropped by container query when the strip itself is narrow —
                see .henry-header-cn in globals.css */}
            <span className="henry-header-cn font-semibold" style={{ fontSize: '0.88em' }}>
              （Henry&apos;s 数学）
            </span>
          </span>
        </div>

        {/* Logo, lapping over the strip's right edge */}
        {header.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={header.logo.src}
            alt=""
            aria-hidden="true"
            // pointer-events-none: the book shell turns any <img> click into an
            // image lightbox, and the logo is not worth enlarging.
            className="relative shrink-0 rounded-full pointer-events-none"
            style={{
              width: header.logo.size,
              height: header.logo.size,
              marginLeft: `-${header.logo.overlap}`,
              border: `2px solid ${palette.card}`,
              background: palette.card,
            }}
          />
        )}
      </div>

      {header.rule && (
        <div
          aria-hidden="true"
          style={{
            height: header.rule.thickness,
            background: palette[header.rule.color],
            borderRadius: '1px',
            marginTop: '0.5em',
          }}
        />
      )}
    </div>
  )
}

export default HenrySheetHeader
