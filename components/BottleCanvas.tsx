'use client';

/**
 * BottleCanvas
 *
 * Wraps the R3F <Canvas> with drag-to-rotate interaction.
 * Pointer events on the wrapper div drive a velocity ref that is forwarded
 * into BottleModel, which handles the actual rotation and shader updates.
 */

import { Suspense, useRef, useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { BottleModel } from './BottleModel';

// ── WebGL probe ───────────────────────────────────────────────────────────────
// Cached at module level so React Strict Mode's double-render doesn't run two
// GPU context creations back-to-back.
let _webGLAvailable: boolean | null = null;

function probeWebGL(): boolean {
  if (_webGLAvailable !== null) return _webGLAvailable;
  if (typeof window === 'undefined') return (_webGLAvailable = false);

  // Silence console.error for the ~1 ms this takes.
  // Three.js calls console.error BEFORE throwing on context-creation failure.
  // In React 19 dev-mode, any console.error fired inside a useEffect gets the
  // full component fiber stack appended — producing commitPassiveMountOnFiber
  // spam in the terminal.  Running this probe synchronously in a useState lazy
  // initializer (not a useEffect) keeps it outside React's effect error path,
  // and our console.error suppression blocks THREE's own pre-throw log.
  const origError = console.error;
  console.error = () => {};
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width  = 1;
    canvas.height = 1;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    return (_webGLAvailable = true);
  } catch {
    return (_webGLAvailable = false);
  } finally {
    console.error = origError;
    try { renderer?.dispose(); } catch { /* ignore */ }
  }
}

// Hoisted outside the component — prevents new object instances on every render,
// which would cause R3F's internal store to invalidate on every parent re-render.
const CAMERA = { position: [0, 0, 6.5] as [number, number, number], fov: 34 };
const GL     = { antialias: true, alpha: true };
const DPR: [number, number] = [1, 2];

interface BottleCanvasProps {
  activeLabelIndex: number;
}

export function BottleCanvas({ activeLabelIndex }: BottleCanvasProps) {
  // Lazy initializer runs synchronously during the render phase — before any
  // effects — so React's effect error handler never sees the probe throw.
  // The throw is caught inside probeWebGL(); nothing escapes to React.
  const [webGLOk] = useState(probeWebGL);

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

  if (!webGLOk) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-500">
        <p className="text-sm font-medium">3D preview unavailable</p>
        <p className="text-xs text-zinc-400">WebGL is not supported in this browser</p>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <Canvas
        camera={CAMERA}
        gl={GL}
        dpr={DPR}
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
          <BottleModel dragVelocity={dragVelocity} isDragging={isDragging} activeLabelIndex={activeLabelIndex} />
        </Suspense>

        {/* ── Ground shadow ──────────────────────────────────────────────── */}
        <ContactShadows
          position={[0, -1.25, 0]}
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
