'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { sceneAt, type SceneState } from './story';
import { Director } from './Director';
import { Studio } from './Studio';
import { Stage } from './Stage';
import { Props } from './Props';
import { Botanicals } from './Botanicals';

// The whole scene is in metres: the bottle is 20cm tall, a strawberry 4.5cm.
// A long lens (low fov) flattens perspective like a product photographer's.
// Passing `rotation` stops R3F auto-aiming the camera at (0,0,0), the floor.
// This is only where it starts: Stage moves it as you scroll.
const CAMERA = {
  position: [0, 0.14, 0.8] as [number, number, number],
  rotation: [-0.06, 0, 0] as [number, number, number],
  fov: 28,
  near: 0.01,
  far: 20,
};

// The canvas fills the screen behind a scrolling page. On phones, pan-y leaves
// vertical swipes to scroll the page; sideways swipes still turn the bottle.
const STYLE = { touchAction: 'pan-y' } as const;

// NeutralToneMapping (Khronos PBR Neutral) keeps brand colours true;
// R3F's default ACES shifts reds and oranges, which our labels are full of.
// The studio fills the whole frame, so the canvas is cleared opaque. (Three
// still makes it see-through wherever something writes alpha under 1; the 3D
// words don't: see keepOpaque.)
const GL = { antialias: true, alpha: false, toneMapping: THREE.NeutralToneMapping };

interface ExperienceProps {
  /** How much has loaded so far, 0 → 100 */
  onProgress: (percent: number) => void;
  /** Called once, when everything's loaded, built and drawn: the loading screen can go. */
  onReady: () => void;
}

export default function Experience({ onProgress, onReady }: ExperienceProps) {
  const { progress } = useProgress(); // models, textures and fonts loaded, of those requested
  useEffect(() => onProgress(progress), [progress, onProgress]);
  // Full Retina sharpness where the machine keeps up; if it can't, drop the
  // scene (not the page's text) to 1.5×, then 1.25×, where it's far lighter.
  const [dpr, setDpr] = useState(2);

  // What the scene looks like right now, eased towards the scroll position.
  // Director writes it every frame; everything else reads it.
  const sceneRef = useRef<SceneState>(sceneAt(0));
  // How hard the scroll is speeding up or slowing down, as a shove the liquid feels.
  const surgeRef = useRef(0);

  return (
    <Canvas camera={CAMERA} gl={GL} dpr={[1, dpr]} shadows="percentage" style={STYLE}>
      <Director sceneRef={sceneRef} surgeRef={surgeRef} />
      <Studio sceneRef={sceneRef} />
      <Suspense fallback={null}>
        <Stage sceneRef={sceneRef} surgeRef={surgeRef} />
        <Props sceneRef={sceneRef} />
        <Botanicals sceneRef={sceneRef} />
        <Precompile onReady={onReady} />
        {/* Only judged once everything's loaded: loading is always a bit jerky. */}
        <PerformanceMonitor flipflops={2} onDecline={() => setDpr(1.5)} onFallback={() => setDpr(1.25)} />
      </Suspense>
    </Canvas>
  );
}

/**
 * Three builds each material's shader the first time it draws it, which can
 * stall a frame for a moment. Most of the scene starts hidden (the bottles
 * waiting their turn, the rain, the botanicals), so that would happen
 * mid-scroll, as each first appears. Instead, once everything's loaded, draw
 * it all once: everything shown, nothing skipped for being out of shot.
 *
 * It's a real draw, not just `gl.compile`, because things seen through the
 * liquid are drawn a second time, for it to bend, with shaders of their own,
 * which only a real draw builds. Then the scene goes back as it was and is
 * drawn again straight away, and only that second picture reaches the screen.
 */
function Precompile({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const changed: [THREE.Object3D, boolean, boolean][] = [];
    scene.traverse((object) => {
      changed.push([object, object.visible, object.frustumCulled]);
      object.visible = true;
      object.frustumCulled = false;
    });
    gl.render(scene, camera);
    for (const [object, visible, culled] of changed) {
      object.visible = visible;
      object.frustumCulled = culled;
    }
    gl.render(scene, camera);
    // Ready once a couple of ordinary frames have gone by too, so the first
    // thing anyone sees is the scene running smoothly.
    let frame = requestAnimationFrame(() => (frame = requestAnimationFrame(onReady)));
    return () => cancelAnimationFrame(frame);
  }, [gl, scene, camera, onReady]);
  return null;
}
