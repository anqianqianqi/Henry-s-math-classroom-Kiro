// components/pet/SpeciesSelector.tsx
// Displays three species options (Dragon, Fox, Cat) for the player to choose from.
// Only intended to be rendered when evolution_stage = 'egg' — the parent page
// controls that condition, but this component is fully self-contained.

import type { Species } from '@/lib/types/pet'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

interface SpeciesSelectorProps {
  onSelect: (species: Species) => void
  className?: string
}

// ─── Inline SVG thumbnails (simplified baby versions) ────────────────────────

function DragonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 80"
      width={64}
      height={64}
      aria-hidden="true"
    >
      {/* Body */}
      <ellipse cx="40" cy="54" rx="18" ry="16" fill="#52B788" />
      {/* Belly */}
      <ellipse cx="40" cy="58" rx="11" ry="10" fill="#95D5B2" />
      {/* Head */}
      <circle cx="40" cy="32" r="16" fill="#52B788" />
      {/* Eyes */}
      <circle cx="34" cy="29" r="4" fill="white" />
      <circle cx="46" cy="29" r="4" fill="white" />
      <circle cx="34.5" cy="29.5" r="2.5" fill="#1B4332" />
      <circle cx="46.5" cy="29.5" r="2.5" fill="#1B4332" />
      <circle cx="35.5" cy="28.5" r="1" fill="white" />
      <circle cx="47.5" cy="28.5" r="1" fill="white" />
      {/* Nostrils */}
      <circle cx="37" cy="36" r="1.2" fill="#2D6A4F" />
      <circle cx="43" cy="36" r="1.2" fill="#2D6A4F" />
      {/* Smile */}
      <path d="M 34 40 Q 40 44 46 40" fill="none" stroke="#2D6A4F" strokeWidth="1.5" strokeLinecap="round" />
      {/* Horns */}
      <path d="M 33 20 L 30 12 L 36 18" fill="#40916C" />
      <path d="M 47 20 L 50 12 L 44 18" fill="#40916C" />
      {/* Wings */}
      <path d="M 22 50 Q 14 40 18 32 Q 22 42 24 48" fill="#40916C" opacity="0.8" />
      <path d="M 58 50 Q 66 40 62 32 Q 58 42 56 48" fill="#40916C" opacity="0.8" />
    </svg>
  )
}

function FoxIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 80"
      width={64}
      height={64}
      aria-hidden="true"
    >
      {/* Body */}
      <ellipse cx="40" cy="54" rx="17" ry="15" fill="#F97316" />
      {/* Belly */}
      <ellipse cx="40" cy="58" rx="10" ry="9" fill="#FED7AA" />
      {/* Head */}
      <circle cx="40" cy="32" r="16" fill="#F97316" />
      {/* Ears */}
      <path d="M 28 22 L 22 8 L 34 20" fill="#F97316" />
      <path d="M 52 22 L 58 8 L 46 20" fill="#F97316" />
      <path d="M 28.5 21 L 23.5 10 L 33.5 19.5" fill="#FB923C" />
      <path d="M 51.5 21 L 56.5 10 L 46.5 19.5" fill="#FB923C" />
      {/* Eyes */}
      <circle cx="34" cy="29" r="4" fill="white" />
      <circle cx="46" cy="29" r="4" fill="white" />
      <circle cx="34.5" cy="29.5" r="2.5" fill="#1C1917" />
      <circle cx="46.5" cy="29.5" r="2.5" fill="#1C1917" />
      <circle cx="35.5" cy="28.5" r="1" fill="white" />
      <circle cx="47.5" cy="28.5" r="1" fill="white" />
      {/* Nose */}
      <ellipse cx="40" cy="37" rx="3" ry="2.5" fill="#1C1917" />
      {/* Cheek fluff */}
      <circle cx="28" cy="34" r="5" fill="#FB923C" opacity="0.5" />
      <circle cx="52" cy="34" r="5" fill="#FB923C" opacity="0.5" />
      {/* Tail */}
      <path d="M 40 68 Q 26 74 20 68 Q 24 62 30 64 Q 35 66 39 68" fill="#F97316" />
      <ellipse cx="19" cy="67" rx="5" ry="4" fill="#FED7AA" opacity="0.9" />
    </svg>
  )
}

function CatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 80"
      width={64}
      height={64}
      aria-hidden="true"
    >
      {/* Body */}
      <ellipse cx="40" cy="54" rx="17" ry="15" fill="#A78BFA" />
      {/* Belly */}
      <ellipse cx="40" cy="58" rx="10" ry="9" fill="#EDE9FE" />
      {/* Head */}
      <circle cx="40" cy="32" r="16" fill="#A78BFA" />
      {/* Ears */}
      <path d="M 28 22 L 23 8 L 34 20" fill="#A78BFA" />
      <path d="M 52 22 L 57 8 L 46 20" fill="#A78BFA" />
      <path d="M 28.5 21 L 24.5 10 L 33.5 19.5" fill="#DDD6FE" />
      <path d="M 51.5 21 L 55.5 10 L 46.5 19.5" fill="#DDD6FE" />
      {/* Eyes */}
      <circle cx="34" cy="29" r="4.5" fill="white" />
      <circle cx="46" cy="29" r="4.5" fill="white" />
      <circle cx="34.5" cy="29.5" r="3" fill="#2E1065" />
      <circle cx="46.5" cy="29.5" r="3" fill="#2E1065" />
      <circle cx="35.5" cy="28.5" r="1.2" fill="white" />
      <circle cx="47.5" cy="28.5" r="1.2" fill="white" />
      {/* Nose */}
      <path d="M 37.5 36 L 40 38.5 L 42.5 36" fill="#7C3AED" />
      {/* Mouth */}
      <path d="M 40 38.5 Q 36 41 33 40" fill="none" stroke="#7C3AED" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M 40 38.5 Q 44 41 47 40" fill="none" stroke="#7C3AED" strokeWidth="1.2" strokeLinecap="round" />
      {/* Cheek blush */}
      <circle cx="28" cy="34" r="5" fill="#C4B5FD" opacity="0.5" />
      <circle cx="52" cy="34" r="5" fill="#C4B5FD" opacity="0.5" />
      {/* Tail */}
      <path d="M 40 68 Q 26 74 20 68 Q 24 62 30 64 Q 35 66 39 68" fill="#A78BFA" />
      <ellipse cx="19" cy="67" rx="5" ry="4" fill="#DDD6FE" opacity="0.9" />
    </svg>
  )
}

// ─── Species data ─────────────────────────────────────────────────────────────

interface SpeciesOption {
  species: Species
  name: string
  description: string
  icon: React.ReactNode
  /** Tailwind ring/border color for the hover/focus state */
  accentColor: string
  /** Tailwind background tint for the card */
  bgColor: string
}

const SPECIES_OPTIONS: SpeciesOption[] = [
  {
    species: 'dragon',
    name: 'Dragon',
    description: 'Fierce and powerful',
    icon: <DragonIcon />,
    accentColor: 'ring-emerald-400 border-emerald-400',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100',
  },
  {
    species: 'fox',
    name: 'Fox',
    description: 'Clever and swift',
    icon: <FoxIcon />,
    accentColor: 'ring-orange-400 border-orange-400',
    bgColor: 'bg-orange-50 hover:bg-orange-100',
  },
  {
    species: 'cat',
    name: 'Cat',
    description: 'Mysterious and graceful',
    icon: <CatIcon />,
    accentColor: 'ring-violet-400 border-violet-400',
    bgColor: 'bg-violet-50 hover:bg-violet-100',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function SpeciesSelector({ onSelect, className }: SpeciesSelectorProps) {
  const { t } = useLanguage()
  return (
    <div className={className}>
      <h2 className="text-center text-xl font-semibold text-gray-800 mb-2">
        {t('pet.chooseYourPet')}
      </h2>
      <p className="text-center text-sm text-gray-500 mb-6">
        {t('pet.chooseHint')}
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {SPECIES_OPTIONS.map(({ species, name, description, icon, accentColor, bgColor }) => (
          <button
            key={species}
            type="button"
            onClick={() => onSelect(species)}
            className={[
              'flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-transparent',
              'transition-all duration-150 cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              bgColor,
              `focus:${accentColor}`,
              `hover:border-current hover:${accentColor.split(' ')[0]}`,
            ].join(' ')}
            aria-label={`Choose ${name}: ${description}`}
          >
            {/* Species illustration */}
            <div className="w-16 h-16 flex items-center justify-center">
              {icon}
            </div>

            {/* Name */}
            <span className="text-base font-semibold text-gray-800">{name}</span>

            {/* Description */}
            <span className="text-xs text-gray-500 text-center leading-snug">
              {description}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
