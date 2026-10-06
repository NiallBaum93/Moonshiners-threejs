'use client'

import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Fraunces } from 'next/font/google'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { COLLAB_SPIRITS, type CollabSpirit } from '@/lib/collabData'
import { BEATS, TOTAL_SCREENS, story, type BeatId } from './story'

gsap.registerPlugin(ScrollTrigger)

// A warm, slightly old-fashioned serif for the headlines, to sit alongside
// the label typography. The variable is scoped to this page.
const display = Fraunces({ subsets: ['latin'], variable: '--font-display' })

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

  useEffect(() => {
    const page = pageRef.current!
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
    }
  }, [])

  // overflow-x-clip: on phones the copy's frost reaches past the screen's
  // sides, which would let the page scroll sideways. (Clip, not hidden, which
  // would stop the copy sticking.)
  return (
    <main ref={pageRef} className={`${display.variable} relative overflow-x-clip bg-[#f7e1dd] text-[#2b1d14]`}>
      {/* The studio. The copy above it ignores the pointer, so you can still pick up the bottle. */}
      <div className='fixed inset-0'>
        <Experience />
      </div>

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
        <div data-intro-title className={COLUMN}>
          <p className='mb-4 text-xs font-medium tracking-[0.3em] uppercase'>Moonshiners × Brocksbushes</p>
          <h1
            data-letters
            aria-label='Field to Still'
            className='font-[family-name:var(--font-display)] text-[clamp(3.5rem,9vw,8.5rem)] leading-[0.9] font-light'
          >
            <Letters text='Field' />
            <br />
            <Letters text='to Still' />
          </h1>
          <p className='mt-6 max-w-sm text-lg leading-relaxed text-[#2b1d14]/75'>
            Three spirits from one Northumberland farm&apos;s year.
          </p>
          <p className='mt-10 text-xs tracking-[0.3em] text-[#2b1d14]/50 uppercase'>Scroll</p>
        </div>
      </div>

      {/* Arrives as the gin pours in. */}
      <div data-passing className='absolute top-[175svh] w-full'>
        <div className='px-6 lg:w-[46vw] lg:pl-[7vw]'>
          <Frosted className='max-w-md'>
            <p
              data-reveal
              className='font-[family-name:var(--font-display)] text-[clamp(1.75rem,3.2vw,2.75rem)] leading-tight font-light'
            >
              Strawberries picked at Brocksbushes, near Corbridge. Distilled on Blandford Street, Newcastle.
            </p>
          </Frosted>
        </div>
      </div>
    </>
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
            className='font-[family-name:var(--font-display)] text-[clamp(2.25rem,6vw,5.5rem)] leading-[0.95] font-light'
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
            className='font-[family-name:var(--font-display)] text-[clamp(2.5rem,5vw,4.5rem)] leading-none font-light'
          >
            <Letters text='One farm. Three bottles.' />
          </h2>
          <p data-reveal className='mt-5 max-w-xl text-base leading-relaxed text-[#2b1d14]/75 lg:text-lg'>
            Find them at the Moonshiners Institute on Blandford Street, Newcastle, and at Brocksbushes Farm Shop, near
            Corbridge.
          </p>
          <footer data-reveal className='pointer-events-auto mt-10 max-w-2xl text-[11px] leading-relaxed text-[#2b1d14]/45'>
            {/* As credited on the labels themselves. TODO: confirm the artist's name with Moonshiners. */}
            Label artwork by{' '}
            <a className='underline' href='https://www.instagram.com/rachaelcutmoreart/'>
              @rachaelcutmoreart
            </a>
            . 3D models: &ldquo;Single Strawberry&rdquo; by aaa888 and &ldquo;3d scanned Cinnamon stick&rdquo; by sfsen,
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
