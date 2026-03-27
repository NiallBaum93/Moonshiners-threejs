'use client';

/**
 * SpiritsSection
 *
 * Desktop (md+): horizontal pinned scroll via GSAP ScrollTrigger â€” one full-
 * viewport card per spirit.  The track moves on the X axis while the section
 * stays pinned.
 *
 * Mobile (<md): cards stack vertically with a standard scroll-triggered
 * stagger â€” no horizontal shenanigans, works perfectly on touch.
 */

import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SPIRITS } from '@/lib/spiritData';

gsap.registerPlugin(ScrollTrigger);

const BLOBS: Record<string, string> = {
  '#8B1E3F': 'M60,20 C80,5  100,30 80,50 C100,70 75,90 55,80 C35,70 10,85 15,60 C20,35 40,35 60,20Z',
  '#7A6019': 'M55,15 C75,0  105,20 90,45 C105,70 80,95 55,85 C30,75  5,80 10,55 C15,30 35,30 55,15Z',
  '#2D4E7A': 'M65,15 C90,5  110,35 95,55 C110,75 85,100 60,88 C35,76  5,85 10,58 C15,31 40,25 65,15Z',
  '#1A1F3A': 'M50,10 C75,0  105,25 95,50 C105,75 80,100 55,90 C30,80  0,90  5,60 C10,30 25,20 50,10Z',
};

function SpotBlob({ color }: { color: string }) {
  const d = BLOBS[color] ?? BLOBS['#8B1E3F'];
  return (
    <svg viewBox="0 0 110 110" aria-hidden className="absolute -right-10 top-1/2 -translate-y-1/2 w-[55vmin] h-[55vmin] opacity-10 pointer-events-none">
      <path d={d} fill={color} />
    </svg>
  );
}

export function SpiritsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef   = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current!;
    const track   = trackRef.current!;
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;

    const ctx = gsap.context(() => {
      const cards = track.querySelectorAll<HTMLDivElement>('.spirit-card');

      if (isDesktop) {
        /* â”€â”€ Desktop: horizontal pinned scroll â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        track.style.width = `${SPIRITS.length * 100}vw`;

        const getTravel = () => track.scrollWidth - window.innerWidth;

        const scrollTween = gsap.to(track, {
          x: () => -getTravel(),
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            pin:     true,
            scrub:   1,
            end:     () => `+=${getTravel() + window.innerWidth * 0.5}`,
            invalidateOnRefresh: true,
          },
        });

        cards.forEach((card) => {
          gsap.from(card.querySelectorAll('.card-animate'), {
            y: 50, opacity: 0, stagger: 0.1, duration: 0.7, ease: 'power3.out',
            scrollTrigger: {
              trigger:            card,
              containerAnimation: scrollTween,
              start:              'left 90%',
              toggleActions:      'play none none none',
              once:               true,
            },
          });
        });
      } else {
        /* â”€â”€ Mobile: vertical stagger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        cards.forEach((card) => {
          gsap.from(card.querySelectorAll('.card-animate'), {
            y: 40, opacity: 0, stagger: 0.08, duration: 0.6, ease: 'power3.out',
            scrollTrigger: {
              trigger:      card,
              start:        'top 88%',
              toggleActions: 'play none none none',
              once:         true,
            },
          });
        });
      }
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="spirits"
      className="bg-zinc-950 md:overflow-hidden"
    >
      {/* "Scroll to explore" hint â€” only visible on desktop pinned scroll */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 z-10 pointer-events-none select-none hidden md:block">
        <p className="text-zinc-600 text-xs font-semibold uppercase tracking-[0.22em]">
          Scroll to explore
        </p>
      </div>

      {/* Track â€” horizontal on desktop, vertical on mobile */}
      <div
        ref={trackRef}
        className="flex flex-col md:flex-row will-change-transform"
      >
        {SPIRITS.map((spirit, i) => (
          <div
            key={spirit.name}
            className="spirit-card relative w-full md:w-screen min-h-screen flex items-center overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${spirit.color}18 0%, #0a0a0f 60%)` }}
          >
            <SpotBlob color={spirit.color} />

            {/* Left accent bar */}
            <div
              className="card-animate absolute left-0 top-0 h-full w-1"
              style={{ backgroundColor: spirit.color }}
            />

            {/* Card content */}
            <div className="relative z-10 px-6 sm:px-10 md:px-16 lg:px-28 py-16 md:py-0 max-w-3xl">
              {/* Big background number */}
              <p
                className="card-animate font-black leading-none select-none text-[4rem] sm:text-[7rem] md:text-[9rem] lg:text-[11rem]"
                style={{ color: spirit.color, opacity: 0.07 }}
                aria-hidden
              >
                {String(i + 1).padStart(2, '0')}
              </p>

              <div className="-mt-6 md:-mt-16 space-y-4 md:space-y-5">
                <p
                  className="card-animate text-xs font-semibold uppercase tracking-[0.22em]"
                  style={{ color: spirit.color }}
                >
                  {spirit.proof}
                </p>

                <h2 className="card-animate text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-extrabold text-white leading-none tracking-tight">
                  {spirit.name}
                </h2>

                <p className="card-animate text-zinc-400 italic text-lg md:text-xl">
                  {spirit.subtitle}
                </p>

                <p className="card-animate text-zinc-500 text-sm md:text-base leading-relaxed max-w-md">
                  {spirit.description}
                </p>

                <div className="card-animate flex flex-wrap gap-2 pt-1 md:pt-2">
                  {spirit.notes.split(' Â· ').map((note) => (
                    <span
                      key={note}
                      className="text-xs font-medium px-3 py-1 rounded-full border"
                      style={{
                        color:       spirit.color,
                        borderColor: `${spirit.color}55`,
                        background:  `${spirit.color}12`,
                      }}
                    >
                      {note}
                    </span>
                  ))}
                </div>

                <button
                  data-cursor="hover"
                  className="card-animate mt-2 md:mt-3 inline-flex items-center gap-2 text-sm font-semibold tracking-wide transition-opacity hover:opacity-70"
                  style={{ color: spirit.color }}
                >
                  Learn more
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
