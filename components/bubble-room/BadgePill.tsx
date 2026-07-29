'use client'

/**
 * BadgePill — displays a single badge inline with emoji + name.
 * Used in QuestionDetailModal next to response author names.
 */

export interface BadgePillProps {
  emoji: string
  name: string
  color?: string  // tailwind color stem e.g. 'teal', 'purple', 'amber'
}

const COLOR_MAP: Record<string, string> = {
  teal:   'bg-teal-100 text-teal-700',
  purple: 'bg-purple-100 text-purple-700',
  amber:  'bg-amber-100 text-amber-700',
  blue:   'bg-blue-100 text-blue-700',
  green:  'bg-green-100 text-green-700',
  red:    'bg-red-100 text-red-700',
  pink:   'bg-pink-100 text-pink-700',
}

export function BadgePill({ emoji, name, color = 'teal' }: BadgePillProps) {
  const classes = COLOR_MAP[color] ?? COLOR_MAP.teal
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5 ${classes}`}
      title={name}
    >
      <span aria-hidden="true">{emoji}</span>
      <span>{name}</span>
    </span>
  )
}
