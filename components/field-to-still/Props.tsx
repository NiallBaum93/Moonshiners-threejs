'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Clone, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneState } from './story';

/*
 * Fruit rain: scanned strawberries tumbling down through the scene in summer,
 * mini pumpkins and cinnamon sticks in autumn.
 *
 * It falls as you scroll (scroll back up and it rises again), plus a slow
 * drift so it never quite stops. Each piece loops from just below the picture
 * back to just above it; whether it reappears depends on how much rain its
 * season calls for at that moment, so the seasons hand over gradually, never
 * popping. The finale, with all three bottles, has a little of everything.
 */

interface Kind {
  model: string;
  season: 'summer' | 'autumn';
  count: number;
  /** The scans are real size; pumpkins come down to mini, ornamental ones */
  scale: [min: number, max: number];
}

const KINDS: Kind[] = [
  { model: 'strawberry-a', season: 'summer', count: 18, scale: [0.85, 1.2] },
  { model: 'pumpkin-4', season: 'autumn', count: 2, scale: [0.18, 0.24] },
  { model: 'pumpkin-5', season: 'autumn', count: 2, scale: [0.16, 0.2] },
  { model: 'pumpkin-6', season: 'autumn', count: 2, scale: [0.2, 0.26] },
  { model: 'cinnamon', season: 'autumn', count: 9, scale: [0.9, 1.1] },
];

// Each piece falls from just above the picture to just below it, however
// much of the scene the camera takes in (phones and the finale see more), so
// it always falls out of view rather than vanishing in it.
const MARGIN = 0.08; // m beyond the picture's edges: more than any piece's size
const FALL_PER_SCREEN = 0.7; // of the picture's height, per screen scrolled
const DRIFT = 0.03; // of it a second: the gentle fall when you're not scrolling

// Where the rain falls: around the bottle, some in front, most behind (where
// you see it through the liquid), and mostly on the bottle's side of the
// screen, so it doesn't drift behind the headlines. Never through the column
// the bottles stand in, the finale's lineup included (x within ±0.22m, z within ±0.07m).
const AREA = { x: [-0.22, 0.38], z: [-0.38, 0.24] } as const;
const KEEP_CLEAR = { x: 0.22, z: 0.07 } as const;

const url = (model: string) => `/models/props/${model}.glb`;

const _ray = new THREE.Vector3();

/** How high the picture's top (1) or bottom (−1) edge reaches at depth `z`, in metres. */
function edgeAt(camera: THREE.Camera, edge: 1 | -1, z: number) {
  _ray.set(0, edge, 0.5).unproject(camera).sub(camera.position);
  return camera.position.y + _ray.y * ((z - camera.position.z) / _ray.z);
}

/** A repeatable random sequence, so the rain falls the same way on every visit. */
export function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

interface Drop {
  kind: Kind;
  x: number;
  z: number;
  scale: number;
  offset: number; // where in the fall it starts, 0 → 1
  speed: number; // a little variety: 0.8 → 1.2
  axis: THREE.Vector3; // what it tumbles around...
  spins: number; // ...and how many times per fall
  rank: number; // 0 → 1: the lightest rain shows only the lowest ranks
}

export function Props({ sceneRef }: { sceneRef: RefObject<SceneState> }) {
  const drops = useMemo(() => {
    const random = seeded(7);
    const list: Drop[] = [];
    for (const kind of KINDS) {
      for (let i = 0; i < kind.count; i++) {
        let x = 0;
        let z = 0;
        do {
          x = THREE.MathUtils.lerp(AREA.x[0], AREA.x[1], random());
          z = THREE.MathUtils.lerp(AREA.z[0], AREA.z[1], random());
        } while (Math.abs(x) < KEEP_CLEAR.x && Math.abs(z) < KEEP_CLEAR.z);
        list.push({
          kind,
          x,
          z,
          scale: THREE.MathUtils.lerp(kind.scale[0], kind.scale[1], random()),
          offset: random(),
          speed: 0.8 + random() * 0.4,
          axis: new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
          spins: 0.5 + random() * 1.5,
          rank: (i + random()) / kind.count,
        });
      }
    }
    return list;
  }, []);

  return drops.map((drop, i) => <FallingProp key={i} drop={drop} sceneRef={sceneRef} />);
}

function FallingProp({ drop, sceneRef }: { drop: Drop; sceneRef: RefObject<SceneState> }) {
  const { scene: model } = useGLTF(url(drop.kind.model));
  const groupRef = useRef<THREE.Group>(null);
  const loopRef = useRef({ lap: Number.NaN, shown: false, time: 0, size: 1 });

  // The models' origins are at their base; they tumble around their middle instead.
  const middle = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model, true);
    return ((box.min.y + box.max.y) / 2) * drop.scale;
  }, [model, drop.scale]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const s = sceneRef.current;
    const loop = loopRef.current;
    const dt = Math.min(delta, 1 / 30);
    loop.time += dt;

    // How far through its fall it is. The whole part counts laps; the
    // fraction is where it is on this one.
    const progress = drop.offset + (s.scroll * FALL_PER_SCREEN + loop.time * DRIFT) * drop.speed;
    const lap = Math.floor(progress);
    const along = progress - lap;

    // How much rain its season calls for right now (just a sprinkle while the
    // botanicals fly, and for the finale, so neither gets cluttered). The
    // strawberries make way for autumn, then come back for the finale.
    const summer = s.strawberries * (1 - s.autumn * (1 - s.lineup)) * (1 - 0.7 * s.botanicals);
    const season = drop.kind.season === 'summer' ? summer : s.autumn;
    const wanted = drop.rank < season * (1 - 0.75 * s.lineup);

    // New pieces only join at the start of a lap, out of sight above the frame,
    // so nothing ever appears in mid-air...
    if (lap !== loop.lap) {
      loop.lap = lap;
      loop.shown = wanted;
      loop.size = 1;
    }
    // ...but one that's no longer wanted shrinks away where it is, rather than
    // hanging around until it's fallen out of the frame.
    if (!wanted) loop.size = THREE.MathUtils.damp(loop.size, 0, 8, dt);

    group.visible = loop.shown && loop.size > 0.01;
    group.scale.setScalar(loop.size);
    const top = edgeAt(state.camera, 1, drop.z) + MARGIN;
    const bottom = edgeAt(state.camera, -1, drop.z) - MARGIN;
    group.position.set(drop.x, THREE.MathUtils.lerp(top, bottom, along) + middle, drop.z);
    group.quaternion.setFromAxisAngle(drop.axis, progress * drop.spins * Math.PI * 2);
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* No shadows: high in the air, they'd only be blobs floating on the backdrop. */}
      <Clone object={model} scale={drop.scale} position-y={-middle} />
    </group>
  );
}

for (const kind of KINDS) useGLTF.preload(url(kind.model));
