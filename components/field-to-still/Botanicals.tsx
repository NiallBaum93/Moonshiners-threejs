'use client';

import { Fragment, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Clone, Text, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLLAB_SPIRITS } from '@/lib/collabData';
import type { SceneState } from './story';
import { WORD_DETAIL, WORD_FONT, keepOpaque } from './BackdropWord';
import { seeded } from './Props';

/*
 * The botanicals interlude: while the gin turns centre stage, its botanical
 * bill flies past on a diagonal, one word at a time, each with a swarm of the
 * real thing tumbling around it: juniper berries, coriander seeds,
 * peppercorns, then lemons and limes.
 *
 * Most of it flies behind the bottle, so you watch it pass through the gin,
 * bent and tinted by it (it's all opaque on purpose: the liquid only refracts
 * opaque things). One word flies in front, for depth.
 *
 * Everything is placed by the scroll, so scrolling back flies it all back.
 */

type Swarm = 'juniper' | 'coriander' | 'peppercorn' | 'citrus';

interface Botanical {
  word: string;
  /** m: how far in front of (+) or behind (−) the bottle it flies */
  z: number;
  /** m: capital height, roughly */
  size: number;
  swarm: Swarm;
}

// As listed in the gin's description in collabData.
const BILL: Botanical[] = [
  { word: 'Juniper', z: -0.2, size: 0.09, swarm: 'juniper' },
  { word: 'Coriander', z: 0.12, size: 0.045, swarm: 'coriander' },
  { word: 'Peppercorn', z: -0.28, size: 0.08, swarm: 'peppercorn' },
  { word: 'Citrus', z: -0.22, size: 0.1, swarm: 'citrus' },
];

const COLOR = COLLAB_SPIRITS.find((s) => s.name === 'Strawberry Gin')!.color;

// The flight. Each word sets off a little after the one before, and takes a
// third of the interlude to cross the screen, bottom left to top right,
// passing behind (or in front of) the middle of the bottle.
const FIRST_START = 0.08; // of the interlude: once the gin's in the middle
const NEXT_START = 0.18; // later, for each word after the first
const CROSSING = 0.34; // of the interlude, to cross the screen
const SLOPE = 0.3; // m up per m across
const MIDDLE_Y = 0.09; // m: the middle of the bottle, which every flight passes
const TILT = Math.atan(SLOPE); // words lean into their flight
const ACROSS = new THREE.Vector3(-SLOPE, 1, 0).normalize(); // square to the flight
const TUMBLE = 0.15; // turns a second: the swarms keep tumbling even when you stop scrolling

/** How far through its crossing botanical `index` is: 0 = just off screen at the left, 1 = just off at the right. */
const crossingOf = (s: SceneState, index: number) => (s.flight - FIRST_START - index * NEXT_START) / CROSSING;

/** A rough width: DM Serif Display capitals are about 0.65 of their size wide. */
const widthOf = (b: Botanical) => b.word.length * 0.65 * b.size;

/** How far either side of the middle a flight runs, so it starts and ends just out of shot. */
function reachOf(b: Botanical, camera: THREE.PerspectiveCamera) {
  const halfWidth = (camera.position.z - b.z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  return halfWidth + widthOf(b) / 2 + 0.08;
}

/** Where `along` (0 → 1) a flight is, in the scene. */
function onFlight(along: number, reach: number, out: THREE.Vector3) {
  const x = THREE.MathUtils.lerp(-reach, reach, along);
  return out.set(x, MIDDLE_Y + x * SLOPE, 0);
}

/** One of a swarm: where it flies relative to its word, and how it tumbles. */
interface Piece {
  lag: number; // ahead of (+) or behind (−) the word, in crossings
  across: number; // m above (+) or below (−) the word's line
  depth: number; // m in front of (+) or behind (−) it
  scale: number;
  axis: THREE.Vector3;
  spins: number; // turns per crossing
  phase: number;
}

function scatter(count: number, seed: number, spread: { across: number; depth: number }, scale: [number, number]) {
  const random = seeded(seed);
  return Array.from({ length: count }, (): Piece => ({
    lag: (random() - 0.5) * 0.36,
    // Thickest along the word's line, thinning out away from it.
    across: (random() + random() - 1) * spread.across,
    depth: (random() - 0.5) * 2 * spread.depth,
    scale: THREE.MathUtils.lerp(scale[0], scale[1], random()),
    axis: new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
    spins: 0.5 + random(),
    phase: random() * Math.PI * 2,
  }));
}

export function Botanicals({ sceneRef }: { sceneRef: RefObject<SceneState> }) {
  return BILL.map((botanical, index) => (
    <Fragment key={botanical.word}>
      <FlyingWord botanical={botanical} index={index} sceneRef={sceneRef} />
      {botanical.swarm === 'citrus' ? (
        <Citrus botanical={botanical} index={index} sceneRef={sceneRef} />
      ) : (
        <Seeds kind={botanical.swarm} botanical={botanical} index={index} sceneRef={sceneRef} />
      )}
    </Fragment>
  ));
}

interface FlightProps {
  botanical: Botanical;
  index: number;
  sceneRef: RefObject<SceneState>;
}

function FlyingWord({ botanical, index, sceneRef }: FlightProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const along = crossingOf(sceneRef.current, index);
    mesh.visible = along > 0 && along < 1;
    if (!mesh.visible) return;
    keepOpaque(mesh);
    onFlight(along, reachOf(botanical, state.camera as THREE.PerspectiveCamera), mesh.position).setZ(botanical.z);
  });

  return (
    <Text
      ref={meshRef}
      font={WORD_FONT}
      sdfGlyphSize={WORD_DETAIL}
      fontSize={botanical.size}
      letterSpacing={0.04}
      anchorX="center"
      anchorY="middle"
      rotation-z={TILT}
      visible={false}
    >
      {botanical.word.toUpperCase()}
      <meshBasicMaterial color={COLOR} toneMapped={false} alphaToCoverage />
    </Text>
  );
}

// The seeds are small and round enough to make: a sphere, pushed in and out
// (`bump`, as a fraction of its radius, from a point on the unit sphere). The
// hollows are painted darker, where dust and shadow collect. Each is a touch
// bigger than life (they fly close to the camera), and varies in size and colour.
type SeedKind = Exclude<Swarm, 'citrus'>;

interface SeedLook {
  count: number;
  radius: number; // m
  detail: number; // segments around
  bump: (p: THREE.Vector3) => number;
  depth: number; // the deepest bump, for the shading
  colors: [dark: string, light: string];
}

const SEEDS: Record<SeedKind, SeedLook> = {
  // Plump, with a dusty blue bloom (the sheen, below) and a little
  // three-pointed star at the tip, where the flower was.
  juniper: {
    count: 36,
    radius: 0.006,
    detail: 32,
    bump: (p) =>
      0.03 * Math.sin(5 * p.x + 2) * Math.sin(4 * p.y + 1) * Math.sin(6 * p.z) -
      0.08 * smooth(0.9, 1, p.y) * (0.6 + 0.4 * Math.cos(3 * Math.atan2(p.z, p.x))),
    depth: 0.08,
    colors: ['#1f2236', '#4a4f6e'],
  },
  // Pale and ridged: ten ribs running pole to pole, every other one wavy.
  coriander: {
    count: 40,
    radius: 0.004,
    detail: 80,
    bump: (p) => {
      const around = Math.atan2(p.z, p.x);
      const ribs = Math.cos(10 * around) + 0.5 * Math.cos(20 * around + 2 * Math.sin(6 * p.y));
      return 0.04 * ribs * (1 - p.y * p.y) - 0.1 * smooth(0.92, 1, p.y);
    },
    depth: 0.06,
    colors: ['#8a6234', '#d9b67f'],
  },
  // Dark, dried and deeply wrinkled.
  peppercorn: {
    count: 40,
    radius: 0.0045,
    detail: 56,
    bump: (p) =>
      0.07 *
      (Math.sin(11 * p.x + 1.7) * Math.sin(9 * p.y + 0.4) * Math.sin(13 * p.z + 2.3) +
        0.6 * Math.sin(23 * p.x + 0.3) * Math.sin(19 * p.y + 2.9) * Math.sin(21 * p.z + 1.1)),
    depth: 0.07,
    colors: ['#17110d', '#4d3726'],
  },
};

/** 0 below `from`, 1 above `to`, smooth in between. */
function smooth(from: number, to: number, x: number) {
  const t = THREE.MathUtils.clamp((x - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}

function seedGeometry(kind: SeedKind) {
  const { radius, detail, bump, depth } = SEEDS[kind];
  let geometry: THREE.BufferGeometry = new THREE.SphereGeometry(1, detail, Math.round(detail * 0.6));
  // Weld the sphere's seam first, so the reshaped surface is shaded smoothly across it.
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  geometry = mergeVertices(geometry);
  const position = geometry.getAttribute('position');
  const shade = new Float32Array(position.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i);
    const b = bump(p);
    p.multiplyScalar((1 + b) * radius);
    position.setXYZ(i, p.x, p.y, p.z);
    shade.fill(THREE.MathUtils.clamp(0.75 + 0.25 * (b / depth), 0.45, 1), i * 3, i * 3 + 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Scratch objects reused every frame.
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

function Seeds({ kind, botanical, index, sceneRef }: FlightProps & { kind: SeedKind }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);
  const look = SEEDS[kind];
  const geometry = useMemo(() => seedGeometry(kind), [kind]);
  const pieces = useMemo(
    () => scatter(look.count, index + 11, { across: 0.07, depth: 0.07 }, [0.75, 1.25]),
    [look.count, index],
  );

  // Give each seed its own colour, straight away: they change which shader the
  // material needs, and it's built up front, before anything's on screen (see Precompile).
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const random = seeded(index + 23);
    const [dark, light] = look.colors.map((c) => new THREE.Color(c));
    pieces.forEach((_, i) => mesh.setColorAt(i, _color.lerpColors(dark, light, random())));
    mesh.instanceColor!.needsUpdate = true;
  }, [index, look.colors, pieces]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    timeRef.current += Math.min(delta, 1 / 30);
    const crossing = crossingOf(sceneRef.current, index);
    // Nothing to do while the whole swarm is off screen.
    mesh.visible = crossing > -0.2 && crossing < 1.2;
    if (!mesh.visible) return;

    const reach = reachOf(botanical, state.camera as THREE.PerspectiveCamera);
    pieces.forEach((piece, i) => {
      const along = crossing + piece.lag;
      onFlight(along, reach, _position).addScaledVector(ACROSS, piece.across);
      _position.z = botanical.z + piece.depth;
      _quaternion.setFromAxisAngle(piece.axis, piece.phase + (along * piece.spins + timeRef.current * TUMBLE) * Math.PI * 2);
      // Hidden (scaled to nothing) when it's past either end of the flight.
      _scale.setScalar(along > 0 && along < 1 ? piece.scale : 0);
      mesh.setMatrixAt(i, _matrix.compose(_position, _quaternion, _scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    // frustumCulled is off because Three only knows where the seeds started.
    <instancedMesh ref={meshRef} args={[geometry, undefined, look.count]} frustumCulled={false} visible={false}>
      {kind === 'juniper' ? (
        <meshPhysicalMaterial vertexColors roughness={0.7} sheen={1} sheenColor="#b9c3dd" sheenRoughness={0.8} />
      ) : (
        <meshStandardMaterial vertexColors roughness={kind === 'coriander' ? 0.8 : 0.65} />
      )}
    </instancedMesh>
  );
}

// The citrus are scans: three lemons and three limes, life size.
const CITRUS = ['lemon', 'lime', 'lemon', 'lime', 'lemon', 'lime'];
const url = (model: string) => `/models/props/${model}.glb`;

function Citrus({ botanical, index, sceneRef }: FlightProps) {
  // Smaller than life (these scans are big fruit), and spread wider than the seeds.
  const pieces = useMemo(() => scatter(CITRUS.length, index + 11, { across: 0.12, depth: 0.05 }, [0.6, 0.75]), [index]);
  return pieces.map((piece, i) => (
    <Fruit key={i} model={CITRUS[i]} piece={piece} botanical={botanical} index={index} sceneRef={sceneRef} />
  ));
}

function Fruit({ model, piece, botanical, index, sceneRef }: FlightProps & { model: string; piece: Piece }) {
  const { scene } = useGLTF(url(model));
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  // The scans' origins are at their base; they tumble around their middle instead.
  const middle = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene, true);
    return ((box.min.y + box.max.y) / 2) * piece.scale;
  }, [scene, piece.scale]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    timeRef.current += Math.min(delta, 1 / 30);
    const along = crossingOf(sceneRef.current, index) + piece.lag;
    group.visible = along > 0 && along < 1;
    if (!group.visible) return;
    onFlight(along, reachOf(botanical, state.camera as THREE.PerspectiveCamera), group.position);
    group.position.addScaledVector(ACROSS, piece.across).setZ(botanical.z + piece.depth);
    group.quaternion.setFromAxisAngle(
      piece.axis,
      piece.phase + (along * piece.spins + timeRef.current * TUMBLE * 0.5) * Math.PI * 2,
    );
  });

  return (
    <group ref={groupRef} visible={false}>
      <Clone object={scene} scale={piece.scale} position-y={-middle} />
    </group>
  );
}

for (const model of new Set(CITRUS)) useGLTF.preload(url(model));
