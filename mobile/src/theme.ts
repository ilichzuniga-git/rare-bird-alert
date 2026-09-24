// Design tokens for the map + bottom-sheet UI (renders/03-bottom-sheet.html).

export const colors = {
  bg: '#f3f5f2',
  card: '#ffffff',
  text: '#101a15',
  muted: '#6b766f',
  line: '#e6ebe7',
  grab: '#d4dad6',
  accent: '#1f7a55',
  accentSoft: '#e3f2ea',
  heroFrom: '#0f5c7a',
  // status dots / labels
  green: '#1f9d5c',
  amber: '#d98a07',
  red: '#d64545',
  gray: '#98a29c',
  dippedSoft: '#fdecec',
};

export type TierName = 'Exceptional' | 'Very Rare' | 'Rare' | 'Notable';

export interface Tier {
  name: TierName;
  color: string; // badge text, pin fill
  soft: string;  // badge background, avatar background
  rank: number;  // higher = rarer
}

export const TIERS: Record<TierName, Tier> = {
  Exceptional: { name: 'Exceptional', color: '#e0364f', soft: '#fde8eb', rank: 3 },
  'Very Rare': { name: 'Very Rare',   color: '#e8701a', soft: '#fdeede', rank: 2 },
  Rare:        { name: 'Rare',        color: '#c99a06', soft: '#fbf3d6', rank: 1 },
  Notable:     { name: 'Notable',     color: '#5f6b64', soft: '#eef1ee', rank: 0 },
};

/**
 * Rarity tier from the species' all-time research-grade iNaturalist observations in
 * the county (the backend supplies this for eBird sightings too). 50+ records, or no
 * data, stays "Notable": eBird may still flag it, e.g. for being out of season.
 */
export function tierFor(rarityCount: number | null): Tier {
  if (rarityCount === null || rarityCount >= 50) return TIERS.Notable;
  if (rarityCount <= 3) return TIERS.Exceptional;
  if (rarityCount <= 9) return TIERS['Very Rare'];
  return TIERS.Rare;
}

export const STATUS_DOT: Record<string, string> = {
  green: colors.green,
  amber: colors.amber,
  red: colors.red,
  gray: colors.gray,
};

export const radius = { sheet: 28, card: 18, hero: 22, control: 12, badge: 7 };
