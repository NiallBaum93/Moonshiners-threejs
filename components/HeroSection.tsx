'use client';

/**
 * HeroSection
 *
 * Left column: brand copy + CTA
 * Right column: interactive 3D bottle (loaded client-side only so Three.js
 *               never runs during SSR)
 */

import dynamic from 'next/dynamic';

const BottleCanvas = dynamic(
  () => import('./BottleCanvas').then((m) => m.BottleCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-amber-500/40 border-t-amber-500 animate-spin" />
      </div>
    ),
  },
);

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-slate-50">
      {/* Radial glow behind the bottle */}
      <div
        aria-hidden
          className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-150 h-150 rounded-full opacity-10"
        style={{
          background:
            'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-24">
        {/* ── Left: Brand copy ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:gap-8">
          {/* Eyebrow */}
          <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
            Small-Batch Craft Spirits
          </span>

          {/* Headline */}
          <h1 className="text-5xl lg:text-7xl font-extrabold text-zinc-900 leading-[1.05] tracking-tight">
            Moonshiners{' '}
            <span className="text-amber-500">Distillery</span>
          </h1>

          {/* Sub-copy */}
          <p className="text-zinc-600 text-lg leading-relaxed max-w-md">
            Handcrafted in small batches using a 150-year-old copper pot still.
            Every bottle carries the character of the hills it was made in.
          </p>

          {/* Hint */}
          <p className="text-zinc-400 text-sm">
            ← Drag the bottle to explore
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 mt-2">
            <button className="px-8 py-3.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm tracking-wide transition-colors shadow-lg shadow-amber-600/20">
              Shop Now
            </button>
            <button className="px-8 py-3.5 rounded-full border border-zinc-300 hover:border-zinc-400 text-zinc-600 hover:text-zinc-900 font-semibold text-sm tracking-wide transition-colors">
              Our Story
            </button>
          </div>

          {/* Stats */}
          <div className="flex gap-10 mt-4">
            {[
              { label: 'Years Heritage', value: '150+' },
              { label: 'Copper Stills',  value: '3'    },
              { label: 'Expressions',    value: '12'   },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-3xl font-extrabold text-amber-600">
                  {value}
                </span>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">
                  {label}
                </span>
              </div>
            ))}
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
          <BottleCanvas />
        </div>
      </div>
    </section>
  );
}
