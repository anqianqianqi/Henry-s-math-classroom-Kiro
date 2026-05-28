// components/pet/PetSvg.tsx
// Renders the correct inline SVG illustration for the given species and stage.
// 12 distinct illustrations: 3 species × 4 stages (baby, teen, adult, legendary).
// Applies idle (scale pulse) or happy (vertical bounce) CSS animation.

import type { Species, EvolutionStage, PetAnimation } from '@/lib/types/pet'

interface PetSvgProps {
  species: Species
  /** Only non-egg stages are valid here */
  stage: Exclude<EvolutionStage, 'egg'>
  animation: PetAnimation
  className?: string
  size?: number
}

// ─── CSS keyframes injected once via a <style> tag ───────────────────────────

const ANIMATION_STYLES = `
@keyframes petIdlePulse {
  0%   { transform: scale(1.0); }
  50%  { transform: scale(1.04); }
  100% { transform: scale(1.0); }
}
@keyframes petHappyBounce {
  0%         { transform: translateY(0); }
  16.666%    { transform: translateY(-10px); }
  33.333%    { transform: translateY(0); }
  50%        { transform: translateY(-10px); }
  66.666%    { transform: translateY(0); }
  83.333%    { transform: translateY(-10px); }
  100%       { transform: translateY(0); }
}
`

function getAnimationStyle(animation: PetAnimation): React.CSSProperties {
  if (animation === 'idle') {
    return {
      animation: 'petIdlePulse 3s ease-in-out infinite',
      transformOrigin: 'center',
      display: 'inline-block',
    }
  }
  if (animation === 'happy') {
    return {
      animation: 'petHappyBounce 600ms ease-in-out 1',
      transformOrigin: 'center',
      display: 'inline-block',
    }
  }
  return { display: 'inline-block' }
}


// ─── Dragon illustrations (green/teal color scheme) ──────────────────────────

function DragonBaby() {
  return (
    <>
      {/* Shadow */}
      <ellipse cx="100" cy="182" rx="30" ry="6" fill="#2D6A4F" opacity="0.25" />
      {/* Body — small round blob */}
      <ellipse cx="100" cy="140" rx="32" ry="30" fill="#52B788" />
      {/* Belly */}
      <ellipse cx="100" cy="148" rx="20" ry="18" fill="#95D5B2" />
      {/* Head */}
      <circle cx="100" cy="100" r="28" fill="#52B788" />
      {/* Eyes */}
      <circle cx="90" cy="96" r="7" fill="white" />
      <circle cx="110" cy="96" r="7" fill="white" />
      <circle cx="91" cy="97" r="4" fill="#1B4332" />
      <circle cx="111" cy="97" r="4" fill="#1B4332" />
      {/* Eye shine */}
      <circle cx="93" cy="95" r="1.5" fill="white" />
      <circle cx="113" cy="95" r="1.5" fill="white" />
      {/* Tiny nostrils */}
      <circle cx="96" cy="108" r="2" fill="#2D6A4F" />
      <circle cx="104" cy="108" r="2" fill="#2D6A4F" />
      {/* Smile */}
      <path d="M 90 114 Q 100 120 110 114" fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" />
      {/* Tiny horns */}
      <path d="M 88 76 L 84 62 L 92 72" fill="#40916C" />
      <path d="M 112 76 L 116 62 L 108 72" fill="#40916C" />
      {/* Tiny wings */}
      <path d="M 68 130 Q 50 110 60 95 Q 68 115 72 125" fill="#40916C" opacity="0.8" />
      <path d="M 132 130 Q 150 110 140 95 Q 132 115 128 125" fill="#40916C" opacity="0.8" />
      {/* Tail */}
      <path d="M 100 168 Q 80 175 72 168 Q 78 162 85 165" fill="#52B788" />
    </>
  )
}

function DragonTeen() {
  return (
    <>
      {/* Shadow */}
      <ellipse cx="100" cy="185" rx="38" ry="7" fill="#2D6A4F" opacity="0.25" />
      {/* Body */}
      <ellipse cx="100" cy="145" rx="40" ry="38" fill="#40916C" />
      {/* Belly scales */}
      <ellipse cx="100" cy="152" rx="26" ry="24" fill="#74C69D" />
      {/* Scale pattern on belly */}
      <ellipse cx="93" cy="145" rx="7" ry="5" fill="#52B788" opacity="0.5" />
      <ellipse cx="107" cy="145" rx="7" ry="5" fill="#52B788" opacity="0.5" />
      <ellipse cx="100" cy="155" rx="7" ry="5" fill="#52B788" opacity="0.5" />
      {/* Head */}
      <ellipse cx="100" cy="96" rx="32" ry="28" fill="#40916C" />
      {/* Snout */}
      <ellipse cx="100" cy="112" rx="14" ry="10" fill="#52B788" />
      {/* Eyes */}
      <circle cx="86" cy="90" r="9" fill="white" />
      <circle cx="114" cy="90" r="9" fill="white" />
      <circle cx="87" cy="91" r="5" fill="#1B4332" />
      <circle cx="115" cy="91" r="5" fill="#1B4332" />
      <circle cx="89" cy="89" r="2" fill="white" />
      <circle cx="117" cy="89" r="2" fill="white" />
      {/* Nostrils */}
      <circle cx="95" cy="113" r="2.5" fill="#2D6A4F" />
      <circle cx="105" cy="113" r="2.5" fill="#2D6A4F" />
      {/* Horns */}
      <path d="M 84 72 L 78 52 L 88 68" fill="#2D6A4F" />
      <path d="M 116 72 L 122 52 L 112 68" fill="#2D6A4F" />
      {/* Wings — more defined */}
      <path d="M 60 140 Q 35 110 45 80 Q 55 105 62 125 Q 58 132 60 140" fill="#2D6A4F" />
      <path d="M 140 140 Q 165 110 155 80 Q 145 105 138 125 Q 142 132 140 140" fill="#2D6A4F" />
      {/* Wing membrane lines */}
      <path d="M 45 80 Q 52 108 60 130" fill="none" stroke="#40916C" strokeWidth="1.5" opacity="0.6" />
      <path d="M 155 80 Q 148 108 140 130" fill="none" stroke="#40916C" strokeWidth="1.5" opacity="0.6" />
      {/* Tail */}
      <path d="M 100 180 Q 72 188 62 178 Q 70 168 80 172 Q 88 175 95 178" fill="#40916C" />
      {/* Tail spike */}
      <path d="M 62 178 L 52 170 L 64 172" fill="#2D6A4F" />
    </>
  )
}

function DragonAdult() {
  return (
    <>
      {/* Shadow */}
      <ellipse cx="100" cy="188" rx="48" ry="8" fill="#1B4332" opacity="0.3" />
      {/* Body */}
      <ellipse cx="100" cy="148" rx="50" ry="44" fill="#2D6A4F" />
      {/* Belly */}
      <ellipse cx="100" cy="155" rx="32" ry="28" fill="#52B788" />
      {/* Belly scale rows */}
      <ellipse cx="90" cy="145" rx="9" ry="6" fill="#40916C" opacity="0.6" />
      <ellipse cx="110" cy="145" rx="9" ry="6" fill="#40916C" opacity="0.6" />
      <ellipse cx="100" cy="158" rx="9" ry="6" fill="#40916C" opacity="0.6" />
      <ellipse cx="88" cy="165" rx="7" ry="5" fill="#40916C" opacity="0.5" />
      <ellipse cx="112" cy="165" rx="7" ry="5" fill="#40916C" opacity="0.5" />
      {/* Head */}
      <ellipse cx="100" cy="90" rx="38" ry="32" fill="#2D6A4F" />
      {/* Snout */}
      <ellipse cx="100" cy="110" rx="18" ry="13" fill="#40916C" />
      {/* Eyes — slit pupils */}
      <circle cx="82" cy="82" r="11" fill="#D8F3DC" />
      <circle cx="118" cy="82" r="11" fill="#D8F3DC" />
      <ellipse cx="82" cy="82" rx="4" ry="8" fill="#1B4332" />
      <ellipse cx="118" cy="82" rx="4" ry="8" fill="#1B4332" />
      <circle cx="84" cy="79" r="2.5" fill="white" />
      <circle cx="120" cy="79" r="2.5" fill="white" />
      {/* Nostrils */}
      <ellipse cx="94" cy="112" rx="3" ry="2.5" fill="#1B4332" />
      <ellipse cx="106" cy="112" rx="3" ry="2.5" fill="#1B4332" />
      {/* Teeth */}
      <path d="M 88 118 L 91 124 L 94 118" fill="white" />
      <path d="M 106 118 L 109 124 L 112 118" fill="white" />
      {/* Horns — curved */}
      <path d="M 78 62 Q 68 42 74 30 Q 82 44 84 58" fill="#1B4332" />
      <path d="M 122 62 Q 132 42 126 30 Q 118 44 116 58" fill="#1B4332" />
      {/* Side spines */}
      <path d="M 76 100 L 66 88 L 74 96" fill="#1B4332" />
      <path d="M 124 100 L 134 88 L 126 96" fill="#1B4332" />
      {/* Wings — large */}
      <path d="M 50 148 Q 18 110 28 65 Q 42 100 50 130 Q 46 140 50 148" fill="#1B4332" />
      <path d="M 150 148 Q 182 110 172 65 Q 158 100 150 130 Q 154 140 150 148" fill="#1B4332" />
      {/* Wing veins */}
      <path d="M 28 65 Q 38 98 50 135" fill="none" stroke="#2D6A4F" strokeWidth="2" opacity="0.7" />
      <path d="M 172 65 Q 162 98 150 135" fill="none" stroke="#2D6A4F" strokeWidth="2" opacity="0.7" />
      <path d="M 35 80 Q 44 108 50 130" fill="none" stroke="#2D6A4F" strokeWidth="1.5" opacity="0.5" />
      <path d="M 165 80 Q 156 108 150 130" fill="none" stroke="#2D6A4F" strokeWidth="1.5" opacity="0.5" />
      {/* Tail */}
      <path d="M 100 188 Q 65 196 50 182 Q 60 168 74 174 Q 86 180 96 186" fill="#2D6A4F" />
      {/* Tail spikes */}
      <path d="M 50 182 L 38 172 L 52 176" fill="#1B4332" />
      <path d="M 62 186 L 54 176 L 64 180" fill="#1B4332" />
    </>
  )
}

function DragonLegendary() {
  return (
    <>
      {/* Glow aura */}
      <circle cx="100" cy="110" r="88" fill="#52B788" opacity="0.08" />
      <circle cx="100" cy="110" r="72" fill="#52B788" opacity="0.1" />
      {/* Shadow */}
      <ellipse cx="100" cy="190" rx="55" ry="9" fill="#1B4332" opacity="0.35" />
      {/* Body */}
      <ellipse cx="100" cy="148" rx="55" ry="48" fill="#1B4332" />
      {/* Belly */}
      <ellipse cx="100" cy="156" rx="36" ry="32" fill="#40916C" />
      {/* Belly scales — detailed */}
      <ellipse cx="88" cy="144" rx="10" ry="7" fill="#2D6A4F" opacity="0.7" />
      <ellipse cx="112" cy="144" rx="10" ry="7" fill="#2D6A4F" opacity="0.7" />
      <ellipse cx="100" cy="158" rx="10" ry="7" fill="#2D6A4F" opacity="0.7" />
      <ellipse cx="86" cy="166" rx="8" ry="6" fill="#2D6A4F" opacity="0.6" />
      <ellipse cx="114" cy="166" rx="8" ry="6" fill="#2D6A4F" opacity="0.6" />
      <ellipse cx="100" cy="174" rx="8" ry="6" fill="#2D6A4F" opacity="0.5" />
      {/* Head */}
      <ellipse cx="100" cy="84" rx="44" ry="38" fill="#1B4332" />
      {/* Crown ridge */}
      <path d="M 70 60 L 76 42 L 84 58 L 92 36 L 100 56 L 108 36 L 116 58 L 124 42 L 130 60" fill="none" stroke="#52B788" strokeWidth="3" strokeLinejoin="round" />
      {/* Snout */}
      <ellipse cx="100" cy="106" rx="22" ry="16" fill="#2D6A4F" />
      {/* Eyes — glowing */}
      <circle cx="78" cy="76" r="13" fill="#B7E4C7" />
      <circle cx="122" cy="76" r="13" fill="#B7E4C7" />
      <ellipse cx="78" cy="76" rx="5" ry="10" fill="#081C15" />
      <ellipse cx="122" cy="76" rx="5" ry="10" fill="#081C15" />
      {/* Eye glow */}
      <circle cx="78" cy="76" r="13" fill="none" stroke="#52B788" strokeWidth="2" opacity="0.8" />
      <circle cx="122" cy="76" r="13" fill="none" stroke="#52B788" strokeWidth="2" opacity="0.8" />
      <circle cx="81" cy="72" r="3" fill="white" opacity="0.9" />
      <circle cx="125" cy="72" r="3" fill="white" opacity="0.9" />
      {/* Nostrils */}
      <ellipse cx="93" cy="108" rx="3.5" ry="3" fill="#081C15" />
      <ellipse cx="107" cy="108" rx="3.5" ry="3" fill="#081C15" />
      {/* Teeth — prominent */}
      <path d="M 84 116 L 88 124 L 92 116" fill="white" />
      <path d="M 96 118 L 100 126 L 104 118" fill="white" />
      <path d="M 108 116 L 112 124 L 116 116" fill="white" />
      {/* Horns — large curved */}
      <path d="M 72 54 Q 56 28 62 12 Q 74 30 78 50" fill="#081C15" />
      <path d="M 128 54 Q 144 28 138 12 Q 126 30 122 50" fill="#081C15" />
      {/* Secondary horns */}
      <path d="M 80 58 Q 70 44 74 34 Q 82 46 84 56" fill="#2D6A4F" />
      <path d="M 120 58 Q 130 44 126 34 Q 118 46 116 56" fill="#2D6A4F" />
      {/* Spine ridge on back */}
      <path d="M 100 104 L 96 92 L 100 98 L 104 88 L 108 96 L 112 84 L 116 94" fill="none" stroke="#52B788" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Wings — massive */}
      <path d="M 45 152 Q 8 108 16 52 Q 34 96 44 132 Q 40 144 45 152" fill="#081C15" />
      <path d="M 155 152 Q 192 108 184 52 Q 166 96 156 132 Q 160 144 155 152" fill="#081C15" />
      {/* Wing veins — multiple */}
      <path d="M 16 52 Q 30 94 45 140" fill="none" stroke="#1B4332" strokeWidth="2.5" opacity="0.8" />
      <path d="M 184 52 Q 170 94 155 140" fill="none" stroke="#1B4332" strokeWidth="2.5" opacity="0.8" />
      <path d="M 24 68 Q 36 100 44 132" fill="none" stroke="#1B4332" strokeWidth="2" opacity="0.6" />
      <path d="M 176 68 Q 164 100 156 132" fill="none" stroke="#1B4332" strokeWidth="2" opacity="0.6" />
      <path d="M 32 84 Q 40 108 44 130" fill="none" stroke="#1B4332" strokeWidth="1.5" opacity="0.4" />
      <path d="M 168 84 Q 160 108 156 130" fill="none" stroke="#1B4332" strokeWidth="1.5" opacity="0.4" />
      {/* Wing glow edges */}
      <path d="M 45 152 Q 8 108 16 52" fill="none" stroke="#52B788" strokeWidth="1.5" opacity="0.4" />
      <path d="M 155 152 Q 192 108 184 52" fill="none" stroke="#52B788" strokeWidth="1.5" opacity="0.4" />
      {/* Tail */}
      <path d="M 100 192 Q 58 202 40 186 Q 52 168 68 176 Q 82 184 96 190" fill="#1B4332" />
      {/* Tail spikes */}
      <path d="M 40 186 L 26 174 L 42 180" fill="#081C15" />
      <path d="M 54 192 L 44 180 L 56 186" fill="#081C15" />
      <path d="M 66 196 L 58 184 L 68 190" fill="#081C15" />
      {/* Magic sparkles */}
      <circle cx="30" cy="50" r="3" fill="#52B788" opacity="0.8" />
      <circle cx="170" cy="50" r="3" fill="#52B788" opacity="0.8" />
      <circle cx="20" cy="90" r="2" fill="#74C69D" opacity="0.7" />
      <circle cx="180" cy="90" r="2" fill="#74C69D" opacity="0.7" />
      <path d="M 28 48 L 30 42 L 32 48 L 38 50 L 32 52 L 30 58 L 28 52 L 22 50 Z" fill="#B7E4C7" opacity="0.7" />
      <path d="M 168 48 L 170 42 L 172 48 L 178 50 L 172 52 L 170 58 L 168 52 L 162 50 Z" fill="#B7E4C7" opacity="0.7" />
    </>
  )
}


// ─── Fox illustrations (orange/amber color scheme) ───────────────────────────

function FoxBaby() {
  return (
    <>
      {/* Shadow */}
      <ellipse cx="100" cy="182" rx="30" ry="6" fill="#92400E" opacity="0.2" />
      {/* Body */}
      <ellipse cx="100" cy="142" rx="30" ry="28" fill="#F97316" />
      {/* Belly */}
      <ellipse cx="100" cy="150" rx="18" ry="16" fill="#FED7AA" />
      {/* Head */}
      <circle cx="100" cy="102" r="28" fill="#F97316" />
      {/* Ears */}
      <path d="M 80 82 L 72 58 L 92 76" fill="#F97316" />
      <path d="M 120 82 L 128 58 L 108 76" fill="#F97316" />
      {/* Inner ears */}
      <path d="M 81 80 L 75 62 L 90 76" fill="#FB923C" />
      <path d="M 119 80 L 125 62 L 110 76" fill="#FB923C" />
      {/* Eyes */}
      <circle cx="90" cy="98" r="7" fill="white" />
      <circle cx="110" cy="98" r="7" fill="white" />
      <circle cx="91" cy="99" r="4" fill="#1C1917" />
      <circle cx="111" cy="99" r="4" fill="#1C1917" />
      <circle cx="93" cy="97" r="1.5" fill="white" />
      <circle cx="113" cy="97" r="1.5" fill="white" />
      {/* Nose */}
      <ellipse cx="100" cy="110" rx="5" ry="4" fill="#1C1917" />
      {/* Smile */}
      <path d="M 92 116 Q 100 122 108 116" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" />
      {/* Cheek fluff */}
      <circle cx="80" cy="108" r="8" fill="#FB923C" opacity="0.5" />
      <circle cx="120" cy="108" r="8" fill="#FB923C" opacity="0.5" />
      {/* Tail */}
      <path d="M 100 168 Q 76 178 68 168 Q 74 156 84 162 Q 92 166 98 168" fill="#F97316" />
      <path d="M 68 168 Q 60 162 64 154 Q 70 158 70 164" fill="#FED7AA" />
    </>
  )
}

function FoxTeen() {
  return (
    <>
      {/* Shadow */}
      <ellipse cx="100" cy="185" rx="38" ry="7" fill="#92400E" opacity="0.2" />
      {/* Body */}
      <ellipse cx="100" cy="148" rx="38" ry="36" fill="#EA580C" />
      {/* Belly */}
      <ellipse cx="100" cy="156" rx="24" ry="22" fill="#FED7AA" />
      {/* Head */}
      <ellipse cx="100" cy="96" rx="32" ry="28" fill="#EA580C" />
      {/* Snout */}
      <ellipse cx="100" cy="112" rx="14" ry="10" fill="#FB923C" />
      {/* Ears — pointed */}
      <path d="M 76 72 L 66 46 L 88 68" fill="#EA580C" />
      <path d="M 124 72 L 134 46 L 112 68" fill="#EA580C" />
      <path d="M 77 70 L 69 50 L 87 67" fill="#FDBA74" />
      <path d="M 123 70 L 131 50 L 113 67" fill="#FDBA74" />
      {/* Eyes */}
      <circle cx="86" cy="90" r="9" fill="white" />
      <circle cx="114" cy="90" r="9" fill="white" />
      <circle cx="87" cy="91" r="5" fill="#1C1917" />
      <circle cx="115" cy="91" r="5" fill="#1C1917" />
      <circle cx="89" cy="89" r="2" fill="white" />
      <circle cx="117" cy="89" r="2" fill="white" />
      {/* Nose */}
      <ellipse cx="100" cy="112" rx="6" ry="5" fill="#1C1917" />
      {/* Whisker dots */}
      <circle cx="84" cy="114" r="1.5" fill="#92400E" />
      <circle cx="78" cy="112" r="1.5" fill="#92400E" />
      <circle cx="116" cy="114" r="1.5" fill="#92400E" />
      <circle cx="122" cy="112" r="1.5" fill="#92400E" />
      {/* Cheek markings */}
      <ellipse cx="78" cy="104" rx="9" ry="6" fill="#FB923C" opacity="0.5" />
      <ellipse cx="122" cy="104" rx="9" ry="6" fill="#FB923C" opacity="0.5" />
      {/* Tail — bushy */}
      <path d="M 100 182 Q 68 194 56 180 Q 64 164 78 170 Q 88 176 96 180" fill="#EA580C" />
      <path d="M 56 180 Q 46 170 50 158 Q 58 164 58 174" fill="#FED7AA" />
      {/* Tail tip */}
      <ellipse cx="52" cy="162" rx="8" ry="6" fill="white" opacity="0.9" />
    </>
  )
}

function FoxAdult() {
  return (
    <>
      {/* Shadow */}
      <ellipse cx="100" cy="188" rx="48" ry="8" fill="#7C2D12" opacity="0.25" />
      {/* Body */}
      <ellipse cx="100" cy="150" rx="48" ry="42" fill="#C2410C" />
      {/* Belly */}
      <ellipse cx="100" cy="158" rx="30" ry="26" fill="#FED7AA" />
      {/* Chest fluff */}
      <ellipse cx="100" cy="138" rx="18" ry="12" fill="#FDBA74" opacity="0.7" />
      {/* Head */}
      <ellipse cx="100" cy="90" rx="38" ry="32" fill="#C2410C" />
      {/* Snout — elongated */}
      <ellipse cx="100" cy="112" rx="18" ry="13" fill="#EA580C" />
      {/* Ears — tall */}
      <path d="M 72 64 L 60 34 L 84 60" fill="#C2410C" />
      <path d="M 128 64 L 140 34 L 116 60" fill="#C2410C" />
      <path d="M 73 62 L 63 38 L 83 59" fill="#FDBA74" />
      <path d="M 127 62 L 137 38 L 117 59" fill="#FDBA74" />
      {/* Eyes — amber */}
      <circle cx="82" cy="84" r="11" fill="#FEF3C7" />
      <circle cx="118" cy="84" r="11" fill="#FEF3C7" />
      <ellipse cx="82" cy="84" rx="4" ry="8" fill="#1C1917" />
      <ellipse cx="118" cy="84" rx="4" ry="8" fill="#1C1917" />
      <circle cx="84" cy="81" r="2.5" fill="white" />
      <circle cx="120" cy="81" r="2.5" fill="white" />
      {/* Nose */}
      <ellipse cx="100" cy="112" rx="7" ry="6" fill="#1C1917" />
      {/* Whiskers */}
      <line x1="82" y1="114" x2="62" y2="110" stroke="#92400E" strokeWidth="1.5" opacity="0.7" />
      <line x1="82" y1="118" x2="62" y2="118" stroke="#92400E" strokeWidth="1.5" opacity="0.7" />
      <line x1="118" y1="114" x2="138" y2="110" stroke="#92400E" strokeWidth="1.5" opacity="0.7" />
      <line x1="118" y1="118" x2="138" y2="118" stroke="#92400E" strokeWidth="1.5" opacity="0.7" />
      {/* Cheek markings */}
      <ellipse cx="74" cy="100" rx="10" ry="7" fill="#EA580C" opacity="0.5" />
      <ellipse cx="126" cy="100" rx="10" ry="7" fill="#EA580C" opacity="0.5" />
      {/* Tail — large bushy */}
      <path d="M 100 190 Q 60 204 44 186 Q 56 166 72 174 Q 86 182 96 188" fill="#C2410C" />
      <path d="M 44 186 Q 30 172 34 156 Q 44 164 44 178" fill="#EA580C" />
      {/* Tail tip */}
      <ellipse cx="36" cy="160" rx="12" ry="9" fill="white" opacity="0.95" />
      {/* Tail stripe */}
      <path d="M 60 188 Q 50 178 48 168" fill="none" stroke="#7C2D12" strokeWidth="2" opacity="0.4" />
    </>
  )
}

function FoxLegendary() {
  return (
    <>
      {/* Glow aura */}
      <circle cx="100" cy="110" r="88" fill="#F97316" opacity="0.07" />
      <circle cx="100" cy="110" r="72" fill="#FDBA74" opacity="0.08" />
      {/* Shadow */}
      <ellipse cx="100" cy="190" rx="55" ry="9" fill="#7C2D12" opacity="0.3" />
      {/* Body */}
      <ellipse cx="100" cy="150" rx="52" ry="46" fill="#9A3412" />
      {/* Belly */}
      <ellipse cx="100" cy="158" rx="34" ry="30" fill="#FED7AA" />
      {/* Chest fluff */}
      <ellipse cx="100" cy="136" rx="22" ry="14" fill="#FDBA74" opacity="0.8" />
      {/* Head */}
      <ellipse cx="100" cy="86" rx="44" ry="38" fill="#9A3412" />
      {/* Snout */}
      <ellipse cx="100" cy="110" rx="22" ry="16" fill="#C2410C" />
      {/* Ears — very tall with tufts */}
      <path d="M 68 60 L 54 24 L 80 56" fill="#9A3412" />
      <path d="M 132 60 L 146 24 L 120 56" fill="#9A3412" />
      <path d="M 69 58 L 57 28 L 79 55" fill="#FDBA74" />
      <path d="M 131 58 L 143 28 L 121 55" fill="#FDBA74" />
      {/* Ear tufts */}
      <path d="M 54 24 L 50 14 L 58 22" fill="#FEF3C7" />
      <path d="M 146 24 L 150 14 L 142 22" fill="#FEF3C7" />
      {/* Eyes — glowing amber */}
      <circle cx="78" cy="78" r="13" fill="#FEF3C7" />
      <circle cx="122" cy="78" r="13" fill="#FEF3C7" />
      <ellipse cx="78" cy="78" rx="5" ry="10" fill="#1C1917" />
      <ellipse cx="122" cy="78" rx="5" ry="10" fill="#1C1917" />
      {/* Eye glow rings */}
      <circle cx="78" cy="78" r="13" fill="none" stroke="#F97316" strokeWidth="2" opacity="0.8" />
      <circle cx="122" cy="78" r="13" fill="none" stroke="#F97316" strokeWidth="2" opacity="0.8" />
      <circle cx="81" cy="74" r="3" fill="white" opacity="0.9" />
      <circle cx="125" cy="74" r="3" fill="white" opacity="0.9" />
      {/* Nose */}
      <ellipse cx="100" cy="112" rx="8" ry="7" fill="#1C1917" />
      {/* Whiskers — long */}
      <line x1="80" y1="112" x2="54" y2="106" stroke="#92400E" strokeWidth="2" opacity="0.7" />
      <line x1="80" y1="117" x2="54" y2="117" stroke="#92400E" strokeWidth="2" opacity="0.7" />
      <line x1="80" y1="122" x2="54" y2="128" stroke="#92400E" strokeWidth="2" opacity="0.7" />
      <line x1="120" y1="112" x2="146" y2="106" stroke="#92400E" strokeWidth="2" opacity="0.7" />
      <line x1="120" y1="117" x2="146" y2="117" stroke="#92400E" strokeWidth="2" opacity="0.7" />
      <line x1="120" y1="122" x2="146" y2="128" stroke="#92400E" strokeWidth="2" opacity="0.7" />
      {/* Nine tails — legendary fox */}
      <path d="M 100 192 Q 62 208 46 190 Q 58 170 74 178 Q 88 186 96 192" fill="#9A3412" />
      <path d="M 96 192 Q 72 210 58 196 Q 66 176 78 182" fill="#C2410C" opacity="0.9" />
      <path d="M 100 192 Q 80 212 66 200 Q 72 180 84 186" fill="#EA580C" opacity="0.8" />
      {/* Tail tips */}
      <ellipse cx="48" cy="192" rx="10" ry="8" fill="white" opacity="0.95" />
      <ellipse cx="60" cy="198" rx="9" ry="7" fill="#FEF3C7" opacity="0.9" />
      <ellipse cx="68" cy="202" rx="8" ry="6" fill="#FEF3C7" opacity="0.85" />
      {/* Magic fire particles */}
      <circle cx="32" cy="60" r="4" fill="#F97316" opacity="0.8" />
      <circle cx="168" cy="60" r="4" fill="#F97316" opacity="0.8" />
      <circle cx="24" cy="90" r="2.5" fill="#FDBA74" opacity="0.7" />
      <circle cx="176" cy="90" r="2.5" fill="#FDBA74" opacity="0.7" />
      <path d="M 30 58 L 32 50 L 34 58 L 42 60 L 34 62 L 32 70 L 30 62 L 22 60 Z" fill="#FEF3C7" opacity="0.8" />
      <path d="M 166 58 L 168 50 L 170 58 L 178 60 L 170 62 L 168 70 L 166 62 L 158 60 Z" fill="#FEF3C7" opacity="0.8" />
      {/* Crown */}
      <path d="M 78 52 L 84 38 L 92 50 L 100 34 L 108 50 L 116 38 L 122 52" fill="none" stroke="#FDBA74" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="100" cy="34" r="4" fill="#FEF3C7" />
      <circle cx="84" cy="38" r="3" fill="#FDBA74" />
      <circle cx="116" cy="38" r="3" fill="#FDBA74" />
    </>
  )
}


// ─── Cat illustrations (purple/lavender color scheme) ────────────────────────

function CatBaby() {
  return (
    <>
      {/* Shadow */}
      <ellipse cx="100" cy="182" rx="30" ry="6" fill="#4C1D95" opacity="0.2" />
      {/* Body */}
      <ellipse cx="100" cy="142" rx="30" ry="28" fill="#A78BFA" />
      {/* Belly */}
      <ellipse cx="100" cy="150" rx="18" ry="16" fill="#EDE9FE" />
      {/* Head */}
      <circle cx="100" cy="102" r="28" fill="#A78BFA" />
      {/* Ears */}
      <path d="M 80 82 L 74 60 L 92 78" fill="#A78BFA" />
      <path d="M 120 82 L 126 60 L 108 78" fill="#A78BFA" />
      {/* Inner ears */}
      <path d="M 81 80 L 76 63 L 91 77" fill="#DDD6FE" />
      <path d="M 119 80 L 124 63 L 109 77" fill="#DDD6FE" />
      {/* Eyes — big cute */}
      <circle cx="90" cy="98" r="8" fill="white" />
      <circle cx="110" cy="98" r="8" fill="white" />
      <circle cx="91" cy="99" r="5" fill="#2E1065" />
      <circle cx="111" cy="99" r="5" fill="#2E1065" />
      <circle cx="93" cy="97" r="2" fill="white" />
      <circle cx="113" cy="97" r="2" fill="white" />
      {/* Nose */}
      <path d="M 97 108 L 100 111 L 103 108" fill="#7C3AED" />
      {/* Mouth */}
      <path d="M 100 111 Q 94 116 90 114" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 100 111 Q 106 116 110 114" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" />
      {/* Cheek blush */}
      <circle cx="80" cy="108" r="7" fill="#C4B5FD" opacity="0.5" />
      <circle cx="120" cy="108" r="7" fill="#C4B5FD" opacity="0.5" />
      {/* Tail */}
      <path d="M 100 168 Q 78 178 70 168 Q 76 158 86 162 Q 93 166 98 168" fill="#A78BFA" />
      {/* Tail curl */}
      <path d="M 70 168 Q 62 160 66 150 Q 72 156 72 164" fill="#A78BFA" />
    </>
  )
}

function CatTeen() {
  return (
    <>
      {/* Shadow */}
      <ellipse cx="100" cy="185" rx="38" ry="7" fill="#4C1D95" opacity="0.2" />
      {/* Body */}
      <ellipse cx="100" cy="148" rx="38" ry="36" fill="#8B5CF6" />
      {/* Belly */}
      <ellipse cx="100" cy="156" rx="24" ry="22" fill="#EDE9FE" />
      {/* Head */}
      <ellipse cx="100" cy="96" rx="32" ry="28" fill="#8B5CF6" />
      {/* Ears — pointed */}
      <path d="M 76 72 L 68 48 L 88 68" fill="#8B5CF6" />
      <path d="M 124 72 L 132 48 L 112 68" fill="#8B5CF6" />
      <path d="M 77 70 L 70 52 L 87 67" fill="#DDD6FE" />
      <path d="M 123 70 L 130 52 L 113 67" fill="#DDD6FE" />
      {/* Eyes */}
      <circle cx="86" cy="90" r="9" fill="white" />
      <circle cx="114" cy="90" r="9" fill="white" />
      <circle cx="87" cy="91" r="5" fill="#2E1065" />
      <circle cx="115" cy="91" r="5" fill="#2E1065" />
      <circle cx="89" cy="89" r="2" fill="white" />
      <circle cx="117" cy="89" r="2" fill="white" />
      {/* Nose */}
      <path d="M 96 108 L 100 112 L 104 108" fill="#6D28D9" />
      {/* Mouth */}
      <path d="M 100 112 Q 93 118 88 116" fill="none" stroke="#6D28D9" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 100 112 Q 107 118 112 116" fill="none" stroke="#6D28D9" strokeWidth="1.5" strokeLinecap="round" />
      {/* Whisker dots */}
      <circle cx="84" cy="110" r="1.5" fill="#4C1D95" />
      <circle cx="78" cy="108" r="1.5" fill="#4C1D95" />
      <circle cx="116" cy="110" r="1.5" fill="#4C1D95" />
      <circle cx="122" cy="108" r="1.5" fill="#4C1D95" />
      {/* Cheek blush */}
      <ellipse cx="78" cy="104" rx="9" ry="6" fill="#C4B5FD" opacity="0.5" />
      <ellipse cx="122" cy="104" rx="9" ry="6" fill="#C4B5FD" opacity="0.5" />
      {/* Tail — curled */}
      <path d="M 100 182 Q 70 194 58 180 Q 66 164 80 170 Q 90 176 96 180" fill="#8B5CF6" />
      <path d="M 58 180 Q 48 168 52 156 Q 60 162 60 174" fill="#8B5CF6" />
      {/* Tail tip */}
      <ellipse cx="54" cy="158" rx="8" ry="6" fill="#DDD6FE" opacity="0.9" />
    </>
  )
}

function CatAdult() {
  return (
    <>
      {/* Shadow */}
      <ellipse cx="100" cy="188" rx="48" ry="8" fill="#3B0764" opacity="0.25" />
      {/* Body */}
      <ellipse cx="100" cy="150" rx="48" ry="42" fill="#7C3AED" />
      {/* Belly */}
      <ellipse cx="100" cy="158" rx="30" ry="26" fill="#EDE9FE" />
      {/* Chest fluff */}
      <ellipse cx="100" cy="138" rx="18" ry="12" fill="#DDD6FE" opacity="0.7" />
      {/* Head */}
      <ellipse cx="100" cy="90" rx="38" ry="32" fill="#7C3AED" />
      {/* Ears — tall with tufts */}
      <path d="M 72 64 L 62 36 L 84 60" fill="#7C3AED" />
      <path d="M 128 64 L 138 36 L 116 60" fill="#7C3AED" />
      <path d="M 73 62 L 64 40 L 83 59" fill="#DDD6FE" />
      <path d="M 127 62 L 136 40 L 117 59" fill="#DDD6FE" />
      {/* Ear tufts */}
      <path d="M 62 36 L 58 26 L 66 34" fill="#C4B5FD" />
      <path d="M 138 36 L 142 26 L 134 34" fill="#C4B5FD" />
      {/* Eyes — slit pupils */}
      <circle cx="82" cy="84" r="11" fill="#EDE9FE" />
      <circle cx="118" cy="84" r="11" fill="#EDE9FE" />
      <ellipse cx="82" cy="84" rx="4" ry="8" fill="#1E1B4B" />
      <ellipse cx="118" cy="84" rx="4" ry="8" fill="#1E1B4B" />
      <circle cx="84" cy="81" r="2.5" fill="white" />
      <circle cx="120" cy="81" r="2.5" fill="white" />
      {/* Nose */}
      <path d="M 95 108 L 100 113 L 105 108" fill="#5B21B6" />
      {/* Mouth */}
      <path d="M 100 113 Q 92 120 86 117" fill="none" stroke="#5B21B6" strokeWidth="2" strokeLinecap="round" />
      <path d="M 100 113 Q 108 120 114 117" fill="none" stroke="#5B21B6" strokeWidth="2" strokeLinecap="round" />
      {/* Whiskers */}
      <line x1="82" y1="112" x2="60" y2="108" stroke="#4C1D95" strokeWidth="1.5" opacity="0.7" />
      <line x1="82" y1="116" x2="60" y2="116" stroke="#4C1D95" strokeWidth="1.5" opacity="0.7" />
      <line x1="118" y1="112" x2="140" y2="108" stroke="#4C1D95" strokeWidth="1.5" opacity="0.7" />
      <line x1="118" y1="116" x2="140" y2="116" stroke="#4C1D95" strokeWidth="1.5" opacity="0.7" />
      {/* Cheek markings */}
      <ellipse cx="74" cy="100" rx="10" ry="7" fill="#A78BFA" opacity="0.5" />
      <ellipse cx="126" cy="100" rx="10" ry="7" fill="#A78BFA" opacity="0.5" />
      {/* Tail — long curled */}
      <path d="M 100 190 Q 62 204 46 188 Q 58 168 74 176 Q 88 184 96 190" fill="#7C3AED" />
      <path d="M 46 188 Q 32 174 36 158 Q 46 166 46 180" fill="#7C3AED" />
      {/* Tail tip */}
      <ellipse cx="38" cy="162" rx="12" ry="9" fill="#DDD6FE" opacity="0.95" />
    </>
  )
}

function CatLegendary() {
  return (
    <>
      {/* Glow aura */}
      <circle cx="100" cy="110" r="88" fill="#8B5CF6" opacity="0.08" />
      <circle cx="100" cy="110" r="72" fill="#A78BFA" opacity="0.1" />
      {/* Shadow */}
      <ellipse cx="100" cy="190" rx="55" ry="9" fill="#3B0764" opacity="0.3" />
      {/* Body */}
      <ellipse cx="100" cy="150" rx="52" ry="46" fill="#4C1D95" />
      {/* Belly */}
      <ellipse cx="100" cy="158" rx="34" ry="30" fill="#EDE9FE" />
      {/* Chest fluff */}
      <ellipse cx="100" cy="136" rx="22" ry="14" fill="#DDD6FE" opacity="0.8" />
      {/* Head */}
      <ellipse cx="100" cy="86" rx="44" ry="38" fill="#4C1D95" />
      {/* Ears — very tall */}
      <path d="M 68 60 L 56 22 L 80 56" fill="#4C1D95" />
      <path d="M 132 60 L 144 22 L 120 56" fill="#4C1D95" />
      <path d="M 69 58 L 58 26 L 79 55" fill="#DDD6FE" />
      <path d="M 131 58 L 142 26 L 121 55" fill="#DDD6FE" />
      {/* Ear tufts — magical */}
      <path d="M 56 22 L 50 10 L 60 20" fill="#C4B5FD" />
      <path d="M 144 22 L 150 10 L 140 20" fill="#C4B5FD" />
      {/* Eyes — glowing purple */}
      <circle cx="78" cy="78" r="13" fill="#EDE9FE" />
      <circle cx="122" cy="78" r="13" fill="#EDE9FE" />
      <ellipse cx="78" cy="78" rx="5" ry="10" fill="#1E1B4B" />
      <ellipse cx="122" cy="78" rx="5" ry="10" fill="#1E1B4B" />
      {/* Eye glow rings */}
      <circle cx="78" cy="78" r="13" fill="none" stroke="#A78BFA" strokeWidth="2.5" opacity="0.9" />
      <circle cx="122" cy="78" r="13" fill="none" stroke="#A78BFA" strokeWidth="2.5" opacity="0.9" />
      <circle cx="81" cy="74" r="3" fill="white" opacity="0.9" />
      <circle cx="125" cy="74" r="3" fill="white" opacity="0.9" />
      {/* Nose */}
      <path d="M 94 108 L 100 114 L 106 108" fill="#6D28D9" />
      {/* Mouth */}
      <path d="M 100 114 Q 91 122 84 118" fill="none" stroke="#6D28D9" strokeWidth="2" strokeLinecap="round" />
      <path d="M 100 114 Q 109 122 116 118" fill="none" stroke="#6D28D9" strokeWidth="2" strokeLinecap="round" />
      {/* Whiskers — long magical */}
      <line x1="80" y1="112" x2="52" y2="106" stroke="#7C3AED" strokeWidth="2" opacity="0.7" />
      <line x1="80" y1="117" x2="52" y2="117" stroke="#7C3AED" strokeWidth="2" opacity="0.7" />
      <line x1="80" y1="122" x2="52" y2="128" stroke="#7C3AED" strokeWidth="2" opacity="0.7" />
      <line x1="120" y1="112" x2="148" y2="106" stroke="#7C3AED" strokeWidth="2" opacity="0.7" />
      <line x1="120" y1="117" x2="148" y2="117" stroke="#7C3AED" strokeWidth="2" opacity="0.7" />
      <line x1="120" y1="122" x2="148" y2="128" stroke="#7C3AED" strokeWidth="2" opacity="0.7" />
      {/* Crescent moon marking on forehead */}
      <path d="M 94 56 Q 88 62 90 70 Q 96 64 104 66 Q 108 58 104 52 Q 98 56 94 56" fill="#A78BFA" opacity="0.8" />
      {/* Multiple tails — legendary cat */}
      <path d="M 100 192 Q 60 208 44 190 Q 56 170 72 178 Q 86 186 96 192" fill="#4C1D95" />
      <path d="M 96 192 Q 70 210 56 196 Q 64 176 76 182" fill="#6D28D9" opacity="0.9" />
      <path d="M 100 192 Q 78 212 64 200 Q 70 180 82 186" fill="#7C3AED" opacity="0.8" />
      {/* Tail tips */}
      <ellipse cx="46" cy="192" rx="10" ry="8" fill="#DDD6FE" opacity="0.95" />
      <ellipse cx="58" cy="198" rx="9" ry="7" fill="#EDE9FE" opacity="0.9" />
      <ellipse cx="66" cy="202" rx="8" ry="6" fill="#EDE9FE" opacity="0.85" />
      {/* Magic sparkles */}
      <circle cx="30" cy="55" r="4" fill="#A78BFA" opacity="0.8" />
      <circle cx="170" cy="55" r="4" fill="#A78BFA" opacity="0.8" />
      <circle cx="22" cy="88" r="2.5" fill="#C4B5FD" opacity="0.7" />
      <circle cx="178" cy="88" r="2.5" fill="#C4B5FD" opacity="0.7" />
      <path d="M 28 53 L 30 45 L 32 53 L 40 55 L 32 57 L 30 65 L 28 57 L 20 55 Z" fill="#EDE9FE" opacity="0.8" />
      <path d="M 168 53 L 170 45 L 172 53 L 180 55 L 172 57 L 170 65 L 168 57 L 160 55 Z" fill="#EDE9FE" opacity="0.8" />
      {/* Floating orbs */}
      <circle cx="40" cy="120" r="5" fill="#A78BFA" opacity="0.5" />
      <circle cx="160" cy="120" r="5" fill="#A78BFA" opacity="0.5" />
      <circle cx="40" cy="120" r="5" fill="none" stroke="#DDD6FE" strokeWidth="1.5" opacity="0.7" />
      <circle cx="160" cy="120" r="5" fill="none" stroke="#DDD6FE" strokeWidth="1.5" opacity="0.7" />
    </>
  )
}


// ─── Lookup map ──────────────────────────────────────────────────────────────

type NonEggStage = Exclude<EvolutionStage, 'egg'>

const ILLUSTRATIONS: Record<Species, Record<NonEggStage, () => JSX.Element>> = {
  dragon: {
    baby: DragonBaby,
    teen: DragonTeen,
    adult: DragonAdult,
    legendary: DragonLegendary,
  },
  fox: {
    baby: FoxBaby,
    teen: FoxTeen,
    adult: FoxAdult,
    legendary: FoxLegendary,
  },
  cat: {
    baby: CatBaby,
    teen: CatTeen,
    adult: CatAdult,
    legendary: CatLegendary,
  },
}

const ARIA_LABELS: Record<Species, Record<NonEggStage, string>> = {
  dragon: {
    baby: 'Baby dragon',
    teen: 'Teen dragon',
    adult: 'Adult dragon',
    legendary: 'Legendary dragon',
  },
  fox: {
    baby: 'Baby fox',
    teen: 'Teen fox',
    adult: 'Adult fox',
    legendary: 'Legendary fox',
  },
  cat: {
    baby: 'Baby cat',
    teen: 'Teen cat',
    adult: 'Adult cat',
    legendary: 'Legendary cat',
  },
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Renders the correct inline SVG illustration for the given species and stage.
 * 12 distinct illustrations: 3 species × 4 stages (baby, teen, adult, legendary).
 *
 * Animations:
 * - idle: scale pulse, 3s period, 1.0→1.04→1.0 (smooth breathing effect)
 * - happy: vertical bounce, 3 cycles, 600ms total
 * - none: no animation
 */
export default function PetSvg({
  species,
  stage,
  animation,
  className,
  size = 200,
}: PetSvgProps) {
  const IllustrationContent = ILLUSTRATIONS[species][stage]
  const ariaLabel = ARIA_LABELS[species][stage]
  const animationStyle = getAnimationStyle(animation)

  return (
    <>
      {/* Inject keyframes once — browsers deduplicate identical <style> tags */}
      <style>{ANIMATION_STYLES}</style>
      <span style={animationStyle}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 200 200"
          width={size}
          height={size}
          className={className}
          aria-label={ariaLabel}
          role="img"
        >
          <IllustrationContent />
        </svg>
      </span>
    </>
  )
}
