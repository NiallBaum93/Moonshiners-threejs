'use client';

import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { surfaceAt } from './Bottle';

/*
 * Air dragged in by the pour. Each bubble plunges in where the stream lands,
 * is caught by buoyancy, rises (the bigger the faster), wobbles, and pops
 * when it reaches the surface.
 *
 * They're drawn as tiny opaque, shiny beads. Opaque on purpose: the liquid
 * refracts opaque things only, so this is how they come out bent and tinted
 * by the liquid around them, like everything else seen through it.
 */

const MAX_BUBBLES = 320;
const SPAWN_RATE = 220; // bubbles per second at full flow
const PLUNGE = 0.25; // m/s: how fast the stream drives them down
const RISE = 0.12; // m/s: how fast a 1mm bubble rises once buoyancy wins
const DRAG = 6; // per second: how quickly they settle to that speed
// How far they can drift from the middle: well inside the walls, wider along
// the flask's long side (which faces the camera) than its thin one.
const SPREAD_X = 0.035; // m
const SPREAD_Z = 0.014; // m

// Scratch objects reused every frame.
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();

interface Bubble {
  x: number;
  y: number;
  z: number;
  speed: number; // upwards, m/s (negative while plunging)
  driftX: number;
  driftZ: number;
  radius: number;
  phase: number; // for the wobble
  alive: boolean;
}

export function Bubbles({ flowRef, fillRef }: { flowRef: RefObject<number>; fillRef: RefObject<number> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const stateRef = useRef({
    bubbles: Array.from({ length: MAX_BUBBLES }, (): Bubble => ({
      x: 0,
      y: 0,
      z: 0,
      speed: 0,
      driftX: 0,
      driftZ: 0,
      radius: 0,
      phase: 0,
      alive: false,
    })),
    owed: 0, // fractions of a bubble carried over between frames
    time: 0,
  });

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(delta, 1 / 30);
    const state = stateRef.current;
    state.time += dt;
    const surface = surfaceAt(fillRef.current);

    // New bubbles, as many as the flow calls for this frame.
    state.owed += SPAWN_RATE * flowRef.current * dt;
    for (const b of state.bubbles) {
      if (state.owed < 1) break;
      if (b.alive) continue;
      state.owed -= 1;
      b.alive = true;
      b.radius = 0.0005 + Math.random() ** 2 * 0.0015; // mostly small, a few big ones
      b.x = (Math.random() - 0.5) * 0.004;
      b.z = (Math.random() - 0.5) * 0.004;
      b.y = surface - b.radius;
      b.speed = -PLUNGE * (0.4 + Math.random() * 0.6);
      // Thrown outwards by the churn where the stream lands.
      b.driftX = (Math.random() - 0.5) * 0.16;
      b.driftZ = (Math.random() - 0.5) * 0.06;
      b.phase = Math.random() * Math.PI * 2;
    }
    state.owed = Math.min(state.owed, 1);

    // Move them all, and write them into the instanced mesh.
    for (let i = 0; i < MAX_BUBBLES; i++) {
      const b = state.bubbles[i];
      if (b.alive) {
        const rise = RISE * (b.radius / 0.0005) ** 0.5; // big bubbles rise faster
        b.speed += (rise - b.speed) * DRAG * dt;
        b.y += b.speed * dt;
        b.driftX *= Math.exp(-1.5 * dt);
        b.driftZ *= Math.exp(-1.5 * dt);
        b.x = THREE.MathUtils.clamp(b.x + b.driftX * dt, -SPREAD_X, SPREAD_X);
        b.z = THREE.MathUtils.clamp(b.z + b.driftZ * dt, -SPREAD_Z, SPREAD_Z);
        // Pop at the surface; and never sink through the floor.
        if (b.y > surface - b.radius || fillRef.current < 0.02) b.alive = false;
        b.y = Math.max(b.y, 0.008);
      }
      const wobble = Math.sin(state.time * 18 + b.phase) * b.radius * 0.6;
      _position.set(b.x + wobble, b.y, b.z);
      _scale.setScalar(b.alive ? b.radius : 0);
      mesh.setMatrixAt(i, _matrix.compose(_position, _quaternion, _scale));
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    // frustumCulled is off because Three only knows where the bubbles started.
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_BUBBLES]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial color="#ffffff" roughness={0.05} metalness={0.2} envMapIntensity={2.5} />
    </instancedMesh>
  );
}
