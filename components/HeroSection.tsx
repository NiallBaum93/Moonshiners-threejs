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
 *
 * GSAP is used for:
 *   – Staggered entrance animation on first mount
 *   – Tweening the CSS custom property --accent when the spirit changes
 */

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { BottleCanvas } from './BottleCanvas';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import { SPIRITS } from '@/lib/spiritData';

const CYCLE_MS = 5000;

/** Converts a hex string like "#8B1E3F" to {r, g, b} 0–255 */
function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export function HeroSection() {
  const [mounted, setMounted]         = useState(false);
  const [spiritIdx, setSpiritIdx]     = useState(0);
  const [textVisible, setTextVisible] = useState(true);
  const spiritIdxRef = useRef(spiritIdx);
  spiritIdxRef.current = spiritIdx;

  // Refs for entrance animation targets
  const badgeRef   = useRef<HTMLSpanElement>(null);
  const copyRef    = useRef<HTMLDivElement>(null);
  const dotsRef    = useRef<HTMLDivElement>(null);
  const hintRef    = useRef<HTMLParagraphElement>(null);
  const ctasRef    = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLDivElement>(null);

  // Accent colour proxy  – mutated by GSAP tween, never read by React
  const accentProxy = useRef(hexToRgb(SPIRITS[0].color));

  // Prevent SSR — Three.js must only run on the client
  useEffect(() => { setMounted(true); }, []);

  /* ── Entrance animation ──────────────────────────────────────────────── */
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from(badgeRef.current,  { y: -16, opacity: 0, duration: 0.6 })
        .from(copyRef.current,   { y:  36, opacity: 0, duration: 0.8 }, '-=0.3')
        .from(dotsRef.current,   { y:  20, opacity: 0, duration: 0.5 }, '-=0.4')
        .from(hintRef.current,   { y:  12, opacity: 0, duration: 0.4 }, '-=0.35')
        .from(ctasRef.current,   { y:  16, opacity: 0, duration: 0.5 }, '-=0.3')
        .from(canvasRef.current, { x:  40, opacity: 0, duration: 0.9 }, 0.15);
    });
    return () => ctx.revert();
  }, []);

  /* ── Per-spirit accent colour tween ─────────────────────────────────── */
  useEffect(() => {
    const target = hexToRgb(SPIRITS[spiritIdx].color);
    const proxy  = accentProxy.current;
    gsap.to(proxy, {
      r: target.r, g: target.g, b: target.b,
      duration: 0.7,
      ease: 'power2.inOut',
      onUpdate() {
        document.documentElement.style.setProperty(
          '--accent',
          `rgb(${Math.round(proxy.r)}, ${Math.round(proxy.g)}, ${Math.round(proxy.b)})`
        );
      },
    });
  }, [spiritIdx]);

  /* ── Auto-cycle ──────────────────────────────────────────────────────── */
  const advanceTo = useCallback((nextIdx: number) => {
    setTextVisible(false);
    setTimeout(() => {
      setSpiritIdx(nextIdx);
      setTextVisible(true);
    }, 380);
  }, []);

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
    <section className="relative min-h-screen flex items-center overflow-hidden bg-slate-50 dark:bg-zinc-950 pt-16">
      {/* Radial glow — colour driven by --accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-150 h-150 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center py-12 lg:py-24">

        {/* ── Left: Brand copy ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:gap-8">

          {/* Static brand identity */}
          <span ref={badgeRef} className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
            Moonshiners Distillery
          </span>

          {/* ── Animated spirit block ──────────────────────────────────── */}
          <div ref={copyRef} style={textStyle}>
            <p className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-[0.18em] mb-2">
              Now Pouring
            </p>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-zinc-900 dark:text-white leading-[1.05] tracking-tight mb-3">
              {spirit.name}
            </h1>

            <p className="text-lg font-semibold mb-5" style={{ color: 'var(--accent)' }}>
              {spirit.subtitle}
            </p>

            <p className="text-zinc-600 dark:text-zinc-400 text-base leading-relaxed max-w-md mb-5">
              {spirit.description}
            </p>

            <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">{spirit.proof}</span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span>{spirit.notes}</span>
            </div>
          </div>

          {/* ── Spirit navigation dots ─────────────────────────────────── */}
          <div ref={dotsRef} className="flex items-center gap-2">
            {SPIRITS.map((s, i) => (
              <button
                key={i}
                aria-label={`Show ${s.name}`}
                data-cursor="hover"
                onClick={() => advanceTo(i)}
                className="rounded-full transition-all duration-300"
                style={i === spiritIdx
                  ? { backgroundColor: 'var(--accent)', width: '1.5rem', height: '0.5rem' }
                  : { backgroundColor: 'var(--dot-inactive)', width: '0.5rem', height: '0.5rem' }}
              />
            ))}
          </div>

          {/* Drag hint */}
          <p ref={hintRef} className="text-zinc-400 dark:text-zinc-500 text-sm -mt-2">
            ← Drag the bottle to explore
          </p>

          {/* CTAs */}
          <div ref={ctasRef} className="flex flex-wrap gap-4">
            <button
              data-cursor="hover"
              className="px-8 py-3.5 rounded-full text-white font-bold text-sm tracking-wide transition-all shadow-lg"
              style={{ backgroundColor: 'var(--accent)', boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 35%, transparent)' }}
            >
              Shop Now
            </button>
            <button
              data-cursor="hover"
              className="px-6 sm:px-8 py-3 sm:py-3.5 rounded-full border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-semibold text-sm tracking-wide transition-colors"
            >
              Our Story
            </button>
          </div>

        </div>

        {/* ── Right: 3-D bottle ─────────────────────────────────────────── */}
        <div ref={canvasRef} className="relative h-80 sm:h-96 lg:h-170">
          <div
            aria-hidden
            className="absolute inset-x-1/4 inset-y-1/4 rounded-full blur-3xl opacity-10"
            style={{ background: 'radial-gradient(circle, var(--accent), transparent)' }}
          />
          {mounted ? (
            <CanvasErrorBoundary>
              <BottleCanvas activeLabelIndex={spiritIdx} />
            </CanvasErrorBoundary>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)', borderTopColor: 'var(--accent)' }} />
            </div>
          )}
        </div>

      </div>
    </section>
  );
}

