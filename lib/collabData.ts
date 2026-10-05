import type { Spirit } from './spiritData';

/**
 * Moonshiners × Brocksbushes collaboration range.
 *
 * Unlike the core range, these labels aren't baked into bottle.glb. Each one
 * is a PNG in /public/labels that the bottle wraps onto its label mesh at runtime.
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
  /** Metres of liquid before light takes on `color`: big = pale/clear, small = dense */
  depth: number;
  /** 0 = crystal clear, 1 = cloudy (fruit liqueurs scatter light) */
  haze: number;
}

export interface CollabSpirit extends Omit<Spirit, 'meshIndex' | 'proof' | 'notes'> {
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
    liquid: { color: '#e14659', depth: 0.3, haze: 0 }, // clear, with a strawberry tint
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
    liquid: { color: '#b3142f', depth: 0.045, haze: 0.22 }, // deep ruby, a little cloudy from the juice
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
    liquid: { color: '#c06a1e', depth: 0.08, haze: 0.05 }, // clear amber
    season: 'autumn',
  },
];
