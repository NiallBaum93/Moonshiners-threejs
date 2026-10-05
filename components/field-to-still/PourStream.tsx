'use client';

import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LiquidLook } from '@/lib/collabData';
import { surfaceAt } from './Bottle';

const TOP = 0.55; // m: it starts above the top of the frame
const RADIUS = 0.005; // m at full flow: a generous pour from a jug
const GLUG_RATE = 13; // radians per second: a pour from a bottle pulses, "glug, glug"
const SPIRIT_IOR = 1.36; // the same spirit as in the bottle

// A tall, open tube, hanging down from its top: y runs from 0 to -1.
const tube = new THREE.CylinderGeometry(1, 1, 1, 12, 96, true).translate(0, -0.5, 0);

// There's only ever one stream, so its shader values can live here.
const streamUniforms = {
  uTime: { value: 0 },
  uLength: { value: 1 }, // m from top to surface
  uStretch: { value: 1 }, // the length in radii: the tube is stretched to length here, not by scaling the mesh
};

/**
 * A real pour isn't a rod. As it falls it speeds up and so thins out, ripples
 * run down it, and it sways a little. All three are done by moving the tube's
 * points in its vertex shader. Ripples are measured in metres down the stream,
 * so they keep their size however long it is.
 *
 * The mesh is scaled evenly (by the radius) and stretched to length in the
 * shader instead: Three works out how far light travels through a material
 * from its mesh's scale, and a mesh scaled 40cm tall would look like a thick
 * rod of solid colour.
 */
function streamShader(shader: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, streamUniforms);
  shader.vertexShader = shader.vertexShader
    .replace(
      'void main() {',
      /* glsl */ `
        uniform float uTime;
        uniform float uLength;
        uniform float uStretch;
        void main() {
      `,
    )
    .replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        float along = -position.y;       // 0 at the top, 1 at the surface
        float down = along * uLength;    // metres fallen
        float thin = 1.0 - 0.4 * along;  // faster lower down, so narrower
        float ripple = 1.0 + 0.18 * sin(down * 260.0 - uTime * 45.0) + 0.08 * sin(down * 610.0 - uTime * 80.0);
        transformed.xz *= thin * ripple;
        transformed.x += 0.35 * along * sin(down * 35.0 - uTime * 20.0); // sway (in radii)
        transformed.y *= uStretch;
      `,
    );
}

interface PourStreamProps {
  liquid: LiquidLook;
  /** How hard it's pouring, 0 → 1. Read every frame. */
  flowRef: RefObject<number>;
  /** How full the bottle is, 0 → 1, so the stream ends at the surface. */
  fillRef: RefObject<number>;
}

export function PourStream({ liquid, flowRef, fillRef }: PourStreamProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const flow = flowRef.current;
    const surface = surfaceAt(fillRef.current);
    const length = TOP - surface;
    // A gentler flow is a thinner stream: its width goes with the square root
    // of the flow, since flow is width × width.
    const glug = 0.8 + 0.2 * Math.sin(streamUniforms.uTime.value * GLUG_RATE);
    const radius = RADIUS * Math.sqrt(flow) * glug;
    mesh.scale.setScalar(radius);
    mesh.visible = flow > 0.02;
    streamUniforms.uTime.value += delta;
    streamUniforms.uLength.value = length;
    streamUniforms.uStretch.value = length / Math.max(radius, 1e-6);
  });

  return (
    // frustumCulled is off because Three only knows the tube's unstretched size,
    // and would hide it whenever its top is off screen.
    <mesh ref={meshRef} geometry={tube} position-y={TOP} visible={false} frustumCulled={false}>
      <meshPhysicalMaterial
        transmission={1}
        thickness={1.5}
        ior={SPIRIT_IOR}
        roughness={0.05}
        attenuationColor={liquid.color}
        // Richer than the liquid in the bottle: a stream only a few millimetres
        // across would otherwise be almost invisible.
        attenuationDistance={liquid.depth * 0.3}
        envMapIntensity={2.5}
        onBeforeCompile={streamShader}
      />
    </mesh>
  );
}
