'use client';

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { LiquidLook } from '@/lib/collabData';
import { SloshField } from './slosh';

// A spirit is roughly 40% ethanol in water: refractive index ≈ 1.36
// (water is 1.33, ethanol 1.36). This is what bends the view through it.
const SPIRIT_IOR = 1.36;

// The glass, as fractions of the bottle's 20cm height.
const WALL = 0.0125; // ≈ 2.5mm walls
const BASE = 0.03; // ≈ 6mm: bottles have a thick base

// The liquid averages the bottle's motion over this long. Frame-to-frame
// differences are jittery, more so at high refresh rates, so this is a fixed
// time rather than a number of frames. Long enough to round off sudden jolts
// too, which a hand holding a bottle naturally cushions.
const SMOOTHING_TIME = 0.08; // s

// How much of its carrier's moves (see `carrierRef`) the liquid is spared.
// They're choreography, like a bottle gliding on a camera dolly: it should
// lean a little as it goes, not slosh as if it had been flung across the set.
const CUSHIONED = 0.8;

// A jump faster than anything could really move (a bottle put straight into
// place while it's off screen, or the page jumping) is a cut, not a move, and
// the liquid doesn't feel it.
const CUT_SPEED = 4; // m/s

// A stream pouring in from above lands in the middle and keeps pushing the
// surface down there, which sends rings out across it.
const POUR_RADIUS = 0.008; // m: how wide a patch the stream disturbs
const POUR_PUSH = 0.012; // m/s: how hard, at full flow

// Scratch objects reused every frame, to avoid creating garbage at 60fps.
const _centre = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _velocity = new THREE.Vector3();
const _carried = new THREE.Vector3();
const _carriedVelocity = new THREE.Vector3();
const _push = new THREE.Vector3();
const _rotation = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _simToWorld = new THREE.Matrix4();

type Uniforms = Record<string, THREE.IUniform>;

interface LiquidProps extends LiquidLook {
  /** The bottle's glass geometry. The liquid is built from its inside, so it always fits. */
  geometry: THREE.BufferGeometry;
  /** The glass mesh's own scale from the GLB */
  glassScale: THREE.Vector3;
  /** Height of the liquid's surface above the bottle's base when full, in metres */
  level: number;
  /** How full it is, 0 → 1. Read every frame, so it can be animated. Default: full. */
  fillRef?: RefObject<number>;
  /** How hard liquid is pouring in from above, 0 → 1. Read every frame. Default: not pouring. */
  pourRef?: RefObject<number>;
  /** An extra shove along the world's x axis, in m/s², from outside (e.g. the scroll). Read every frame. */
  shoveRef?: RefObject<number>;
  /**
   * Whatever is carrying the bottle around the set (the stage's slides in and
   * out). The liquid feels only a little of its moves; picking the bottle up
   * and turning it, inside it, is felt in full.
   */
  carrierRef?: RefObject<THREE.Object3D | null>;
}

/**
 * The liquid's shape: the inside of the glass. Every point of the glass
 * surface moves inwards by the wall thickness, so the gap is even everywhere,
 * shoulders and corners included, then the floor rises to the top of the base.
 */
function innerShell(glass: THREE.BufferGeometry) {
  // Just the shape (no UVs or normals), with seams welded so that pushing
  // the surface inwards can't open cracks along them.
  const source = new THREE.BufferGeometry();
  const glassPosition = glass.getAttribute('position');
  const position = new THREE.Float32BufferAttribute(glassPosition.count * 3, 3);
  for (let i = 0; i < glassPosition.count; i++) {
    position.setXYZ(i, glassPosition.getX(i), glassPosition.getY(i), glassPosition.getZ(i));
  }
  source.setAttribute('position', position);
  source.setIndex(glass.getIndex());
  const shell = mergeVertices(source);

  shell.computeVertexNormals(); // these point outwards
  shell.computeBoundingBox();
  const { min, max } = shell.boundingBox!;
  const height = max.y - min.y;
  const wall = height * WALL;
  const floor = min.y + height * BASE;

  const points = shell.getAttribute('position');
  const normals = shell.getAttribute('normal');
  for (let i = 0; i < points.count; i++) {
    points.setXYZ(
      i,
      points.getX(i) - normals.getX(i) * wall,
      Math.max(points.getY(i) - normals.getY(i) * wall, floor),
      points.getZ(i) - normals.getZ(i) * wall,
    );
  }
  shell.computeVertexNormals();
  shell.computeBoundingBox();
  return shell;
}

/**
 * The fill level. Every pixel of the liquid above the surface is thrown away
 * (`discard`). The surface is flat in *world* space, so it stays level however
 * the bottle tilts, plus the wave heights from the simulation.
 *
 * The liquid is drawn as two layers from the same shape:
 *   - the walls (front faces): what you look *through*. The view behind,
 *     back label included, is bent and tinted by the liquid.
 *   - the surface (back faces): once the top is cut off, what you see through
 *     the opening are the inside faces of the far walls. They're shaded with
 *     the waves' normal, so they reflect the studio like a real liquid surface.
 *     Below the waterline the walls cover them, so they only show through the top.
 */
function liquidShader(shader: THREE.WebGLProgramParametersWithUniforms, uniforms: Uniforms, isSurface: boolean) {
  // Both layers share one set of uniforms, so useFrame updates them together.
  Object.assign(shader.uniforms, uniforms);

  shader.fragmentShader = shader.fragmentShader.replace(
    'void main() {',
    /* glsl */ `
      uniform vec3 uOrigin;
      uniform float uLevel;
      uniform sampler2D uWaves;
      uniform vec2 uWavesSize;
      uniform mat4 uWorldToSim;
      uniform mat3 uSimToWorld;

      float waveAt(vec2 uv) {
        return texture2D(uWaves, uv).r;
      }

      void main() {
        // vWorldPosition is provided by Three whenever transmission is on.
        vec2 waveUv = (uWorldToSim * vec4(vWorldPosition, 1.0)).xz / uWavesSize + 0.5;
        float surfaceY = uOrigin.y + uLevel + waveAt(waveUv);
        if (vWorldPosition.y > surfaceY) discard;
    `,
  );

  if (isSurface) {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      /* glsl */ `
        #include <normal_fragment_maps>
        // The slope of the waves, from the heights either side of this point.
        vec2 texel = 1.0 / vec2(textureSize(uWaves, 0));
        vec2 cell = texel * uWavesSize;
        float slopeX = (waveAt(waveUv + vec2(texel.x, 0.0)) - waveAt(waveUv - vec2(texel.x, 0.0))) / (2.0 * cell.x);
        float slopeZ = (waveAt(waveUv + vec2(0.0, texel.y)) - waveAt(waveUv - vec2(0.0, texel.y))) / (2.0 * cell.y);
        vec3 surfaceNormal = normalize(vec3(0.0, 1.0, 0.0) + uSimToWorld * vec3(-slopeX, 0.0, -slopeZ));
        normal = normalize((viewMatrix * vec4(surfaceNormal, 0.0)).xyz);
      `,
    );
  } else {
    // The meniscus: liquid creeps up the glass and catches the light in a
    // thin bright line just under the waterline.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      /* glsl */ `
        float meniscus = 1.0 - smoothstep(0.0, 0.0014, surfaceY - vWorldPosition.y);
        outgoingLight = mix(outgoingLight, vec3(1.0), meniscus * 0.75);
        #include <opaque_fragment>
      `,
    );
  }
}

/** Whether it's in the picture: it, and everything it's part of, is visible. */
function onStage(object: THREE.Object3D) {
  for (let o: THREE.Object3D | null = object.parent; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export function Liquid({ geometry, glassScale, color, depth, haze, level, fillRef, pourRef, shoveRef, carrierRef }: LiquidProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Values the shaders read every frame. Changing `.value` needs no recompile.
  const uniformsRef = useRef<Uniforms>({
    uOrigin: { value: new THREE.Vector3() }, // the bottle's base, in world space
    uLevel: { value: 0 }, // resting surface height above the base, in metres
    uWaves: { value: null }, // the simulation's heights
    uWavesSize: { value: new THREE.Vector2(1, 1) }, // the area they cover, in metres
    uWorldToSim: { value: new THREE.Matrix4() }, // world → the bottle's frame
    uSimToWorld: { value: new THREE.Matrix3() }, // and back, for directions
  });
  const wallsShader = useCallback((s: THREE.WebGLProgramParametersWithUniforms) => {
    liquidShader(s, uniformsRef.current, false);
  }, []);
  const surfaceShader = useCallback((s: THREE.WebGLProgramParametersWithUniforms) => {
    liquidShader(s, uniformsRef.current, true);
  }, []);

  const shell = useMemo(() => innerShell(geometry), [geometry]);
  useEffect(() => () => shell.dispose(), [shell]);

  // The liquid's base and the middle of its footprint, in the bottle's units.
  const frame = useMemo(() => {
    const box = shell.boundingBox!;
    return {
      base: new THREE.Vector3(0, box.min.y, 0),
      centre: new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2),
      size: box.getSize(new THREE.Vector3()),
    };
  }, [shell]);

  // The wave simulation is built on the first frame, once we know the
  // bottle's real size in the world. Motion tracking lives alongside it.
  const simRef = useRef({
    field: null as SloshField | null,
    lastCentre: new THREE.Vector3(),
    lastVelocity: new THREE.Vector3(),
    lastCarried: new THREE.Vector3(),
    lastCarriedVelocity: new THREE.Vector3(),
    acceleration: new THREE.Vector3(), // smoothed, world space, m/s²
    lastAngle: 0,
    lastSpin: 0,
    spin: 0,
    spinRate: 0,
  });

  useEffect(() => () => simRef.current.field?.texture.dispose(), []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    const uniforms = uniformsRef.current;
    const sim = simRef.current;
    const dt = Math.min(delta, 1 / 30);

    group.localToWorld(uniforms.uOrigin.value.copy(frame.base));
    const fill = fillRef?.current ?? 1;
    uniforms.uLevel.value = level * fill;
    // Empty, the surface sits exactly on the floor, which the cut can't quite
    // remove, so hide it. (The simulation keeps running regardless.)
    group.visible = fill > 0.002;

    // The simulation's frame: centred on the bottle's footprint, turning
    // with it, in metres. The shader needs it both ways round.
    group.matrixWorld.decompose(_centre, _rotation, _scale);
    group.localToWorld(_centre.copy(frame.centre));
    _simToWorld.compose(_centre, _rotation, _scale.set(1, 1, 1));
    uniforms.uWorldToSim.value.copy(_simToWorld).invert();
    uniforms.uSimToWorld.value.setFromMatrix4(_simToWorld);

    // 1. How is the bottle moving? Track a point in the middle of the liquid;
    //    its change in velocity is the acceleration the liquid feels.
    group.localToWorld(_centre.copy(frame.centre).setY(frame.centre.y + 2.5));
    _axis.set(0, 0, 1).transformDirection(group.matrixWorld);
    const angle = Math.atan2(_axis.x, _axis.z);

    if (!sim.field) {
      group.getWorldScale(_scale);
      const width = frame.size.x * _scale.x;
      const length = frame.size.z * _scale.z;
      sim.field = new SloshField(width, length);
      uniforms.uWaves.value = sim.field.texture;
      uniforms.uWavesSize.value.set(width, length);
      sim.lastCentre.copy(_centre);
      if (carrierRef?.current) sim.lastCarried.setFromMatrixPosition(carrierRef.current.matrixWorld);
      sim.lastAngle = angle;
      return;
    }

    _velocity.subVectors(_centre, sim.lastCentre).divideScalar(dt);
    const cut = _velocity.length() > CUT_SPEED;
    if (cut) _velocity.copy(sim.lastVelocity); // as if it had carried on as it was
    _push.subVectors(_velocity, sim.lastVelocity).divideScalar(dt).setY(0);
    _push.x += shoveRef?.current ?? 0;
    // Take away most of the carrier's acceleration, measured the same way.
    const carrier = carrierRef?.current;
    if (carrier) {
      _carried.setFromMatrixPosition(carrier.matrixWorld);
      _carriedVelocity.subVectors(_carried, sim.lastCarried).divideScalar(dt);
      if (cut) _carriedVelocity.copy(sim.lastCarriedVelocity);
      _carried.subVectors(_carriedVelocity, sim.lastCarriedVelocity).divideScalar(dt).setY(0);
      _push.addScaledVector(_carried, -CUSHIONED);
      sim.lastCarried.setFromMatrixPosition(carrier.matrixWorld);
      sim.lastCarriedVelocity.copy(_carriedVelocity);
    }
    sim.lastCentre.copy(_centre);
    sim.lastVelocity.copy(_velocity);
    const smooth = 1 - Math.exp(-dt / SMOOTHING_TIME);
    sim.acceleration.lerp(_push, smooth);

    const spin = Math.atan2(Math.sin(angle - sim.lastAngle), Math.cos(angle - sim.lastAngle)) / dt;
    sim.spinRate = THREE.MathUtils.lerp(sim.spinRate, (spin - sim.lastSpin) / dt, smooth);
    sim.spin = THREE.MathUtils.lerp(sim.spin, spin, smooth);
    sim.lastSpin = spin;
    sim.lastAngle = angle;

    // 2. Hand it to the simulation, turned into the bottle's own frame. Unless
    //    the bottle's off stage (hidden, waiting its turn): then there's
    //    nothing to see, so it's left as it is. Its motion is still tracked
    //    above, so it carries on smoothly when it comes back.
    if (!onStage(group)) return;
    _push.copy(sim.acceleration).applyQuaternion(_rotation.invert());
    const pour = pourRef?.current ?? 0;
    if (pour > 0.01) sim.field.drop(0, 0, POUR_RADIUS, POUR_PUSH * pour * dt);
    sim.field.step(dt, _push.x, _push.z, sim.spin, sim.spinRate);
  });

  // Cloudy liqueurs: light scatters instead of passing straight through, so
  // some of the colour becomes diffuse and the view through it softens.
  const tint = useMemo(() => new THREE.Color('white').lerp(new THREE.Color(color), haze), [color, haze]);

  const look = {
    color: tint,
    transmission: 1 - haze * 0.35,
    // How far light travels through the liquid, in local units (≈ 7.5cm in
    // the world). Drives how much the view behind bends and darkens.
    thickness: 1.4,
    ior: SPIRIT_IOR,
    roughness: 0.02 + haze * 0.2,
    attenuationColor: color,
    attenuationDistance: depth,
    envMapIntensity: 1.2,
  };

  return (
    <group ref={groupRef} scale={glassScale}>
      <mesh geometry={shell}>
        <meshPhysicalMaterial {...look} onBeforeCompile={wallsShader} customProgramCacheKey={() => 'liquid-walls'} />
      </mesh>
      <mesh geometry={shell}>
        <meshPhysicalMaterial
          {...look}
          side={THREE.BackSide}
          onBeforeCompile={surfaceShader}
          customProgramCacheKey={() => 'liquid-surface'}
        />
      </mesh>
    </group>
  );
}
