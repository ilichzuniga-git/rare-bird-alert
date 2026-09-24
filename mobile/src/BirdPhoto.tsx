import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { openAllAboutBirds } from './util';

export const INAT_BASE = 'https://api.inaturalist.org/v1';

// Per-session cache: scientific_name → { url, attribution } (or empty if not found)
export type PhotoInfo = { url: string; attribution: string };

const photoCache = new Map<string, PhotoInfo>();
// Lookups already in flight, so a screenful of rows for the same species share one request
const inflight = new Map<string, Promise<PhotoInfo>>();

// Creative Commons photo licenses we may display. The app is free and
// non-commercial, so NC variants are fine (the photographer is credited on
// every photo). All-rights-reserved photos are never shown. See docs/SOURCES.MD.
export const USABLE_LICENSES = new Set([
  'cc0', 'cc-by', 'cc-by-sa', 'cc-by-nd',
  'cc-by-nc', 'cc-by-nc-sa', 'cc-by-nc-nd',
]);

const EMPTY: PhotoInfo = { url: '', attribution: '' };

export function fetchPhotoForSpecies(scientificName: string): Promise<PhotoInfo> {
  const cached = photoCache.get(scientificName);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(scientificName);
  if (pending) return pending;

  const request = (async () => {
    try {
      const res = await fetch(
        `${INAT_BASE}/taxa?q=${encodeURIComponent(scientificName)}&rank=species&per_page=1`
      );
      const data = await res.json();
      const photo = data?.results?.[0]?.default_photo;
      const license = (photo?.license_code || '').toLowerCase();
      const info = photo?.square_url && USABLE_LICENSES.has(license)
        ? { url: photo.square_url, attribution: photo.attribution ?? '' }
        : EMPTY;
      photoCache.set(scientificName, info);
      return info;
    } catch {
      return EMPTY; // not cached, so a later render can retry
    } finally {
      inflight.delete(scientificName);
    }
  })();
  inflight.set(scientificName, request);
  return request;
}

/**
 * A sighting's photo: the one stored with it (iNaturalist sightings), or else the
 * species' default photo looked up lazily (eBird sightings). Empty url = no usable photo.
 */
export function usePhoto(photoUrl: string | null, attribution: string | null, scientificName: string | null): PhotoInfo {
  const [info, setInfo] = useState<PhotoInfo>(
    photoUrl ? { url: photoUrl, attribution: attribution ?? '' }
      : (scientificName && photoCache.get(scientificName)) || EMPTY
  );
  useEffect(() => {
    if (photoUrl) {
      setInfo({ url: photoUrl, attribution: attribution ?? '' });
      return;
    }
    if (!scientificName) return;
    let live = true;
    fetchPhotoForSpecies(scientificName).then(i => { if (live) setInfo(i); });
    return () => { live = false; };
  }, [photoUrl, attribution, scientificName]);
  return info;
}

/**
 * Split iNaturalist's attribution into photographer and license, e.g.
 * "(c) Jane Smith, some rights reserved (CC BY-NC), uploaded by Jane Smith"
 *   → { credit: "© Jane Smith", license: "CC BY-NC" }.
 * The license must stay visible wherever the photo is credited (CC terms).
 */
export function parseCredit(attribution: string): { credit: string; license: string | null } {
  const credit = attribution
    .replace(/\(c\)/i, '©')
    .replace(/,?\s*(some|no|all) rights reserved.*$/i, '')
    .replace(/,?\s*uploaded by.*$/i, '')
    .trim();
  const license = attribution.match(/\((CC[^)]*)\)/i)?.[1]?.toUpperCase() ?? null;
  return { credit, license };
}

/** 64px photo tile with an overlaid credit; tapping it opens All About Birds. */
export default function BirdPhoto({
  photoUrl,
  photoAttribution,
  scientificName,
  commonName,
}: {
  photoUrl: string | null;
  photoAttribution: string | null;
  scientificName: string | null;
  commonName: string;
}) {
  const { url, attribution } = usePhoto(photoUrl, photoAttribution, scientificName);

  if (!url) {
    // Placeholder: tappable link to All About Birds
    return (
      <TouchableOpacity
        style={styles.photoPlaceholder}
        onPress={() => openAllAboutBirds(commonName)}
        activeOpacity={0.7}
      >
        <Text style={styles.photoPlaceholderIcon}>🐦</Text>
        <Text style={styles.photoPlaceholderLink}>Info</Text>
      </TouchableOpacity>
    );
  }

  // The license gets its own line so a long name can't truncate it away
  const { credit, license } = parseCredit(attribution);

  return (
    <TouchableOpacity
      style={styles.photoWrapper}
      onPress={() => openAllAboutBirds(commonName)}
      activeOpacity={0.85}
    >
      <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" />
      {credit || license ? (
        <View style={[styles.photoCredit, license ? styles.photoCreditTwoLine : null]}>
          {credit ? <Text style={styles.photoCreditText} numberOfLines={1}>{credit}</Text> : null}
          {license ? (
            <Text style={styles.photoCreditText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {license}
            </Text>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  photoWrapper: { width: 64, flexShrink: 0 },
  photo: { width: 64, height: 64, borderRadius: 8 },
  photoCredit: {
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: -14,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  photoCreditTwoLine: { marginTop: -24 },
  photoCreditText: { fontSize: 8, color: '#fff', lineHeight: 10 },
  photoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#ecf4ed',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderIcon: { fontSize: 26 },
  photoPlaceholderLink: { fontSize: 9, color: '#4a7c59', fontWeight: '600', marginTop: 2 },
});
