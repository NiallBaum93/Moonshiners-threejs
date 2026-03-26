/**
 * Spirit data — one entry per label variant in bottle.glb.
 *
 * The order here must match the order in which Blender / the GLTF exporter
 * exports the label meshes (typically alphabetical by mesh name).
 * Adjust names and copy to match your actual product lineup.
 */

export interface Spirit {
  /** Main product name shown as the animated headline */
  name: string;
  /** Short punchy descriptor shown below the name */
  subtitle: string;
  /** 2–3 sentence product description */
  description: string;
  /** Proof / ABV string */
  proof: string;
  /** Comma-separated tasting notes */
  notes: string;
  /** Index of this spirit's label mesh in the GLB scene.traverse order */
  meshIndex: number;
}

// Label mesh traversal order from the GLB (scene.traverse visit order):
// 0 → Label_|_VAMP
// 1 → Label_|_UNREST  (omitted — texture not packed in GLB)
// 2 → Label_|_Vagant
// 3 → Label_|_Paradox
// 4 → Label_|_NoctiVagant
//
// meshIndex maps each Spirit to its exact position in that traversal order.
export const SPIRITS: Spirit[] = [
  {
    name: 'VAMP',
    subtitle: 'Seductive. Dangerous. Crimson.',
    description:
      'Deep garnet and dangerously smooth. VAMP is a dark-fruit spirit aged with blood orange peel and black cherry — alluring at first pour, with a heat that stays long after.',
    proof: '80 Proof',
    notes: 'Blood Orange · Black Cherry · Dark Spice',
    meshIndex: 0,
  },
  {
    name: 'Vagant',
    subtitle: 'No Fixed Horizon',
    description:
      'A wanderer by nature. Vagant draws from distillation traditions across borders — a free-roaming blend with an ever-shifting finish that takes you somewhere new every time.',
    proof: '84 Proof',
    notes: 'Alpine Herb · Stone Fruit · Open Road',
    meshIndex: 2,
  },
  {
    name: 'Paradox',
    subtitle: 'Contradictions, Perfected',
    description:
      'Smooth yet fierce. Delicate yet unyielding. Paradox blends opposing forces into something that defies expectation — a spirit that reveals a new character with every sip.',
    proof: '88 Proof',
    notes: 'Bright Citrus · Deep Leather · Velvet Finish',
    meshIndex: 3,
  },
  {
    name: 'NoctiVagant',
    subtitle: 'Wander Through the Dark',
    description:
      'Crafted for those who belong to the night. A complex, slow-aged spirit with layers that only reveal themselves as the hours dissolve — mysterious, lingering, and impossible to forget.',
    proof: '92 Proof',
    notes: 'Dark Spice · Smoked Vanilla · Midnight Oak',
    meshIndex: 4,
  },
];
