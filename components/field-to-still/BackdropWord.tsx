'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
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

export const WORD_FONT = '/fonts/Fraunces144pt-Light.ttf'; // Fraunces, SIL Open Font License

/**
 * Troika (drei's text renderer) makes every text material transparent, which
 * would leave the word out of the picture the liquid refracts. So: put it
 * back to opaque, every frame (troika can rebuild its material at any time).
 * Give the material `alphaToCoverage` too, so its edges stay smooth.
 */
export function keepOpaque(mesh: THREE.Mesh) {
  (mesh.material as THREE.Material).transparent = false;
}
const DEPTH = -0.17; // m behind the bottle
const HEIGHT = 0.1; // m: level with the middle of the bottle
const MAX_SIZE = 0.16; // m: capital height, roughly
const MAX_WIDTH = 0.36; // m: long words shrink to fit, so they stay clear of the copy
const TINT = 0.28; // how far from the backdrop's colour towards the spirit's

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
  // A rough fit: Fraunces capitals are about 0.65 of their size wide.
  const size = Math.min(MAX_SIZE, MAX_WIDTH / (word.length * 0.65));

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
