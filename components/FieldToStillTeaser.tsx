'use client';

/**
 * FieldToStillTeaser
 *
 * A window onto the Moonshiners × Brocksbushes collaboration: a still of the
 * three bottles from the /brocksbushes page, and a link through to it.
 *
 * It keeps that page's cream studio in both themes, so the still (rendered
 * against the cream backdrop) melts into it rather than sitting in a box.
 * Copy and image rise into view via a GSAP ScrollTrigger.
 */

import { useLayoutEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Fraunces } from 'next/font/google';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// The collaboration page's headline face.
const display = Fraunces({ subsets: ['latin'], variable: '--font-display' });

// Fade the still's outer edges into the section, so there's no visible
// rectangle (two fades, across and down, kept where they overlap).
const FEATHER = {
  maskImage:
    'linear-gradient(to right, transparent, black 5%, black 90%, transparent), ' +
    'linear-gradient(to bottom, transparent, black 8%, black 88%, transparent)',
  maskComposite: 'intersect',
  WebkitMaskImage:
    'linear-gradient(to right, transparent, black 5%, black 90%, transparent), ' +
    'linear-gradient(to bottom, transparent, black 8%, black 88%, transparent)',
  WebkitMaskComposite: 'source-in',
} as const;

export function FieldToStillTeaser() {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // fromTo rather than from: the button has a CSS opacity transition,
      // which `from` would read mid-fade as its resting opacity.
      gsap.fromTo(
        '[data-rise]',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="field-to-still"
      className={`${display.variable} relative overflow-hidden bg-gradient-to-b from-[#efe3d1] to-[#e4d3bd] text-[#2b1d14]`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28 grid items-center gap-10 lg:grid-cols-[5fr_7fr]">
        <div>
          <p data-rise className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D7263D] mb-4">
            New · Moonshiners × Brocksbushes
          </p>
          <h2
            data-rise
            className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl lg:text-7xl font-light leading-[0.95]"
          >
            Field to Still
          </h2>
          <p data-rise className="mt-6 max-w-md text-lg leading-relaxed text-[#2b1d14]/75">
            Three spirits from one Northumberland farm&apos;s year: Strawberry Gin, Strawberry Liqueur and Pumpkin
            Spiced Rum, made with fruit from Brocksbushes, near Corbridge.
          </p>
          <Link
            data-rise
            href="/brocksbushes"
            data-cursor="hover"
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-[#2b1d14] px-6 py-3 text-sm font-bold tracking-wide text-[#efe8df] transition-opacity hover:opacity-85"
          >
            Explore the collaboration
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        <Link href="/brocksbushes" tabIndex={-1} aria-hidden data-rise className="block">
          <Image
            src="/images/field-to-still-lineup.jpg"
            alt=""
            width={1840}
            height={900}
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="w-full h-auto transition-transform duration-700 ease-out hover:scale-[1.02]"
            style={FEATHER}
          />
        </Link>
      </div>
    </section>
  );
}
