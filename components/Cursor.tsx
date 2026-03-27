'use client';

/**
 * Custom magnetic cursor
 * – Small dot follows mouse exactly (no lag)
 * – Large ring follows with spring inertia
 * – Scales up + blends on hoverable elements (data-cursor="hover")
 * – Hides when mouse leaves the viewport
 */

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export function Cursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot  = dotRef.current!;
    const ring = ringRef.current!;

    // Start off-screen so there's no flash at (0,0)
    gsap.set([dot, ring], { x: -100, y: -100 });

    let mouseX = -100;
    let mouseY = -100;
    let ringX  = -100;
    let ringY  = -100;

    // Dot: exact position
    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      gsap.set(dot, { x: mouseX, y: mouseY });
    };

    // Ring: spring lerp in a rAF loop
    let raf: number;
    const loop = () => {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      gsap.set(ring, { x: ringX, y: ringY });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Hover expansion
    const onEnter = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-cursor="hover"]')) {
        gsap.to(ring, { scale: 2.2, opacity: 0.5, duration: 0.3, ease: 'power2.out' });
        gsap.to(dot,  { scale: 0,   duration: 0.2 });
      }
    };
    const onLeave = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-cursor="hover"]')) {
        gsap.to(ring, { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' });
        gsap.to(dot,  { scale: 1, duration: 0.2 });
      }
    };

    // Hide when leaving window
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) gsap.to([dot, ring], { opacity: 0, duration: 0.2 });
    };
    const onIn  = () => gsap.to([dot, ring], { opacity: 1, duration: 0.2 });

    window.addEventListener('mousemove',  onMove);
    window.addEventListener('mouseover',  onEnter);
    window.addEventListener('mouseout',   onLeave);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('mouseover', onIn);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove',  onMove);
      window.removeEventListener('mouseover',  onEnter);
      window.removeEventListener('mouseout',   onLeave);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mouseover', onIn);
    };
  }, []);

  return (
    <>
      {/* Dot */}
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-9999 -translate-x-1/2 -translate-y-1/2
                   w-2 h-2 rounded-full bg-amber-500"
      />
      {/* Ring */}
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-9999 -translate-x-1/2 -translate-y-1/2
                   w-9 h-9 rounded-full border border-amber-500/60"
      />
    </>
  );
}
