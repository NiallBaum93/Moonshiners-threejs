'use client'

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { DM_Serif_Display, Inter } from 'next/font/google'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { COLLAB_SPIRITS, type CollabSpirit } from '@/lib/collabData'
import { Logo } from '@/components/Logo'
import { BEATS, TOTAL_SCREENS, story, type BeatId } from './story'

gsap.registerPlugin(ScrollTrigger)

// Moonshiners' own type, as on moonshiners.co.uk: DM Serif Display for the
// headlines, Inter for everything else. (The 3D words use the same display
// face; see BackdropWord.) The variables are scoped to this page.
const display = DM_Serif_Display({ subsets: ['latin'], weight: '400', variable: '--font-display' })
const body = Inter({ subsets: ['latin'], variable: '--font-body' })

// Three.js needs `window` and a WebGL context, so the 3D scene must never
// render on the server. `ssr: false` is only allowed inside a Client Component,
// which is why it's loaded here.
const Experience = dynamic(() => import('./Experience'), {
  ssr: false,
  loading: () => <div className='h-full w-full bg-[#f7e1dd]' />
})

/**
 * The page: the 3D studio fixed full-screen at the back, and the story
 * scrolling over it. Each beat in story.ts gets a section that many screens
 * tall, so the copy and the 3D choreography stay in step.
 */
export function FieldToStill() {
  const pageRef = useRef<HTMLElement>(null)
  // Everything loads, and every shader is built, behind a loading screen, so
  // the scroll is smooth from the first moment. Scrolling waits for it.
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Every visit starts at the top, where the story does.
    history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (ready) return
    const root = document.documentElement
    root.style.overflow = 'hidden'
    // If something never loads (no WebGL, say), don't keep the page locked forever.
    const giveUp = setTimeout(() => setReady(true), GIVE_UP_AFTER)
    return () => {
      root.style.overflow = ''
      clearTimeout(giveUp)
    }
  }, [ready])

  // The scroll animations start once the loading screen starts to lift, so the
  // headline's entrance plays as it fades.
  useEffect(() => {
    if (!ready) return
    const page = pageRef.current!

    // Smooth wheel scrolling. A mouse with a notched wheel jumps ~100px a
    // click, which makes the copy step rather than glide; Lenis eases each
    // jump out over a few frames. It still moves the real page scroll, so
    // ScrollTrigger works as before, and touch scrolling is left native.
    // It runs on GSAP's clock, so both see the same position every frame.
    const lenis = new Lenis({ lerp: 0.12, autoRaf: false })
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0) // keep the clocks in step, even after a slow frame

    const phones = gsap.matchMedia() // animations only for small screens, undone if it grows
    const ctx = gsap.context(() => {
      // 1. Tell the scene how far down the page we are, in screens.
      //    (Measured from the sections themselves, so it always matches the CSS.)
      const track = (self: ScrollTrigger) => {
        story.position = (self.scroll() - self.start) / (page.offsetHeight / TOTAL_SCREENS)
      }
      ScrollTrigger.create({
        trigger: page,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: track,
        onRefresh: track
      })

      // 2. The title drifts away as you start to scroll.
      gsap.to('[data-intro-title]', {
        opacity: 0,
        y: -60,
        ease: 'none',
        scrollTrigger: { trigger: page, start: 'top top', end: () => `+=${window.innerHeight * 0.6}`, scrub: true }
      })

      // 3. Each beat's copy fades as it scrolls away, rather than sliding
      //    across the bottle on its way out: sooner on phones, where the
      //    bottle stands above the copy, right in its way. (The copy and its
      //    frost fade, not what holds them: fading that would switch the frost off.)
      gsap.utils.toArray<HTMLElement>('[data-exit]').forEach((el) => {
        gsap.to(el.querySelectorAll('[data-fades]'), {
          opacity: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: el.parentElement,
            start: 'bottom bottom',
            end: () => (window.innerWidth < 1024 ? 'bottom 75%' : 'bottom 55%'),
            scrub: true
          }
        })
      })

      // 4. On phones, the line that scrolls up past the bottle during the pour
      //    fades before it reaches it. (On wide screens it passes beside it.)
      phones.add('(max-width: 1023px)', () => {
        gsap.to('[data-passing] [data-fades]', {
          opacity: 0,
          ease: 'none',
          scrollTrigger: { trigger: '[data-passing]', start: 'top 60%', end: 'top 40%', scrub: true }
        })
      }, page)

      // 5. Headlines arrive letter by letter: each rises with a slight tilt and
      //    settles with a little overshoot.
      gsap.utils.toArray<HTMLElement>('[data-letters]').forEach((el) => {
        gsap.from(el.querySelectorAll('[data-letter]'), {
          yPercent: 70,
          rotate: 10,
          opacity: 0,
          duration: 0.9,
          ease: 'back.out(2)',
          stagger: 0.03,
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' }
        })
      })

      // 6. Other copy rises into place as it scrolls into view, and back out when you scroll up.
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          y: 32,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' }
        })
      })
    }, page)
    return () => {
      phones.revert()
      ctx.revert()
      gsap.ticker.remove(tick)
      gsap.ticker.lagSmoothing(500, 33) // GSAP's default
      lenis.destroy()
    }
  }, [ready])

  // overflow-x-clip: on phones the copy's frost reaches past the screen's
  // sides, which would let the page scroll sideways. (Clip, not hidden, which
  // would stop the copy sticking.)
  return (
    <main ref={pageRef} className={`${display.variable} ${body.variable} relative overflow-x-clip font-[family-name:var(--font-body)] bg-[#f7e1dd] text-[#2b1d14]`}>
      {/* The studio. The copy above it ignores the pointer, so you can still pick up the bottle. */}
      <div className='fixed inset-0'>
        {/* Files load in more than one batch, and the count starts again with
            each; the loading screen's level only ever rises. */}
        <Experience onProgress={(p) => setProgress((was) => Math.max(was, p))} onReady={() => setReady(true)} />
      </div>
      <Loader progress={progress} ready={ready} />

      <div className='pointer-events-none relative'>
        {BEATS.map((beat) => (
          <section key={beat.id} className='relative' style={{ height: `${beat.screens * 100}svh` }}>
            <BeatCopy id={beat.id} />
          </section>
        ))}
      </div>
    </main>
  )
}

const GIVE_UP_AFTER = 30_000 // ms

/**
 * The loading screen: a line drawing of the flask, filling with liqueur as
 * the models and labels arrive, its surface gently rolling. Once the scene's
 * ready, it fills to the shoulder, the cork pops, and the screen fades away
 * to reveal the studio already running.
 */
// The flask, in a 100 × 160 box: neck, shoulders, body, rounded base.
const FLASK = 'M38 18V30C38 38 12 40 12 56V146Q12 154 20 154H80Q88 154 88 146V56C88 40 62 38 62 30V18'
const FLASK_INSIDE = `${FLASK}Z`
const FULL = 40 // the liquid's surface when full: at the shoulder
const EMPTY = 154 // and empty: on the base
// The Moonshiners star (from the logo), with its teardrop cut out.
const STAR =
  'M34.6457 13.0673H21.4113L20.533 10.274C19.7456 7.94109 18.8674 5.17847 18.2617 3.15255L17.3228 0.297852L17.1714 0.758287C16.6263 2.50794 14.8395 8.30943 13.5675 11.9622L13.2041 13.0673H0L10.7208 20.9561L6.63234 33.7255L17.3531 25.8367L28.0739 33.7255L23.9855 20.9561L34.7062 13.0673H34.6457ZM14.8092 15.1546C15.4149 13.7426 16.4143 10.7344 17.3228 7.849C18.2617 10.7344 19.2611 13.7426 19.8062 15.1546C20.1999 16.1061 20.1999 17.0884 19.8667 17.8865C19.5639 18.5618 19.0491 19.0222 18.3222 19.2678C18.2617 19.2678 18.1708 19.3292 18.1102 19.3292C17.9285 19.3599 17.7165 19.3906 17.4743 19.3906H17.3228C17.2925 19.3906 17.2623 19.3906 17.2623 19.3906C17.232 19.3906 17.1714 19.3906 17.1411 19.3906C16.8988 19.3906 16.7171 19.3906 16.5051 19.3292C16.4446 19.3292 16.3537 19.2985 16.2932 19.2678C15.5663 19.0222 15.0212 18.5311 14.7184 17.8558C14.3549 17.0577 14.3852 16.1061 14.7789 15.1546H14.8092Z'

function Loader({ progress, ready }: { progress: number; ready: boolean }) {
  const [gone, setGone] = useState(false)
  if (gone) return null
  // Hold just short of full until it's really ready (loaded isn't yet built).
  const shown = ready ? 100 : Math.min(progress, 94)
  const level = EMPTY - (EMPTY - FULL) * (shown / 100)
  return (
    <div
      role='status'
      aria-label={ready ? 'Loaded' : `Loading, ${Math.round(shown)}%`}
      onTransitionEnd={(e) => e.target === e.currentTarget && ready && setGone(true)}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f7e1dd] transition-opacity duration-[900ms] ease-out ${ready ? 'pointer-events-none opacity-0 delay-[650ms]' : ''}`}
    >
      <svg viewBox='0 -12 100 172' className='h-44 w-auto overflow-visible sm:h-52' aria-hidden>
        <defs>
          <clipPath id='loader-flask'>
            <path d={FLASK_INSIDE} />
          </clipPath>
        </defs>
        {/* The liquid: a rolling surface, risen to the level loaded so far. */}
        <g clipPath='url(#loader-flask)'>
          <g className='transition-transform duration-700 ease-out' style={{ transform: `translateY(${level}px)` }}>
            <path
              d='M0 0Q25 -3.5 50 0T100 0T150 0T200 0T250 0T300 0V130H0Z'
              fill='#ce1644'
              fillOpacity={0.85}
              className='motion-safe:animate-[loader-wave_2.4s_linear_infinite]'
            />
          </g>
        </g>
        {/* The glass, the star on its label, and the cork, which pops when it's done. */}
        <path d={FLASK} fill='none' stroke='#2b1d14' strokeWidth={1.5} strokeLinejoin='round' />
        <path d={STAR} fill='#FF0000' transform='translate(39.6 92) scale(0.6)' />
        <g
          className='transition-transform duration-500 ease-[cubic-bezier(0.34,1.8,0.64,1)]'
          style={{ transform: ready ? 'translate(6px, -16px) rotate(-16deg)' : 'none', transformOrigin: '50px 10px' }}
        >
          <rect x={40.5} y={2} width={19} height={18} rx={2.5} fill='#c49a6c' stroke='#2b1d14' strokeWidth={1.5} />
        </g>
      </svg>
      <p className='mt-8 mb-2 text-[10px] font-medium tracking-[0.3em] text-[#2b1d14]/60 uppercase'>
        Moonshiners × Brocksbushes
      </p>
      <p className='font-[family-name:var(--font-display)] text-3xl sm:text-4xl'>Field to Still</p>
      <p className='mt-3 text-[10px] tracking-[0.25em] text-[#2b1d14]/45 tabular-nums'>{Math.round(shown)}%</p>
    </div>
  )
}

const SPIRIT_FOR_BEAT: Partial<Record<BeatId, CollabSpirit>> = {
  gin: COLLAB_SPIRITS.find((s) => s.name === 'Strawberry Gin'),
  liqueur: COLLAB_SPIRITS.find((s) => s.name === 'Strawberry Liqueur'),
  rum: COLLAB_SPIRITS.find((s) => s.name === 'Pumpkin Spiced Rum')
}

// On wide screens the copy takes the left column and the bottle stands to the
// right; on phones the copy sits at the bottom, under the bottle.
const COLUMN = 'flex h-svh flex-col justify-end px-6 pb-[8svh] lg:w-[46vw] lg:justify-center lg:pb-0 lg:pl-[7vw]'

function BeatCopy({ id }: { id: BeatId }) {
  if (id === 'intro') return <Intro />
  if (id === 'finale') return <Finale />
  if (id === 'botanicals') return <BotanicalsCopy />
  const spirit = SPIRIT_FOR_BEAT[id]
  return spirit ? <SpiritCopy spirit={spirit} /> : null
}

function Intro() {
  return (
    <>
      <div className='sticky top-0'>
        <div data-intro-title className={`relative ${COLUMN}`}>
          <p className='mb-4 text-xs font-medium tracking-[0.3em] uppercase'>Moonshiners × Brocksbushes</p>
          <h1
            data-letters
            aria-label='Field to Still'
            className='font-[family-name:var(--font-display)] text-[clamp(3.5rem,9vw,8.5rem)] leading-[0.9]'
          >
            <Letters text='Field' />
            <br />
            <Letters text='to Still' />
          </h1>
          <p className='mt-6 max-w-sm text-lg leading-relaxed text-[#2b1d14]/75'>
            Three spirits from one Northumberland farm&apos;s year.
          </p>
          <Actions className='mt-8' />
          <p className='mt-10 hidden text-xs tracking-[0.3em] text-[#2b1d14]/50 uppercase lg:block'>Scroll</p>
          <Partners />
        </div>
      </div>

      {/* Arrives as the gin pours in. */}
      <div data-passing className='absolute top-[175svh] w-full'>
        <div className='px-6 lg:w-[46vw] lg:pl-[7vw]'>
          <Frosted className='max-w-md'>
            <p
              data-reveal
              className='font-[family-name:var(--font-display)] text-[clamp(1.75rem,3.2vw,2.75rem)] leading-tight'
            >
              Strawberries picked at Brocksbushes, near Corbridge. Distilled on Blandford Street, Newcastle.
            </p>
          </Frosted>
        </div>
      </div>
    </>
  )
}

const SHOP_URL = 'https://moonshiners.co.uk/shop/'
const CONTACT_URL = 'https://moonshiners.co.uk/contact/'

/** Where to go next: buy a bottle, or get in touch. */
function Actions({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-auto flex flex-wrap items-center gap-x-6 gap-y-3 ${className}`}>
      <a
        href={SHOP_URL}
        data-cursor='hover'
        className='group inline-flex items-center gap-2 rounded-full bg-[#2b1d14] px-6 py-3 text-sm font-semibold tracking-wide text-[#fbf3ee] transition-opacity hover:opacity-85'
      >
        Shop the collection
        <span aria-hidden className='transition-transform group-hover:translate-x-1'>
          →
        </span>
      </a>
      <a
        href={CONTACT_URL}
        data-cursor='hover'
        className='text-sm font-semibold tracking-wide underline decoration-[#2b1d14]/30 underline-offset-4 transition-colors hover:decoration-[#2b1d14]'
      >
        Get in touch
      </a>
    </div>
  )
}

/**
 * Who made it: the two partners, side by side, then the studio. The page is a
 * standalone showpiece with no site nav, so these are also its way back to
 * each of them. At the foot of the opening screen on wide screens; under the
 * intro on phones.
 */
function Partners() {
  const link = 'pointer-events-auto transition-opacity hover:opacity-70'
  return (
    <div className='mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 lg:absolute lg:bottom-[6svh] lg:left-[7vw] lg:mt-0'>
      <div className='flex items-center gap-4'>
        <a href='https://moonshiners.co.uk' target='_blank' rel='noopener' className={link} data-cursor='hover'>
          <Logo className='h-5 w-auto lg:h-6' width={undefined} height={undefined} />
        </a>
        <span aria-hidden className='text-sm text-[#2b1d14]/50'>
          ×
        </span>
        <a href='https://www.brocksbushes.co.uk' target='_blank' rel='noopener' className={link} data-cursor='hover'>
          <Image src='/logos/brocksbushes.svg' alt='Brocksbushes' width={82} height={40} unoptimized className='h-8 w-auto lg:h-10' />
        </a>
      </div>
      <a
        href='https://layers.studio'
        target='_blank'
        rel='noopener'
        className={`flex items-center gap-2.5 lg:border-l lg:border-[#2b1d14]/20 lg:pl-6 ${link}`}
        data-cursor='hover'
      >
        <span className='text-[10px] tracking-[0.25em] text-[#2b1d14]/55 uppercase'>Made by</span>
        <Image src='/logos/layers-studio.svg' alt='Layers.Studio' width={82} height={36} unoptimized className='h-8 w-auto lg:h-9' />
      </a>
    </div>
  )
}

// The botanicals fly across the whole screen, bottom left to top right, so the
// copy keeps to the corner they leave clear.
function BotanicalsCopy() {
  return (
    <div data-exit className='sticky top-0'>
      <div className='flex h-svh flex-col items-end justify-end px-6 pb-[8svh] text-right lg:pr-[7vw]'>
        <Frosted>
          <p
            data-reveal
            className='mb-3 text-xs font-medium tracking-[0.3em] uppercase'
            style={{ color: SPIRIT_FOR_BEAT.gin?.color }}
          >
            The botanical bill
          </p>
          <p data-reveal className='max-w-xs text-sm leading-relaxed text-[#2b1d14]/75 lg:text-base'>
            Alongside the strawberries: juniper, coriander, peppercorns and citrus.
          </p>
        </Frosted>
      </div>
    </div>
  )
}

function SpiritCopy({ spirit }: { spirit: CollabSpirit }) {
  return (
    <div data-exit className='sticky top-0'>
      <div className={COLUMN}>
        <Frosted>
          <p data-reveal className='mb-4 text-xs font-medium tracking-[0.3em] uppercase' style={{ color: spirit.color }}>
            {spirit.season === 'summer' ? 'Summer' : 'Autumn'} at Brocksbushes
          </p>
          <h2
            data-letters
            aria-label={spirit.name}
            className='font-[family-name:var(--font-display)] text-[clamp(2.25rem,6vw,5.5rem)] leading-[0.95]'
          >
            <Letters text={spirit.name} />
          </h2>
          <p data-reveal className='mt-3 text-sm tracking-wide text-[#2b1d14]/60'>
            {spirit.abv}% vol · 50cl
          </p>
          <p data-reveal className='mt-4 max-w-md text-sm leading-relaxed text-[#2b1d14]/80 lg:mt-6 lg:text-lg'>
            {spirit.description}
          </p>
          <ul data-reveal className='mt-5 flex max-w-md flex-wrap gap-2 lg:mt-8'>
            {spirit.notes.map((note) => (
              <li
                key={note}
                className='rounded-full border px-3 py-1 text-xs lg:px-4 lg:py-1.5 lg:text-sm'
                style={{ borderColor: `${spirit.color}66`, color: spirit.color }}
              >
                {note}
              </li>
            ))}
          </ul>
        </Frosted>
      </div>
    </div>
  )
}

function Finale() {
  return (
    <div className='sticky top-0'>
      <div className='flex h-svh flex-col items-center justify-end px-6 pb-[6svh] text-center'>
        <Frosted className='flex flex-col items-center'>
          <h2
            data-letters
            aria-label='One farm. Three bottles.'
            className='font-[family-name:var(--font-display)] text-[clamp(2.5rem,5vw,4.5rem)] leading-none'
          >
            <Letters text='One farm. Three bottles.' />
          </h2>
          <p data-reveal className='mt-5 max-w-xl text-base leading-relaxed text-[#2b1d14]/75 lg:text-lg'>
            Find them at the Moonshiners Institute on Blandford Street, Newcastle, and at Brocksbushes Farm Shop, near
            Corbridge.
          </p>
          <div data-reveal>
            <Actions className='mt-7 justify-center' />
          </div>
          {/* As credited on the labels themselves. TODO: confirm the artist's name with Moonshiners. */}
          <p data-reveal className='pointer-events-auto mt-9 text-sm text-[#2b1d14]/75'>
            Label artwork by{' '}
            <a
              href='https://www.instagram.com/rachaelcutmoreart/'
              target='_blank'
              rel='noopener'
              data-cursor='hover'
              className='font-semibold text-[#2b1d14] underline decoration-[#2b1d14]/30 underline-offset-4 transition-colors hover:decoration-[#2b1d14]'
            >
              @rachaelcutmoreart
            </a>
          </p>
          <footer data-reveal className='pointer-events-auto mt-4 max-w-2xl text-[11px] leading-relaxed text-[#2b1d14]/45'>
            3D models: &ldquo;Single Strawberry&rdquo; by aaa888 and &ldquo;3d scanned Cinnamon stick&rdquo; by sfsen,
            both on Sketchfab, licensed under{' '}
            <a className='underline' href='https://creativecommons.org/licenses/by/4.0/'>
              CC-BY-4.0
            </a>{' '}
            and modified for web. Pumpkins from ShareTextures; ginger, lime and lemon from Poly Haven (CC0).
          </footer>
        </Frosted>
      </div>
    </div>
  )
}

// The rain falls behind the copy. A soft-edged patch of frosted glass behind
// each block blurs whatever passes, so the words stay readable over it; over
// the plain backdrop, it's invisible. Faded out at its edges (two fades,
// across and down, kept where they overlap), so it has no outline.
const FEATHER = 'linear-gradient(to right, transparent, black 18%, black 82%, transparent), linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)'
const FROST = {
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  maskImage: FEATHER,
  maskComposite: 'intersect',
  WebkitMaskImage: FEATHER,
  WebkitMaskComposite: 'source-in'
} as const

/**
 * Copy on its patch of frost. Each is marked `data-fades`, for the copy's
 * exit: fading the frost itself fades its blur smoothly, whereas fading
 * something it's inside would switch the blur off.
 */
function Frosted({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className='relative'>
      <div data-fades aria-hidden className='absolute -inset-x-14 -inset-y-12' style={FROST} />
      <div data-fades className={`relative ${className}`}>
        {children}
      </div>
    </div>
  )
}

/**
 * Splits a headline into letters that can be animated one by one. Each word
 * stays in one piece so lines only break between words. Screen readers get the
 * whole text from the heading's aria-label, and skip the letters.
 */
function Letters({ text }: { text: string }) {
  const words = text.split(' ')
  return words.map((word, w) => (
    <Fragment key={w}>
      <span aria-hidden className='inline-block whitespace-nowrap'>
        {[...word].map((letter, l) => (
          <span key={l} data-letter className='inline-block'>
            {letter}
          </span>
        ))}
      </span>
      {w < words.length - 1 && ' '}
    </Fragment>
  ))
}
