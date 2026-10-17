// Design tokens for the map + bottom-sheet UI (renders/03-bottom-sheet.html).
// Two palettes with the same keys: the app follows the phone's light or dark setting.

import { StyleSheet, useColorScheme } from 'react-native';

export type TierName = 'Exceptional' | 'Very Rare' | 'Rare' | 'Notable';
export type Scheme = 'light' | 'dark';

export const LIGHT = {
  scheme: 'light' as Scheme,
  bg: '#f3f5f2',
  card: '#ffffff',
  text: '#101a15',
  textSoft: '#374151', // body copy in cards
  muted: '#6b766f',
  line: '#e6ebe7',
  grab: '#d4dad6',
  accent: '#1f7a55',
  accentSoft: '#e3f2ea',
  heroFrom: '#0f5c7a', // the teal hero cards (white text on it in both themes)
  teal: '#0f5c7a',     // teal as text on a card
  tealSoft: '#e3eff4',
  link: '#1d4ed8',
  linkSoft: '#e8effd',
  noteSoft: '#f0f7f2', // quoted notes, credits
  warn: '#b45309',
  warnSoft: '#fdf3e1',
  warnText: '#8a5a00',
  exact: '#c2410c',    // the observer's exact spot
  brand: '#1a7392',    // the app icon's tile
  scrim: 'rgba(16,26,21,0.45)',
  ring: '#ffffff',     // white rings around dots and badges on a card
  inverse: '#101a15',  // dark buttons, badges and toasts with white content
  // status dots / labels
  green: '#1f9d5c',
  amber: '#d98a07',
  red: '#d64545',
  gray: '#98a29c',
  dippedSoft: '#fdecec',
  /** Rarity badge and avatar backgrounds; the pins keep the tier's own colour */
  tierSoft: { Exceptional: '#fde8eb', 'Very Rare': '#fdeede', Rare: '#fbf3d6', Notable: '#eef1ee' } as Record<TierName, string>,
  /** Rarity badge text */
  tierInk: { Exceptional: '#e0364f', 'Very Rare': '#e8701a', Rare: '#c99a06', Notable: '#5f6b64' } as Record<TierName, string>,
  /** "Dipped ×N" text by dipLevel(), deeper with more dips */
  dipText: { 1: '#d64545', 2: '#b42323', 3: '#7f1d1d' } as Record<1 | 2 | 3, string>,
};

export type Colors = typeof LIGHT;

export const DARK: Colors = {
  scheme: 'dark',
  bg: '#0e1311',
  card: '#1a211d',
  text: '#e8eee9',
  textSoft: '#c9d2cc',
  muted: '#93a099',
  line: '#2a332e',
  grab: '#3a443e',
  accent: '#2f9e6c',
  accentSoft: '#183428',
  heroFrom: '#0f5c7a',
  teal: '#6cc3e0',
  tealSoft: '#14303b',
  link: '#7aa7ff',
  linkSoft: '#1d2a44',
  noteSoft: '#18261e',
  warn: '#f0a531',
  warnSoft: '#3a2c12',
  warnText: '#f5c26b',
  exact: '#fb8a4c',
  brand: '#1a7392',
  scrim: 'rgba(0,0,0,0.6)',
  ring: '#1a211d',
  inverse: '#34403a',
  green: '#34c27a',
  amber: '#f0a531',
  red: '#ef6b6b',
  gray: '#8a948e',
  dippedSoft: '#3a1f1f',
  tierSoft: { Exceptional: '#3d1a20', 'Very Rare': '#3d2614', Rare: '#38300f', Notable: '#262d29' },
  tierInk: { Exceptional: '#ff7a8c', 'Very Rare': '#ff9a4f', Rare: '#e8c34a', Notable: '#a9b4ad' },
  // On a dark card the deeper shades get brighter and more saturated, not darker
  dipText: { 1: '#f29a9a', 2: '#f06a6a', 3: '#ff4040' },
};

/** The phone's light or dark setting. */
export function useScheme(): Scheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function useColors(): Colors {
  return useScheme() === 'dark' ? DARK : LIGHT;
}

/**
 * Themed StyleSheet: `const useStyles = makeStyles(c => ({ … }))` at module level, then
 * `const styles = useStyles()` in the component. Each theme's sheet is built once.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(build: (c: Colors) => T): () => T {
  const sheets: Partial<Record<Scheme, T>> = {};
  return function useStyles() {
    const scheme = useScheme();
    return (sheets[scheme] ??= StyleSheet.create(build(scheme === 'dark' ? DARK : LIGHT)));
  };
}

export interface Tier {
  name: TierName;
  color: string; // pin fill (both themes); badge text and backgrounds come from Colors.tierInk / tierSoft
  rank: number;  // higher = rarer
}

export const TIERS: Record<TierName, Tier> = {
  Exceptional: { name: 'Exceptional', color: '#e0364f', rank: 3 },
  'Very Rare': { name: 'Very Rare',   color: '#e8701a', rank: 2 },
  Rare:        { name: 'Rare',        color: '#c99a06', rank: 1 },
  Notable:     { name: 'Notable',     color: '#5f6b64', rank: 0 },
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

/** Status dot / label colour for a cluster status level. */
export function statusColor(c: Colors, level: string): string {
  return level === 'green' ? c.green : level === 'amber' ? c.amber : level === 'red' ? c.red : c.gray;
}

/** Map pin outline for piled-up dips, by dipLevel(): deeper red with more dips. */
export const DIP_PIN: Record<1 | 2 | 3, string> = { 1: '#f19a9a', 2: '#d64545', 3: '#8f1d1d' };

export const radius = { sheet: 28, card: 18, hero: 22, control: 12, badge: 7 };
