// components/pet/PetPreviewCard.tsx
// Compact widget showing the pet SVG (min 64×64px), evolution stage name,
// and a link to /pet. Shows an egg placeholder when pet prop is null.

import Link from 'next/link'
import type { StudentPet } from '@/lib/types/pet'
import EggSvg from '@/components/pet/EggSvg'
import PetSvg from '@/components/pet/PetSvg'

interface PetPreviewCardProps {
  /** The student's pet data. Pass null if no pet row exists yet. */
  pet: StudentPet | null
  className?: string
}

/** Maps evolution stage values to display names. */
const STAGE_LABELS: Record<string, string> = {
  egg: 'Egg',
  baby: 'Baby',
  teen: 'Teen',
  adult: 'Adult',
  legendary: 'Legendary',
}

export default function PetPreviewCard({ pet, className = '' }: PetPreviewCardProps) {
  // Determine what to render inside the card
  const isEgg = pet === null || pet.evolution_stage === 'egg'

  const stageName = pet ? (STAGE_LABELS[pet.evolution_stage] ?? pet.evolution_stage) : null

  return (
    <Link
      href="/pet"
      className={`inline-flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${className}`}
      aria-label="Go to your pet"
    >
      {isEgg ? (
        <>
          <EggSvg size={64} aria-label="Egg" />
          <span className="text-sm font-medium text-gray-600">
            {pet === null ? 'Your egg is waiting!' : 'Egg'}
          </span>
        </>
      ) : (
        <>
          {/* pet is non-null and stage is not 'egg' here */}
          <PetSvg
            species={pet!.species!}
            stage={pet!.evolution_stage as Exclude<typeof pet.evolution_stage, 'egg'>}
            animation="idle"
            size={64}
          />
          <span className="text-sm font-medium text-gray-600">{stageName}</span>
        </>
      )}
    </Link>
  )
}
