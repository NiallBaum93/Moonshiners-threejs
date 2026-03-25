'use client';

/**
 * BottleCanvas
 *
 * Wraps the R3F <Canvas> with drag-to-rotate interaction.
 * Pointer events on the wrapper div drive a velocity ref that is forwarded
 * into BottleModel, which handles the actual rotation and shader updates.
 */

import { Suspense, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import { BottleModel } from './BottleModel';

export function BottleCanvas() {
  const dragVelocity = useRef({ x: 0, y: 0 });
  const isDragging   = useRef(false);
  const lastMouse    = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current   = true;
    lastMouse.current    = { x: e.clientX, y: e.clientY };
    dragVelocity.current = { x: 0, y: 0 };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;

    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;

    // Accumulate velocity — scale down so it feels natural
    dragVelocity.current.x += dx * 0.0028;
    dragVelocity.current.y += dy * 0.0022;

    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
    // velocity is NOT zeroed — lets inertia carry the rotation naturally
  }, []);

  return (
    <div
      className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        {/* ── Lighting ── */}
        <ambientLight intensity={0.45} />

        {/* Key light — warm front-top */}
        <directionalLight
          position={[3, 6, 4]}
          intensity={1.6}
          color="#ffd6a0"
          castShadow
        />

        {/* Fill light — cool left */}
        <directionalLight
          position={[-4, 2, -2]}
          intensity={0.5}
          color="#a0c8ff"
        />

        {/* Rim light — back */}
        <directionalLight
          position={[0, 3, -5]}
          intensity={0.35}
          color="#ffffff"
        />

        {/* ── Environment (IBL for glass reflections) ───────────────────── */}
        <Environment preset="warehouse" />

        {/* ── The Bottle ─────────────────────────────────────────────────── */}
        <Suspense fallback={null}>
          <BottleModel dragVelocity={dragVelocity} isDragging={isDragging} />
        </Suspense>

        {/* ── Ground shadow ──────────────────────────────────────────────── */}
        <ContactShadows
          position={[0, -1.0, 0]}
          opacity={0.3}
          scale={3}
          blur={2.5}
          far={1.5}
          color="#1a0a00"
        />
      </Canvas>
    </div>
  );
}
