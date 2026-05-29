// components/pet/BackgroundScene.tsx
// Renders one of five stage-specific backgrounds as inline SVG.
// Each scene has at least two unique illustrated elements.
// Applies a 600ms CSS cross-fade transition when the `stage` prop changes.

'use client'

import { useEffect, useRef, useState } from 'react'
import type { EvolutionStage } from '@/lib/types/pet'

interface BackgroundSceneProps {
  stage: EvolutionStage
  className?: string
}

// ─── CSS keyframes injected once ─────────────────────────────────────────────

const BACKGROUND_STYLES = `
@keyframes bgCloudDrift {
  0%   { transform: translateX(0); }
  50%  { transform: translateX(12px); }
  100% { transform: translateX(0); }
}
@keyframes bgTwinkle {
  0%   { opacity: 0.4; }
  50%  { opacity: 1.0; }
  100% { opacity: 0.4; }
}
@keyframes bgGrassWave {
  0%   { transform: rotate(0deg); transform-origin: bottom center; }
  50%  { transform: rotate(3deg); transform-origin: bottom center; }
  100% { transform: rotate(0deg); transform-origin: bottom center; }
}
`

// ─── Scene: Nest (egg stage) ──────────────────────────────────────────────────
// Warm browns/tans, illustrated nest with straw/twigs, cozy feel

function NestScene() {
  return (
    <svg
      viewBox="0 0 400 300"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-hidden="true"
    >
      {/* Sky gradient — warm amber/tan */}
      <defs>
        <linearGradient id="nestSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="60%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="nestGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#92400E" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
      </defs>

      {/* Background sky */}
      <rect width="400" height="300" fill="url(#nestSky)" />

      {/* Ground */}
      <rect x="0" y="230" width="400" height="70" fill="url(#nestGround)" />

      {/* Illustrated element 1: Large nest made of twigs/straw */}
      {/* Outer nest rim */}
      <ellipse cx="200" cy="248" rx="110" ry="28" fill="#92400E" />
      <ellipse cx="200" cy="244" rx="100" ry="24" fill="#78350F" />
      {/* Nest interior */}
      <ellipse cx="200" cy="240" rx="80" ry="18" fill="#B45309" />
      {/* Straw/twig details — crossing lines */}
      <line x1="110" y1="248" x2="160" y2="230" stroke="#D97706" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <line x1="120" y1="252" x2="175" y2="235" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <line x1="290" y1="248" x2="240" y2="230" stroke="#D97706" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <line x1="280" y1="252" x2="225" y2="235" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <line x1="140" y1="255" x2="200" y2="238" stroke="#B45309" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <line x1="260" y1="255" x2="200" y2="238" stroke="#B45309" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <line x1="130" y1="244" x2="190" y2="232" stroke="#D97706" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="270" y1="244" x2="210" y2="232" stroke="#D97706" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      {/* Nest inner soft lining */}
      <ellipse cx="200" cy="238" rx="60" ry="12" fill="#FDE68A" opacity="0.4" />

      {/* Illustrated element 2: Tree branch the nest sits on */}
      {/* Main branch */}
      <path d="M 0 220 Q 100 210 200 215 Q 300 220 400 210" fill="none" stroke="#78350F" strokeWidth="18" strokeLinecap="round" />
      <path d="M 0 220 Q 100 210 200 215 Q 300 220 400 210" fill="none" stroke="#92400E" strokeWidth="14" strokeLinecap="round" />
      {/* Branch texture lines */}
      <path d="M 50 218 Q 100 212 150 215" fill="none" stroke="#B45309" strokeWidth="2" opacity="0.5" />
      <path d="M 250 217 Q 300 213 350 215" fill="none" stroke="#B45309" strokeWidth="2" opacity="0.5" />
      {/* Small side twigs */}
      <path d="M 80 215 L 70 195 L 85 205" fill="none" stroke="#78350F" strokeWidth="6" strokeLinecap="round" />
      <path d="M 320 213 L 330 193 L 315 203" fill="none" stroke="#78350F" strokeWidth="6" strokeLinecap="round" />
      <path d="M 150 213 L 145 198" fill="none" stroke="#92400E" strokeWidth="4" strokeLinecap="round" />
      <path d="M 260 215 L 265 200" fill="none" stroke="#92400E" strokeWidth="4" strokeLinecap="round" />

      {/* Illustrated element 3: Warm glowing sun */}
      <circle cx="340" cy="55" r="36" fill="#FCD34D" opacity="0.9" />
      <circle cx="340" cy="55" r="28" fill="#FDE68A" />
      {/* Sun rays */}
      <line x1="340" y1="10" x2="340" y2="2" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />
      <line x1="370" y1="20" x2="376" y2="14" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />
      <line x1="385" y1="55" x2="393" y2="55" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />
      <line x1="370" y1="90" x2="376" y2="96" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />
      <line x1="310" y1="20" x2="304" y2="14" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />
      <line x1="295" y1="55" x2="287" y2="55" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />
      <line x1="310" y1="90" x2="304" y2="96" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />

      {/* Illustrated element 4: Soft fluffy clouds */}
      <g style={{ animation: 'bgCloudDrift 8s ease-in-out infinite' }}>
        <ellipse cx="80" cy="70" rx="45" ry="22" fill="white" opacity="0.7" />
        <ellipse cx="60" cy="78" rx="28" ry="18" fill="white" opacity="0.7" />
        <ellipse cx="105" cy="78" rx="30" ry="16" fill="white" opacity="0.7" />
      </g>
      <g style={{ animation: 'bgCloudDrift 11s ease-in-out infinite reverse' }}>
        <ellipse cx="230" cy="45" rx="38" ry="18" fill="white" opacity="0.5" />
        <ellipse cx="212" cy="52" rx="22" ry="14" fill="white" opacity="0.5" />
        <ellipse cx="252" cy="52" rx="24" ry="13" fill="white" opacity="0.5" />
      </g>

      {/* Illustrated element 5: Fallen leaves on ground */}
      <ellipse cx="50" cy="238" rx="14" ry="7" fill="#D97706" opacity="0.8" transform="rotate(-20, 50, 238)" />
      <ellipse cx="350" cy="242" rx="12" ry="6" fill="#B45309" opacity="0.7" transform="rotate(15, 350, 242)" />
      <ellipse cx="160" cy="235" rx="10" ry="5" fill="#92400E" opacity="0.6" transform="rotate(-10, 160, 235)" />
    </svg>
  )
}

// ─── Scene: Meadow (baby stage) ───────────────────────────────────────────────
// Greens, illustrated grass/flowers, sunny sky

function MeadowScene() {
  return (
    <svg
      viewBox="0 0 400 300"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="meadowSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#BAE6FD" />
          <stop offset="60%" stopColor="#7DD3FC" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="meadowGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width="400" height="300" fill="url(#meadowSky)" />

      {/* Ground */}
      <rect x="0" y="210" width="400" height="90" fill="url(#meadowGround)" />

      {/* Bright sun */}
      <circle cx="60" cy="55" r="32" fill="#FDE68A" opacity="0.95" />
      <circle cx="60" cy="55" r="24" fill="#FEF3C7" />
      <line x1="60" y1="14" x2="60" y2="6" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />
      <line x1="88" y1="27" x2="94" y2="21" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />
      <line x1="101" y1="55" x2="109" y2="55" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />
      <line x1="88" y1="83" x2="94" y2="89" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />
      <line x1="32" y1="27" x2="26" y2="21" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />
      <line x1="19" y1="55" x2="11" y2="55" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />
      <line x1="32" y1="83" x2="26" y2="89" stroke="#FCD34D" strokeWidth="3" strokeLinecap="round" />

      {/* Clouds */}
      <g style={{ animation: 'bgCloudDrift 9s ease-in-out infinite' }}>
        <ellipse cx="200" cy="65" rx="55" ry="24" fill="white" opacity="0.85" />
        <ellipse cx="175" cy="74" rx="32" ry="20" fill="white" opacity="0.85" />
        <ellipse cx="228" cy="74" rx="36" ry="18" fill="white" opacity="0.85" />
      </g>
      <g style={{ animation: 'bgCloudDrift 13s ease-in-out infinite reverse' }}>
        <ellipse cx="330" cy="45" rx="40" ry="18" fill="white" opacity="0.65" />
        <ellipse cx="312" cy="52" rx="24" ry="14" fill="white" opacity="0.65" />
        <ellipse cx="352" cy="52" rx="26" ry="13" fill="white" opacity="0.65" />
      </g>

      {/* Illustrated element 1: Grass blades */}
      {/* Back row of grass */}
      <g opacity="0.7">
        <path d="M 20 210 Q 18 190 22 175 Q 26 190 24 210" fill="#22C55E" />
        <path d="M 50 210 Q 47 188 52 172 Q 57 188 54 210" fill="#16A34A" />
        <path d="M 90 210 Q 88 192 93 178 Q 97 192 95 210" fill="#22C55E" />
        <path d="M 130 210 Q 128 190 133 176 Q 137 190 135 210" fill="#16A34A" />
        <path d="M 170 210 Q 168 188 173 174 Q 177 188 175 210" fill="#22C55E" />
        <path d="M 210 210 Q 208 192 213 178 Q 217 192 215 210" fill="#16A34A" />
        <path d="M 250 210 Q 248 190 253 176 Q 257 190 255 210" fill="#22C55E" />
        <path d="M 290 210 Q 288 188 293 174 Q 297 188 295 210" fill="#16A34A" />
        <path d="M 330 210 Q 328 192 333 178 Q 337 192 335 210" fill="#22C55E" />
        <path d="M 370 210 Q 368 190 373 176 Q 377 190 375 210" fill="#16A34A" />
      </g>
      {/* Front row of grass — taller, animated */}
      <g style={{ animation: 'bgGrassWave 4s ease-in-out infinite' }}>
        <path d="M 35 215 Q 32 192 37 174 Q 42 192 40 215" fill="#4ADE80" />
        <path d="M 70 215 Q 67 190 72 170 Q 77 190 75 215" fill="#22C55E" />
        <path d="M 110 215 Q 107 194 112 176 Q 116 194 114 215" fill="#4ADE80" />
        <path d="M 150 215 Q 147 192 152 172 Q 157 192 155 215" fill="#22C55E" />
        <path d="M 190 215 Q 187 190 192 170 Q 197 190 195 215" fill="#4ADE80" />
        <path d="M 230 215 Q 227 194 232 176 Q 236 194 234 215" fill="#22C55E" />
        <path d="M 270 215 Q 267 192 272 172 Q 277 192 275 215" fill="#4ADE80" />
        <path d="M 310 215 Q 307 190 312 170 Q 317 190 315 215" fill="#22C55E" />
        <path d="M 350 215 Q 347 194 352 176 Q 356 194 354 215" fill="#4ADE80" />
        <path d="M 385 215 Q 382 192 387 172 Q 392 192 390 215" fill="#22C55E" />
      </g>

      {/* Illustrated element 2: Flowers */}
      {/* Flower 1 — yellow daisy */}
      <line x1="80" y1="240" x2="80" y2="210" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="80" cy="207" r="10" fill="#FDE68A" />
      <circle cx="80" cy="207" r="5" fill="#F59E0B" />
      <ellipse cx="80" cy="196" rx="4" ry="7" fill="#FDE68A" />
      <ellipse cx="80" cy="218" rx="4" ry="7" fill="#FDE68A" />
      <ellipse cx="69" cy="207" rx="7" ry="4" fill="#FDE68A" />
      <ellipse cx="91" cy="207" rx="7" ry="4" fill="#FDE68A" />

      {/* Flower 2 — pink flower */}
      <line x1="160" y1="238" x2="160" y2="212" stroke="#15803D" strokeWidth="3" strokeLinecap="round" />
      <circle cx="160" cy="209" r="9" fill="#FDA4AF" />
      <circle cx="160" cy="209" r="4" fill="#F43F5E" />
      <ellipse cx="160" cy="199" rx="4" ry="6" fill="#FDA4AF" />
      <ellipse cx="160" cy="219" rx="4" ry="6" fill="#FDA4AF" />
      <ellipse cx="150" cy="209" rx="6" ry="4" fill="#FDA4AF" />
      <ellipse cx="170" cy="209" rx="6" ry="4" fill="#FDA4AF" />

      {/* Flower 3 — white flower */}
      <line x1="300" y1="240" x2="300" y2="213" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="300" cy="210" r="9" fill="white" opacity="0.9" />
      <circle cx="300" cy="210" r="4" fill="#FCD34D" />
      <ellipse cx="300" cy="200" rx="4" ry="6" fill="white" opacity="0.9" />
      <ellipse cx="300" cy="220" rx="4" ry="6" fill="white" opacity="0.9" />
      <ellipse cx="290" cy="210" rx="6" ry="4" fill="white" opacity="0.9" />
      <ellipse cx="310" cy="210" rx="6" ry="4" fill="white" opacity="0.9" />

      {/* Flower 4 — purple flower */}
      <line x1="340" y1="236" x2="340" y2="212" stroke="#15803D" strokeWidth="3" strokeLinecap="round" />
      <circle cx="340" cy="209" r="8" fill="#C4B5FD" />
      <circle cx="340" cy="209" r="4" fill="#7C3AED" />
      <ellipse cx="340" cy="200" rx="3.5" ry="6" fill="#C4B5FD" />
      <ellipse cx="340" cy="218" rx="3.5" ry="6" fill="#C4B5FD" />
      <ellipse cx="331" cy="209" rx="6" ry="3.5" fill="#C4B5FD" />
      <ellipse cx="349" cy="209" rx="6" ry="3.5" fill="#C4B5FD" />

      {/* Illustrated element 3: Butterfly */}
      <g transform="translate(240, 155)">
        <ellipse cx="-12" cy="-5" rx="14" ry="9" fill="#FDE68A" opacity="0.85" transform="rotate(-20, -12, -5)" />
        <ellipse cx="12" cy="-5" rx="14" ry="9" fill="#FDE68A" opacity="0.85" transform="rotate(20, 12, -5)" />
        <ellipse cx="-10" cy="6" rx="9" ry="6" fill="#F59E0B" opacity="0.75" transform="rotate(15, -10, 6)" />
        <ellipse cx="10" cy="6" rx="9" ry="6" fill="#F59E0B" opacity="0.75" transform="rotate(-15, 10, 6)" />
        <ellipse cx="0" cy="0" rx="3" ry="8" fill="#92400E" />
        <line x1="-4" y1="-8" x2="-10" y2="-18" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="4" y1="-8" x2="10" y2="-18" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

// ─── Scene: Mountain (teen stage) ────────────────────────────────────────────
// Blues/grays, illustrated mountains/rocks, clouds

function MountainScene() {
  return (
    <svg
      viewBox="0 0 400 300"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mountainSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E3A5F" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
        <linearGradient id="mountainFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="mountainNear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6B7280" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
        <linearGradient id="mountainGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4B5563" />
          <stop offset="100%" stopColor="#1F2937" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width="400" height="300" fill="url(#mountainSky)" />

      {/* Illustrated element 1: Far mountains (blue/misty) */}
      <polygon points="0,200 60,100 120,160 180,80 240,140 300,90 360,130 400,100 400,200" fill="url(#mountainFar)" opacity="0.6" />
      {/* Snow caps on far mountains */}
      <polygon points="180,80 165,110 195,110" fill="white" opacity="0.8" />
      <polygon points="300,90 286,118 314,118" fill="white" opacity="0.7" />
      <polygon points="60,100 48,126 72,126" fill="white" opacity="0.6" />

      {/* Illustrated element 2: Near mountains (gray/dark) */}
      <polygon points="0,300 0,220 80,120 160,200 220,130 300,190 360,110 400,160 400,300" fill="url(#mountainNear)" />
      {/* Snow cap on main peak */}
      <polygon points="220,130 204,165 236,165" fill="white" opacity="0.9" />
      <polygon points="360,110 346,142 374,142" fill="white" opacity="0.85" />

      {/* Ground/rocky floor */}
      <rect x="0" y="260" width="400" height="40" fill="url(#mountainGround)" />

      {/* Illustrated element 3: Foreground rocks */}
      {/* Large rock left */}
      <ellipse cx="60" cy="272" rx="42" ry="22" fill="#374151" />
      <ellipse cx="60" cy="268" rx="38" ry="18" fill="#4B5563" />
      <ellipse cx="52" cy="264" rx="18" ry="10" fill="#6B7280" opacity="0.5" />
      {/* Medium rock right */}
      <ellipse cx="340" cy="275" rx="35" ry="18" fill="#374151" />
      <ellipse cx="340" cy="271" rx="31" ry="14" fill="#4B5563" />
      <ellipse cx="332" cy="267" rx="14" ry="8" fill="#6B7280" opacity="0.5" />
      {/* Small rocks */}
      <ellipse cx="160" cy="278" rx="20" ry="10" fill="#4B5563" />
      <ellipse cx="250" cy="276" rx="16" ry="8" fill="#374151" />
      <ellipse cx="200" cy="282" rx="12" ry="6" fill="#4B5563" />

      {/* Illustrated element 4: Clouds (wispy mountain clouds) */}
      <g style={{ animation: 'bgCloudDrift 10s ease-in-out infinite' }}>
        <ellipse cx="120" cy="55" rx="60" ry="20" fill="white" opacity="0.6" />
        <ellipse cx="95" cy="63" rx="35" ry="16" fill="white" opacity="0.6" />
        <ellipse cx="148" cy="63" rx="38" ry="14" fill="white" opacity="0.6" />
      </g>
      <g style={{ animation: 'bgCloudDrift 14s ease-in-out infinite reverse' }}>
        <ellipse cx="310" cy="40" rx="50" ry="16" fill="white" opacity="0.45" />
        <ellipse cx="288" cy="48" rx="28" ry="12" fill="white" opacity="0.45" />
        <ellipse cx="334" cy="48" rx="30" ry="11" fill="white" opacity="0.45" />
      </g>

      {/* Illustrated element 5: Pine trees silhouette */}
      {/* Left pine */}
      <polygon points="30,260 50,200 70,260" fill="#1F2937" opacity="0.8" />
      <polygon points="35,240 50,190 65,240" fill="#374151" opacity="0.7" />
      {/* Right pine */}
      <polygon points="330,260 350,205 370,260" fill="#1F2937" opacity="0.8" />
      <polygon points="335,242 350,195 365,242" fill="#374151" opacity="0.7" />
      {/* Center-left pine */}
      <polygon points="140,260 155,215 170,260" fill="#1F2937" opacity="0.6" />
    </svg>
  )
}

// ─── Scene: Sky (adult stage) ─────────────────────────────────────────────────
// Sky blues, illustrated clouds, birds/stars

function SkyScene() {
  return (
    <svg
      viewBox="0 0 400 300"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="skyBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="50%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#BAE6FD" />
        </linearGradient>
      </defs>

      {/* Sky background */}
      <rect width="400" height="300" fill="url(#skyBg)" />

      {/* Illustrated element 1: Large fluffy clouds */}
      <g style={{ animation: 'bgCloudDrift 8s ease-in-out infinite' }}>
        {/* Big cloud center */}
        <ellipse cx="200" cy="100" rx="80" ry="35" fill="white" opacity="0.92" />
        <ellipse cx="160" cy="112" rx="48" ry="30" fill="white" opacity="0.92" />
        <ellipse cx="242" cy="112" rx="52" ry="28" fill="white" opacity="0.92" />
        <ellipse cx="200" cy="120" rx="70" ry="22" fill="white" opacity="0.92" />
        {/* Cloud shadow/depth */}
        <ellipse cx="200" cy="125" rx="65" ry="14" fill="#BAE6FD" opacity="0.4" />
      </g>

      <g style={{ animation: 'bgCloudDrift 12s ease-in-out infinite reverse' }}>
        {/* Left cloud */}
        <ellipse cx="55" cy="65" rx="50" ry="22" fill="white" opacity="0.8" />
        <ellipse cx="32" cy="74" rx="30" ry="18" fill="white" opacity="0.8" />
        <ellipse cx="78" cy="74" rx="34" ry="16" fill="white" opacity="0.8" />
      </g>

      <g style={{ animation: 'bgCloudDrift 15s ease-in-out infinite' }}>
        {/* Right cloud */}
        <ellipse cx="345" cy="55" rx="45" ry="20" fill="white" opacity="0.75" />
        <ellipse cx="322" cy="63" rx="28" ry="16" fill="white" opacity="0.75" />
        <ellipse cx="368" cy="63" rx="30" ry="14" fill="white" opacity="0.75" />
      </g>

      {/* Small wispy clouds lower */}
      <g style={{ animation: 'bgCloudDrift 18s ease-in-out infinite reverse' }}>
        <ellipse cx="100" cy="200" rx="55" ry="18" fill="white" opacity="0.55" />
        <ellipse cx="78" cy="208" rx="32" ry="14" fill="white" opacity="0.55" />
        <ellipse cx="124" cy="208" rx="36" ry="12" fill="white" opacity="0.55" />
      </g>
      <g style={{ animation: 'bgCloudDrift 20s ease-in-out infinite' }}>
        <ellipse cx="310" cy="210" rx="50" ry="16" fill="white" opacity="0.5" />
        <ellipse cx="290" cy="218" rx="28" ry="12" fill="white" opacity="0.5" />
        <ellipse cx="332" cy="218" rx="32" ry="11" fill="white" opacity="0.5" />
      </g>

      {/* Illustrated element 2: Birds (V-shaped silhouettes) */}
      {/* Bird flock 1 — upper left */}
      <g fill="none" stroke="#0C4A6E" strokeWidth="2.5" strokeLinecap="round">
        <path d="M 60 40 Q 65 35 70 40" />
        <path d="M 75 36 Q 80 31 85 36" />
        <path d="M 50 48 Q 55 43 60 48" />
        <path d="M 85 44 Q 90 39 95 44" />
        <path d="M 68 52 Q 73 47 78 52" />
      </g>
      {/* Bird flock 2 — upper right */}
      <g fill="none" stroke="#0C4A6E" strokeWidth="2" strokeLinecap="round" opacity="0.7">
        <path d="M 300 30 Q 305 25 310 30" />
        <path d="M 315 26 Q 320 21 325 26" />
        <path d="M 290 38 Q 295 33 300 38" />
        <path d="M 325 34 Q 330 29 335 34" />
      </g>
      {/* Bird flock 3 — mid right */}
      <g fill="none" stroke="#075985" strokeWidth="2" strokeLinecap="round" opacity="0.6">
        <path d="M 340 150 Q 345 145 350 150" />
        <path d="M 355 146 Q 360 141 365 146" />
        <path d="M 330 158 Q 335 153 340 158" />
      </g>

      {/* Illustrated element 3: Sun peeking from top */}
      <circle cx="200" cy="-10" r="50" fill="#FDE68A" opacity="0.6" />
      <circle cx="200" cy="-10" r="38" fill="#FEF3C7" opacity="0.5" />

      {/* Illustrated element 4: Stars (faint, daytime) */}
      <g style={{ animation: 'bgTwinkle 3s ease-in-out infinite' }}>
        <circle cx="30" cy="20" r="2" fill="white" opacity="0.6" />
        <circle cx="370" cy="15" r="1.5" fill="white" opacity="0.5" />
        <circle cx="15" cy="80" r="1.5" fill="white" opacity="0.4" />
        <circle cx="385" cy="90" r="2" fill="white" opacity="0.5" />
      </g>
      <g style={{ animation: 'bgTwinkle 4s ease-in-out infinite reverse' }}>
        <circle cx="380" cy="180" r="1.5" fill="white" opacity="0.4" />
        <circle cx="10" cy="160" r="2" fill="white" opacity="0.45" />
      </g>

      {/* Illustrated element 5: Horizon haze */}
      <rect x="0" y="270" width="400" height="30" fill="#BAE6FD" opacity="0.5" />
      <rect x="0" y="285" width="400" height="15" fill="#7DD3FC" opacity="0.4" />
    </svg>
  )
}

// ─── Scene: Cosmos (legendary stage) ─────────────────────────────────────────
// Deep purples/blacks, illustrated stars/nebula, cosmic feel

function CosmosScene() {
  return (
    <svg
      viewBox="0 0 400 300"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cosmosBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0F0A1E" />
          <stop offset="40%" stopColor="#1E0A3C" />
          <stop offset="70%" stopColor="#0A0A2E" />
          <stop offset="100%" stopColor="#050510" />
        </linearGradient>
        <radialGradient id="nebula1" cx="30%" cy="40%" r="40%">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#4C1D95" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0F0A1E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nebula2" cx="70%" cy="60%" r="45%">
          <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.25" />
          <stop offset="50%" stopColor="#1D4ED8" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0F0A1E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nebula3" cx="55%" cy="25%" r="30%">
          <stop offset="0%" stopColor="#EC4899" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0F0A1E" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Deep space background */}
      <rect width="400" height="300" fill="url(#cosmosBg)" />

      {/* Illustrated element 1: Nebula clouds */}
      <rect width="400" height="300" fill="url(#nebula1)" />
      <rect width="400" height="300" fill="url(#nebula2)" />
      <rect width="400" height="300" fill="url(#nebula3)" />

      {/* Illustrated element 2: Stars — many sizes, twinkling */}
      {/* Large bright stars */}
      <g style={{ animation: 'bgTwinkle 2s ease-in-out infinite' }}>
        <circle cx="45" cy="30" r="2.5" fill="white" />
        <circle cx="355" cy="45" r="2.5" fill="white" />
        <circle cx="200" cy="20" r="2" fill="white" />
        <circle cx="120" cy="80" r="2.5" fill="#E0E7FF" />
        <circle cx="280" cy="70" r="2" fill="#E0E7FF" />
        <circle cx="380" cy="130" r="2.5" fill="white" />
        <circle cx="20" cy="150" r="2" fill="white" />
      </g>
      <g style={{ animation: 'bgTwinkle 3s ease-in-out infinite reverse' }}>
        <circle cx="90" cy="55" r="2" fill="#FDE68A" />
        <circle cx="310" cy="25" r="2.5" fill="#FDE68A" />
        <circle cx="170" cy="110" r="2" fill="white" />
        <circle cx="240" cy="140" r="2.5" fill="#E0E7FF" />
        <circle cx="60" cy="200" r="2" fill="white" />
        <circle cx="340" cy="180" r="2.5" fill="white" />
        <circle cx="150" cy="230" r="2" fill="#FDE68A" />
      </g>
      <g style={{ animation: 'bgTwinkle 4s ease-in-out infinite' }}>
        <circle cx="320" cy="250" r="2" fill="white" />
        <circle cx="80" cy="260" r="2.5" fill="#E0E7FF" />
        <circle cx="200" cy="270" r="2" fill="white" />
        <circle cx="390" cy="220" r="2" fill="#FDE68A" />
        <circle cx="10" cy="240" r="2.5" fill="white" />
      </g>

      {/* Medium stars */}
      <g opacity="0.7">
        <circle cx="130" cy="40" r="1.5" fill="white" />
        <circle cx="260" cy="50" r="1.5" fill="white" />
        <circle cx="30" cy="100" r="1.5" fill="#E0E7FF" />
        <circle cx="370" cy="90" r="1.5" fill="white" />
        <circle cx="190" cy="160" r="1.5" fill="white" />
        <circle cx="100" cy="180" r="1.5" fill="#FDE68A" />
        <circle cx="300" cy="160" r="1.5" fill="white" />
        <circle cx="220" cy="200" r="1.5" fill="#E0E7FF" />
        <circle cx="50" cy="280" r="1.5" fill="white" />
        <circle cx="360" cy="270" r="1.5" fill="white" />
        <circle cx="140" cy="290" r="1.5" fill="#FDE68A" />
        <circle cx="270" cy="285" r="1.5" fill="white" />
      </g>

      {/* Small star field */}
      <g opacity="0.45">
        <circle cx="75" cy="15" r="1" fill="white" />
        <circle cx="155" cy="25" r="1" fill="white" />
        <circle cx="225" cy="35" r="1" fill="white" />
        <circle cx="295" cy="15" r="1" fill="white" />
        <circle cx="345" cy="65" r="1" fill="white" />
        <circle cx="15" cy="65" r="1" fill="white" />
        <circle cx="55" cy="130" r="1" fill="white" />
        <circle cx="175" cy="90" r="1" fill="white" />
        <circle cx="325" cy="110" r="1" fill="white" />
        <circle cx="395" cy="160" r="1" fill="white" />
        <circle cx="5" cy="190" r="1" fill="white" />
        <circle cx="115" cy="145" r="1" fill="white" />
        <circle cx="255" cy="120" r="1" fill="white" />
        <circle cx="185" cy="240" r="1" fill="white" />
        <circle cx="285" cy="230" r="1" fill="white" />
        <circle cx="95" cy="250" r="1" fill="white" />
        <circle cx="375" cy="240" r="1" fill="white" />
        <circle cx="25" cy="300" r="1" fill="white" />
        <circle cx="395" cy="295" r="1" fill="white" />
      </g>

      {/* Illustrated element 3: Star sparkles (4-pointed) */}
      <g style={{ animation: 'bgTwinkle 2.5s ease-in-out infinite' }}>
        <path d="M 45 30 L 47 24 L 49 30 L 55 32 L 49 34 L 47 40 L 45 34 L 39 32 Z" fill="white" opacity="0.9" />
        <path d="M 355 45 L 357 39 L 359 45 L 365 47 L 359 49 L 357 55 L 355 49 L 349 47 Z" fill="white" opacity="0.85" />
      </g>
      <g style={{ animation: 'bgTwinkle 3.5s ease-in-out infinite reverse' }}>
        <path d="M 310 25 L 312 19 L 314 25 L 320 27 L 314 29 L 312 35 L 310 29 L 304 27 Z" fill="#FDE68A" opacity="0.8" />
        <path d="M 90 55 L 92 49 L 94 55 L 100 57 L 94 59 L 92 65 L 90 59 L 84 57 Z" fill="#FDE68A" opacity="0.75" />
      </g>

      {/* Illustrated element 4: Planet/moon */}
      <circle cx="340" cy="55" r="28" fill="#1E0A3C" />
      <circle cx="340" cy="55" r="26" fill="#2D1B69" />
      {/* Planet surface details */}
      <ellipse cx="332" cy="48" rx="10" ry="6" fill="#4C1D95" opacity="0.6" />
      <ellipse cx="348" cy="62" rx="8" ry="5" fill="#3B0764" opacity="0.5" />
      <ellipse cx="326" cy="60" rx="6" ry="4" fill="#4C1D95" opacity="0.4" />
      {/* Planet ring */}
      <ellipse cx="340" cy="55" rx="40" ry="10" fill="none" stroke="#7C3AED" strokeWidth="3" opacity="0.5" />
      <ellipse cx="340" cy="55" rx="40" ry="10" fill="none" stroke="#A78BFA" strokeWidth="1.5" opacity="0.3" />
      {/* Mask ring behind planet */}
      <ellipse cx="340" cy="55" rx="26" ry="26" fill="#2D1B69" />
      <circle cx="340" cy="55" r="26" fill="#2D1B69" />
      {/* Planet glow */}
      <circle cx="340" cy="55" r="28" fill="none" stroke="#7C3AED" strokeWidth="2" opacity="0.4" />

      {/* Illustrated element 5: Shooting star / comet */}
      <g style={{ opacity: 0.8 }}>
        <circle cx="80" cy="170" r="3" fill="white" />
        <path d="M 80 170 L 30 155" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <path d="M 80 170 L 25 160" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <path d="M 80 170 L 28 165" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.25" />
      </g>

      {/* Illustrated element 6: Distant galaxy swirl */}
      <g opacity="0.3">
        <ellipse cx="160" cy="240" rx="30" ry="12" fill="#7C3AED" transform="rotate(-30, 160, 240)" />
        <ellipse cx="160" cy="240" rx="20" ry="8" fill="#A78BFA" transform="rotate(-30, 160, 240)" />
        <circle cx="160" cy="240" r="4" fill="#DDD6FE" opacity="0.6" />
      </g>
    </svg>
  )
}

// ─── Scene map ────────────────────────────────────────────────────────────────

const SCENE_MAP: Record<EvolutionStage, React.ReactNode> = {
  egg: <NestScene />,
  baby: <MeadowScene />,
  teen: <MountainScene />,
  adult: <SkyScene />,
  legendary: <CosmosScene />,
}

// ─── BackgroundScene component ────────────────────────────────────────────────

/**
 * Renders a stage-specific illustrated background scene.
 * Applies a 600ms CSS cross-fade transition when the `stage` prop changes.
 * Fills its container (width: 100%, height: 100%).
 */
export default function BackgroundScene({ stage, className }: BackgroundSceneProps) {
  const [currentStage, setCurrentStage] = useState<EvolutionStage>(stage)
  const [nextStage, setNextStage] = useState<EvolutionStage | null>(null)
  const [fading, setFading] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Inject animation keyframes once
    const styleId = 'background-scene-styles'
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style')
      styleEl.id = styleId
      styleEl.textContent = BACKGROUND_STYLES
      document.head.appendChild(styleEl)
    }
  }, [])

  useEffect(() => {
    if (stage === currentStage) return

    // Start cross-fade: show next scene fading in over current
    setNextStage(stage)
    setFading(true)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setCurrentStage(stage)
      setNextStage(null)
      setFading(false)
    }, 600)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      {/* Current scene — fades out when transitioning */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transition: fading ? 'opacity 600ms ease-in-out' : 'none',
          opacity: fading ? 0 : 1,
        }}
      >
        {SCENE_MAP[currentStage]}
      </div>

      {/* Next scene — fades in when transitioning */}
      {nextStage !== null && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transition: 'opacity 600ms ease-in-out',
            opacity: fading ? 1 : 0,
          }}
        >
          {SCENE_MAP[nextStage]}
        </div>
      )}
    </div>
  )
}
