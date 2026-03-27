'use client';

/**
 * NavBar
 *
 * Transparent on load; on scroll past 60 px GSAP tweens in a frosted-glass
 * background whose colour is theme-aware (white in light, zinc-950 in dark).
 * Listens for the custom 'themechange' event from ThemeToggle so it can
 * update the scrolled background immediately when the user switches themes.
 */

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const NAV_LINKS = [
  { label: 'Our Spirits', href: '#spirits' },
  { label: 'The Craft',   href: '#process' },
  { label: 'Our Story',   href: '#story'   },
];

const scrolledBg     = () => document.documentElement.classList.contains('dark')
  ? 'rgba(9,9,11,0.93)'
  : 'rgba(248,250,252,0.93)';
const scrolledShadow = () => document.documentElement.classList.contains('dark')
  ? '0 1px 24px rgba(0,0,0,0.35)'
  : '0 1px 24px rgba(0,0,0,0.07)';

export function NavBar() {
  const barRef   = useRef<HTMLElement>(null);
  const scrolled = useRef(false);
  const [open, setOpen] = useState(false);

  /* â”€â”€ Entrance stagger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(barRef.current!.querySelectorAll('.nav-item'), {
        y: -10, opacity: 0, stagger: 0.07, duration: 0.55,
        ease: 'power3.out', delay: 0.2,
      });
    }, barRef);
    return () => ctx.revert();
  }, []);

  /* â”€â”€ Scroll-driven background â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  useEffect(() => {
    const bar = barRef.current!;

    const applyScrolled = () => gsap.to(bar, {
      backgroundColor: scrolledBg(),
      backdropFilter:  'blur(16px)',
      boxShadow:       scrolledShadow(),
      duration: 0.4, ease: 'power2.out',
    });
    const applyTransparent = () => gsap.to(bar, {
      backgroundColor: 'rgba(0,0,0,0)',
      backdropFilter:  'blur(0px)',
      boxShadow:       'none',
      duration: 0.4, ease: 'power2.out',
    });

    const onScroll = () => {
      if (window.scrollY > 60 && !scrolled.current) {
        scrolled.current = true;
        applyScrolled();
      } else if (window.scrollY <= 60 && scrolled.current) {
        scrolled.current = false;
        applyTransparent();
      }
    };

    // Re-apply when theme changes while already scrolled
    const onThemeChange = () => {
      if (scrolled.current) applyScrolled();
    };

    window.addEventListener('scroll',      onScroll,      { passive: true });
    window.addEventListener('themechange', onThemeChange);
    return () => {
      window.removeEventListener('scroll',      onScroll);
      window.removeEventListener('themechange', onThemeChange);
    };
  }, []);

  return (
    <header
      ref={barRef}
      className="fixed top-0 inset-x-0 z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <a href="/" aria-label="Moonshiners Distillery â€” home" className="nav-item shrink-0" data-cursor="hover">
          <Logo className="h-5 sm:h-6 w-auto" height={24} width={undefined} />
        </a>

        {/* Desktop nav links */}
        <nav aria-label="Primary" className="hidden md:flex items-center gap-6 lg:gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              data-cursor="hover"
              className="nav-item text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors tracking-wide"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop right controls */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle className="nav-item" />
          <a
            href="#spirits"
            data-cursor="hover"
            className="nav-item px-5 py-2 rounded-full text-sm font-bold text-white tracking-wide transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--accent, #f59e0b)' }}
          >
            Shop Now
          </a>
        </div>

        {/* Mobile right controls */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle className="nav-item" />
          {/* Hamburger */}
          <button
            className="nav-item flex flex-col gap-1.5 p-2"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`block h-0.5 w-5 bg-zinc-700 dark:bg-zinc-300 transition-transform origin-center ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block h-0.5 w-5 bg-zinc-700 dark:bg-zinc-300 transition-opacity ${open ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-5 bg-zinc-700 dark:bg-zinc-300 transition-transform origin-center ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${open ? 'max-h-72' : 'max-h-0'}`}
        style={{
          backgroundColor: 'var(--background)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(128,128,128,0.1)',
        }}
      >
        <nav className="flex flex-col px-6 pb-6 pt-2 gap-4">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors py-1"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#spirits"
            onClick={() => setOpen(false)}
            className="self-start px-5 py-2 rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: 'var(--accent, #f59e0b)' }}
          >
            Shop Now
          </a>
        </nav>
      </div>
    </header>
  );
}

