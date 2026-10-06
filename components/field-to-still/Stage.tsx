'use client';

import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLLAB_SPIRITS, type CollabSpirit } from '@/lib/collabData';
import type { SceneState } from './story';
import { Bottle } from './Bottle';
import { Turntable } from './Turntable';
import { PourStream } from './PourStream';
import { Bubbles } from './Bubbles';
import { BackdropWord } from './BackdropWord';

// Bottle changes: the old one slides out to the right (away from the copy),
// the new one is lowered in from above. Each goes just far enough to be out of
// the picture, however much of the scene the screen takes in, so both are in
// view for most of the swap (rather than one leaving an empty stage).
const CLEAR_SIDE = 0.08; // m past the picture's right edge: more than half a bottle's width
const CLEAR_TOP = 0.03; // m above its top edge, for the bottle's base
const LINEUP_SPACING = 0.14; // m between bottles in the finale
const FULL_FLOW = 0.6; // fill per second that counts as pouring flat out
// The gin turns once through the botanicals interlude, following the scroll
// on a spring, and never faster than this, however fast you scroll (the liquid
// swirls with it).
const TURN_STIFFNESS = 30;
const TURN_DAMPING = 11;
const MAX_TURN_ACCELERATION = 8; // rad/s²
const MAX_TURN_SPEED = 3; // rad/s

const _edge = new THREE.Vector3();

/**
 * Where an edge of the picture meets the bottles' plane (z = 0). The edge is
 * in screen terms: (1, 0) is the middle of the right edge, (0, 1) of the top.
 */
function edgeOnStage(camera: THREE.Camera, x: number, y: number) {
  _edge.set(x, y, 0.5).unproject(camera).sub(camera.position);
  return _edge.multiplyScalar(-camera.position.z / _edge.z).add(camera.position);
}

interface StageProps {
  sceneRef: RefObject<SceneState>;
  /** The scroll's surge, which every bottle's liquid feels (see Director) */
  surgeRef: RefObject<number>;
}

/** The three bottles, each putting itself in place from the eased scene state (see Director). */
export function Stage({ sceneRef, surgeRef }: StageProps) {
  return COLLAB_SPIRITS.map((spirit, i) => (
    <StagedBottle key={spirit.name} spirit={spirit} index={i} sceneRef={sceneRef} surgeRef={surgeRef} />
  ));
}

function StagedBottle({ spirit, index, sceneRef, surgeRef }: StageProps & { spirit: CollabSpirit; index: number }) {
  const groupRef = useRef<THREE.Group>(null);
  // Only the gin is filled and corked on screen; the others arrive ready.
  const fillRef = useRef(1);
  const corkRef = useRef(0);
  const flowRef = useRef(0); // how hard it's pouring in, 0 → 1
  const presenceRef = useRef(0); // how much it's centre stage, for its backdrop word
  const turnRef = useRef(0); // radians
  const turnSpeedRef = useRef(0); // rad/s

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const s = sceneRef.current;
    const dt = Math.min(delta, 1 / 30);
    const exitDistance = edgeOnStage(state.camera, 1, 0).x + CLEAR_SIDE;
    const dropHeight = edgeOnStage(state.camera, 0, 1).y + CLEAR_TOP;
    // How many bottles away from centre stage this one is: above 0 it's still
    // waiting overhead, below 0 it's been and gone to the right.
    const away = index - s.bottle;
    let x = away < 0 ? Math.min(-away, 1) * exitDistance : 0;
    let y = away > 0 ? Math.min(away, 1) * dropHeight : 0;
    // The finale gathers all three, side by side. The one on stage steps
    // aside; the others are lowered into their places, so none of them
    // pass through each other on the way. (The lineup waits for any bottle
    // swap to finish, see Director, so by then the others are out of shot.)
    const place = (index - 1) * LINEUP_SPACING;
    if (s.lineup > 0 && Math.abs(away) >= 0.5) {
      x = place;
      y = dropHeight;
    }
    const { lerp } = THREE.MathUtils;
    groupRef.current.position.set(lerp(x, place, s.lineup), lerp(y, 0, s.lineup), 0);
    groupRef.current.visible = Math.abs(away) < 1 || s.lineup > 0.001;
    // (The gin's word steps aside for the botanicals.)
    presenceRef.current = Math.max(0, 1 - Math.abs(away) * 2) * (1 - s.lineup) * (1 - s.botanicals);
    if (index === 0) {
      // The pour follows how fast it's filling: scroll through the fill and it
      // runs, stop and it stops, scroll back up and nothing pours.
      const rising = Math.max(0, (s.fill - fillRef.current) / dt) / FULL_FLOW;
      flowRef.current = THREE.MathUtils.damp(flowRef.current, Math.min(rising, 1), 10, dt);
      fillRef.current = s.fill;
      corkRef.current = s.cork;
      const { clamp } = THREE.MathUtils;
      const force = TURN_STIFFNESS * (s.flight * Math.PI * 2 - turnRef.current) - TURN_DAMPING * turnSpeedRef.current;
      turnSpeedRef.current += clamp(force, -MAX_TURN_ACCELERATION, MAX_TURN_ACCELERATION) * dt;
      turnSpeedRef.current = clamp(turnSpeedRef.current, -MAX_TURN_SPEED, MAX_TURN_SPEED);
      turnRef.current += turnSpeedRef.current * dt;
    }
  });

  // You can pick up whichever bottle is centre stage, but not during the lineup.
  // (The React Compiler keeps this function stable between renders by itself.)
  const canGrab = () => Math.round(sceneRef.current.bottle) === index && sceneRef.current.lineup < 0.5;
  // For the lineup, every bottle turns to face the front, however you left it.
  const faceFront = () => sceneRef.current.lineup > 0.1;

  return (
    <group ref={groupRef}>
      <Turntable canGrab={canGrab} turnRef={turnRef} faceFront={faceFront}>
        <Bottle
          labelUrl={spirit.labelUrl}
          liquid={spirit.liquid}
          fillRef={fillRef}
          corkRef={corkRef}
          pourRef={flowRef}
          shoveRef={surgeRef}
          carrierRef={groupRef}
        />
      </Turntable>
      {/* The last word of its name (GIN, LIQUEUR, RUM), large, behind it. */}
      <BackdropWord word={spirit.name.split(' ').at(-1)!} color={spirit.color} presenceRef={presenceRef} />
      {/* Outside the turntable: tip the bottle and the stream still falls straight down. */}
      {index === 0 && (
        <>
          <PourStream liquid={spirit.liquid} flowRef={flowRef} fillRef={fillRef} />
          <Bubbles flowRef={flowRef} fillRef={fillRef} />
        </>
      )}
    </group>
  );
}
