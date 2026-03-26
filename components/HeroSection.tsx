'use client';

/**
 * HeroSection
 *
 * Left column: animated spirit copy that cycles through each label variant.
 * Right column: interactive 3D bottle (client-side only, no SSR).
 *
 * activeSpiritIndex drives both the hero text (CSS fade) and the 3D label
 * cross-fade inside BottleModel.  The auto-cycle fires every 5 s; the dot
 * navigation lets users jump to any spirit manually.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { BottleCanvas } from './BottleCanvas';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import { SPIRITS } from '@/lib/spiritData';

const CYCLE_MS = 5000; // ms per spirit

export function HeroSection() {
  const [mounted, setMounted]         = useState(false);
  const [spiritIdx, setSpiritIdx]     = useState(0);
  const [textVisible, setTextVisible] = useState(true);
  const spiritIdxRef = useRef(spiritIdx);
  spiritIdxRef.current = spiritIdx;

  // Prevent SSR — Three.js must only run on the client
  useEffect(() => { setMounted(true); }, []);

  // Transition to a specific spirit index with a fade-out / fade-in
  const advanceTo = useCallback((nextIdx: number) => {
    setTextVisible(false);
    setTimeout(() => {
      setSpiritIdx(nextIdx);
      setTextVisible(true);
    }, 380);
  }, []);

  // Auto-cycle — stable interval (empty deps), reads latest idx via ref
  useEffect(() => {
    const timer = setInterval(() => {
      advanceTo((spiritIdxRef.current + 1) % SPIRITS.length);
    }, CYCLE_MS);
    return () => clearInterval(timer);
  }, [advanceTo]);

  const spirit = SPIRITS[spiritIdx];

  const textStyle: React.CSSProperties = {
    opacity:    textVisible ? 1 : 0,
    transform:  textVisible ? 'translateY(0px)' : 'translateY(10px)',
    transition: 'opacity 0.38s ease, transform 0.38s ease',
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-slate-50">
      {/* Radial glow behind the bottle */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-150 h-150 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-24">

        {/* ── Left: Brand copy ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:gap-8">

          {/* Static brand identity */}
          <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
            Moonshiners Distillery
          </span>

          {/* ── Animated spirit block ──────────────────────────────────── */}
          <div style={textStyle}>
            {/* "Now Pouring" label */}
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-[0.18em] mb-2">
              Now Pouring
            </p>

            {/* Spirit name */}
            <h1 className="text-5xl lg:text-7xl font-extrabold text-zinc-900 leading-[1.05] tracking-tight mb-3">
              {spirit.name}
            </h1>

            {/* Subtitle */}
            <p className="text-amber-600 font-semibold text-lg mb-5">
              {spirit.subtitle}
            </p>

            {/* Description */}
            <p className="text-zinc-600 text-base leading-relaxed max-w-md mb-5">
              {spirit.description}
            </p>

            {/* Proof + notes */}
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <span className="font-semibold text-zinc-700">{spirit.proof}</span>
              <span className="text-zinc-300">|</span>
              <span>{spirit.notes}</span>
            </div>
          </div>

          {/* ── Spirit navigation dots ─────────────────────────────────── */}
          <div className="flex items-center gap-2">
            {SPIRITS.map((s, i) => (
              <button
                key={i}
                aria-label={`Show ${s.name}`}
                onClick={() => advanceTo(i)}
                className={[
                  'rounded-full transition-all duration-300',
                  i === spiritIdx
                    ? 'bg-amber-500 w-6 h-2'
                    : 'bg-zinc-300 hover:bg-zinc-400 w-2 h-2',
                ].join(' ')}
              />
            ))}
          </div>

          {/* Drag hint */}
          <p className="text-zinc-400 text-sm -mt-2">
            ← Drag the bottle to explore
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4">
            <button className="px-8 py-3.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm tracking-wide transition-colors shadow-lg shadow-amber-600/20">
              Shop Now
            </button>
            <button className="px-8 py-3.5 rounded-full border border-zinc-300 hover:border-zinc-400 text-zinc-600 hover:text-zinc-900 font-semibold text-sm tracking-wide transition-colors">
              Our Story
            </button>
          </div>

        </div>

        {/* ── Right: 3-D bottle ─────────────────────────────────────────── */}
        <div className="relative h-130 lg:h-170">
          {/* Faint label plate behind the canvas */}
          <div
            aria-hidden
            className="absolute inset-x-1/4 inset-y-1/4 rounded-full blur-3xl opacity-10"
            style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }}
          />
          {mounted ? (
            <CanvasErrorBoundary>
              <BottleCanvas activeLabelIndex={spiritIdx} />
            </CanvasErrorBoundary>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-amber-500/40 border-t-amber-500 animate-spin" />
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
