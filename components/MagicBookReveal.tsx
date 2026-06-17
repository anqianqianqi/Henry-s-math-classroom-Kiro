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
   */
  solutionSlot?: React.ReactNode
}

/**
 * MagicBookReveal — ancient book opening animation for challenge problems.
 *
 * Desktop (≥ 768 px):
 *   Closed  → full-height dark leather cover with gold filigree + "Open the Book" prompt
 *   Opening → 3-D page-turn with gold sparkles
 *   Open    → two-page spread: left = problem, right = solution form
 *             Clicking the challenge image opens a full-screen lightbox (no new tab)
 *
 * Mobile (< 768 px):
 *   Same cover/animation, single parchment page for the problem, solution slot below.
 */
export function MagicBookReveal({ title, date, children, solutionSlot }: MagicBookRevealProps) {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open'>('closed')
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; angle: number; delay: number }[]
  >([])
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
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

  // Keyboard: Enter/Space opens book, Escape closes lightbox
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setLightboxSrc(null); return }
      if ((e.key === 'Enter' || e.key === ' ') && phase === 'closed') {
        e.preventDefault()
        openBook()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  // Intercept image clicks inside the left page to open lightbox instead of new tab
  function handlePageClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      const src = (target as HTMLImageElement).src
      if (src) {
        e.preventDefault()
        e.stopPropagation()
        setLightboxSrc(src)
      }
    }
  }

  /* ─── shared parchment decorations ─── */
  const ParchmentDecor = () => (
    <>
      <div
        className="absolute inset-x-0 top-0 bottom-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(30,80,40,0.5) 27px, rgba(30,80,40,0.5) 28px)',
          backgroundPositionY: '56px',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(20,60,30,0.10) 100%)' }}
      />
      <div
        className="absolute top-0 inset-x-0 h-1 pointer-events-none opacity-60"
        style={{ background: 'linear-gradient(to right, #7ab87a, #5da85d, #7ab87a, #5da85d, #7ab87a)' }}
      />
      <div
        className="absolute bottom-0 inset-x-0 h-1 pointer-events-none opacity-60"
        style={{ background: 'linear-gradient(to right, #7ab87a, #5da85d, #7ab87a, #5da85d, #7ab87a)' }}
      />
    </>
  )

  const parchmentBg = 'linear-gradient(to bottom, #f0f7f0 0%, #dff0e0 100%)'

  return (
    <>
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
              className="absolute inset-y-0 left-0 w-8 rounded-l-sm z-10"
              style={{
                background: 'linear-gradient(to right, #1a3a20, #2d6035, #3d7a45)',
                boxShadow: 'inset -4px 0 10px rgba(0,0,0,0.4)',
              }}
            />

            {/* Front cover — tall, full-width, portrait proportions */}
            <div
              className="relative overflow-hidden rounded-r-xl rounded-l-sm"
              style={{
                background: 'linear-gradient(160deg, #4a8a58 0%, #3a7048 35%, #2d5c3a 70%, #1e4028 100%)',
                boxShadow:
                  phase === 'opening'
                    ? '8px 10px 32px rgba(0,0,0,0.7), inset 0 0 40px rgba(0,0,0,0.4)'
                    : '6px 8px 24px rgba(0,0,0,0.55), inset 0 0 28px rgba(0,0,0,0.3)',
                minHeight: '480px',
                transformOrigin: 'left center',
                animation: phase === 'opening'
                  ? 'page-turn 1s cubic-bezier(0.4,0,0.2,1) forwards'
                  : undefined,
              }}
            >
              {/* Leather grain texture */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 3px), ' +
                    'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 5px)',
                }}
              />

              {/* Outer gold border */}
              <div
                className="absolute inset-4 rounded-lg pointer-events-none"
                style={{ border: '2px solid rgba(212,175,55,0.65)', boxShadow: 'inset 0 0 20px rgba(212,175,55,0.12)' }}
              />
              {/* Inner gold border */}
              <div
                className="absolute inset-7 rounded pointer-events-none"
                style={{ border: '1px solid rgba(212,175,55,0.35)' }}
              />

              {/* Corner ornaments */}
              {['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'].map(pos => (
                <div
                  key={pos}
                  className={`absolute ${pos} text-yellow-500 opacity-75 text-xl leading-none pointer-events-none`}
                  style={{ textShadow: '0 0 8px rgba(212,175,55,0.7)' }}
                >
                  ✦
                </div>
              ))}

              {/* Horizontal decorative rule top */}
              <div
                className="absolute pointer-events-none"
                style={{
                  top: '22%',
                  left: '12%',
                  right: '12%',
                  height: '1px',
                  background: 'linear-gradient(to right, transparent, rgba(212,175,55,0.5), transparent)',
                }}
              />
              {/* Horizontal decorative rule bottom */}
              <div
                className="absolute pointer-events-none"
                style={{
                  bottom: '22%',
                  left: '12%',
                  right: '12%',
                  height: '1px',
                  background: 'linear-gradient(to right, transparent, rgba(212,175,55,0.5), transparent)',
                }}
              />

              {/* Cover content */}
              <div className="relative z-10 flex flex-col items-center justify-center min-h-[480px] px-12 py-16 text-center">
                {/* Large book icon */}
                <div
                  className="text-7xl mb-6"
                  style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.7))' }}
                >
                  📖
                </div>

                {/* Decorative top flourish */}
                <div
                  className="text-sm mb-4"
                  style={{ color: 'rgba(212,175,55,0.6)', letterSpacing: '0.3em' }}
                >
                  ✦ ✦ ✦
                </div>

                <h2
                  className="text-2xl font-bold mb-3 leading-snug"
                  style={{
                    color: '#f5e6b0',
                    fontFamily: '"Georgia", "Times New Roman", serif',
                    textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 30px rgba(212,175,55,0.25)',
                    letterSpacing: '0.05em',
                    maxWidth: '80%',
                  }}
                >
                  {title}
                </h2>

                <p
                  className="text-base mb-8"
                  style={{
                    color: 'rgba(245,230,176,0.65)',
                    fontFamily: '"Georgia", serif',
                    fontStyle: 'italic',
                    letterSpacing: '0.08em',
                  }}
                >
                  {date}
                </p>

                {/* Decorative bottom flourish */}
                <div
                  className="text-sm mb-6"
                  style={{ color: 'rgba(212,175,55,0.6)', letterSpacing: '0.3em' }}
                >
                  ✦ ✦ ✦
                </div>

                {/* Open prompt pill */}
                <div
                  className="flex items-center gap-3 px-7 py-3 rounded-full text-base font-semibold"
                  style={{
                    background: 'rgba(212,175,55,0.15)',
                    border: '1px solid rgba(212,175,55,0.55)',
                    color: '#f5e6b0',
                    animation: 'pulse-glow 2s ease-in-out infinite',
                    backdropFilter: 'blur(4px)',
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
                boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
                minHeight: '540px',
              }}
            >
              {/* ── Left page: Problem ── */}
              <div
                className="relative flex-1 overflow-y-auto"
                style={{
                  background: parchmentBg,
                  borderRight: '3px solid rgba(100,60,10,0.2)',
                  boxShadow: 'inset -6px 0 18px rgba(0,0,0,0.1)',
                  maxHeight: '80vh',
                }}
                onClick={handlePageClick}
              >
                <ParchmentDecor />
                <div
                  className="absolute inset-y-0 left-8 w-px pointer-events-none opacity-25"
                  style={{ background: 'rgba(60,140,80,0.7)' }}
                />
                <div
                  className="relative z-10 px-10 py-8"
                  style={{ animation: 'content-fade-in 0.5s ease-out 0.1s both' }}
                >
                  <div className="text-center mb-5">
                    <div
                      className="inline-flex items-center gap-3 text-sm"
                      style={{ color: 'rgba(30,80,40,0.6)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                    >
                      <span>— ✦ —</span>
                      <span>{date}</span>
                      <span>— ✦ —</span>
                    </div>
                  </div>
                  <div
                    style={{ fontFamily: '"Georgia", "Times New Roman", serif', color: '#1a3520', lineHeight: '1.8' }}
                  >
                    {children}
                  </div>
                  <div
                    className="text-center mt-6 text-xs"
                    style={{ color: 'rgba(30,80,40,0.4)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                  >
                    i
                  </div>
                </div>
              </div>

              {/* Spine shadow */}
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
                style={{ background: parchmentBg, maxHeight: '80vh' }}
              >
                <ParchmentDecor />
                <div
                  className="absolute inset-y-0 left-8 w-px pointer-events-none opacity-25"
                  style={{ background: 'rgba(60,140,80,0.7)' }}
                />
                <div
                  className="relative z-10 px-10 py-8"
                  style={{ animation: 'content-fade-in 0.5s ease-out 0.2s both' }}
                >
                  <div className="text-center mb-5">
                    <p
                      className="text-sm font-semibold tracking-widest uppercase"
                      style={{ color: 'rgba(30,80,40,0.55)', fontFamily: 'Georgia, serif', letterSpacing: '0.15em' }}
                    >
                      ✍ Your Answer
                    </p>
                  </div>
                  {solutionSlot ? (
                    <div style={{ fontFamily: '"Georgia", "Times New Roman", serif', color: '#1a3520' }}>
                      {solutionSlot}
                    </div>
                  ) : (
                    <p
                      className="text-center text-sm italic"
                      style={{ color: 'rgba(30,80,40,0.4)', fontFamily: 'Georgia, serif' }}
                    >
                      — this page is blank —
                    </p>
                  )}
                  <div
                    className="text-center mt-6 text-xs"
                    style={{ color: 'rgba(30,80,40,0.4)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                  >
                    ii
                  </div>
                </div>
              </div>
            </div>

            {/* ════ MOBILE: single parchment page ════ */}
            <div
              className="block md:hidden relative rounded-lg overflow-hidden"
              style={{
                animation: 'book-settle 0.4s ease-out forwards',
                background: parchmentBg,
                boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
              }}
              onClick={handlePageClick}
            >
              <ParchmentDecor />
              <div
                className="absolute inset-y-0 left-6 w-px pointer-events-none opacity-25"
                style={{ background: 'rgba(60,140,80,0.7)' }}
              />
              <div
                className="relative z-10 px-6 py-6"
                style={{ animation: 'content-fade-in 0.5s ease-out 0.1s both' }}
              >
                <div className="text-center mb-4">
                  <div
                    className="inline-flex items-center gap-2 text-xs"
                    style={{ color: 'rgba(30,80,40,0.6)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                  >
                    <span>— ✦ —</span>
                    <span>{date}</span>
                    <span>— ✦ —</span>
                  </div>
                </div>
                <div
                  style={{ fontFamily: '"Georgia", "Times New Roman", serif', color: '#1a3520', lineHeight: '1.8' }}
                >
                  {children}
                </div>
              </div>
            </div>

            {/* Mobile: solution slot below */}
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
            0%   { transform: rotateY(0deg);    box-shadow: 6px 8px 24px rgba(0,0,0,0.55); }
            60%  { transform: rotateY(-90deg);  box-shadow: 0 10px 50px rgba(0,0,0,0.75); }
            100% { transform: rotateY(-175deg); opacity: 0; box-shadow: none; }
          }
          @keyframes book-settle {
            from { transform: scale(0.97) translateY(8px); opacity: 0.8; }
            to   { transform: scale(1)    translateY(0);   opacity: 1; }
          }
          @keyframes content-fade-in {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 0    rgba(212,175,55,0); }
            50%       { box-shadow: 0 0 16px rgba(212,175,55,0.45); }
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

      {/* ── Lightbox overlay ── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
          onClick={() => setLightboxSrc(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-yellow-300 transition-colors"
            aria-label="Close image"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
          >
            ✕
          </button>

          {/* Image — constrained to viewport, click stops propagation so overlay click still closes */}
          <img
            src={lightboxSrc}
            alt="Challenge image enlarged"
            className="max-w-[92vw] max-h-[90vh] rounded-lg object-contain"
            style={{
              boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
              animation: 'content-fade-in 0.2s ease-out both',
            }}
            onClick={(e) => e.stopPropagation()}
          />

          <p
            className="absolute bottom-4 text-xs"
            style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}
          >
            Click anywhere to close
          </p>

          <style jsx>{`
            @keyframes content-fade-in {
              from { opacity: 0; transform: scale(0.95); }
              to   { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </>
  )
}
