'use client';

/**
 * ThemeToggle
 * Sun / moon button.  Reads localStorage on mount, applies .dark to <html>,
 * and fires a custom 'themechange' event so other components (e.g. NavBar)
 * can react without a shared Context.
 */

import { useEffect, useState } from 'react';

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const t = getInitialTheme();
    setTheme(t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, []);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    window.dispatchEvent(new Event('themechange'));
  };

  return (
    <button
      onClick={toggle}
      data-cursor="hover"
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      className={[
        'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
        'border border-zinc-200 dark:border-zinc-700',
        'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white',
        'hover:border-zinc-300 dark:hover:border-zinc-500',
        'bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
        className,
      ].join(' ')}
    >
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
