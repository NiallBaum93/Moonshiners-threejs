'use client';

/**
 * NavBar
 *
 * Transparent on load; on scroll past 60 px GSAP tweens in a frosted-glass
 * background whose colour is theme-aware (white in light, zinc-950 in dark).
 * Listens for the custom 'themechange' event from ThemeToggle so it can
 * update the scrolled background immediately when the user switches themes.
 *
 * Some pages are light only, like the cream Field to Still studio. There the
 * bar is always frosted cream with dark ink, whatever the theme, there's no
 * theme toggle, and the links go back to the homepage's sections.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { gsap } from 'gsap';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const NAV_LINKS = [
  { label: 'Our Spirits', href: '#spirits' },
  { label: 'The Craft',   href: '#process' },
  { label: 'Our Story',   href: '#story'   },
];

const LIGHT_ONLY_PAGES = ['/brocksbushes'];

const CREAM = 'rgba(255,248,243,0.5)'; // light frost: the Field to Still studio's colour shows through
const INK   = '#2b1d14';

const isDark         = () => document.documentElement.classList.contains('dark');
const scrolledBg     = (lightOnly: boolean) => lightOnly ? CREAM
  : isDark() ? 'rgba(9,9,11,0.93)' : 'rgba(248,250,252,0.93)';
const scrolledShadow = (lightOnly: boolean) => !lightOnly && isDark()
  ? '0 1px 24px rgba(0,0,0,0.35)'
  : '0 1px 24px rgba(0,0,0,0.07)';

// Text colours: theme-aware, or always dark ink on a light-only page.
const linkText = (lightOnly: boolean) => lightOnly
  ? 'text-[#2b1d14]/70 hover:text-[#2b1d14]'
  : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white';
const drawerText = (lightOnly: boolean) => lightOnly
  ? 'text-[#2b1d14]/80 hover:text-[#2b1d14]'
  : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white';
const burgerLine = (lightOnly: boolean) => lightOnly ? 'bg-[#2b1d14]' : 'bg-zinc-700 dark:bg-zinc-300';

export function NavBar() {
  const barRef   = useRef<HTMLElement>(null);
  const scrolled = useRef(false);
  const [open, setOpen] = useState(false);
  const lightOnly = LIGHT_ONLY_PAGES.includes(usePathname());
  // The sections live on the homepage, so from anywhere else, link back to them.
  const home = lightOnly ? '/' : '';

  /* ── Entrance stagger ─────────────────────────────────────────────── */
  useEffect(() => {
    const ctx = gsap.context(() => {
      // fromTo, not from: `from` animates to whatever the opacity is right
      // now, and a CSS opacity transition (the Shop Now button has one) can
      // leave that at 0, so the button never appears.
      gsap.fromTo(barRef.current!.querySelectorAll('.nav-item'),
        { y: -10, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.07, duration: 0.55, ease: 'power3.out', delay: 0.2 },
      );
    }, barRef);
    return () => ctx.revert();
  }, []);

  /* ── Scroll-driven background ─────────────────────────────────────── */
  useEffect(() => {
    const bar = barRef.current!;

    const applyScrolled = () => gsap.to(bar, {
      backgroundColor: scrolledBg(lightOnly),
      backdropFilter:  'blur(16px)',
      boxShadow:       scrolledShadow(lightOnly),
      duration: 0.4, ease: 'power2.out',
    });
    const applyTransparent = () => gsap.to(bar, {
      backgroundColor: 'rgba(0,0,0,0)',
      backdropFilter:  'blur(0px)',
      boxShadow:       'none',
      duration: 0.4, ease: 'power2.out',
    });

    // Moving between pages keeps the bar, so start each page afresh.
    scrolled.current = false;
    gsap.set(bar, { backgroundColor: 'rgba(0,0,0,0)', backdropFilter: 'blur(0px)', boxShadow: 'none' });

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
    onScroll(); // in case the page opened already scrolled
    return () => {
      window.removeEventListener('scroll',      onScroll);
      window.removeEventListener('themechange', onThemeChange);
    };
  }, [lightOnly]);

  return (
    <header
      ref={barRef}
      className="fixed top-0 inset-x-0 z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0)', color: lightOnly ? INK : undefined }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" aria-label="Moonshiners Distillery — home" className="nav-item shrink-0" data-cursor="hover">
          <Logo className="h-5 sm:h-6 w-auto" height={24} width={undefined} />
        </Link>

        {/* Desktop nav links */}
        <nav aria-label="Primary" className="hidden md:flex items-center gap-6 lg:gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={home + link.href}
              data-cursor="hover"
              className={`nav-item text-sm font-medium ${linkText(lightOnly)} transition-colors tracking-wide`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop right controls */}
        <div className="hidden md:flex items-center gap-3">
          {!lightOnly && <ThemeToggle className="nav-item" />}
          <a
            href={`${home}#spirits`}
            data-cursor="hover"
            className="nav-item px-5 py-2 rounded-full text-sm font-bold text-white tracking-wide transition-opacity hover:opacity-80"
            style={{ backgroundColor: lightOnly ? INK : 'var(--accent, #f59e0b)' }}
          >
            Shop Now
          </a>
        </div>

        {/* Mobile right controls */}
        <div className="flex md:hidden items-center gap-2">
          {!lightOnly && <ThemeToggle className="nav-item" />}
          {/* Hamburger */}
          <button
            className="nav-item flex flex-col gap-1.5 p-2"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`block h-0.5 w-5 ${burgerLine(lightOnly)} transition-transform origin-center ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block h-0.5 w-5 ${burgerLine(lightOnly)} transition-opacity ${open ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-5 ${burgerLine(lightOnly)} transition-transform origin-center ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${open ? 'max-h-72' : 'max-h-0'}`}
        style={{
          backgroundColor: lightOnly ? CREAM : 'var(--background)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(128,128,128,0.1)',
        }}
      >
        <nav className="flex flex-col px-6 pb-6 pt-2 gap-4">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={home + link.href}
              onClick={() => setOpen(false)}
              className={`text-sm font-medium ${drawerText(lightOnly)} transition-colors py-1`}
            >
              {link.label}
            </a>
          ))}
          <a
            href={`${home}#spirits`}
            onClick={() => setOpen(false)}
            className="self-start px-5 py-2 rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: lightOnly ? INK : 'var(--accent, #f59e0b)' }}
          >
            Shop Now
          </a>
        </nav>
      </div>
    </header>
  );
}

