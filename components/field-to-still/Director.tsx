'use client';

import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sceneAt, story, type SceneState } from './story';

// How quickly the scene eases towards the scroll position: it's about a
// quarter of a second behind. The easing runs twice over (see below), each
// stage twice as quick, so the total lag is the same as easing once at 4.
const CATCH_UP = 8; // per second, per stage

// The camera: close for the product shots, pulled back for the lineup.
const CLOSE = { y: 0.14, z: 0.8, tilt: -0.06 };
const WIDE = { y: 0.15, z: 1.15, tilt: -0.05 };
const LINEUP_WIDTH = 0.48; // m of the finale that must fit across the screen

// Scrolling carries the scene, and the liquid feels it: start scrolling and
// it leans one way, stop and it rocks back. This turns the scroll's change
// of speed (screens/s²) into a shove (m/s²). Gently: it should feel like a
// bottle being carried, not shaken.
const SURGE = 0.1;
const MAX_SURGE = 1.5; // m/s²: about a sixth of a g, however wildly you scroll

/**
 * Runs the story. Every frame it asks story.ts what the scene should look like
 * at the current scroll position, eases the shared scene state towards it, and frames the
 * camera. The bottles, props and studio all read the same eased state.
 *
 * It renders nothing. Its useFrame runs at priority -1, before everyone
 * else's (which run at 0), so they always read this frame's values.
 */
interface DirectorProps {
  sceneRef: RefObject<SceneState>;
  /** Written every frame: the scroll's surge, for the liquid (m/s²) */
  surgeRef: RefObject<number>;
}

export function Director({ sceneRef, surgeRef }: DirectorProps) {
  const scrollRef = useRef({ last: Number.NaN, speed: 0 });
  const halfwayRef = useRef<SceneState>(sceneAt(0)); // the first stage of the easing

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const target = sceneAt(story.position);
    const halfway = halfwayRef.current;
    const s = sceneRef.current;

    // Ease every value, rather than jumping, so a flick of the scroll wheel
    // becomes a smooth move. Twice over: easing once still starts each move
    // at full speed, from a standstill, a jolt the liquid feels as a hard
    // shove. Easing the eased value again lets everything gather speed instead.
    for (const key of Object.keys(target) as (keyof SceneState)[]) {
      halfway[key] = THREE.MathUtils.damp(halfway[key], target[key], CATCH_UP, dt);
      s[key] = THREE.MathUtils.damp(s[key], halfway[key], CATCH_UP, dt);
    }

    // The surge: how quickly the (eased) scroll is speeding up or slowing down.
    const scroll = scrollRef.current;
    const speed = Number.isNaN(scroll.last) ? 0 : (s.scroll - scroll.last) / dt;
    const change = (speed - scroll.speed) / dt;
    scroll.last = s.scroll;
    scroll.speed = speed;
    surgeRef.current = THREE.MathUtils.clamp(-change * SURGE, -MAX_SURGE, MAX_SURGE);

    // Camera. Pull back for the lineup, far enough that all three fit across
    // even a narrow phone screen. The camera's field of view is vertical, so
    // the narrower the screen, the further back it needs to be.
    const camera = state.camera as THREE.PerspectiveCamera;
    const { size } = state;
    const aspect = size.width / size.height;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const fitWidth = LINEUP_WIDTH / (2 * Math.tan(halfFov) * aspect);
    const { lerp } = THREE.MathUtils;
    // On upright screens, step back a little too, so the bottle leaves room for the copy beneath it.
    const close = CLOSE.z * THREE.MathUtils.clamp(1 / aspect, 1, 1.7);
    // (And on wide screens, step in a little for the botanicals.)
    const wide = aspect > 1.1;
    const stepIn = wide ? 0.06 * s.botanicals : 0;
    const z = lerp(close * (1 - stepIn), Math.max(WIDE.z, fitWidth), s.lineup);
    camera.position.set(0, lerp(CLOSE.y, WIDE.y, s.lineup), z);
    camera.rotation.set(lerp(CLOSE.tilt, WIDE.tilt, s.lineup), 0, 0);

    // Framing. Slide the picture (not the camera, so the bottle is still shot
    // straight on) to keep it clear of the copy: right of the copy column on
    // wide screens, above it on phones, and above the closing words at the end.
    // The botanicals have the screen to themselves (their copy is just a
    // caption), so the gin moves to the middle for them.
    const right = wide ? 0.2 * (1 - s.lineup) * (1 - s.botanicals) : 0; // fraction of the screen's width
    const up = wide ? 0.12 * s.lineup : lerp(0.19, 0.07, s.botanicals); // fraction of its height
    camera.setViewOffset(size.width, size.height, -right * size.width, up * size.height, size.width, size.height);
  }, -1);

  return null;
}
