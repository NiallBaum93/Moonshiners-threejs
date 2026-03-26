'use client';

/**
 * BottleModel
 *
 * Loads the GLB, auto-detects the liquid mesh, swaps its material for the
 * custom ShaderMaterial, and drives the wobble uniforms every frame.
 *
 * PUT YOUR GLB AT:  /public/models/bottle.glb
 *
 * If auto-detection doesn't find your liquid mesh, open the browser console —
 * we log every mesh name so you can set LIQUID_KEYWORDS below.
 */

import {
  useRef,
  useEffect,
  useMemo,
  MutableRefObject,
} from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { liquidVertexShader, liquidFragmentShader } from '@/lib/liquidShader';
import { SPIRITS } from '@/lib/spiritData';

// ── Detection keywords (compared against lowercased mesh names) ───────────────
const LIQUID_KEYWORDS = [
  'liquid', 'fluid', 'fill', 'content', 'spirit',
  'moonshine', 'whiskey', 'whisky', 'water', 'drink',
];
const LABEL_KEYWORDS = ['label'];
const CORK_KEYWORDS  = ['cork', 'stopper', 'cap', 'bung'];

// Per-liquid colour variants — keywords matched against lowercased mesh names.
// Each spirit's mesh name contains a recognisable substring, so we key on those.
// Keys matched against lowercased mesh names — GLB has liquid_AMBER and liquid_CLEAR
const LIQUID_VARIANTS: Record<string, { color: THREE.Color; opacity: number }> = {
  amber: { color: new THREE.Color(0.75, 0.32, 0.04), opacity: 0.30 }, // whiskey amber
  clear: { color: new THREE.Color(0.82, 0.92, 1.00), opacity: 0.12 }, // clear spirit
};

// Fallback
const LIQUID_DEFAULT = { color: new THREE.Color(0.75, 0.32, 0.04), opacity: 0.30 };

// ~5° rightward tilt
const TILT_Z = 0.087;

// ─────────────────────────────────────────────────────────────────────────────

interface BottleModelProps {
  /** Ref written by BottleCanvas with the current drag velocity (units/frame) */
  dragVelocity:     MutableRefObject<{ x: number; y: number }>;
  isDragging:       MutableRefObject<boolean>;
  activeLabelIndex: number;
}

export function BottleModel({ dragVelocity, isDragging, activeLabelIndex }: BottleModelProps) {
  const { scene } = useGLTF('/models/bottle.glb');

  // Separate ref for the inner spinning group so the tilt is applied in world
  // space and doesn't rotate with the bottle as it spins on Y.
  const spinRef = useRef<THREE.Group>(null);

  // ── Compute group transform from scene bounding box ─────────────────────
  // useMemo runs synchronously during render — no ref timing issues.
  const groupTransform = useMemo(() => {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const SKIP_NAMES = ['wall', 'plane', 'background', 'backdrop', 'floor', 'ground', 'label'];
    // Only measure solid structural meshes (glass body + cork).
    // Labels (flat quads) and liquid (inner surface) are excluded because they
    // can have near-zero thickness or unusual local-space extents that corrupt
    // the scale calculation.
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const n = child.name.toLowerCase().trim();
      if (SKIP_NAMES.some(p => n.includes(p))) return;
      if (LIQUID_KEYWORDS.some(kw => n.includes(kw))) return;
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
      if (!child.geometry.boundingBox) return;
      const geomBox = child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld);
      box.union(geomBox);
    });
    if (box.isEmpty()) return { scale: 1, positionY: 0 };
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Guard against degenerate geometry (un-applied Blender scale, etc.)
    const rawScale = 2.15 / size.y;
    const s        = Number.isFinite(rawScale) ? Math.min(rawScale, 5.0) : 1.65;
    return { scale: s, positionY: -center.y * s + 0.35 };
  }, [scene]);

  const rotY        = useRef(0);
  const rotX        = useRef(0);
  const elapsedTime = useRef(0);
  const liquidMats  = useRef<THREE.ShaderMaterial[]>([]);

  // Label cross-fade state
  const labelMeshes  = useRef<THREE.Mesh[]>([]);
  const labelMats    = useRef<THREE.MeshStandardMaterial[]>([]);
  const labelCurrent = useRef<number[]>([]); // interpolated opacity per label
  const labelTarget  = useRef<number[]>([]); // desired opacity per label

  // Slosh / spin physics
  const sloshEnergy = useRef(0);
  const spinSpeed   = useRef(0);
  const prevRotY    = useRef(0);

  // ── One-time scene setup ────────────────────────────────────────────────
  // Material swapping only — group transform is handled via JSX props above.
  useEffect(() => {
    // 1. Hide any remaining backdrop studio props
    const BACKDROP_NAMES = ['wall', 'plane'];
    scene.traverse((child) => {
      const n = child.name.toLowerCase().trim();
      if (BACKDROP_NAMES.some((p) => n === p || n.startsWith(p + ' ') || n.startsWith(p + '+'))) {
        child.visible = false;
      }
    });

    // 2. Categorise and materialise each mesh
    const liquidMatsArr : THREE.ShaderMaterial[]       = [];
    const glassMatsArr  : THREE.MeshPhysicalMaterial[] = [];
    const labelMeshArr  : THREE.Mesh[]                 = [];
    const labelMatArr   : THREE.MeshStandardMaterial[] = [];
    const origMats = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const allNames : string[] = [];

    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      allNames.push(child.name || '(unnamed)');

      const n = (child.name || '').toLowerCase();

      // Priority order: liquid > label > cork > glass body
      const isLiquid = LIQUID_KEYWORDS.some(kw => n.includes(kw));
      const isLabel  = !isLiquid && LABEL_KEYWORDS.some(kw => n.includes(kw));
      const isCork   = !isLiquid && !isLabel && CORK_KEYWORDS.some(kw => n.includes(kw));

      if (isLiquid) {
        // ── Custom slosh shader ────────────────────────────────────────────────
        let variant = LIQUID_DEFAULT;
        for (const [key, val] of Object.entries(LIQUID_VARIANTS)) {
          if (n.includes(key)) { variant = val; break; }
        }
        const mat = new THREE.ShaderMaterial({
          vertexShader:   liquidVertexShader,
          fragmentShader: liquidFragmentShader,
          uniforms: {
            uTime:      { value: 0 },
            uGravTiltX: { value: 0 },
            uGravTiltZ: { value: 0 },
            uSlosh:     { value: 0 },
            uSpin:      { value: 0.06 },
            uColor:     { value: variant.color.clone() },
            uOpacity:   { value: variant.opacity },
          },
          transparent: true,
          side:        THREE.FrontSide,
          depthWrite:  false,
        });
        origMats.set(child, child.material);
        child.material    = mat;
        child.renderOrder = 1;
        liquidMatsArr.push(mat);

      } else if (isLabel) {
        // ── Label: clone original so ALL textures are preserved, enable fade ──
        // Using .includes('label') catches "Label | Whiskey", "Label_Rum", "label.001" etc.
        // The depthWrite:false lets labels layer correctly over the glass in renderOrder 3.
        //
        // Some label meshes exported from Blender carry a multi-material array where
        // material[0] is a plain white fill and material[1] (or later) holds the actual
        // texture.  Always picking [0] makes those labels appear solid white.
        // Instead, pick whichever material in the array has a `map` (texture), falling
        // back to [0] only when none of them do.
        const allMats = (Array.isArray(child.material)
          ? child.material
          : [child.material]) as THREE.MeshStandardMaterial[];
        const src = allMats.find(m => m.map != null) ?? allMats[0];
        const clone = src.clone() as THREE.MeshStandardMaterial;
        // Ensure the texture is treated as sRGB colour data (not linear).
        // Three.js r152+ requires this when textures are manually cloned.
        if (clone.map) clone.map.colorSpace = THREE.SRGBColorSpace;
        clone.transparent = true;
        clone.depthWrite  = false;
        clone.side        = THREE.FrontSide;  // back face causes label to render over liquid from all angles
        clone.opacity     = 0;               // start invisible; useEffect sets active one
        clone.needsUpdate = true;
        origMats.set(child, child.material);
        child.material    = clone;
        child.renderOrder = 2;
        child.visible     = true;            // managed via opacity, not .visible
        labelMeshArr.push(child);
        labelMatArr .push(clone);

      } else if (isCork) {
        // ── Cork: KEEP OPAQUE so it writes depth and renders correctly ─────────
        // The previous code forced transparent+depthWrite:false which made the
        // cork vanish behind the glass.  Opaque + depthWrite:true fixes this.
        const src = (Array.isArray(child.material)
          ? child.material[0]
          : child.material) as THREE.MeshStandardMaterial;
        const clone = src.clone() as THREE.MeshStandardMaterial;
        clone.side            = THREE.DoubleSide;
        clone.transparent     = false;
        clone.depthWrite      = true;
        clone.roughness       = 0.90; // cork is matte and rough
        clone.metalness       = 0.0;
        clone.envMapIntensity = 0.25;
        // Apply a realistic cork colour when no texture is packed in the GLB
        if (!clone.map) clone.color.setRGB(0.70, 0.48, 0.31);
        clone.needsUpdate = true;
        origMats.set(child, child.material);
        child.material    = clone;
        child.renderOrder = 0;

      } else if (child.name.length > 0) {
        // ── Bottle glass body — IBL reflections + subtle transparency ─────────
        // envMapIntensity: 1.8 gives readable glass reflections from the
        // warehouse Environment preset while staying mostly see-through.
        const glassMat = new THREE.MeshPhysicalMaterial({
          color:               new THREE.Color(0.82, 0.94, 0.97),
          roughness:           0.03,
          metalness:           0.0,
          // Physically-based glass transmission — far more convincing than
          // low-opacity transparency; uses screen-space refraction pass.
          transmission:        0.92,
          thickness:           0.8,
          ior:                 1.52,
          attenuationColor:    new THREE.Color(0.82, 0.94, 0.97),
          attenuationDistance: 8.0,
          envMapIntensity:     2.8,
          transparent:         true,
          opacity:             1.0,
          side:                THREE.FrontSide,
          depthWrite:          false,
        });
        origMats.set(child, child.material);
        child.material    = glassMat;
        child.renderOrder = 3;
        glassMatsArr.push(glassMat);
      }
    });

    console.log('[BottleModel] all meshes:', allNames);
    console.log('[BottleModel] labels found:', labelMeshArr.map(m => m.name));
    if (liquidMatsArr.length === 0) {
      console.warn('[BottleModel] No liquid mesh detected. Names:', allNames.join(', '));
    }

    liquidMats.current  = liquidMatsArr;
    labelMeshes.current = labelMeshArr;
    labelMats.current   = labelMatArr;

    // Initialise cross-fade arrays: index 0 visible, rest hidden
    labelCurrent.current = labelMatArr.map((_, i) => (i === 0 ? 1 : 0));
    labelTarget .current = labelMatArr.map((_, i) => (i === 0 ? 1 : 0));
    labelMatArr.forEach((m, i) => { m.opacity = i === 0 ? 1 : 0; });

    // 4. Done — group is already visible from mount
    return () => {
      origMats.forEach((orig, mesh) => { mesh.material = orig; });
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) child.visible = true;
      });
      liquidMats.current   = [];
      labelMeshes.current  = [];
      labelMats.current    = [];
      labelCurrent.current = [];
      labelTarget .current = [];
      liquidMatsArr.forEach(m => m.dispose());
      glassMatsArr .forEach(m => m.dispose());
      labelMatArr  .forEach(m => m.dispose());
    };
  }, [scene]);

  // ── Respond to label index changes ───────────────────────────────────────
  useEffect(() => {
    const targets = labelTarget.current;
    if (!targets.length) return;
    // Use the explicit meshIndex from spiritData so removed/skipped label
    // meshes in the GLB don't shift all subsequent spirits out of sync.
    const meshIdx = SPIRITS[activeLabelIndex]?.meshIndex ?? activeLabelIndex;
    const clampedIdx = Math.min(meshIdx, targets.length - 1);
    for (let i = 0; i < targets.length; i++) {
      targets[i] = i === clampedIdx ? 1.0 : 0.0;
    }
  }, [activeLabelIndex]);

  // ── Per-frame: rotation physics + shader uniform updates ──────────────────
  useFrame((_state, delta) => {
    if (!spinRef.current) return;
    const dt = Math.min(delta, 0.05); // guard against tab-blur spike
    elapsedTime.current += dt;

    rotY.current += dragVelocity.current.x * 60 * dt;
    rotX.current += dragVelocity.current.y * 60 * dt;

    // Auto-spin on Y — rotation.z tilt is permanent and untouched
    if (!isDragging.current) rotY.current += 0.005;

    dragVelocity.current.x *= 0.91;
    dragVelocity.current.y *= 0.91;

    spinRef.current.rotation.y = rotY.current;
    spinRef.current.rotation.x = THREE.MathUtils.clamp(rotX.current, -0.3, 0.3);

    const t = elapsedTime.current;

    // ── Slosh energy: spikes on angular acceleration, decays naturally ──────
    const dRotY = rotY.current - prevRotY.current;
    sloshEnergy.current = THREE.MathUtils.lerp(
      sloshEnergy.current,
      Math.abs(dRotY) * 28,
      0.25,
    );
    sloshEnergy.current *= 0.93;
    prevRotY.current = rotY.current;

    // ── Spin speed (centrifugal effects) ─────────────────────────────────────
    const targetSpin = isDragging.current
      ? THREE.MathUtils.clamp(Math.abs(dragVelocity.current.x) * 8, 0, 1)
      : 0.06; // small idle value keeps subtle ring-ripple always visible
    spinSpeed.current = THREE.MathUtils.lerp(spinSpeed.current, targetSpin, 0.08);

    // ── Gravity tilt in bottle-local frame ────────────────────────────────────
    // World gravity = [0,-1,0].  Inverse-transforming by Rz(TILT_Z)*Ry(rotY) gives
    // the local gravity direction.  The X and Z components set the liquid surface
    // tilt so it appears to stay horizontal in world space as the bottle spins.
    //   gravTiltX = tan(TILT_Z) * cos(rotY)
    //   gravTiltZ = tan(TILT_Z) * sin(rotY)
    const tiltMag   = Math.tan(TILT_Z); // ≈ 0.40
    const gravTiltX = tiltMag * Math.cos(rotY.current);
    const gravTiltZ = tiltMag * Math.sin(rotY.current);

    // ── Update liquid shader uniforms ─────────────────────────────────────────
    const sloshClamped = THREE.MathUtils.clamp(sloshEnergy.current, 0, 1);
    for (const mat of liquidMats.current) {
      mat.uniforms.uTime     .value = t;
      mat.uniforms.uGravTiltX.value = gravTiltX;
      mat.uniforms.uGravTiltZ.value = gravTiltZ;
      mat.uniforms.uSlosh    .value = sloshClamped;
      mat.uniforms.uSpin     .value = spinSpeed.current;
    }

    // ── Label cross-fades ─────────────────────────────────────────────────────
    // lerp factor 0.04 @ 60fps ≈ ~1 second for a full cross-fade
    const mats     = labelMats.current;
    const targets  = labelTarget.current;
    const currents = labelCurrent.current;
    for (let i = 0; i < mats.length; i++) {
      currents[i] = THREE.MathUtils.lerp(currents[i] ?? 0, targets[i] ?? 0, 0.04);
      mats[i].opacity = currents[i];
    }
  });

  return (
    // Outer group: world-space tilt only — never mutated by useFrame
    <group
      rotation-z={-TILT_Z}
      scale={groupTransform.scale}
      position-y={groupTransform.positionY}
    >
      {/* Inner group: spin + drag rotation only — no tilt component */}
      <group ref={spinRef}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload('/models/bottle.glb');

