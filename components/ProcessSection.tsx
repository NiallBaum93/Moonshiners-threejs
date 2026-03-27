'use client';

/**
 * ProcessSection
 *
 * A dark "How We Craft It" section with four process steps.
 * Each step reveals via a GSAP ScrollTrigger stagger.
 * A copper SVG distillation-path animates its stroke via
 * `strokeDashoffset` as the user scrolls through the section.
 */

import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    number: '01',
    title:  'Grain Selection',
    body:   'Every batch begins with locally sourced grain — hand-picked for character. We favour heritage varieties whose natural sugars express themselves differently with every season.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden>
        <path d="M24 4C24 4 12 12 12 24s12 20 12 20 12-8 12-20S24 4 24 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M24 4v40M12 24h24" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    number: '02',
    title:  'Copper Pot Distillation',
    body:   'Our handmade copper pot stills run slow — short cuts removed, only the heart collected. The copper itself reacts with the vapour, stripping sulphur and building richness.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden>
        <path d="M14 36V28a10 10 0 0 1 20 0v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M10 36h28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M24 18V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M24 8c0 0 4-4 8-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    number: '03',
    title:  'Small-Batch Maturation',
    body:   'Rested in new American oak and ex-bourbon casks — never more than 50 litres at a time. Each cask is tasted seasonally and bottled only at its unique peak, not to a schedule.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden>
        <rect x="8" y="14" width="32" height="22" rx="11" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 25h32" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M20 14v22M28 14v22" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3"/>
      </svg>
    ),
  },
  {
    number: '04',
    title:  'Bottled by Hand',
    body:   'Every bottle is filled, labelled, and wax-dipped by hand in our distillery. No automation. No compromises. The batch number is our signature — our promise on every pour.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden>
        <path d="M18 6h12v8l4 8v18H14V22l4-8V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M14 30h20" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
];

/**
 * The SVG "pipe" path that draws itself as the user scrolls.
 * It forms a rough S-curve that visually connects the four steps.
 */
function DistillationPath() {
  const pathRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });

    const ctx = gsap.context(() => {
      gsap.to(path, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: path.closest('section'),
          start:   'top 80%',
          end:     'bottom 40%',
          scrub:   1,
        },
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <svg
      viewBox="0 0 100 500"
      preserveAspectRatio="none"
      aria-hidden
      className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 pointer-events-none hidden lg:block"
      style={{ overflow: 'visible' }}
    >
      <path
        ref={pathRef}
        d="M50,0 C50,80 10,100 10,180 C10,260 90,280 90,360 C90,440 50,460 50,500"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProcessSection() {
  const sectionRef  = useRef<HTMLElement>(null);
  const headingRef  = useRef<HTMLDivElement>(null);
  const stepsRef    = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      /* Section heading slides up */
      gsap.from(headingRef.current!.children, {
        y:        40,
        opacity:  0,
        stagger:  0.15,
        duration: 0.8,
        ease:     'power3.out',
        scrollTrigger: {
          trigger: headingRef.current,
          start:   'top 85%',
          once:    true,
        },
      });

      /* Each step card slides in from alternating sides */
      const cards = stepsRef.current!.querySelectorAll<HTMLDivElement>('.process-card');
      cards.forEach((card, i) => {
        gsap.from(card, {
          x:        i % 2 === 0 ? -60 : 60,
          opacity:  0,
          duration: 0.8,
          ease:     'power3.out',
          scrollTrigger: {
            trigger:     card,
            start:       'top 88%',
            toggleActions: 'play none none none',
            once:        true,
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="process"
      className="relative bg-zinc-950 text-white py-16 lg:py-32 px-4 sm:px-6 lg:px-16 overflow-hidden"
    >
      {/* Background grain texture overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'300\' height=\'300\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")',
        }}
      />

      {/* Section header */}
      <div ref={headingRef} className="max-w-2xl mx-auto text-center mb-12 lg:mb-24">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-500/70 mb-4">
          The Craft
        </p>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
          How We Make It
        </h2>
        <p className="mt-5 text-zinc-500 text-lg leading-relaxed">
          Every bottle is the result of patience, precision, and a refusal
          to cut corners. Four steps. No shortcuts.
        </p>
      </div>

      {/* Steps grid with connecting SVG path */}
      <div ref={stepsRef} className="relative max-w-5xl mx-auto">
        <DistillationPath />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className={[
                'process-card group relative rounded-2xl border border-zinc-800 bg-zinc-900/60',
                'p-6 sm:p-8 backdrop-blur-sm transition-colors hover:border-amber-500/30',
                '',
              ].join(' ')}
            >
              {/* Subtle top-left glow on hover */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'radial-gradient(circle at 20% 20%, #f59e0b0a 0%, transparent 60%)' }}
              />

              <div className="flex items-start gap-6">
                {/* Icon */}
                <div className="shrink-0 text-amber-500/70 group-hover:text-amber-400 transition-colors">
                  {step.icon}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold tracking-widest text-amber-500/40">
                      {step.number}
                    </span>
                    <h3 className="text-xl font-bold text-white">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-zinc-500 text-sm leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="mt-24 text-center">
        <button
          data-cursor="hover"
          className="inline-flex items-center gap-3 px-10 py-4 rounded-full border border-amber-500/40 text-amber-400 text-sm font-semibold tracking-wide hover:border-amber-400 hover:bg-amber-500/5 transition-all"
        >
          Visit the Distillery
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M3.75 9h10.5M10.5 5.25 14.25 9l-3.75 3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </section>
  );
}
