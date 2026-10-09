'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { backdropWall } from './Studio';

/*
 * A huge, pale word standing in the studio just behind its bottle: GIN,
 * LIQUEUR, RUM. It's real 3D text in the scene rather than page copy, so the
 * liquid in front of it bends and magnifies it, and the fruit rain falls both
 * in front of it and behind it.
 *
 * It fades in from exactly the backdrop's colour, so it seems to condense out
 * of the studio as its bottle arrives. (It's opaque on purpose: the liquid
 * only refracts opaque things.)
 */

// Moonshiners' display face (as on moonshiners.co.uk), SIL Open Font License.
export const WORD_FONT = '/fonts/DMSerifDisplay-Regular.ttf';
/**
 * How finely troika draws each letter (it renders them from small distance
 * maps). Its default, 64, loses a serif face's hairlines, breaking the
 * letters up; 128 keeps them whole.
 */
export const WORD_DETAIL = 128;

/**
 * Troika (drei's text renderer) makes every text material transparent, which
 * would leave the word out of the picture the liquid refracts. So: put it
 * back to opaque, every frame (troika can rebuild its material at any time).
 * Give the material `alphaToCoverage` too, so its edges stay smooth.
 *
 * Opaque, it would still write its letters' soft edges into the canvas's
 * alpha, and the page shows through the canvas wherever that's under 1: a pale
 * outline round every letter. So it writes colour only, and leaves the alpha
 * as the opaque canvas cleared it (see Experience).
 */
export function keepOpaque(mesh: THREE.Mesh) {
  const material = mesh.material as THREE.Material;
  material.transparent = false;
  material.blending = THREE.CustomBlending;
  material.blendSrc = THREE.OneFactor; // colour: replace
  material.blendDst = THREE.ZeroFactor;
  material.blendSrcAlpha = THREE.ZeroFactor; // alpha: keep what's there
  material.blendDstAlpha = THREE.OneFactor;
}
const DEPTH = -0.17; // m behind the bottle
const HEIGHT = 0.1; // m: level with the middle of the bottle
const MAX_SIZE = 0.16; // m: capital height, roughly
const MAX_WIDTH = 0.36; // m: long words shrink to fit, so they stay clear of the copy
const TINT = 0.28; // how far from the backdrop's colour towards the spirit's
/**
 * The short words are mostly hidden behind their bottle, so they're drawn
 * larger to stay readable around it. (LIQUEUR is already wider than the bottle.)
 * Wide screens only: on a phone they'd run off its sides.
 */
const ENLARGE: Record<string, number> = { GIN: 1.3, LIQUEUR: 1.1, RUM: 1.3 };
const WIDE = 1024; // px: the page's lg breakpoint, where the copy moves beside the bottle

interface BackdropWordProps {
  word: string;
  /** The spirit's colour, faintly tinting the word */
  color: string;
  /** 0 = gone (the backdrop's colour), 1 = fully there. Read every frame. */
  presenceRef: RefObject<number>;
}

export function BackdropWord({ word, color, presenceRef }: BackdropWordProps) {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const tint = useMemo(() => new THREE.Color(color), [color]);
  // A rough fit: DM Serif Display capitals are about 0.65 of their size wide.
  const wide = useThree((state) => state.size.width >= WIDE);
  const enlarge = wide ? (ENLARGE[word.toUpperCase()] ?? 1) : 1;
  const size = Math.min(MAX_SIZE, MAX_WIDTH / (word.length * 0.65)) * enlarge;

  useFrame(() => {
    const presence = presenceRef.current;
    materialRef.current?.color.copy(backdropWall).lerp(tint, TINT * presence);
    if (!meshRef.current) return;
    meshRef.current.visible = presence > 0.01;
    keepOpaque(meshRef.current);
  });

  return (
    <Text
      ref={meshRef}
      font={WORD_FONT}
      sdfGlyphSize={WORD_DETAIL}
      fontSize={size}
      letterSpacing={0.04}
      anchorX="center"
      anchorY="middle"
      position={[0, HEIGHT, DEPTH]}
    >
      {word.toUpperCase()}
      {/* Unlit and untoned, exactly like the backdrop, so at 0 it disappears into it. */}
      <meshBasicMaterial ref={materialRef} toneMapped={false} alphaToCoverage />
    </Text>
  );
}
