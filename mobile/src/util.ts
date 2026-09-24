import {
  Linking,
  Platform,
} from 'react-native';
import type { MapPin } from './LeafletMap';
import type { Sighting } from './types';

// Set EXPO_PUBLIC_API_BASE (e.g. in mobile/.env.local) to point at a local backend;
// defaults to production. Read at bundle time, so restart Metro after changing it.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://rba-backend.cloudedapps.org';

/** Haversine distance in metres between two lat/lng points. */
export function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

/** Opens the All About Birds species page for a given common name. */
export function openAllAboutBirds(commonName: string) {
  const slug = commonName.trim().replace(/ /g, '_');
  Linking.openURL(`https://www.allaboutbirds.org/guide/${encodeURIComponent(slug)}`);
}

export function formatSource(source: string | null): string {
  if (!source) return 'Unknown';
  if (source.toLowerCase() === 'ebird') return 'eBird';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate().toString();
}

/** "Sep 17 · 11:15 AM"; date only when the report has no time (midnight). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return formatDate(iso);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (h === 0 && m === 0) return formatDate(iso);
  const time = `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  return `${formatDate(iso)} · ${time}`;
}

/** Open the phone's maps app at an exact point (Android geo: intent, Apple Maps on iOS). */
export function openInMaps(lat: number, lng: number, label: string) {
  const q = `${lat},${lng}`;
  Linking.openURL(
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?ll=${q}&q=${encodeURIComponent(label)}`
      : `geo:${q}?q=${q}(${encodeURIComponent(label)})`
  );
}

// ---- Coordinates typed into observer notes ----
// Hotspot reports all share the hotspot's pin, so birders often paste the bird's
// actual spot into their notes. Find it so the app can show and navigate to it.
export const DECIMAL_COORDS = /(-?\d{1,2}\.\d{3,})\s*°?\s*([NS])?[\s,;/]+(-?\d{1,3}\.\d{3,})\s*°?\s*([EW])?/gi;

export const DMS_COORDS = /(\d{1,2})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*(?:["″]|'')?\s*([NS])[\s,;/]+(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*(?:["″]|'')?\s*([EW])/gi;

export const MAX_NOTE_COORD_DISTANCE_M = 25_000;

/**
 * First coordinate pair in `texts` that lies within 25km of the report (which
 * rules out unrelated numbers and fixes a dropped minus sign on longitude).
 */
export function findNoteCoordinates(
  texts: (string | null | undefined)[],
  near: { lat: number; lng: number },
): { lat: number; lng: number } | null {
  const candidates: { lat: number; lng: number }[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const m of text.matchAll(DMS_COORDS)) {
      const lat = (+m[1] + +m[2] / 60 + +m[3] / 3600) * (m[4].toUpperCase() === 'S' ? -1 : 1);
      const lng = (+m[5] + +m[6] / 60 + +m[7] / 3600) * (m[8].toUpperCase() === 'W' ? -1 : 1);
      candidates.push({ lat, lng });
    }
    for (const m of text.matchAll(DECIMAL_COORDS)) {
      let lat = parseFloat(m[1]);
      let lng = parseFloat(m[3]);
      if (m[2]?.toUpperCase() === 'S') lat = -Math.abs(lat);
      if (m[4]?.toUpperCase() === 'W') lng = -Math.abs(lng);
      candidates.push({ lat, lng });
      if (!m[4]) candidates.push({ lat, lng: -lng }); // "118.28397" meant as west
    }
  }
  return candidates.find(c =>
    Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180 &&
    distanceMetres(c.lat, c.lng, near.lat, near.lng) <= MAX_NOTE_COORD_DISTANCE_M
  ) ?? null;
}

export function toPin(s: Sighting): MapPin | null {
  if (s.lat == null || s.lng == null) return null;
  return { lat: s.lat, lng: s.lng, label: s.common_name, sciName: s.scientific_name };
}
