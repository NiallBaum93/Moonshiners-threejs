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

import { useRef, useLayoutEffect, useCallback, MutableRefObject } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { liquidVertexShader, liquidFragmentShader } from '@/lib/liquidShader';

// ── Tweak these to match your GLB mesh names ─────────────────────────────────
const LIQUID_KEYWORDS = [
  'liquid', 'fluid', 'fill', 'content', 'spirit',
  'moonshine', 'whiskey', 'whisky', 'water', 'drink',
];

// Per-liquid overrides keyed to a substring of the node name (lowercase)
const LIQUID_VARIANTS: Record<string, { color: THREE.Color; opacity: number }> = {
  amber: { color: new THREE.Color(0.82, 0.42, 0.08), opacity: 0.88 },
  clear: { color: new THREE.Color(0.78, 0.92, 1.00), opacity: 0.38 },
};

// Fallback when name doesn't match a variant
const LIQUID_DEFAULT = { color: new THREE.Color(0.82, 0.42, 0.08), opacity: 0.88 };

// Earth-like axial tilt (~22°) — bottle leans sideways on its tilted axis
const TILT_Z = 0.38;

// ─────────────────────────────────────────────────────────────────────────────

interface BottleModelProps {
  /** Ref written by BottleCanvas with the current drag velocity (units/frame) */
  dragVelocity: MutableRefObject<{ x: number; y: number }>;
  isDragging: MutableRefObject<boolean>;
}

export function BottleModel({ dragVelocity, isDragging }: BottleModelProps) {
  const { scene } = useGLTF('/models/bottle.glb');

  // groupRef is populated via a callback ref so we can hide it before the
  // very first R3F frame — React won't override `visible` because we don't
  // pass it as a JSX prop.
  const groupRef = useRef<THREE.Group | null>(null);
  const setGroupRef = useCallback((node: THREE.Group | null) => {
    if (node) node.visible = false; // hide before first R3F paint
    groupRef.current = node;
  }, []);

  const rotY        = useRef(0);
  const rotX        = useRef(0);
  const elapsedTime = useRef(0);
  const liquidMats  = useRef<THREE.ShaderMaterial[]>([]);

  // ── All one-time scene setup in a single layout effect ───────────────────
  // useLayoutEffect runs synchronously before the browser paints, so the full
  // React StrictMode mount→cleanup→remount cycle completes before R3F ever
  // fires a requestAnimationFrame — eliminating the one-frame flicker.
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // 1. Hide any remaining backdrop studio props
    const BACKDROP_NAMES = ['wall', 'plane'];
    scene.traverse((child) => {
      const n = child.name.toLowerCase().trim();
      if (BACKDROP_NAMES.some((p) => n === p || n.startsWith(p + ' ') || n.startsWith(p + '+'))) {
        child.visible = false;
      }
    });

    // 2. Normalise scale/position from visible mesh bounding box
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.visible) box.expandByObject(child);
    });
    if (!box.isEmpty()) {
      const size   = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale  = 1.1 / size.y;           // 1.1 units — fits tilted bottle with margin
      group.scale.setScalar(scale);
      group.position.y = -center.y * scale + 0.1; // slight lift
      group.rotation.z = TILT_Z;             // sideways axial tilt — set once, never overwritten
    }

    // 3. Apply materials
    //    - liquid meshes       → custom slosh shader
    //    - "Label |..." decals → only first variant visible; transparent clone so
    //                           renderOrder=4 places them AFTER glass in the
    //                           transparent render queue (opaque renders before
    //                           transparent regardless of renderOrder).
    //    - "cork"              → same transparent clone treatment
    //    - everything else     → transparent glass (bottle body)
    const liquidMatsArr: THREE.ShaderMaterial[]    = [];
    const glassMatsArr:  THREE.Material[]          = [];
    const origMats = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const allMeshNames: string[] = [];
    let firstLabelShown = false;

    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      allMeshNames.push(child.name || '(unnamed)');

      const nameLower     = (child.name || '').toLowerCase();
      const isLiquid      = LIQUID_KEYWORDS.some((kw) => nameLower.includes(kw));
      const isLabelPrint  = nameLower.includes('label |');
      const isCork        = nameLower === 'cork';

      if (isLiquid) {
        // ── Liquid shader ──────────────────────────────────────────────────────
        let variant = LIQUID_DEFAULT;
        for (const [key, val] of Object.entries(LIQUID_VARIANTS)) {
          if (nameLower.includes(key)) { variant = val; break; }
        }
        const mat = new THREE.ShaderMaterial({
          vertexShader: liquidVertexShader,
          fragmentShader: liquidFragmentShader,
          uniforms: {
            uTime:          { value: 0 },
            uYawVelocity:   { value: 0 },
            uPitchVelocity: { value: 0 },
            uRotX:          { value: 0 },
            uColor:         { value: variant.color },
            uOpacity:       { value: variant.opacity },
          },
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        origMats.set(child, child.material);
        child.material    = mat;
        child.renderOrder = 1;
        liquidMatsArr.push(mat);

      } else if (isLabelPrint) {
        // ── Label decal: only show the first variant, hide the rest ──────────
        if (!firstLabelShown) {
          firstLabelShown = true;
          // Clone so we can modify the material without touching the shared GLB asset.
          // Set side=DoubleSide because Blender label cylinders often have inward-
          // facing normals — without this the label is only visible from inside.
          const orig = child.material as THREE.MeshStandardMaterial;
          const clone = orig.clone() as THREE.MeshStandardMaterial;
          clone.side        = THREE.DoubleSide;
          clone.transparent = true;   // move into transparent queue
          clone.depthWrite  = false;
          clone.opacity     = 1.0;
          clone.needsUpdate = true;
          origMats.set(child, child.material);
          child.material    = clone;
          child.renderOrder = 4;
          glassMatsArr.push(clone);
        } else {
          child.visible = false;
        }

      } else if (isCork) {
        // ── Cork: DoubleSide + transparent so it draws after glass ───────────
        const orig = child.material as THREE.MeshStandardMaterial;
        const clone = orig.clone() as THREE.MeshStandardMaterial;
        clone.side        = THREE.DoubleSide;
        clone.transparent = true;
        clone.depthWrite  = false;
        clone.opacity     = 1.0;
        clone.needsUpdate = true;
        origMats.set(child, child.material);
        child.material    = clone;
        child.renderOrder = 4;
        glassMatsArr.push(clone);

      } else if (child.name.length > 0) {
        // ── Bottle body → very subtle transparent glass ──────────────────────
        const glassMat = new THREE.MeshPhysicalMaterial({
          color:           new THREE.Color(0.94, 0.98, 1.0),
          roughness:       0.15,
          metalness:       0.0,
          transparent:     true,
          opacity:         0.10,           // barely-there tint
          side:            THREE.FrontSide,
          envMapIntensity: 0.0,            // no reflections — labels must show clearly
          depthWrite:      false,
        });
        origMats.set(child, child.material);
        child.material    = glassMat;
        child.renderOrder = 2;
        glassMatsArr.push(glassMat);
      }
    });

    console.log('[BottleModel] meshes:', allMeshNames);
    if (liquidMatsArr.length === 0) {
      console.warn('[BottleModel] No liquid mesh found. Found: ' + allMeshNames.join(', '));
    }

    liquidMats.current = liquidMatsArr;

    // 4. Reveal only after everything is configured — no flicker
    group.visible = true;

    return () => {
      group.visible = false;
      origMats.forEach((orig, mesh) => { mesh.material = orig; });
      // Restore visibility for any label variants we hid
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) child.visible = true;
      });
      liquidMats.current = [];
      liquidMatsArr.forEach((m) => m.dispose());
      glassMatsArr.forEach((m) => m.dispose());
    };
  }, [scene]);

  // ── Per-frame: rotation physics + shader uniform updates ──────────────────
  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05); // guard against tab-blur spike
    elapsedTime.current += dt;

    rotY.current += dragVelocity.current.x * 60 * dt;
    rotX.current += dragVelocity.current.y * 60 * dt;

    // Auto-spin on Y — rotation.z tilt is permanent and untouched
    if (!isDragging.current) rotY.current += 0.004;

    dragVelocity.current.x *= 0.91;
    dragVelocity.current.y *= 0.91;

    groupRef.current.rotation.y = rotY.current;
    // Z tilt is fixed (set in layout effect); only update Y rotation for spin.
    // User vertical drag still adjusts X slightly for perspective feel.
    groupRef.current.rotation.x = THREE.MathUtils.clamp(rotX.current, -0.3, 0.3);

    const t   = elapsedTime.current;

    // As the tilted bottle spins, the tilt projects differently onto the
    // camera-facing axis each rotation — this makes the liquid surface appear
    // to react to gravity realistically, like a spinning axially-tilted globe.
    const tiltProjection = Math.sin(rotY.current) * TILT_Z;

    // During auto-spin, feed a small steady yaw velocity so centrifugal
    // ripples are always visible in the liquid, not just on drag.
    const autoSpinYaw = isDragging.current ? 0 : 0.04;
    const yaw = THREE.MathUtils.clamp(dragVelocity.current.x * 10 + autoSpinYaw, -1.5, 1.5);
    const pit = THREE.MathUtils.clamp(dragVelocity.current.y * 10, -1.5, 1.5);

    for (const mat of liquidMats.current) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uYawVelocity.value = THREE.MathUtils.lerp(
        mat.uniforms.uYawVelocity.value, yaw, 0.1,
      );
      mat.uniforms.uPitchVelocity.value = THREE.MathUtils.lerp(
        mat.uniforms.uPitchVelocity.value, pit, 0.12,
      );
      // uRotX drives the static tilt of the liquid surface.
      // tiltProjection oscillates as the bottle spins, creating the slosh.
      mat.uniforms.uRotX.value = THREE.MathUtils.lerp(
        mat.uniforms.uRotX.value, tiltProjection, 0.08,
      );
    }
  });

  return (
    <group ref={setGroupRef} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload('/models/bottle.glb');

