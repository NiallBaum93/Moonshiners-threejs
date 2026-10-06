'use client';

import { useCallback, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { LiquidLook } from '@/lib/collabData';
import { Liquid } from './Liquid';

const BOTTLE_URL = '/models/bottle.glb';
const BOTTLE_HEIGHT_M = 0.2; // a 50cl flask is about 20cm tall
/** Where a full bottle's surface sits, in metres above the liquid's floor: just below the shoulder. */
export const FULL_LEVEL = 0.148;
/** The liquid's floor, in metres above the table: it sits on the thick glass base. */
export const LIQUID_FLOOR = 0.006;
/** Where the surface is when the bottle is this full (0 → 1), in metres above the table. */
export const surfaceAt = (fill: number) => LIQUID_FLOOR + FULL_LEVEL * fill;
const _base = new THREE.Vector3();
// When it's out, the cork rises clear of the neck, then swings aside (out of
// the way of the pour) and tips over.
const CORK_LIFT_M = 0.03;
const CORK_ASIDE_M = 0.045;
const CORK_TIP = 0.6; // radians
// It doesn't glide with the scroll: once it's time, it pops, on a bouncy spring.
const POP_STIFFNESS = 160;
const POP_DAMPING = 7.5; // low, so it overshoots: a little hop on the way out
// On the way back in it's pushed home, aiming just past seated so it arrives
// with a little speed, and stops dead against the neck. Corks don't bounce.
const SEAT_DAMPING = 22;
const SEAT_PUSH = 0.06; // how far past seated it aims
// A bottle in the air (waiting to be lowered in) casts a fainter shadow the
// higher it is, as it would under a big soft studio light, gone by this height.
const SHADOW_FADE_HEIGHT = 0.1; // m

/**
 * The shadow map can't hold a half-strength shadow, but it can hold a
 * shadow with holes in it. So a fading bottle leaves out a fine, even pattern
 * of its shadow's pixels (more of them the fainter it is), and the light's
 * soft-shadow blur smooths the pattern into an evenly lighter shadow.
 */
function fadingShadowShader(shader: THREE.WebGLProgramParametersWithUniforms, fade: { value: number }) {
  shader.uniforms.uShadowFade = fade;
  shader.fragmentShader = shader.fragmentShader
    .replace(
      'void main() {',
      /* glsl */ `
        uniform float uShadowFade;
        // An ordered 4×4 pattern of thresholds, 0 → 1, spread as evenly as possible.
        float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
        float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
        void main() {
      `,
    )
    .replace(
      '#include <clipping_planes_fragment>',
      /* glsl */ `
        #include <clipping_planes_fragment>
        if (bayer4(gl_FragCoord.xy) >= uShadowFade) discard;
      `,
    );
}

/**
 * Thin glass doesn't visibly bend light, so we don't use `transmission` here.
 * What makes glass look like glass is reflection: bright strips from the
 * studio lights, and dark edges where it reflects the darker surroundings at
 * grazing angles. So the material is black (no diffuse colour, only
 * reflections), and we change the last line of Three's shader so that:
 *   - rgb   = the reflection, added on top of whatever is behind the glass
 *   - alpha = how much of what's behind gets absorbed (more at the edges)
 * The custom blend mode below does: screen = rgb + behind * (1 - alpha).
 */
function glassShader(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    /* glsl */ `
      float facing = abs(dot(normal, normalize(vViewPosition)));
      float edge = pow(1.0 - facing, 3.0);
      gl_FragColor = vec4(outgoingLight, 0.03 + edge * 0.55);
    `,
  );
}

/**
 * Seen through the liquid, the back label shows its reverse side: paper, with
 * the print faintly showing through (mirrored, as it would be). The artwork's
 * alpha is kept, so the die-cut shape survives. A little light comes through
 * the paper from the studio behind, so it glows slightly rather than sitting
 * in the shade.
 */
function labelBackShader(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <map_fragment>',
      /* glsl */ `
        #include <map_fragment>
        diffuseColor.rgb = mix(vec3(0.92, 0.9, 0.86), diffuseColor.rgb, 0.2);
      `,
    )
    .replace(
      '#include <emissivemap_fragment>',
      /* glsl */ `
        #include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * 0.15;
      `,
    );
}

interface BottleProps {
  labelUrl: string;
  liquid: LiquidLook;
  /**
   * Liquid surface height above the base, in metres. The shoulder (where the
   * glass curves in) runs from ~0.149 to ~0.168, then the neck, then the cork at ~0.174.
   * Default: just below the shoulder, so it looks full but you can see it move.
   */
  level?: number;
  /** How full it is, 0 → 1 of `level`. Read every frame, so it can be animated. Default: full. */
  fillRef?: RefObject<number>;
  /** How far the cork is out, 0 = in, 1 = lifted clear. Read every frame. Default: in. */
  corkRef?: RefObject<number>;
  /** How hard liquid is pouring in from above, 0 → 1. Read every frame. Default: not pouring. */
  pourRef?: RefObject<number>;
  /** An extra shove for the liquid along the world's x axis, in m/s². Read every frame. */
  shoveRef?: RefObject<number>;
  /** Whatever carries the bottle around the set: the liquid feels only a little of its moves. */
  carrierRef?: RefObject<THREE.Object3D | null>;
}

export function Bottle({ labelUrl, liquid, level = FULL_LEVEL, fillRef, corkRef, pourRef, shoveRef, carrierRef }: BottleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const corkMeshRef = useRef<THREE.Mesh>(null);
  const popRef = useRef({ out: 0, speed: 0 });
  // How much shadow it casts, 0 → 1, shared by every part's shadow material.
  const shadowFadeRef = useRef({ value: 1 });
  const shadowShader = useCallback((s: THREE.WebGLProgramParametersWithUniforms) => {
    fadingShadowShader(s, shadowFadeRef.current);
  }, []);
  const { nodes } = useGLTF(BOTTLE_URL);
  const glass = nodes.Bottle_Main as THREE.Mesh;
  const cork = nodes.cork as THREE.Mesh;
  const labelShape = nodes['Label_|_VAMP'] as THREE.Mesh; // every label shares this geometry

  // Models use the UV convention flipY = false; Three's texture loader defaults to true.
  const label = useTexture(labelUrl, (t) => {
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  });

  // Work out the scale that makes the bottle 20cm tall and stands it on y = 0.
  const fit = useMemo(() => {
    glass.geometry.computeBoundingBox();
    const box = glass.geometry.boundingBox!;
    const height = (box.max.y - box.min.y) * glass.scale.y;
    const scale = BOTTLE_HEIGHT_M / height;
    return { scale, y: -box.min.y * glass.scale.y * scale };
  }, [glass]);

  // The cork. Past halfway, the story wants it out; a spring gets it there.
  useFrame((_, delta) => {
    const mesh = corkMeshRef.current;
    const group = groupRef.current;
    if (!mesh || !group) return;
    // The base's height above the floor.
    const height = group.getWorldPosition(_base).y - fit.y;
    shadowFadeRef.current.value = 1 - THREE.MathUtils.smoothstep(height, 0, SHADOW_FADE_HEIGHT);
    const dt = Math.min(delta, 1 / 30);
    const pop = popRef.current;
    const opening = (corkRef?.current ?? 0) > 0.5;
    const target = opening ? 1 : -SEAT_PUSH;
    const damping = opening ? POP_DAMPING : SEAT_DAMPING;
    pop.speed += (POP_STIFFNESS * (target - pop.out) - damping * pop.speed) * dt;
    pop.out += pop.speed * dt;
    if (pop.out < 0) {
      pop.out = 0; // home
      pop.speed = 0;
    }

    // The first half of `out` lifts it, the second half moves it aside.
    // Overshooting out hops it a little higher.
    const out = pop.out;
    const lift = Math.min(out * 2, 1) + Math.max(out - 1, 0) * 1.5;
    const aside = THREE.MathUtils.clamp(out * 2 - 1, 0, 1);
    // In the bottle's own units, which are scaled (fit.scale) to make it 20cm tall.
    mesh.position.set(
      cork.position.x,
      cork.position.y + (lift * CORK_LIFT_M) / fit.scale,
      cork.position.z + (aside * CORK_ASIDE_M) / fit.scale,
    );
    mesh.rotation.x = aside * CORK_TIP + pop.speed * 0.04; // and it wobbles in flight
  });

  return (
    <group ref={groupRef} position-y={fit.y} scale={fit.scale} rotation-y={-Math.PI / 2 + 0.3}>
      {/* The label is printed paper on the outside of the glass. polygonOffset
          nudges it towards the camera so it doesn't flicker against the glass
          surface it sits exactly on.

          `transparent` keeps the printed side out of the picture of the scene
          that the liquid refracts (Three only puts opaque things in it).
          Without it, the front label shows up again *inside* the liquid as a
          ghost. Its alphaTest still gives it hard, die-cut edges. */}
      <mesh geometry={labelShape.geometry} scale={labelShape.scale} castShadow>
        <meshStandardMaterial
          map={label}
          alphaTest={0.5}
          roughness={0.55}
          transparent
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-4}
        />
        {/* Its shadow keeps the die-cut shape too. */}
        <meshDepthMaterial attach="customDepthMaterial" map={label} alphaTest={0.5} onBeforeCompile={shadowShader} />
      </mesh>
      {/* The paper's inside, facing into the bottle. Opaque, so the liquid
          refracts it, which is how you see the back label through the gin. */}
      <mesh geometry={labelShape.geometry} scale={labelShape.scale}>
        <meshStandardMaterial
          map={label}
          alphaTest={0.5}
          roughness={0.7}
          side={THREE.BackSide}
          onBeforeCompile={labelBackShader}
        />
      </mesh>

      <Liquid
        geometry={glass.geometry}
        glassScale={glass.scale}
        level={level}
        fillRef={fillRef}
        pourRef={pourRef}
        shoveRef={shoveRef}
        carrierRef={carrierRef}
        {...liquid}
      />

      <mesh ref={corkMeshRef} geometry={cork.geometry} position={cork.position} scale={cork.scale} castShadow>
        <meshStandardMaterial color="#c49a6c" roughness={0.85} />
        <meshDepthMaterial attach="customDepthMaterial" onBeforeCompile={shadowShader} />
      </mesh>

      {/* Drawn last (renderOrder) so the reflections sit on top of everything inside the bottle. */}
      <mesh geometry={glass.geometry} scale={glass.scale} renderOrder={10} castShadow>
        <meshPhysicalMaterial
          color="black"
          roughness={0.04}
          ior={1.5}
          envMapIntensity={1.6}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          blending={THREE.CustomBlending}
          blendSrc={THREE.OneFactor}
          blendDst={THREE.OneMinusSrcAlphaFactor}
          onBeforeCompile={glassShader}
        />
        <meshDepthMaterial attach="customDepthMaterial" onBeforeCompile={shadowShader} />
      </mesh>
    </group>
  );
}

useGLTF.preload(BOTTLE_URL);
