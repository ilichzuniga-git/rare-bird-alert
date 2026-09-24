import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerForPushNotificationsAsync } from './src/notifications';
import LeafletMap, { type MapFocus, type MapPin } from './src/LeafletMap';
import AboutModal from './src/AboutModal';
import { DetailBody, DetailHeader, useSightingDetail } from './src/SightingDetail';
import BottomSheet, { type BottomSheetHandle } from './src/BottomSheet';
import { SheetHeader, SheetList } from './src/RaritiesSheet';
import { byRarity, distanceTo, groupBirds, inPeriod, matchesQuery, type Bird, type Period } from './src/birds';
import { colors } from './src/theme';
import { API_BASE, formatDate } from './src/util';
import type { ClusterData, Sighting } from './src/types';

const SEARCH_BAR_H = 48;

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // ---- data ----
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [clusters, setClusters] = useState<Map<number, ClusterData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const fetchSightings = useCallback(async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/api/sightings?limit=500`),
        fetch(`${API_BASE}/api/clusters`),
      ]);
      if (!sRes.ok) throw new Error(`Server returned ${sRes.status}`);
      const sData = await sRes.json();
      setSightings(sData.sightings);
      if (cRes.ok) {
        const cData = await cRes.json();
        const map = new Map<number, ClusterData>();
        for (const c of (cData.clusters ?? [])) map.set(c.id, c);
        setClusters(map);
      }
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e: any) {
      setError(e.message ?? 'Failed to load sightings');
    }
  }, []);

  useEffect(() => {
    fetchSightings().finally(() => setLoading(false));
    registerForPushNotificationsAsync();
    const tick = setInterval(() => setNow(Date.now()), 60_000); // keeps "updated N min ago" fresh
    return () => clearInterval(tick);
  }, [fetchSightings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSightings();
    setRefreshing(false);
  }, [fetchSightings]);

  // ---- filters ----
  const [period, setPeriod] = useState<Period>('week');
  const [source, setSource] = useState<string | null>(null);
  const [queryText, setQueryText] = useState('');
  const [query, setQuery] = useState(''); // debounced, so the map isn't redrawn on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryText.trim()), 250);
    return () => clearTimeout(t);
  }, [queryText]);

  // "Near me" needs the user's position
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [nearState, setNearState] = useState<'idle' | 'locating' | 'denied' | 'ready'>('idle');
  const choosePeriod = useCallback(async (p: Period) => {
    setPeriod(p);
    if (p !== 'near' || userLoc) return;
    setNearState('locating');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setNearState('denied'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setNearState('ready');
    } catch {
      setNearState('denied');
    }
  }, [userLoc]);

  const sources = useMemo(
    () => [...new Set(sightings.map(s => s.source).filter(Boolean))] as string[],
    [sightings],
  );

  const allBirds = useMemo(() => groupBirds(sightings, clusters), [sightings, clusters]);

  // Selected bird (its detail replaces the list in the sheet)
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [selected, setSelected] = useState<{ key: string; sightingId: number } | null>(null);

  const weekCount = useMemo(() => allBirds.filter(b => inPeriod(b, 'week')).length, [allBirds]);

  const distanceOf = useCallback(
    (b: Bird) => (period === 'near' && userLoc ? distanceTo(b, userLoc) : null),
    [period, userLoc],
  );

  // Birds shown in the sheet and on the map: first one is the hero card
  const birds = useMemo(() => {
    const visible = allBirds.filter(b =>
      inPeriod(b, period) &&
      (!source || b.reports.some(r => r.source === source)) &&
      matchesQuery(b, query));
    if (period === 'near' && userLoc) {
      return visible.sort((a, b) => (distanceTo(a, userLoc) ?? Infinity) - (distanceTo(b, userLoc) ?? Infinity));
    }
    // Rarest bird leads as the hero; the rest stay newest-first
    const hero = [...visible].sort(byRarity)[0];
    return hero ? [hero, ...visible.filter(b => b !== hero)] : visible;
  }, [allBirds, period, source, query, userLoc]);

  const pins: MapPin[] = useMemo(() => birds.flatMap(b => {
    const { lat, lng } = b.latest;
    if (lat == null || lng == null) return [];
    const date = formatDate(b.latest.observed_at);
    return [{
      lat, lng, id: b.latest.id,
      label: b.latest.common_name,
      sublabel: b.reports.length > 1 ? `${b.reports.length} reports · ${date}` : date,
      color: b.tier.color,
      selected: b.key === selected?.key,
      tag: b.tier.rank === 3 || b.key === selected?.key,
    }];
  }), [birds, selected?.key]);

  // ---- selected bird (detail view in the sheet) ----
  const selectedBird = selected ? allBirds.find(b => b.key === selected.key) ?? null : null;
  const selectedSighting = selectedBird
    ? selectedBird.reports.find(r => r.id === selected!.sightingId) ?? selectedBird.latest
    : null;
  const detail = useSightingDetail(selectedSighting);

  const selectBird = useCallback((bird: Bird, sighting?: Sighting) => {
    Keyboard.dismiss();
    setSelected({ key: bird.key, sightingId: (sighting ?? bird.latest).id });
    sheetRef.current?.snapTo(1);
  }, []);
  const openSightingById = useCallback((id: number) => {
    const bird = allBirds.find(b => b.reports.some(r => r.id === id));
    if (bird) selectBird(bird, bird.reports.find(r => r.id === id));
  }, [allBirds, selectBird]);
  const closeDetail = useCallback(() => setSelected(null), []);

  const focus: MapFocus | null = useMemo(() => {
    if (!selectedSighting || selectedSighting.lat == null || selectedSighting.lng == null) return null;
    const c = detail.cluster;
    return {
      lat: Number(selectedSighting.lat),
      lng: Number(selectedSighting.lng),
      circle: c ? { lat: c.center_lat, lng: c.center_lng, radiusM: c.radius_m } : null,
      trail: (c?.sighting_pins ?? []).map(p => ({ lat: p.lat, lng: p.lng })),
      exact: detail.exactSpot,
    };
  }, [selectedSighting, detail.cluster, detail.exactSpot]);

  const [aboutOpen, setAboutOpen] = useState(false);

  // ---- layout ----
  const searchBottom = insets.top + 8 + SEARCH_BAR_H;
  const snapPoints = useMemo(() => [
    Math.round(150 + insets.bottom),     // peek: header only
    Math.round(height * 0.5),            // half: map + list
    Math.round(height - searchBottom - 8), // full: list, search bar stays visible
  ], [height, insets.bottom, searchBottom]);

  // Android back: shrink the sheet / clear the search before leaving the app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selected) { setSelected(null); return true; }
      if (sheetRef.current && sheetRef.current.getIndex() === 2) { sheetRef.current.snapTo(1); return true; }
      if (queryText) { setQueryText(''); return true; }
      return false;
    });
    return () => sub.remove();
  }, [queryText, selected]);

  const mins = updatedAt ? Math.floor((now - updatedAt) / 60000) : null;
  const updatedLabel = mins == null ? 'loading…' : mins < 1 ? 'updated just now' : `updated ${mins} min ago`;
  const fitKey = `${loading ? 'loading' : 'ready'}|${period}|${source}|${query}`;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={StyleSheet.absoluteFill}>
        <LeafletMap
          pins={pins}
          onPinPress={openSightingById}
          insets={{ top: searchBottom, bottom: snapPoints[1] }}
          fitKey={fitKey}
          focus={focus}
        />
      </View>

      {/* Floating search bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable style={styles.logo} onPress={() => setAboutOpen(true)} accessibilityLabel="About and data sources">
          <Text style={styles.logoGlyph}>🐦</Text>
        </Pressable>
        <View style={styles.search}>
          <TextInput
            value={queryText}
            onChangeText={setQueryText}
            onFocus={() => sheetRef.current?.snapTo(1)}
            placeholder="Search species or places"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {queryText ? (
            <Pressable onPress={() => setQueryText('')} hitSlop={10} accessibilityLabel="Clear search">
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        initialIndex={1}
        header={selectedBird && selectedSighting ? (
          <DetailHeader
            bird={selectedBird}
            sighting={selectedSighting}
            distance={distanceOf(selectedBird)}
            onClose={closeDetail}
          />
        ) : (
          <SheetHeader
            updatedLabel={updatedLabel}
            period={period}
            onPeriod={choosePeriod}
            weekCount={weekCount}
            sources={sources}
            source={source}
            onSource={setSource}
          />
        )}
      >
        {hidden => selectedBird && selectedSighting ? (
          <DetailBody
            detail={detail}
            bird={selectedBird}
            sighting={selectedSighting}
            onSelectReport={r => setSelected({ key: selectedBird.key, sightingId: r.id })}
            bottomPadding={hidden + insets.bottom}
          />
        ) : (
          <SheetList
            birds={birds}
            period={period}
            loading={loading}
            error={error}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onRetry={() => { setLoading(true); fetchSightings().finally(() => setLoading(false)); }}
            onSelect={b => selectBird(b)}
            distanceOf={distanceOf}
            nearState={nearState}
            bottomPadding={hidden + insets.bottom}
          />
        )}
      </BottomSheet>

      <AboutModal visible={aboutOpen} onClose={() => setAboutOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 8, alignItems: 'center' },
  logo: {
    width: SEARCH_BAR_H, height: SEARCH_BAR_H, borderRadius: 14, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  logoGlyph: { fontSize: 22 },
  search: {
    flex: 1, height: SEARCH_BAR_H, borderRadius: 14, backgroundColor: colors.card, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 14, elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text, paddingVertical: 0 },
  clear: { fontSize: 15, color: colors.muted, paddingLeft: 8 },
});
