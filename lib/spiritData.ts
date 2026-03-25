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
}

export const SPIRITS: Spirit[] = [
  {
    name: 'Original Moonshine',
    subtitle: 'Pure & Unadulterated',
    description:
      'Distilled from our 150-year-old grain mash recipe and bottled straight off the copper still. Crystal-clear, bold, and unapologetically honest.',
    proof: '100 Proof',
    notes: 'Grain-forward · Crisp · Clean',
  },
  {
    name: 'Smoked Whiskey',
    subtitle: 'Bold. Smoky. Unforgettable.',
    description:
      'Aged in charred American oak then finished over slow-burning applewood smoke. Deep caramel depth with a long, warming finish that lingers.',
    proof: '86 Proof',
    notes: 'Smoky · Caramel · Oak',
  },
  {
    name: 'Wildflower Honey',
    subtitle: 'Naturally Sweet, Wildly Good',
    description:
      'Blended with raw wildflower honey from our local apiary. Silky-smooth with floral sweetness and a gentle warmth that makes it perfect neat or on the rocks.',
    proof: '70 Proof',
    notes: 'Floral · Honey · Warm',
  },
  {
    name: 'Blackberry Shine',
    subtitle: 'Fruit of the Appalachian Hills',
    description:
      "Wild-picked Appalachian blackberries steep in our white moonshine for 60 days. Luscious dark fruit with just enough bite to know it's the real thing.",
    proof: '80 Proof',
    notes: 'Blackberry · Tart · Smooth',
  },
];
