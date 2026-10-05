/*
 * The page's choreography, in one place.
 *
 * The page is a stack of beats, each a few screens tall. As you scroll,
 * ScrollTrigger writes how far down you are into `story.position`, measured in
 * screen heights from the top. Every frame, the 3D scene asks `sceneAt()` what
 * it should look like at that position, and eases towards it.
 *
 * Nothing here knows about three.js or React, so the whole sequence can be
 * read, and tuned, without touching the scene.
 */

export const BEATS = [
  { id: 'intro', screens: 3 }, // strawberries fall, the cork pops, the gin pours in
  { id: 'gin', screens: 1.5 },
  { id: 'botanicals', screens: 2.5 }, // the gin turns, centre stage, as its botanicals fly past
  { id: 'liqueur', screens: 2 }, // the liqueur slides in
  { id: 'rum', screens: 2.5 }, // autumn arrives, then the rum slides in
  { id: 'finale', screens: 2 }, // all three, side by side
] as const;

export type BeatId = (typeof BEATS)[number]['id'];

/** How tall the whole page is, in screens */
export const TOTAL_SCREENS = BEATS.reduce((total, beat) => total + beat.screens, 0);

/** Where each beat starts, in screens from the top */
export const BEAT_START = Object.fromEntries(
  BEATS.map((beat, i) => [beat.id, BEATS.slice(0, i).reduce((total, b) => total + b.screens, 0)]),
) as Record<BeatId, number>;

/** Written by the page's ScrollTrigger, read by the scene every frame. */
export const story = { position: 0 };

/** What the scene should look like at one moment. Every value runs 0 → 1 unless noted. */
export interface SceneState {
  /** The scroll position itself, in screens (eased like the rest: the rain falls with it) */
  scroll: number;
  /** How much strawberry rain there is: it eases in through the intro */
  strawberries: number;
  /** How far the gin's cork is out: 0 = in the bottle, 1 = lifted clear */
  cork: number;
  /** How full the gin bottle is (the other two always arrive full) */
  fill: number;
  /** The botanicals interlude: the gin takes centre stage on its own */
  botanicals: number;
  /** How far through the interlude, 0 → 1. Not eased in or out: it's the botanicals' flight */
  flight: number;
  /** Which bottle is centre stage: 0 = gin, 1 = liqueur, 2 = rum, in between = sliding */
  bottle: number;
  /** Summer → autumn: the studio warms, and pumpkins and cinnamon replace the strawberries */
  autumn: number;
  /** The finale: the camera pulls back and the bottles line up */
  lineup: number;
}

/** 0 before `from`, 1 after `to`, easing smoothly in between. */
function ramp(x: number, from: number, to: number) {
  const t = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
}

/** How far through a beat `position` is, 0 → 1. */
function progress(position: number, id: BeatId) {
  const beat = BEATS.find((b) => b.id === id)!;
  return Math.min(Math.max((position - BEAT_START[id]) / beat.screens, 0), 1);
}

export function sceneAt(position: number): SceneState {
  const intro = progress(position, 'intro');
  const botanicals = progress(position, 'botanicals');
  const liqueur = progress(position, 'liqueur');
  const rum = progress(position, 'rum');
  const finale = progress(position, 'finale');

  return {
    scroll: position,
    strawberries: ramp(intro, 0, 0.25),
    // Out just before the pour, back in once it's full.
    cork: ramp(intro, 0.35, 0.45) - ramp(intro, 0.82, 0.92),
    fill: ramp(intro, 0.45, 0.8),
    botanicals: ramp(botanicals, 0, 0.15) - ramp(botanicals, 0.85, 1),
    flight: botanicals,
    bottle: ramp(liqueur, 0, 0.4) + ramp(rum, 0.25, 0.65),
    autumn: ramp(rum, 0, 0.5),
    // `position` is the top of the screen, so at the very bottom of the page
    // it stops one screen short of the end: the finale has to finish by halfway.
    lineup: ramp(finale, 0, 0.45),
  };
}
