// components/pet/XpBar.tsx
// Displays the pet's current XP progress toward the next evolution stage.
// When stage is 'legendary', shows total XP with a "Max Level!" label instead.

'use client'

import type { EvolutionStage } from '@/lib/types/pet'
import { xpToNextStage } from '@/lib/utils/pet'

interface XpBarProps {
  xp: number
  stage: EvolutionStage
  className?: string
}

/** Maps each stage to the XP value at which that stage begins. */
const STAGE_START_XP: Record<EvolutionStage, number> = {
  egg:       0,
  baby:      0,
  teen:      100,
  adult:     300,
  legendary: 700,
}

/** Gradient colors per stage for a visually distinct progress bar. */
const STAGE_GRADIENT: Record<EvolutionStage, string> = {
  egg:       'from-yellow-300 to-amber-400',
  baby:      'from-green-300 to-emerald-500',
  teen:      'from-blue-400 to-cyan-500',
  adult:     'from-purple-400 to-violet-600',
  legendary: 'from-yellow-400 via-orange-400 to-pink-500',
}

/** Label color per stage. */
const STAGE_TEXT_COLOR: Record<EvolutionStage, string> = {
  egg:       'text-amber-700',
  baby:      'text-emerald-700',
  teen:      'text-cyan-700',
  adult:     'text-violet-700',
  legendary: 'text-orange-600',
}

export default function XpBar({ xp, stage, className = '' }: XpBarProps) {
  const nextThreshold = xpToNextStage(xp, stage)
  const isLegendary = stage === 'legendary'

  // For non-legendary stages, compute progress within the current stage window.
  const stageStart = STAGE_START_XP[stage]
  const stageRange = nextThreshold !== null ? nextThreshold - stageStart : 1
  const progressInStage = Math.min(xp - stageStart, stageRange)
  const progressPercent = nextThreshold !== null
    ? Math.min(100, Math.round((progressInStage / stageRange) * 100))
    : 100

  const gradient = STAGE_GRADIENT[stage]
  const textColor = STAGE_TEXT_COLOR[stage]

  return (
    <div className={`w-full ${className}`} role="region" aria-label="XP progress">
      {/* Label row */}
      <div className={`flex items-center justify-between mb-1 text-sm font-semibold ${textColor}`}>
        {isLegendary ? (
          <>
            <span>{xp.toLocaleString()} XP</span>
            <span className="flex items-center gap-1">
              <span>✨</span>
              <span>Max Level!</span>
            </span>
          </>
        ) : (
          <>
            <span>{xp.toLocaleString()} XP</span>
            <span>{nextThreshold?.toLocaleString()} XP</span>
          </>
        )}
      </div>

      {/* Progress bar track */}
      <div
        className="w-full h-3 rounded-full bg-gray-200 overflow-hidden shadow-inner"
        role="progressbar"
        aria-valuenow={xp}
        aria-valuemin={stageStart}
        aria-valuemax={nextThreshold ?? xp}
        aria-label={
          isLegendary
            ? `${xp} XP — Max Level`
            : `${xp} of ${nextThreshold} XP`
        }
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500 ease-out`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Sub-label: percentage or max level note */}
      {!isLegendary && (
        <p className={`mt-0.5 text-xs text-right ${textColor} opacity-70`}>
          {progressPercent}% to next stage
        </p>
      )}
    </div>
  )
}
