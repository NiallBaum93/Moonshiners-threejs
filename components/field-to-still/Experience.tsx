'use client';

import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
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
const GL = { antialias: true, toneMapping: THREE.NeutralToneMapping };

export default function Experience() {
  // What the scene looks like right now, eased towards the scroll position.
  // Director writes it every frame; everything else reads it.
  const sceneRef = useRef<SceneState>(sceneAt(0));
  // How hard the scroll is speeding up or slowing down, as a shove the liquid feels.
  const surgeRef = useRef(0);

  return (
    <Canvas camera={CAMERA} gl={GL} dpr={[1, 2]} shadows="percentage" style={STYLE}>
      <Director sceneRef={sceneRef} surgeRef={surgeRef} />
      <Studio sceneRef={sceneRef} />
      <Suspense fallback={null}>
        <Stage sceneRef={sceneRef} surgeRef={surgeRef} />
        <Props sceneRef={sceneRef} />
        <Botanicals sceneRef={sceneRef} />
      </Suspense>
    </Canvas>
  );
}
