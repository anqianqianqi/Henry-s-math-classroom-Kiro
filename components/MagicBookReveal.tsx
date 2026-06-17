'use client'

import { useState, useEffect, useRef } from 'react'

interface MagicBookRevealProps {
  title: string
  date: string
  children: React.ReactNode
}

/**
 * MagicBookReveal — wraps challenge content in an ancient-book opening animation.
 *
 * On mount the book is closed (showing only the leather cover). The user taps/clicks
 * the cover and the left page folds back (CSS 3-D page-turn), revealing the parchment
 * pages with the challenge content inside.
 */
export function MagicBookReveal({ title, date, children }: MagicBookRevealProps) {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open'>('closed')
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; angle: number; delay: number }[]>([])
  const bookRef = useRef<HTMLDivElement>(null)

  function openBook() {
    if (phase !== 'closed') return
    // Spawn sparkle particles
    const newParticles = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: 30 + Math.random() * 40,
      y: 20 + Math.random() * 60,
      angle: Math.random() * 360,
      delay: Math.random() * 0.4,
    }))
    setParticles(newParticles)
    setPhase('opening')
    setTimeout(() => setPhase('open'), 1100)
    setTimeout(() => setParticles([]), 1600)
  }

  // Keyboard accessibility
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Enter' || e.key === ' ') && phase === 'closed') {
        e.preventDefault()
        openBook()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  return (
    <div
      ref={bookRef}
      className="relative w-full mb-6"
      style={{ perspective: '1400px' }}
    >
      {/* ── Sparkle particles ── */}
      {particles.map(p => (
        <div
          key={p.id}
          className="pointer-events-none absolute z-50 text-yellow-400 text-lg select-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            animation: `sparkle-fly 1.2s ease-out forwards`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.angle}deg)`,
            opacity: 0,
          }}
        >
          ✦
        </div>
      ))}

      {/* ── Closed book cover ── (hidden once open) */}
      {phase !== 'open' && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Open the challenge book"
          onClick={openBook}
          className="relative w-full cursor-pointer select-none"
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Book spine shadow on left */}
          <div
            className="absolute inset-y-0 left-0 w-6 rounded-l-sm z-10"
            style={{
              background: 'linear-gradient(to right, #3d1f00, #6b3a10)',
              boxShadow: 'inset -3px 0 8px rgba(0,0,0,0.5)',
            }}
          />

          {/* Front cover */}
          <div
            className="relative overflow-hidden rounded-r-lg rounded-l-sm"
            style={{
              background: 'linear-gradient(135deg, #7c4a1e 0%, #5a2d0c 40%, #3d1800 100%)',
              boxShadow:
                phase === 'opening'
                  ? '6px 8px 24px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.3)'
                  : '4px 6px 18px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.25)',
              minHeight: '220px',
              transformOrigin: 'left center',
              animation: phase === 'opening' ? 'page-turn 1s cubic-bezier(0.4,0,0.2,1) forwards' : undefined,
            }}
          >
            {/* Aged texture overlay */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 4px)',
              }}
            />

            {/* Gold border filigree */}
            <div
              className="absolute inset-3 rounded pointer-events-none"
              style={{
                border: '2px solid rgba(212,175,55,0.6)',
                boxShadow: 'inset 0 0 12px rgba(212,175,55,0.15)',
              }}
            />
            <div
              className="absolute inset-5 rounded pointer-events-none"
              style={{
                border: '1px solid rgba(212,175,55,0.3)',
              }}
            />

            {/* Corner ornaments */}
            {['top-3 left-3', 'top-3 right-3', 'bottom-3 left-3', 'bottom-3 right-3'].map(pos => (
              <div
                key={pos}
                className={`absolute ${pos} text-yellow-500 opacity-70 text-lg leading-none pointer-events-none`}
                style={{ textShadow: '0 0 6px rgba(212,175,55,0.6)' }}
              >
                ✦
              </div>
            ))}

            {/* Book title on cover */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-[220px] px-8 py-10 text-center">
              <div
                className="text-4xl mb-4"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}
              >
                📖
              </div>
              <h2
                className="text-xl font-bold mb-2 leading-snug"
                style={{
                  color: '#f5e6b0',
                  fontFamily: '"Georgia", "Times New Roman", serif',
                  textShadow: '0 1px 6px rgba(0,0,0,0.8), 0 0 20px rgba(212,175,55,0.3)',
                  letterSpacing: '0.04em',
                }}
              >
                {title}
              </h2>
              <p
                className="text-sm mb-6"
                style={{
                  color: 'rgba(245,230,176,0.7)',
                  fontFamily: '"Georgia", serif',
                  fontStyle: 'italic',
                }}
              >
                {date}
              </p>

              {/* Open prompt */}
              <div
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold"
                style={{
                  background: 'rgba(212,175,55,0.18)',
                  border: '1px solid rgba(212,175,55,0.5)',
                  color: '#f5e6b0',
                  animation: 'pulse-glow 2s ease-in-out infinite',
                }}
              >
                <span style={{ animation: 'wiggle 1.5s ease-in-out infinite' }}>📜</span>
                <span>Open the Book</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Open book ── (revealed after animation) */}
      {phase === 'open' && (
        <div
          className="relative rounded-lg overflow-hidden"
          style={{
            animation: 'book-settle 0.4s ease-out forwards',
            background: 'linear-gradient(to right, #f5e6c8 0%, #fdf3e3 50%, #f5e6c8 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 4px 0 12px rgba(0,0,0,0.08)',
          }}
        >
          {/* Centre spine line */}
          <div
            className="absolute inset-y-0 left-1/2 w-px pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, transparent, rgba(100,60,10,0.25) 20%, rgba(100,60,10,0.25) 80%, transparent)',
              boxShadow: '1px 0 4px rgba(0,0,0,0.1)',
              transform: 'translateX(-50%)',
            }}
          />

          {/* Left margin rule */}
          <div
            className="absolute inset-y-0 left-8 w-px pointer-events-none opacity-30"
            style={{ background: 'rgba(200,100,60,0.6)' }}
          />

          {/* Horizontal ruled lines (decorative) */}
          <div
            className="absolute inset-x-0 top-0 bottom-0 pointer-events-none opacity-10"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(100,60,10,0.5) 27px, rgba(100,60,10,0.5) 28px)',
              backgroundPositionY: '56px',
            }}
          />

          {/* Aged parchment vignette */}
          <div
            className="absolute inset-0 pointer-events-none rounded-lg"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 50%, rgba(80,40,5,0.12) 100%)',
            }}
          />

          {/* Page torn top edge decoration */}
          <div
            className="absolute top-0 inset-x-0 h-1 pointer-events-none"
            style={{
              background:
                'linear-gradient(to right, #c8a05a, #d4a842, #c8a05a, #d4a842, #c8a05a)',
              opacity: 0.6,
            }}
          />
          <div
            className="absolute bottom-0 inset-x-0 h-1 pointer-events-none"
            style={{
              background:
                'linear-gradient(to right, #c8a05a, #d4a842, #c8a05a, #d4a842, #c8a05a)',
              opacity: 0.6,
            }}
          />

          {/* Content */}
          <div
            className="relative z-10 px-8 py-8"
            style={{ animation: 'content-fade-in 0.5s ease-out 0.1s both' }}
          >
            {/* Chapter header ornament */}
            <div className="text-center mb-6">
              <div
                className="inline-flex items-center gap-3 text-sm"
                style={{ color: 'rgba(100,60,10,0.6)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
              >
                <span>— ✦ —</span>
                <span>{date}</span>
                <span>— ✦ —</span>
              </div>
            </div>

            {/* The actual challenge content */}
            <div
              style={{
                fontFamily: '"Georgia", "Times New Roman", serif',
                color: '#2d1a00',
                lineHeight: '1.8',
              }}
            >
              {children}
            </div>
          </div>
        </div>
      )}

      {/* ── Keyframe styles ── */}
      <style jsx>{`
        @keyframes page-turn {
          0%   { transform: rotateY(0deg); box-shadow: 4px 6px 18px rgba(0,0,0,0.5); }
          60%  { transform: rotateY(-90deg); box-shadow: 0 8px 40px rgba(0,0,0,0.7); }
          100% { transform: rotateY(-175deg); opacity: 0; box-shadow: none; }
        }

        @keyframes book-settle {
          from { transform: scale(0.97) translateY(6px); opacity: 0.8; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }

        @keyframes content-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 rgba(212,175,55,0); }
          50%       { box-shadow: 0 0 12px rgba(212,175,55,0.4); }
        }

        @keyframes wiggle {
          0%, 100% { transform: rotate(-8deg); }
          50%       { transform: rotate(8deg); }
        }

        @keyframes sparkle-fly {
          0%   { opacity: 0; transform: rotate(var(--angle, 0deg)) translateY(0) scale(0.5); }
          30%  { opacity: 1; }
          100% { opacity: 0; transform: rotate(var(--angle, 0deg)) translateY(-60px) scale(1.5); }
        }
      `}</style>
    </div>
  )
}
