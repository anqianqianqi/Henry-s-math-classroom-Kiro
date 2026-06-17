'use client'

import { useState, useEffect, useRef } from 'react'

interface MagicBookRevealProps {
  title: string
  date: string
  /** Left page: the problem content */
  children: React.ReactNode
  /**
   * Right page: the solution form / submitted answer.
   * On desktop this renders as the right-hand page of the open book.
   * On mobile it renders below the problem page as a normal flow section.
   * If omitted the open book renders full-width (problem only).
   */
  solutionSlot?: React.ReactNode
}

/**
 * MagicBookReveal — ancient book opening animation for challenge problems.
 *
 * Desktop (≥ 768 px):
 *   Closed  → dark leather cover with gold filigree + "Open the Book" prompt
 *   Opening → 3-D page-turn with gold sparkles
 *   Open    → two-page spread: left = problem, right = solution form
 *
 * Mobile (< 768 px):
 *   Same cover/animation, but the open book shows only the problem on one
 *   parchment page. The solution slot falls below as a normal scroll section.
 */
export function MagicBookReveal({ title, date, children, solutionSlot }: MagicBookRevealProps) {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open'>('closed')
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; angle: number; delay: number }[]
  >([])
  const bookRef = useRef<HTMLDivElement>(null)

  function openBook() {
    if (phase !== 'closed') return
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

  /* ─── shared parchment page decorations ─── */
  const ParchmentDecor = () => (
    <>
      {/* Horizontal ruled lines */}
      <div
        className="absolute inset-x-0 top-0 bottom-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(100,60,10,0.5) 27px, rgba(100,60,10,0.5) 28px)',
          backgroundPositionY: '56px',
        }}
      />
      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(80,40,5,0.12) 100%)',
        }}
      />
      {/* Top gold rule */}
      <div
        className="absolute top-0 inset-x-0 h-1 pointer-events-none opacity-60"
        style={{ background: 'linear-gradient(to right, #c8a05a, #d4a842, #c8a05a, #d4a842, #c8a05a)' }}
      />
      {/* Bottom gold rule */}
      <div
        className="absolute bottom-0 inset-x-0 h-1 pointer-events-none opacity-60"
        style={{ background: 'linear-gradient(to right, #c8a05a, #d4a842, #c8a05a, #d4a842, #c8a05a)' }}
      />
    </>
  )

  const parchmentBg = 'linear-gradient(to bottom, #fdf3e3 0%, #f5e6c8 100%)'

  return (
    <div ref={bookRef} className="relative w-full mb-6" style={{ perspective: '1400px' }}>

      {/* ── Sparkle particles ── */}
      {particles.map(p => (
        <div
          key={p.id}
          className="pointer-events-none absolute z-50 text-yellow-400 text-lg select-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            animation: 'sparkle-fly 1.2s ease-out forwards',
            animationDelay: `${p.delay}s`,
            opacity: 0,
            transform: `rotate(${p.angle}deg)`,
          }}
        >
          ✦
        </div>
      ))}

      {/* ── Closed / opening cover ── */}
      {phase !== 'open' && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Open the challenge book"
          onClick={openBook}
          className="relative w-full cursor-pointer select-none"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Spine */}
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
              animation: phase === 'opening'
                ? 'page-turn 1s cubic-bezier(0.4,0,0.2,1) forwards'
                : undefined,
            }}
          >
            {/* Aged grain overlay */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 4px)',
              }}
            />
            {/* Gold filigree borders */}
            <div
              className="absolute inset-3 rounded pointer-events-none"
              style={{ border: '2px solid rgba(212,175,55,0.6)', boxShadow: 'inset 0 0 12px rgba(212,175,55,0.15)' }}
            />
            <div
              className="absolute inset-5 rounded pointer-events-none"
              style={{ border: '1px solid rgba(212,175,55,0.3)' }}
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

            {/* Cover text */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-[220px] px-8 py-10 text-center">
              <div className="text-4xl mb-4" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}>
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
                style={{ color: 'rgba(245,230,176,0.7)', fontFamily: '"Georgia", serif', fontStyle: 'italic' }}
              >
                {date}
              </p>
              <div
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold"
                style={{
                  background: 'rgba(212,175,55,0.18)',
                  border: '1px solid rgba(212,175,55,0.5)',
                  color: '#f5e6b0',
                  animation: 'pulse-glow 2s ease-in-out infinite',
                }}
              >
                <span style={{ animation: 'wiggle 1.5s ease-in-out infinite', display: 'inline-block' }}>📜</span>
                <span>Open the Book</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Open book ── */}
      {phase === 'open' && (
        <>
          {/* ════ DESKTOP: two-page spread ════ */}
          <div
            className="hidden md:flex relative rounded-lg overflow-hidden"
            style={{
              animation: 'book-settle 0.4s ease-out forwards',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              minHeight: '480px',
            }}
          >
            {/* ── Left page: Problem ── */}
            <div
              className="relative flex-1 overflow-y-auto"
              style={{
                background: parchmentBg,
                borderRight: '3px solid rgba(100,60,10,0.2)',
                boxShadow: 'inset -6px 0 18px rgba(0,0,0,0.12)',
                maxHeight: '80vh',
              }}
            >
              <ParchmentDecor />
              {/* Left margin red rule */}
              <div
                className="absolute inset-y-0 left-8 w-px pointer-events-none opacity-30"
                style={{ background: 'rgba(200,100,60,0.6)' }}
              />
              <div
                className="relative z-10 px-10 py-8"
                style={{ animation: 'content-fade-in 0.5s ease-out 0.1s both' }}
              >
                <div className="text-center mb-5">
                  <div
                    className="inline-flex items-center gap-3 text-sm"
                    style={{
                      color: 'rgba(100,60,10,0.6)',
                      fontFamily: 'Georgia, serif',
                      fontStyle: 'italic',
                    }}
                  >
                    <span>— ✦ —</span>
                    <span>{date}</span>
                    <span>— ✦ —</span>
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: '"Georgia", "Times New Roman", serif',
                    color: '#2d1a00',
                    lineHeight: '1.8',
                  }}
                >
                  {children}
                </div>
                {/* Page number */}
                <div
                  className="text-center mt-6 text-xs"
                  style={{ color: 'rgba(100,60,10,0.4)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                >
                  i
                </div>
              </div>
            </div>

            {/* ── Spine shadow ── */}
            <div
              className="absolute inset-y-0 pointer-events-none z-10"
              style={{
                left: '50%',
                width: '12px',
                transform: 'translateX(-50%)',
                background:
                  'linear-gradient(to right, rgba(0,0,0,0.18), rgba(0,0,0,0.04) 40%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0.18))',
              }}
            />

            {/* ── Right page: Solution ── */}
            <div
              className="relative flex-1 overflow-y-auto"
              style={{
                background: parchmentBg,
                maxHeight: '80vh',
              }}
            >
              <ParchmentDecor />
              {/* Left margin red rule */}
              <div
                className="absolute inset-y-0 left-8 w-px pointer-events-none opacity-30"
                style={{ background: 'rgba(200,100,60,0.6)' }}
              />
              <div
                className="relative z-10 px-10 py-8"
                style={{ animation: 'content-fade-in 0.5s ease-out 0.2s both' }}
              >
                {/* Section heading */}
                <div className="text-center mb-5">
                  <p
                    className="text-sm font-semibold tracking-widest uppercase"
                    style={{ color: 'rgba(100,60,10,0.5)', fontFamily: 'Georgia, serif', letterSpacing: '0.15em' }}
                  >
                    ✍ Your Answer
                  </p>
                </div>

                {solutionSlot ? (
                  <div
                    style={{
                      fontFamily: '"Georgia", "Times New Roman", serif',
                      color: '#2d1a00',
                    }}
                  >
                    {solutionSlot}
                  </div>
                ) : (
                  <p
                    className="text-center text-sm italic"
                    style={{ color: 'rgba(100,60,10,0.4)', fontFamily: 'Georgia, serif' }}
                  >
                    — this page is blank —
                  </p>
                )}

                {/* Page number */}
                <div
                  className="text-center mt-6 text-xs"
                  style={{ color: 'rgba(100,60,10,0.4)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                >
                  ii
                </div>
              </div>
            </div>
          </div>

          {/* ════ MOBILE: single parchment page (problem only) ════ */}
          <div
            className="block md:hidden relative rounded-lg overflow-hidden"
            style={{
              animation: 'book-settle 0.4s ease-out forwards',
              background: parchmentBg,
              boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
            }}
          >
            <ParchmentDecor />
            <div
              className="absolute inset-y-0 left-6 w-px pointer-events-none opacity-25"
              style={{ background: 'rgba(200,100,60,0.6)' }}
            />
            <div
              className="relative z-10 px-6 py-6"
              style={{ animation: 'content-fade-in 0.5s ease-out 0.1s both' }}
            >
              <div className="text-center mb-4">
                <div
                  className="inline-flex items-center gap-2 text-xs"
                  style={{ color: 'rgba(100,60,10,0.6)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                >
                  <span>— ✦ —</span>
                  <span>{date}</span>
                  <span>— ✦ —</span>
                </div>
              </div>
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

          {/* Mobile: solution slot rendered below as normal flow */}
          {solutionSlot && (
            <div className="block md:hidden mt-4">
              {solutionSlot}
            </div>
          )}
        </>
      )}

      {/* ── Keyframe styles ── */}
      <style jsx>{`
        @keyframes page-turn {
          0%   { transform: rotateY(0deg);    box-shadow: 4px 6px 18px rgba(0,0,0,0.5); }
          60%  { transform: rotateY(-90deg);  box-shadow: 0 8px 40px rgba(0,0,0,0.7); }
          100% { transform: rotateY(-175deg); opacity: 0; box-shadow: none; }
        }
        @keyframes book-settle {
          from { transform: scale(0.97) translateY(6px); opacity: 0.8; }
          to   { transform: scale(1)    translateY(0);   opacity: 1; }
        }
        @keyframes content-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0   rgba(212,175,55,0); }
          50%       { box-shadow: 0 0 12px rgba(212,175,55,0.4); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-8deg); }
          50%       { transform: rotate(8deg); }
        }
        @keyframes sparkle-fly {
          0%   { opacity: 0; transform: rotate(0deg) translateY(0)    scale(0.5); }
          30%  { opacity: 1; }
          100% { opacity: 0; transform: rotate(0deg) translateY(-60px) scale(1.5); }
        }
      `}</style>
    </div>
  )
}
