// components/desktop-pet/DidiSvg.tsx
// SVG illustrations of Didi — a Ragdoll cat with:
//   - Creamy white/off-white fluffy body with full chest ruff
//   - Dark chocolate/seal brown color points: ears, face mask, legs, tail
//   - White blaze splitting the dark face mask
//   - Bright blue eyes, pink nose
//   - Large chunky build, very fluffy
//   - Long dark bushy tail
//
// Four poses: idle (sitting), sleeping (loaf/curled), yawning, playing (batting paw)

'use client'

import React from 'react'

export type DidiPose = 'idle' | 'sleeping' | 'yawning' | 'playing' | 'walking'

interface DidiSvgProps {
  pose: DidiPose
  size?: number
  className?: string
  /** walking direction for the walk animation */
  facingLeft?: boolean
}

// ─── Shared color palette matching Didi exactly ──────────────────────────────
const C = {
  // Body fur — creamy white
  bodyMain:    '#F5F0E8',
  bodyShade:   '#E8E0D0',
  // Color points — dark chocolate/seal brown
  pointDark:   '#2C1810',
  pointMid:    '#4A2C1A',
  pointLight:  '#6B3D22',
  // Chest ruff — bright white
  ruff:        '#FAFAF8',
  ruffShade:   '#EDE8E0',
  // Eyes — bright blue
  eyeOuter:    '#5BA3D9',
  eyeInner:    '#3A7DB5',
  eyePupil:    '#1A1A2E',
  eyeShine:    '#FFFFFF',
  // Nose — pink
  nose:        '#E8A0A0',
  noseDark:    '#C87878',
  // Mouth/whiskers
  mouth:       '#8B6060',
  whisker:     '#FFFFFF',
  // Paw pads — pink
  pad:         '#E8B0B0',
  // Shadow
  shadow:      'rgba(44,24,16,0.15)',
}

// ─── IDLE pose — sitting upright, looking forward ────────────────────────────
function DidiIdle({ flip }: { flip?: boolean }) {
  return (
    <g transform={flip ? 'scale(-1,1) translate(-200,0)' : undefined}>
      {/* Ground shadow */}
      <ellipse cx="100" cy="193" rx="52" ry="7" fill={C.shadow} />

      {/* === BODY === */}
      {/* Main body — large fluffy loaf */}
      <ellipse cx="100" cy="152" rx="52" ry="46" fill={C.bodyMain} />
      {/* Body shading sides */}
      <ellipse cx="68" cy="155" rx="22" ry="38" fill={C.bodyShade} opacity="0.5" />
      <ellipse cx="132" cy="155" rx="22" ry="38" fill={C.bodyShade} opacity="0.5" />

      {/* Color point — lower body/haunches (dark brown) */}
      <ellipse cx="100" cy="172" rx="40" ry="28" fill={C.pointMid} opacity="0.35" />

      {/* === CHEST RUFF — big fluffy white bib === */}
      <ellipse cx="100" cy="138" rx="38" ry="32" fill={C.ruff} />
      {/* Ruff texture layers */}
      <ellipse cx="100" cy="132" rx="30" ry="24" fill={C.ruff} />
      <ellipse cx="100" cy="126" rx="22" ry="18" fill={C.ruffShade} opacity="0.4" />
      {/* Ruff fur wisps */}
      <path d="M 72 130 Q 68 118 74 112" fill="none" stroke={C.ruffShade} strokeWidth="2" opacity="0.6" strokeLinecap="round" />
      <path d="M 80 124 Q 76 112 82 106" fill="none" stroke={C.ruffShade} strokeWidth="2" opacity="0.5" strokeLinecap="round" />
      <path d="M 128 130 Q 132 118 126 112" fill="none" stroke={C.ruffShade} strokeWidth="2" opacity="0.6" strokeLinecap="round" />
      <path d="M 120 124 Q 124 112 118 106" fill="none" stroke={C.ruffShade} strokeWidth="2" opacity="0.5" strokeLinecap="round" />

      {/* === FRONT PAWS === */}
      {/* Left paw */}
      <ellipse cx="76" cy="188" rx="16" ry="9" fill={C.bodyMain} />
      <ellipse cx="76" cy="186" rx="14" ry="7" fill={C.ruff} />
      {/* Paw toe lines */}
      <line x1="68" y1="187" x2="68" y2="191" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="76" y1="188" x2="76" y2="192" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="84" y1="187" x2="84" y2="191" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      {/* Right paw */}
      <ellipse cx="124" cy="188" rx="16" ry="9" fill={C.bodyMain} />
      <ellipse cx="124" cy="186" rx="14" ry="7" fill={C.ruff} />
      <line x1="116" y1="187" x2="116" y2="191" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="124" y1="188" x2="124" y2="192" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="132" y1="187" x2="132" y2="191" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />

      {/* === TAIL — long dark bushy, curled to right === */}
      <path d="M 148 168 Q 172 155 170 132 Q 168 112 154 118 Q 144 124 148 144 Q 150 158 148 168" fill={C.pointDark} />
      {/* Tail fur texture */}
      <path d="M 152 162 Q 174 150 172 128" fill="none" stroke={C.pointMid} strokeWidth="2" opacity="0.5" strokeLinecap="round" />
      <path d="M 146 155 Q 168 142 166 120" fill="none" stroke={C.pointLight} strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
      {/* Tail tip lighter */}
      <ellipse cx="154" cy="118" rx="7" ry="5" fill={C.pointMid} />

      {/* === HEAD === */}
      {/* Head base — large round */}
      <circle cx="100" cy="88" r="46" fill={C.bodyMain} />
      {/* Head side shading */}
      <ellipse cx="68" cy="90" rx="18" ry="22" fill={C.bodyShade} opacity="0.4" />
      <ellipse cx="132" cy="90" rx="18" ry="22" fill={C.bodyShade} opacity="0.4" />

      {/* === COLOR POINT FACE MASK === */}
      {/* Dark mask covers forehead, sides of face */}
      <path d="M 60 70 Q 56 80 58 95 Q 62 108 72 112 Q 80 116 88 112 Q 96 108 100 104 Q 104 108 112 112 Q 120 116 128 112 Q 138 108 142 95 Q 144 80 140 70 Q 130 52 100 50 Q 70 52 60 70 Z" fill={C.pointDark} />

      {/* === WHITE BLAZE — splits the mask down center === */}
      <path d="M 100 54 Q 96 62 94 72 Q 92 82 94 92 Q 96 100 100 104 Q 104 100 106 92 Q 108 82 106 72 Q 104 62 100 54 Z" fill={C.ruff} />
      {/* Blaze widening at forehead */}
      <ellipse cx="100" cy="60" rx="8" ry="6" fill={C.ruff} />

      {/* === EARS === */}
      {/* Left ear — dark brown */}
      <path d="M 62 66 L 54 40 L 78 60" fill={C.pointDark} />
      <path d="M 64 64 L 58 44 L 76 60" fill={C.pointMid} opacity="0.7" />
      {/* Right ear */}
      <path d="M 138 66 L 146 40 L 122 60" fill={C.pointDark} />
      <path d="M 136 64 L 142 44 L 124 60" fill={C.pointMid} opacity="0.7" />

      {/* === EYES — bright blue === */}
      {/* Left eye */}
      <ellipse cx="82" cy="84" rx="13" ry="11" fill="white" />
      <ellipse cx="82" cy="84" rx="10" ry="9" fill={C.eyeOuter} />
      <ellipse cx="82" cy="84" rx="7" ry="8" fill={C.eyeInner} />
      <ellipse cx="82" cy="84" rx="4" ry="5" fill={C.eyePupil} />
      <circle cx="86" cy="80" r="3" fill={C.eyeShine} opacity="0.9" />
      <circle cx="79" cy="87" r="1.5" fill={C.eyeShine} opacity="0.5" />
      {/* Right eye */}
      <ellipse cx="118" cy="84" rx="13" ry="11" fill="white" />
      <ellipse cx="118" cy="84" rx="10" ry="9" fill={C.eyeOuter} />
      <ellipse cx="118" cy="84" rx="7" ry="8" fill={C.eyeInner} />
      <ellipse cx="118" cy="84" rx="4" ry="5" fill={C.eyePupil} />
      <circle cx="122" cy="80" r="3" fill={C.eyeShine} opacity="0.9" />
      <circle cx="115" cy="87" r="1.5" fill={C.eyeShine} opacity="0.5" />

      {/* === NOSE — pink === */}
      <path d="M 96 100 L 100 105 L 104 100 Q 102 97 100 97 Q 98 97 96 100 Z" fill={C.nose} />
      <path d="M 97 100 L 100 103 L 103 100" fill={C.noseDark} opacity="0.4" />

      {/* === MOUTH === */}
      <path d="M 100 105 Q 94 111 90 109" fill="none" stroke={C.mouth} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 100 105 Q 106 111 110 109" fill="none" stroke={C.mouth} strokeWidth="1.8" strokeLinecap="round" />

      {/* === WHISKERS — white, long === */}
      <line x1="52" y1="100" x2="88" y2="103" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      <line x1="52" y1="106" x2="88" y2="106" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      <line x1="52" y1="112" x2="88" y2="109" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <line x1="112" y1="103" x2="148" y2="100" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      <line x1="112" y1="106" x2="148" y2="106" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      <line x1="112" y1="109" x2="148" y2="112" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />

      {/* Cheek fur wisps */}
      <ellipse cx="68" cy="100" rx="10" ry="7" fill={C.ruff} opacity="0.6" />
      <ellipse cx="132" cy="100" rx="10" ry="7" fill={C.ruff} opacity="0.6" />
    </g>
  )
}

// ─── SLEEPING pose — loaf/curled, eyes closed ────────────────────────────────
function DidiSleeping() {
  return (
    <>
      {/* Ground shadow */}
      <ellipse cx="100" cy="178" rx="62" ry="8" fill={C.shadow} />

      {/* === BODY — loaf shape, low and wide === */}
      <ellipse cx="100" cy="158" rx="62" ry="28" fill={C.bodyMain} />
      {/* Body shading */}
      <ellipse cx="100" cy="162" rx="55" ry="22" fill={C.bodyShade} opacity="0.3" />
      {/* Color point on back/haunches */}
      <ellipse cx="118" cy="158" rx="38" ry="22" fill={C.pointMid} opacity="0.3" />

      {/* === CHEST RUFF visible at front === */}
      <ellipse cx="72" cy="152" rx="28" ry="20" fill={C.ruff} />
      <ellipse cx="68" cy="148" rx="22" ry="16" fill={C.ruff} />

      {/* === PAWS tucked under === */}
      <ellipse cx="62" cy="170" rx="18" ry="8" fill={C.ruff} />
      <ellipse cx="88" cy="172" rx="16" ry="7" fill={C.ruff} />
      {/* Paw toe lines */}
      <line x1="54" y1="171" x2="54" y2="175" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="62" y1="172" x2="62" y2="176" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="70" y1="171" x2="70" y2="175" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />

      {/* === TAIL curled around body === */}
      <path d="M 158 158 Q 172 148 168 132 Q 164 118 152 124 Q 144 130 148 146 Q 152 158 158 158" fill={C.pointDark} />
      <path d="M 162 154 Q 174 144 170 128" fill="none" stroke={C.pointMid} strokeWidth="2" opacity="0.5" strokeLinecap="round" />

      {/* === HEAD — resting, slightly tilted === */}
      <circle cx="76" cy="126" r="40" fill={C.bodyMain} />
      {/* Head shading */}
      <ellipse cx="58" cy="128" rx="16" ry="20" fill={C.bodyShade} opacity="0.35" />

      {/* === FACE MASK === */}
      <path d="M 44 112 Q 40 122 42 136 Q 46 148 56 152 Q 64 156 72 152 Q 80 148 76 144 Q 72 140 76 136 Q 80 132 76 124 Q 72 116 76 108 Q 68 96 56 100 Q 48 104 44 112 Z" fill={C.pointDark} />
      {/* Right side mask */}
      <path d="M 108 112 Q 112 122 110 136 Q 106 148 96 152 Q 88 156 80 152 Q 76 148 76 144 Q 80 140 76 136 Q 72 132 76 124 Q 80 116 76 108 Q 84 96 96 100 Q 104 104 108 112 Z" fill={C.pointDark} />

      {/* === WHITE BLAZE === */}
      <path d="M 76 100 Q 72 108 70 118 Q 68 128 70 136 Q 72 144 76 148 Q 80 144 82 136 Q 84 128 82 118 Q 80 108 76 100 Z" fill={C.ruff} />
      <ellipse cx="76" cy="106" rx="7" ry="5" fill={C.ruff} />

      {/* === EARS === */}
      <path d="M 48 108 L 40 84 L 62 102" fill={C.pointDark} />
      <path d="M 50 106 L 44 86 L 60 102" fill={C.pointMid} opacity="0.7" />
      <path d="M 104 108 L 112 84 L 90 102" fill={C.pointDark} />
      <path d="M 102 106 L 108 86 L 92 102" fill={C.pointMid} opacity="0.7" />

      {/* === EYES — CLOSED, sleeping === */}
      {/* Left eye — curved closed line */}
      <path d="M 60 122 Q 66 118 72 122" fill="none" stroke={C.pointDark} strokeWidth="2.5" strokeLinecap="round" />
      {/* Right eye */}
      <path d="M 80 122 Q 86 118 92 122" fill="none" stroke={C.pointDark} strokeWidth="2.5" strokeLinecap="round" />

      {/* === NOSE === */}
      <path d="M 73 132 L 76 136 L 79 132 Q 77 129 76 129 Q 75 129 73 132 Z" fill={C.nose} />

      {/* === MOUTH — relaxed === */}
      <path d="M 76 136 Q 71 140 68 138" fill="none" stroke={C.mouth} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 76 136 Q 81 140 84 138" fill="none" stroke={C.mouth} strokeWidth="1.5" strokeLinecap="round" />

      {/* === WHISKERS === */}
      <line x1="36" y1="130" x2="66" y2="133" stroke={C.whisker} strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
      <line x1="36" y1="136" x2="66" y2="136" stroke={C.whisker} strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
      <line x1="86" y1="133" x2="116" y2="130" stroke={C.whisker} strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
      <line x1="86" y1="136" x2="116" y2="136" stroke={C.whisker} strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />

      {/* === ZZZ sleep bubbles === */}
      <text x="118" y="108" fontSize="14" fill={C.pointMid} opacity="0.7" fontWeight="bold">z</text>
      <text x="128" y="96" fontSize="11" fill={C.pointMid} opacity="0.55" fontWeight="bold">z</text>
      <text x="136" y="86" fontSize="8" fill={C.pointMid} opacity="0.4" fontWeight="bold">z</text>
    </>
  )
}

// ─── YAWNING pose — sitting, mouth wide open ─────────────────────────────────
function DidiYawning() {
  return (
    <>
      {/* Ground shadow */}
      <ellipse cx="100" cy="193" rx="52" ry="7" fill={C.shadow} />

      {/* === BODY === */}
      <ellipse cx="100" cy="152" rx="52" ry="46" fill={C.bodyMain} />
      <ellipse cx="68" cy="155" rx="22" ry="38" fill={C.bodyShade} opacity="0.5" />
      <ellipse cx="132" cy="155" rx="22" ry="38" fill={C.bodyShade} opacity="0.5" />
      <ellipse cx="100" cy="172" rx="40" ry="28" fill={C.pointMid} opacity="0.35" />

      {/* === CHEST RUFF === */}
      <ellipse cx="100" cy="138" rx="38" ry="32" fill={C.ruff} />
      <ellipse cx="100" cy="132" rx="30" ry="24" fill={C.ruff} />

      {/* === PAWS === */}
      <ellipse cx="76" cy="188" rx="16" ry="9" fill={C.ruff} />
      <line x1="68" y1="187" x2="68" y2="191" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="76" y1="188" x2="76" y2="192" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="84" y1="187" x2="84" y2="191" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="124" cy="188" rx="16" ry="9" fill={C.ruff} />
      <line x1="116" y1="187" x2="116" y2="191" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="124" y1="188" x2="124" y2="192" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="132" y1="187" x2="132" y2="191" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />

      {/* === TAIL === */}
      <path d="M 148 168 Q 172 155 170 132 Q 168 112 154 118 Q 144 124 148 144 Q 150 158 148 168" fill={C.pointDark} />

      {/* === HEAD — tilted back slightly for yawn === */}
      <circle cx="100" cy="86" r="46" fill={C.bodyMain} />
      <ellipse cx="68" cy="88" rx="18" ry="22" fill={C.bodyShade} opacity="0.4" />
      <ellipse cx="132" cy="88" rx="18" ry="22" fill={C.bodyShade} opacity="0.4" />

      {/* === FACE MASK === */}
      <path d="M 60 68 Q 56 78 58 93 Q 62 106 72 110 Q 80 114 88 110 Q 96 106 100 102 Q 104 106 112 110 Q 120 114 128 110 Q 138 106 142 93 Q 144 78 140 68 Q 130 50 100 48 Q 70 50 60 68 Z" fill={C.pointDark} />

      {/* === WHITE BLAZE === */}
      <path d="M 100 52 Q 96 60 94 70 Q 92 80 94 90 Q 96 98 100 102 Q 104 98 106 90 Q 108 80 106 70 Q 104 60 100 52 Z" fill={C.ruff} />
      <ellipse cx="100" cy="58" rx="8" ry="6" fill={C.ruff} />

      {/* === EARS — perked up for yawn === */}
      <path d="M 62 64 L 54 38 L 78 58" fill={C.pointDark} />
      <path d="M 64 62 L 58 42 L 76 58" fill={C.pointMid} opacity="0.7" />
      <path d="M 138 64 L 146 38 L 122 58" fill={C.pointDark} />
      <path d="M 136 62 L 142 42 L 124 58" fill={C.pointMid} opacity="0.7" />

      {/* === EYES — squinted/closed during yawn === */}
      {/* Left eye — squinted */}
      <ellipse cx="82" cy="82" rx="13" ry="6" fill="white" />
      <ellipse cx="82" cy="82" rx="10" ry="4" fill={C.eyeOuter} />
      <path d="M 70 82 Q 82 78 94 82" fill="none" stroke={C.pointDark} strokeWidth="2" strokeLinecap="round" />
      {/* Right eye — squinted */}
      <ellipse cx="118" cy="82" rx="13" ry="6" fill="white" />
      <ellipse cx="118" cy="82" rx="10" ry="4" fill={C.eyeOuter} />
      <path d="M 106 82 Q 118 78 130 82" fill="none" stroke={C.pointDark} strokeWidth="2" strokeLinecap="round" />

      {/* === MOUTH — WIDE OPEN yawn === */}
      {/* Outer mouth opening */}
      <path d="M 82 100 Q 100 96 118 100 Q 122 112 118 124 Q 100 130 82 124 Q 78 112 82 100 Z" fill={C.pointDark} />
      {/* Inner mouth — pink/red */}
      <path d="M 84 102 Q 100 98 116 102 Q 120 112 116 122 Q 100 128 84 122 Q 80 112 84 102 Z" fill="#C0504A" />
      {/* Tongue */}
      <path d="M 92 118 Q 100 124 108 118 Q 106 128 100 130 Q 94 128 92 118 Z" fill="#E07070" />
      {/* Tongue center line */}
      <line x1="100" y1="118" x2="100" y2="128" stroke="#C05050" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      {/* Upper teeth */}
      <path d="M 88 104 L 90 110 L 94 104" fill="white" />
      <path d="M 96 102 L 98 108 L 102 102" fill="white" />
      <path d="M 104 102 L 106 108 L 110 104" fill="white" />
      {/* Nose — above open mouth */}
      <path d="M 96 96 L 100 100 L 104 96 Q 102 93 100 93 Q 98 93 96 96 Z" fill={C.nose} />

      {/* === WHISKERS === */}
      <line x1="52" y1="98" x2="80" y2="100" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      <line x1="52" y1="104" x2="80" y2="104" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      <line x1="120" y1="100" x2="148" y2="98" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      <line x1="120" y1="104" x2="148" y2="104" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />

      {/* Cheek fur */}
      <ellipse cx="68" cy="98" rx="10" ry="7" fill={C.ruff} opacity="0.6" />
      <ellipse cx="132" cy="98" rx="10" ry="7" fill={C.ruff} opacity="0.6" />
    </>
  )
}

// ─── PLAYING pose — one paw raised, batting at something ─────────────────────
function DidiPlaying() {
  return (
    <>
      {/* Ground shadow */}
      <ellipse cx="96" cy="193" rx="50" ry="7" fill={C.shadow} />

      {/* === BODY — slightly leaning forward === */}
      <ellipse cx="96" cy="154" rx="50" ry="44" fill={C.bodyMain} />
      <ellipse cx="66" cy="157" rx="20" ry="36" fill={C.bodyShade} opacity="0.5" />
      <ellipse cx="126" cy="157" rx="20" ry="36" fill={C.bodyShade} opacity="0.5" />
      <ellipse cx="96" cy="172" rx="38" ry="26" fill={C.pointMid} opacity="0.35" />

      {/* === CHEST RUFF === */}
      <ellipse cx="96" cy="138" rx="36" ry="30" fill={C.ruff} />
      <ellipse cx="96" cy="132" rx="28" ry="22" fill={C.ruff} />

      {/* === GROUNDED PAWS === */}
      {/* Left paw — on ground */}
      <ellipse cx="72" cy="188" rx="16" ry="9" fill={C.ruff} />
      <line x1="64" y1="187" x2="64" y2="191" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="72" y1="188" x2="72" y2="192" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="80" y1="187" x2="80" y2="191" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />

      {/* === RAISED RIGHT PAW — batting upward === */}
      {/* Arm/leg raised */}
      <path d="M 118 170 Q 130 155 142 140 Q 148 132 144 126" fill="none" stroke={C.bodyMain} strokeWidth="14" strokeLinecap="round" />
      <path d="M 118 170 Q 130 155 142 140 Q 148 132 144 126" fill="none" stroke={C.bodyShade} strokeWidth="10" strokeLinecap="round" opacity="0.4" />
      {/* Paw at end of raised arm */}
      <ellipse cx="144" cy="124" rx="13" ry="10" fill={C.ruff} transform="rotate(-30 144 124)" />
      {/* Paw toe lines */}
      <line x1="136" y1="120" x2="134" y2="115" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="143" y1="116" x2="142" y2="111" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="150" y1="118" x2="150" y2="113" stroke={C.bodyShade} strokeWidth="1.2" strokeLinecap="round" />
      {/* Paw pads visible */}
      <ellipse cx="143" cy="120" rx="5" ry="4" fill={C.pad} opacity="0.7" transform="rotate(-30 143 120)" />

      {/* === TAIL — raised and curved playfully === */}
      <path d="M 142 162 Q 166 148 168 124 Q 170 104 156 108 Q 146 112 150 132 Q 152 148 142 162" fill={C.pointDark} />
      <path d="M 146 156 Q 168 142 170 118" fill="none" stroke={C.pointMid} strokeWidth="2" opacity="0.5" strokeLinecap="round" />

      {/* === TOY — small ball the paw is batting === */}
      <circle cx="158" cy="108" r="8" fill="#F97316" opacity="0.9" />
      <circle cx="155" cy="105" r="3" fill="#FDBA74" opacity="0.7" />
      {/* Motion lines from toy */}
      <line x1="166" y1="100" x2="172" y2="94" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="168" y1="106" x2="176" y2="104" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

      {/* === HEAD — alert, looking at toy === */}
      <circle cx="94" cy="86" r="44" fill={C.bodyMain} />
      <ellipse cx="64" cy="88" rx="17" ry="21" fill={C.bodyShade} opacity="0.4" />
      <ellipse cx="124" cy="88" rx="17" ry="21" fill={C.bodyShade} opacity="0.4" />

      {/* === FACE MASK === */}
      <path d="M 56 68 Q 52 78 54 92 Q 58 105 68 109 Q 76 113 84 109 Q 92 105 94 101 Q 96 105 104 109 Q 112 113 120 109 Q 130 105 134 92 Q 136 78 132 68 Q 122 50 94 48 Q 66 50 56 68 Z" fill={C.pointDark} />

      {/* === WHITE BLAZE === */}
      <path d="M 94 52 Q 90 60 88 70 Q 86 80 88 90 Q 90 98 94 101 Q 98 98 100 90 Q 102 80 100 70 Q 98 60 94 52 Z" fill={C.ruff} />
      <ellipse cx="94" cy="58" rx="8" ry="6" fill={C.ruff} />

      {/* === EARS — perked forward === */}
      <path d="M 58 64 L 50 38 L 74 58" fill={C.pointDark} />
      <path d="M 60 62 L 54 42 L 72 58" fill={C.pointMid} opacity="0.7" />
      <path d="M 130 64 L 138 38 L 114 58" fill={C.pointDark} />
      <path d="M 128 62 L 134 42 L 116 58" fill={C.pointMid} opacity="0.7" />

      {/* === EYES — wide open, alert, looking right === */}
      {/* Left eye */}
      <ellipse cx="78" cy="82" rx="13" ry="12" fill="white" />
      <ellipse cx="78" cy="82" rx="10" ry="10" fill={C.eyeOuter} />
      <ellipse cx="80" cy="82" rx="7" ry="8" fill={C.eyeInner} />
      <ellipse cx="81" cy="82" rx="4" ry="5" fill={C.eyePupil} />
      <circle cx="83" cy="78" r="3" fill={C.eyeShine} opacity="0.9" />
      {/* Right eye */}
      <ellipse cx="112" cy="82" rx="13" ry="12" fill="white" />
      <ellipse cx="112" cy="82" rx="10" ry="10" fill={C.eyeOuter} />
      <ellipse cx="114" cy="82" rx="7" ry="8" fill={C.eyeInner} />
      <ellipse cx="115" cy="82" rx="4" ry="5" fill={C.eyePupil} />
      <circle cx="117" cy="78" r="3" fill={C.eyeShine} opacity="0.9" />

      {/* === NOSE === */}
      <path d="M 90 98 L 94 102 L 98 98 Q 96 95 94 95 Q 92 95 90 98 Z" fill={C.nose} />

      {/* === MOUTH — slight open, excited === */}
      <path d="M 94 102 Q 88 107 84 105" fill="none" stroke={C.mouth} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 94 102 Q 100 107 104 105" fill="none" stroke={C.mouth} strokeWidth="1.8" strokeLinecap="round" />

      {/* === WHISKERS === */}
      <line x1="46" y1="98" x2="82" y2="101" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      <line x1="46" y1="104" x2="82" y2="104" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      <line x1="106" y1="101" x2="142" y2="98" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      <line x1="106" y1="104" x2="142" y2="104" stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />

      <ellipse cx="64" cy="100" rx="10" ry="7" fill={C.ruff} opacity="0.6" />
      <ellipse cx="124" cy="100" rx="10" ry="7" fill={C.ruff} opacity="0.6" />
    </>
  )
}

// ─── WALKING pose — mid-stride, side view ────────────────────────────────────
function DidiWalking({ flip }: { flip?: boolean }) {
  return (
    <g transform={flip ? 'scale(-1,1) translate(-200,0)' : undefined}>
      {/* Ground shadow */}
      <ellipse cx="100" cy="188" rx="55" ry="6" fill={C.shadow} />

      {/* === BODY — elongated walking shape === */}
      <ellipse cx="100" cy="158" rx="58" ry="36" fill={C.bodyMain} />
      {/* Back color point */}
      <ellipse cx="128" cy="158" rx="36" ry="28" fill={C.pointMid} opacity="0.35" />
      {/* Belly lighter */}
      <ellipse cx="88" cy="166" rx="36" ry="18" fill={C.ruff} opacity="0.5" />

      {/* === CHEST RUFF — visible from side === */}
      <ellipse cx="60" cy="148" rx="24" ry="20" fill={C.ruff} />
      <ellipse cx="56" cy="144" rx="18" ry="15" fill={C.ruff} />

      {/* === LEGS — walking stride === */}
      {/* Front left leg — forward */}
      <path d="M 68 172 Q 62 178 58 186" fill="none" stroke={C.bodyMain} strokeWidth="12" strokeLinecap="round" />
      <ellipse cx="57" cy="186" rx="10" ry="6" fill={C.ruff} />
      {/* Front right leg — back */}
      <path d="M 80 174 Q 78 180 80 188" fill="none" stroke={C.bodyShade} strokeWidth="11" strokeLinecap="round" />
      <ellipse cx="80" cy="188" rx="9" ry="5" fill={C.ruff} opacity="0.8" />
      {/* Back left leg — forward */}
      <path d="M 120 172 Q 126 178 128 186" fill="none" stroke={C.bodyMain} strokeWidth="12" strokeLinecap="round" />
      <ellipse cx="128" cy="186" rx="10" ry="6" fill={C.ruff} />
      {/* Back right leg — back */}
      <path d="M 132 174 Q 136 180 138 188" fill="none" stroke={C.bodyShade} strokeWidth="11" strokeLinecap="round" />
      <ellipse cx="138" cy="188" rx="9" ry="5" fill={C.ruff} opacity="0.8" />

      {/* === TAIL — raised and curved === */}
      <path d="M 154 152 Q 170 136 166 114 Q 162 96 150 102 Q 142 108 146 128 Q 148 144 154 152" fill={C.pointDark} />
      <path d="M 158 148 Q 172 132 168 110" fill="none" stroke={C.pointMid} strokeWidth="2" opacity="0.5" strokeLinecap="round" />

      {/* === HEAD — side profile === */}
      <circle cx="62" cy="118" r="38" fill={C.bodyMain} />
      {/* Head shading */}
      <ellipse cx="46" cy="120" rx="14" ry="18" fill={C.bodyShade} opacity="0.35" />

      {/* === FACE MASK — side view === */}
      {/* Dark mask on top/back of head */}
      <path d="M 36 104 Q 32 114 34 128 Q 38 140 48 144 Q 56 148 64 144 Q 72 140 74 132 Q 76 124 72 116 Q 68 108 72 100 Q 64 88 52 92 Q 42 96 36 104 Z" fill={C.pointDark} />
      {/* Front face lighter — white blaze visible */}
      <ellipse cx="74" cy="118" rx="16" ry="20" fill={C.bodyMain} />
      <ellipse cx="76" cy="116" rx="12" ry="16" fill={C.ruff} opacity="0.8" />

      {/* === EAR — side view === */}
      <path d="M 40 100 L 32 76 L 54 96" fill={C.pointDark} />
      <path d="M 42 98 L 36 78 L 52 96" fill={C.pointMid} opacity="0.7" />

      {/* === EYE — side view, bright blue === */}
      <ellipse cx="72" cy="112" rx="10" ry="9" fill="white" />
      <ellipse cx="72" cy="112" rx="8" ry="7" fill={C.eyeOuter} />
      <ellipse cx="72" cy="112" rx="5" ry="6" fill={C.eyeInner} />
      <ellipse cx="72" cy="112" rx="3" ry="4" fill={C.eyePupil} />
      <circle cx="75" cy="109" r="2.5" fill={C.eyeShine} opacity="0.9" />

      {/* === NOSE — side view === */}
      <ellipse cx="82" cy="124" rx="5" ry="4" fill={C.nose} />
      <ellipse cx="82" cy="124" rx="3" ry="2.5" fill={C.noseDark} opacity="0.4" />

      {/* === MOUTH — side view === */}
      <path d="M 82 128 Q 78 132 74 130" fill="none" stroke={C.mouth} strokeWidth="1.6" strokeLinecap="round" />

      {/* === WHISKERS — side view === */}
      <line x1="84" y1="122" x2="110" y2="118" stroke={C.whisker} strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
      <line x1="84" y1="126" x2="110" y2="126" stroke={C.whisker} strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
      <line x1="84" y1="130" x2="108" y2="134" stroke={C.whisker} strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />

      {/* Cheek fur */}
      <ellipse cx="68" cy="128" rx="8" ry="6" fill={C.ruff} opacity="0.6" />
    </g>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function DidiSvg({ pose, size = 120, className, facingLeft = false }: DidiSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      aria-label={`Didi the cat — ${pose}`}
      role="img"
    >
      {pose === 'idle'     && <DidiIdle flip={facingLeft} />}
      {pose === 'sleeping' && <DidiSleeping />}
      {pose === 'yawning'  && <DidiYawning />}
      {pose === 'playing'  && <DidiPlaying />}
      {pose === 'walking'  && <DidiWalking flip={facingLeft} />}
    </svg>
  )
}
