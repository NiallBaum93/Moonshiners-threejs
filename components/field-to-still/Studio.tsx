'use client';

import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneState } from './story';

// The studio takes its colour from whichever spirit is on stage, a pale wash
// of its liquid: blush pink for the gin, rosy red for the strawberry liqueur,
// and orange for the pumpkin rum (which stays for the finale, at autumn's end).
const GIN = { floor: '#ecd0cb', wall: '#f7e1dd', glow: '#fdf1ee', key: '#fff0e8' };
const LIQUEUR = { floor: '#e2aeab', wall: '#efc6c2', glow: '#fbe5e1', key: '#ffe1da' };
const RUM = { floor: '#e5b385', wall: '#f2cea5', glow: '#fde9d3', key: '#ffd39e' };

// A seamless photo-studio "cove": a giant sphere around the scene, seen from
// the inside, shaded with a soft vertical gradient and a glow behind the bottle.
const domeVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const domeFragment = /* glsl */ `
  uniform vec3 uFloor;
  uniform vec3 uWall;
  uniform vec3 uGlow;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    // Floor colour below the horizon, wall colour above, with a soft seam.
    vec3 col = mix(uFloor, uWall, smoothstep(-0.08, 0.25, dir.y));
    // Hotspot behind the bottle, like a light aimed at the backdrop.
    float glow = pow(max(dot(dir, normalize(vec3(0.0, 0.12, -1.0))), 0.0), 8.0);
    col = mix(col, uGlow, glow * 0.6);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const palette = (p: typeof GIN) => ({
  floor: new THREE.Color(p.floor),
  wall: new THREE.Color(p.wall),
  glow: new THREE.Color(p.glow),
  key: new THREE.Color(p.key),
});
const gin = palette(GIN);
const liqueur = palette(LIQUEUR);
const rum = palette(RUM);
const summer = palette(GIN); // gin to liqueur, as far as the scene's got: worked out every frame

// The two tall light strips that make the glass's main highlights, placed by
// angle around the bottle (radians, 0 = to its right) and distance. As you
// scroll, the whole rig turns a little about the bottle, so the highlights
// glide across the glass, like a photographer moving the softboxes.
const KEY_STRIP = strip(2.36, 4.24, 1.5);
const RIM_STRIP = strip(0.4, 3.81, 1);
const SWEEP = 0.3; // radians either way
const SWEEP_PER_SCREEN = 0.9; // radians of the sweep's cycle per screen scrolled

/** A strip's place, `distance` out at `angle` around the bottle, and where it faces. */
function strip(angle: number, distance: number, height: number) {
  return {
    position: [Math.cos(angle) * distance, height, Math.sin(angle) * distance] as [number, number, number],
    target: [0, height * 0.3, 0] as [number, number, number],
  };
}

// The backdrop's colours. There's only ever one studio, so they can live here
// and change every frame without involving React.
const domeUniforms = {
  uFloor: { value: gin.floor.clone() },
  uWall: { value: gin.wall.clone() },
  uGlow: { value: gin.glow.clone() },
};

/** The backdrop's colour right now (it shifts with the seasons). Read it, don't change it. */
export const backdropWall = domeUniforms.uWall.value;

export function Studio({ sceneRef }: { sceneRef?: RefObject<SceneState> }) {
  const keyRef = useRef<THREE.DirectionalLight>(null);

  useFrame(({ scene }) => {
    // The light rig sweeps as you scroll. Turning the finished reflections
    // costs nothing, where moving the strips would mean re-rendering them
    // every frame, which was most of the scene's work.
    scene.environmentRotation.y = Math.sin((sceneRef?.current.scroll ?? 0) * SWEEP_PER_SCREEN) * SWEEP;

    // Gin pink to liqueur red as the liqueur arrives, then rum orange as autumn
    // comes in just ahead of the rum. (In the finale the bottle number runs on
    // past the liqueur, but autumn's taken over by then.)
    const s = sceneRef?.current;
    const toLiqueur = THREE.MathUtils.clamp(s?.bottle ?? 0, 0, 1);
    const toRum = s?.autumn ?? 0;
    for (const key of ['floor', 'wall', 'glow', 'key'] as const) {
      summer[key].lerpColors(gin[key], liqueur[key], toLiqueur);
    }
    domeUniforms.uFloor.value.lerpColors(summer.floor, rum.floor, toRum);
    domeUniforms.uWall.value.lerpColors(summer.wall, rum.wall, toRum);
    domeUniforms.uGlow.value.lerpColors(summer.glow, rum.glow, toRum);
    keyRef.current?.color.lerpColors(summer.key, rum.key, toRum);
  });

  return (
    <>
      <mesh scale={6}>
        <sphereGeometry args={[1, 64, 32]} />
        <shaderMaterial
          vertexShader={domeVertex}
          fragmentShader={domeFragment}
          uniforms={domeUniforms}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/*
        Reflections. These panels never appear on screen; they're rendered into
        a cube map that every shiny material reflects. Long thin strips on a
        dark surround are what give glass bottles their crisp highlights and
        defined edges. They sit 3+ units out because the cube camera can't see
        anything closer than 1. The map is rendered once (frames={1}); the
        sweep turns it rather than re-rendering it.
      */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={5} scale={[1.2, 6, 1]} {...KEY_STRIP} />
        <Lightformer form="rect" intensity={3} scale={[0.6, 6, 1]} {...RIM_STRIP} />
        <Lightformer form="rect" intensity={2} position={[0, 1, -4]} scale={[6, 0.8, 1]} target={[0, 0, 0]} />
        <Lightformer form="circle" intensity={1.5} position={[0, 5, 0]} scale={4} target={[0, 0, 0]} />
        {/* The backdrop, low on the horizon behind the bottle. A liquid surface
            seen from just above mirrors exactly this; without it, it mirrors
            empty black and goes dark. */}
        <Lightformer form="rect" intensity={0.9} position={[0, 0.25, -4]} scale={[12, 1.4, 1]} target={[0, 0.25, 0]} />
      </Environment>

      {/* Direct lights do the diffuse lighting (label paper, cork, fruit). Glass
          barely reflects them, so they don't turn it milky like a big
          reflected fill panel would. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[0.6, 0.8, 1.2]} intensity={0.8} />

      {/* Key light: warm, upper left, and the one that casts the shadow. */}
      <directionalLight
        ref={keyRef}
        position={[-0.5, 1.2, 0.6]}
        intensity={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={6}
        shadow-bias={-0.0004}
        shadow-normalBias={0.002}
        shadow-camera-left={-0.3}
        shadow-camera-right={0.3}
        shadow-camera-top={0.3}
        shadow-camera-bottom={-0.3}
        shadow-camera-near={0.5}
        shadow-camera-far={3}
      />

      {/* A "shadow catcher": an invisible floor that only draws the shadows that land on it.
          It sits 1mm below the bottle's base. At exactly the same height, the
          two surfaces fight over which is in front ("z-fighting"), and the
          base flickers as the bottle turns. It doesn't hide what's beneath it
          (depthWrite off): there's no visible floor, so falling fruit should
          carry on out of the frame rather than vanish at an invisible line. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.001} receiveShadow>
        <planeGeometry args={[3, 3]} />
        <shadowMaterial transparent opacity={0.22} color="#3a2a1c" depthWrite={false} />
      </mesh>
    </>
  );
}
