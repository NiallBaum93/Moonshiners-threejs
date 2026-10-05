'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const SPIN_PER_PX = 0.009; // radians of spin per pixel dragged sideways
const TILT_PER_PX = 0.004; // radians of tip per pixel dragged up/down
const MAX_TILT = 0.35; // ~20°: tip it, don't topple it

// The bottle has weight: your finger pulls it round on a spring rather than
// turning it directly, so it can't jump or jitter, and it can only speed up so
// fast. (The liquid feels every jolt, so this is what keeps it calm.)
const SPIN_STIFFNESS = 120;
const SPIN_DAMPING = 22; // just enough to follow the finger without overshooting
const MAX_SPIN_ACCELERATION = 40; // rad/s²
const MAX_SPIN_SPEED = 6; // rad/s: about one turn a second
const SPIN_FRICTION = 2.2; // per second: how quickly a flicked spin slows down

// Asked to face the front again, it turns there by the shortest way, on a
// gentler spring than your finger's (just enough damping not to overshoot).
const FRONT_STIFFNESS = 30;
const FRONT_DAMPING = 11;

const TILT_STIFFNESS = 90; // how firmly it rocks back upright when released...
const TILT_DAMPING = 14; // ...and how quickly that rocking dies away

/**
 * Lets you pick the bottle up: drag sideways to spin it (flick it and it keeps
 * turning), drag up/down to tip it towards or away from you. Let go and it
 * rocks back upright. Everything pivots on the base, like a real bottle on a table.
 *
 * Pointer events only move the *target*, where your finger has dragged it to.
 * The bottle itself follows on springs, worked out once per frame in
 * useFrame, so it's smooth however unevenly the browser fires pointer events.
 */
interface TurntableProps {
  children: ReactNode;
  /** Asked when you press: may this bottle be picked up right now? (Default: yes.) */
  canGrab?: () => boolean;
  /** An extra turn on top of yours, in radians, for turning it with the scroll. Read every frame. */
  turnRef?: RefObject<number>;
  /** Asked every frame: should it turn back to face the front (if it's not being held)? (Default: no.) */
  faceFront?: () => boolean;
}

export function Turntable({ children, canGrab, turnRef, faceFront }: TurntableProps) {
  const tiltRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const dragRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    spin: 0, // radians
    spinTarget: 0, // where the finger has dragged it to
    spinVelocity: 0, // radians per second
    tilt: 0,
    tiltVelocity: 0,
    tiltTarget: 0,
  });
  // Half the width and depth of whatever's on the turntable, in metres.
  const footprintRef = useRef<{ x: number; z: number } | null>(null);
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;

    const onDown = (e: PointerEvent) => {
      if (canGrab && !canGrab()) return;
      dragRef.current.active = true;
      dragRef.current.spinTarget = dragRef.current.spin; // grab it where it is
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId); // keep receiving moves even off the canvas
    };
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      dragRef.current.spinTarget += dx * SPIN_PER_PX;
      dragRef.current.tiltTarget = THREE.MathUtils.clamp(dragRef.current.tiltTarget + dy * TILT_PER_PX, -MAX_TILT, MAX_TILT);
    };
    const onUp = () => {
      dragRef.current.active = false;
      dragRef.current.tiltTarget = 0; // let go: it settles back upright
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, [gl, canGrab]);

  useFrame((_, delta) => {
    if (!tiltRef.current || !spinRef.current) return;
    const dt = Math.min(delta, 1 / 30); // a hidden tab can report huge deltas
    const d = dragRef.current;
    const { clamp } = THREE.MathUtils;

    // Spin: while dragging, the spring pulls it towards the finger; once
    // released, it keeps its speed and friction slows it down, unless it's
    // been asked to face the front, when a spring turns it to the nearest one.
    let spinForce = -SPIN_FRICTION * d.spinVelocity;
    if (d.active) {
      spinForce = SPIN_STIFFNESS * (d.spinTarget - d.spin) - SPIN_DAMPING * d.spinVelocity;
    } else if (faceFront?.()) {
      const front = Math.round(d.spin / (Math.PI * 2)) * Math.PI * 2;
      spinForce = FRONT_STIFFNESS * (front - d.spin) - FRONT_DAMPING * d.spinVelocity;
    }
    d.spinVelocity += clamp(spinForce, -MAX_SPIN_ACCELERATION, MAX_SPIN_ACCELERATION) * dt;
    d.spinVelocity = clamp(d.spinVelocity, -MAX_SPIN_SPEED, MAX_SPIN_SPEED);
    d.spin += d.spinVelocity * dt;
    const spin = d.spin + (turnRef?.current ?? 0);
    spinRef.current.rotation.y = spin;

    // Tilt: a damped spring towards the target (your drag, or upright).
    const tiltForce = TILT_STIFFNESS * (d.tiltTarget - d.tilt) - TILT_DAMPING * d.tiltVelocity;
    d.tiltVelocity += tiltForce * dt;
    d.tilt += d.tiltVelocity * dt;
    tiltRef.current.rotation.x = d.tilt;

    // A bottle tips on the edge of its base, not its middle (tipping on the
    // middle would sink half the base into the table). Measure the footprint
    // once, upright and unturned, using the actual vertices for a snug fit.
    if (!footprintRef.current) {
      // (The box comes out in world space; shift it back to be around the turntable.)
      const box = new THREE.Box3().setFromObject(spinRef.current, true);
      if (box.isEmpty()) return;
      box.translate(spinRef.current.getWorldPosition(new THREE.Vector3()).negate());
      footprintRef.current = {
        x: Math.max(-box.min.x, box.max.x),
        z: Math.max(-box.min.z, box.max.z),
      };
    }
    // How far the base reaches towards (or away from) the camera at this
    // spin: the edge it tips over...
    const { x, z } = footprintRef.current;
    const edge = (Math.abs(x * Math.sin(spin)) + Math.abs(z * Math.cos(spin))) * Math.sign(d.tilt);
    // ...and the shift that turns "rotate about the middle" into "rotate about that edge".
    tiltRef.current.position.set(0, edge * Math.sin(d.tilt), edge * (1 - Math.cos(d.tilt)));
  });

  return (
    <group ref={tiltRef}>
      <group ref={spinRef}>{children}</group>
    </group>
  );
}
