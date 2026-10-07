/**
 * Moonshiners × Brocksbushes collaboration range.
 *
 * The labels aren't baked into bottle.glb: each one is a PNG in /public/labels
 * that the bottle wraps onto its label mesh at runtime.
 */

export type Season = 'summer' | 'autumn';

/**
 * How the liquid looks, in physical terms rather than "opacity":
 * light passing through a drink is absorbed a little more with every
 * centimetre it travels (Beer–Lambert law), so the same gin is pale at the
 * thin edges of the bottle and richer through the middle.
 */
export interface LiquidLook {
  /** The colour light becomes after travelling `depth` metres through the liquid */
  color: string;
  /**
   * Metres of liquid before light takes on `color`: big = pale/clear, small = dense.
   * 0.065 is about the bottle's depth, so at that `color` is what you see looking
   * straight through the bottle, which is what the reference photos show.
   */
  depth: number;
  /** 0 = crystal clear, 1 = cloudy (fruit liqueurs scatter light) */
  haze: number;
}

export interface CollabSpirit {
  name: string;
  /** A short line under the name */
  subtitle: string;
  /** 2–3 sentences about it */
  description: string;
  /** Its accent colour, for its copy */
  color: string;
  /** Label texture: 2274×1008, same UV layout as the labels in bottle.glb */
  labelUrl: string;
  /** Alcohol by volume, as a percentage */
  abv: number;
  /** Tasting notes, one per chip */
  notes: string[];
  liquid: LiquidLook;
  /** Which Brocksbushes harvest the fruit comes from */
  season: Season;
}

// Ordered summer → autumn, so the page can scroll through the farm's year.
export const COLLAB_SPIRITS: CollabSpirit[] = [
  {
    name: 'Strawberry Gin',
    subtitle: 'Picked at Brocksbushes. Distilled on Blandford St.',
    description:
      'Over 25 Brocksbushes strawberries squashed into every bottle, alongside a botanical bill of juniper, coriander, peppercorns and citrus. No artificial flavours, no added sugar.',
    abv: 40,
    notes: ['Fresh Strawberry', 'Juniper', 'Peppercorn', 'Citrus'],
    labelUrl: '/labels/brocksbushes-strawberry-gin.png',
    color: '#D7263D',
    // Clear, deep crimson: from a photo backlit by a white screen, so it's the real tint
    liquid: { color: '#ce1644', depth: 0.065, haze: 0 },
    season: 'summer',
  },
  {
    name: 'Strawberry Liqueur',
    subtitle: 'Jammy, Juicy, Made for Fizz',
    description:
      'Over 30 strawberries in every bottle: fresh-pressed juice blended with jammy boiled fruit. Pour it into a glass of fizz, or over ice with a strawberry on the side.',
    abv: 20,
    notes: ['Pressed Strawberry', 'Strawberry Jam', 'Sweet Finish'],
    labelUrl: '/labels/brocksbushes-strawberry-liqueur.png',
    color: '#C2185B',
    // Deep blood red, darker than the gin and a little cloudy from the juice
    liquid: { color: '#790a24', depth: 0.065, haze: 0.14 },
    season: 'summer',
  },
  {
    name: 'Pumpkin Spiced Rum',
    subtitle: 'The Pumpkin Patch, Spiced',
    description:
      'Distilled in small batches with Brocksbushes pumpkin and a warming blend of cinnamon, ginger, nutmeg, clove, vanilla and allspice. Gently sweetened. Over ice, with ginger ale, or in your favourite autumn cocktail.',
    abv: 40, // TODO: confirm with Moonshiners. Print label front says 20%, back says 40%
    notes: ['Pumpkin', 'Cinnamon', 'Ginger', 'Clove', 'Vanilla'],
    labelUrl: '/labels/brocksbushes-pumpkin-spiced-rum.png',
    color: '#E8742A',
    // Clear honey gold, from the bottling-day photos
    liquid: { color: '#d49535', depth: 0.065, haze: 0.05 },
    season: 'autumn',
  },
];
