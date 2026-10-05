import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Image,
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
import { markAlertsSeen, onNotificationTap, registerForPushNotificationsAsync } from './src/notifications';
import LeafletMap, { type MapFocus, type MapPin, type UserSpot } from './src/LeafletMap';
import AboutModal from './src/AboutModal';
import WhatsNewCard from './src/WhatsNewCard';
import { APP_VERSION, WHATS_NEW } from './src/guide';
import { DetailBody, DetailHeader, useSightingDetail } from './src/SightingDetail';
import BottomSheet, { type BottomSheetHandle } from './src/BottomSheet';
import { SheetHeader, SheetList } from './src/RaritiesSheet';
import { TripHeader, TripList } from './src/TripSheet';
import CarIcon from './src/CarIcon';
import { MAX_STOPS, openTripDirections, routable, routeOrder, useTrip } from './src/trip';
import { atSea, byRarity, distanceTo, groupBirds, inPeriod, matchesQuery, type Bird, type Period } from './src/birds';
import { usePrefs } from './src/prefs';
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

  // Birds from a tapped notification, listed first under "Just reported" (bird keys)
  const [justReported, setJustReported] = useState<Set<string> | null>(null);
  // Leaving the app ends that view; a later normal launch shows the usual list
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'background') setJustReported(null);
      if (s === 'active') markAlertsSeen(); // back in the app: clear the icon badge
    });
    return () => sub.remove();
  }, []);

  const onRefresh = useCallback(async () => {
    setJustReported(null);
    setRefreshing(true);
    await fetchSightings();
    setRefreshing(false);
  }, [fetchSightings]);

  // ---- filters ----
  const [period, setPeriod] = useState<Period>('week');
  const [source, setSource] = useState<string | null>(null);
  const { prefs, setPref } = usePrefs();
  const hideAtSea = useCallback((hide: boolean) => setPref('hideAtSea', hide), [setPref]);
  const [queryText, setQueryText] = useState('');
  const [query, setQuery] = useState(''); // debounced, so the map isn't redrawn on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryText.trim()), 250);
    return () => clearTimeout(t);
  }, [queryText]);

  // "Near me" and the trip's driving order need the user's position
  const [userLoc, setUserLoc] = useState<UserSpot | null>(null);
  const [nearState, setNearState] = useState<'idle' | 'locating' | 'denied' | 'ready'>('idle');
  const lastList = useRef<Period>('week'); // where closing the trip returns to
  const choosePeriod = useCallback(async (p: Period) => {
    setJustReported(null);
    if (p !== 'trip') lastList.current = p;
    setPeriod(p);
    if ((p !== 'near' && p !== 'trip') || userLoc || nearState === 'locating') return;
    setNearState('locating');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setNearState('denied'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy });
      setNearState('ready');
    } catch {
      setNearState('denied');
    }
  }, [userLoc, nearState]);
  const closeTrip = useCallback(() => setPeriod(lastList.current), []);

  const sources = useMemo(
    () => [...new Set(sightings.map(s => s.source).filter(Boolean))] as string[],
    [sightings],
  );

  const allBirds = useMemo(() => groupBirds(sightings, clusters), [sightings, clusters]);

  // ---- trip drawer (saved on this phone only) ----
  const trip = useTrip(allBirds);
  const route = useMemo(() => routeOrder(trip.birds, userLoc), [trip.birds, userLoc]);
  const stopOf = useMemo(() => new Map(route.map((t, i) => [t.bird.key, i + 1])), [route]);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);
  const toggleTrip = useCallback((bird: Bird) => {
    const added = trip.toggle(bird);
    const n = trip.count + (added ? 1 : -1);
    setToast(!added ? 'Removed from your trip'
      : n > MAX_STOPS ? `Saved · ${n} birds (directions cover ${MAX_STOPS} stops)`
      : `Saved to your trip · ${n} of ${MAX_STOPS} stops`);
  }, [trip]);

  // Selected bird (its detail replaces the list in the sheet)
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [selected, setSelected] = useState<{ key: string; sightingId: number } | null>(null);

  const weekCount = useMemo(() => allBirds.filter(b => inPeriod(b, 'week')).length, [allBirds]);

  const distanceOf = useCallback(
    (b: Bird) => ((period === 'near' || period === 'trip') && userLoc ? distanceTo(b, userLoc) : null),
    [period, userLoc],
  );

  // Birds shown in the sheet and on the map: first one is the hero card.
  // seaCount: how many of them are out on the ocean, counted before the at-sea switch hides them.
  // justCount: how many lead the list because a tapped notification announced them.
  const { birds, seaCount, justCount } = useMemo(() => {
    if (period === 'trip') {
      return { birds: route.map(t => t.bird).filter(b => matchesQuery(b, query)), seaCount: 0, justCount: 0 };
    }
    // Announced birds show even when reported late (seen before this week) or at sea while those are hidden
    const isJust = (b: Bird) => justReported?.has(b.key) === true;
    const matching = allBirds.filter(b =>
      (inPeriod(b, period) || isJust(b)) &&
      (!source || b.reports.some(r => r.source === source)) &&
      matchesQuery(b, query));
    const seaCount = matching.filter(atSea).length;
    const visible = prefs.hideAtSea ? matching.filter(b => !atSea(b) || isJust(b)) : matching;
    if (period === 'near' && userLoc) {
      visible.sort((a, b) => (distanceTo(a, userLoc) ?? Infinity) - (distanceTo(b, userLoc) ?? Infinity));
      return { birds: visible, seaCount, justCount: 0 };
    }
    // After a notification tap: its birds first, rarest leading as the hero, then the rest newest-first
    const just = visible.filter(isJust).sort(byRarity);
    if (just.length) return { birds: [...just, ...visible.filter(b => !isJust(b))], seaCount, justCount: just.length };
    // Rarest bird you can get to leads as the hero (one at sea only if that's all there is);
    // the rest stay newest-first
    const ranked = [...visible].sort(byRarity);
    const hero = ranked.find(b => !atSea(b)) ?? ranked[0];
    return { birds: hero ? [hero, ...visible.filter(b => b !== hero)] : visible, seaCount, justCount: 0 };
  }, [allBirds, period, source, query, userLoc, route, prefs.hideAtSea, justReported]);

  const pins: MapPin[] = useMemo(() => birds.flatMap(b => {
    const { lat, lng } = b.latest;
    if (lat == null || lng == null) return [];
    const date = (atSea(b) ? 'At sea · ' : '') + formatDate(b.latest.observed_at);
    const stop = period === 'trip' ? stopOf.get(b.key) : undefined;
    return [{
      lat, lng, id: b.latest.id,
      label: stop ? `${stop}. ${b.latest.common_name}` : b.latest.common_name,
      sublabel: b.reports.length > 1 ? `${b.reports.length} reports · ${date}` : date,
      color: b.tier.color,
      selected: b.key === selected?.key,
      tag: stop != null || b.tier.rank === 3 || b.key === selected?.key,
    }];
  }), [birds, selected?.key, period, stopOf]);

  // ---- selected bird (detail view in the sheet) ----
  // A saved bird may have dropped out of the feed; then it only exists in the trip
  const selectedBird = selected
    ? allBirds.find(b => b.key === selected.key) ?? trip.birds.find(t => t.bird.key === selected.key)?.bird ?? null
    : null;
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
    const bird = [...birds, ...allBirds].find(b => b.reports.some(r => r.id === id));
    if (bird) selectBird(bird, bird.reports.find(r => r.id === id));
  }, [birds, allBirds, selectBird]);
  const closeDetail = useCallback(() => setSelected(null), []);

  // Tapping a notification: reload, then open its bird, or list its birds first under "Just reported"
  const [tapped, setTapped] = useState<number[] | null>(null);
  useEffect(() => onNotificationTap(async ids => {
    Keyboard.dismiss();
    setSelected(null);
    setQueryText(''); setQuery(''); setSource(null);
    lastList.current = 'week';
    setPeriod('week');
    await fetchSightings();
    setTapped(ids); // resolved below, once the fresh sightings are grouped into birds
  }), [fetchSightings]);
  useEffect(() => {
    if (!tapped) return;
    setTapped(null);
    const ids = new Set(tapped);
    const hits = allBirds.filter(b => b.reports.some(r => ids.has(r.id)));
    if (hits.length === 1) {
      setJustReported(null);
      selectBird(hits[0], hits[0].reports.find(r => ids.has(r.id)));
    } else {
      setJustReported(hits.length ? new Set(hits.map(b => b.key)) : null);
      sheetRef.current?.snapTo(1);
    }
  }, [tapped, allBirds, selectBird]);
  const openOrCloseTrip = useCallback(() => {
    if (period === 'trip' && !selected) { closeTrip(); return; }
    setSelected(null);
    choosePeriod('trip');
    sheetRef.current?.snapTo(1);
  }, [period, selected, closeTrip, choosePeriod]);

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

  // "What's new" once per release that has an entry, after the first load so it isn't over a spinner
  const whatsNewDue = WHATS_NEW.version === APP_VERSION && prefs.lastSeenVersion !== APP_VERSION;
  const closeWhatsNew = useCallback(() => setPref('lastSeenVersion', APP_VERSION), [setPref]);

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
      if (period === 'trip') { closeTrip(); return true; }
      if (sheetRef.current && sheetRef.current.getIndex() === 2) { sheetRef.current.snapTo(1); return true; }
      if (queryText) { setQueryText(''); return true; }
      return false;
    });
    return () => sub.remove();
  }, [queryText, selected, period, closeTrip]);

  const mins = updatedAt ? Math.floor((now - updatedAt) / 60000) : null;
  const updatedLabel = mins == null ? 'loading…' : mins < 1 ? 'updated just now' : `updated ${mins} min ago`;
  const fitKey = `${loading ? 'loading' : 'ready'}|${period}|${source}|${query}|${period === 'trip' ? trip.count : ''}`;
  const me: UserSpot | null = (period === 'near' || period === 'trip') && userLoc
    ? { ...userLoc, icon: period === 'trip' ? 'car' : 'binoculars' }
    : null;

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
          me={me}
        />
      </View>

      {/* Floating search bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable style={styles.logo} onPress={() => setAboutOpen(true)} accessibilityLabel="About and data sources">
          <Image source={require('./assets/icon.png')} style={styles.logoImage} />
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
            // no contacts/password AutoFill offers on a bird search
            autoComplete="off"
            textContentType="none"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {queryText ? (
            <Pressable onPress={() => setQueryText('')} hitSlop={10} accessibilityLabel="Clear search">
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          style={[styles.tripBtn, period === 'trip' && styles.tripBtnOn]}
          onPress={openOrCloseTrip}
          accessibilityLabel={`Trip, ${trip.count} saved bird${trip.count === 1 ? '' : 's'}`}
        >
          <CarIcon size={26} cut={period === 'trip' ? colors.accent : colors.text} />
          {trip.count ? <Text style={styles.tripCount}>{trip.count}</Text> : null}
        </Pressable>
      </View>

      {toast ? (
        <View style={[styles.toast, { top: searchBottom + 10 }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

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
            onTrip={trip.has(selectedBird.key)}
            onToggleTrip={() => toggleTrip(selectedBird)}
          />
        ) : period === 'trip' ? (
          <TripHeader
            count={trip.count}
            stops={route.filter(t => routable(t.bird)).length}
            fromYou={!!userLoc}
            onDirections={() => openTripDirections(route)}
            onClear={trip.clear}
            onClose={closeTrip}
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
            seaCount={seaCount}
            hideAtSea={prefs.hideAtSea}
            onHideAtSea={hideAtSea}
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
        ) : period === 'trip' ? (
          <TripList
            route={query ? route.filter(t => matchesQuery(t.bird, query)) : route}
            distanceOf={distanceOf}
            onSelect={b => selectBird(b)}
            onRemove={trip.remove}
            bottomPadding={hidden + insets.bottom}
          />
        ) : (
          <SheetList
            birds={birds}
            justCount={justCount}
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
      <WhatsNewCard visible={whatsNewDue && !loading && !aboutOpen} onDone={closeWhatsNew} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 8, alignItems: 'center' },
  logo: {
    width: SEARCH_BAR_H, height: SEARCH_BAR_H, borderRadius: 14, backgroundColor: '#1a7392',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  // The app icon has wide padding around the pin; oversize it so the pin fills the button.
  logoImage: { width: SEARCH_BAR_H * 1.5, height: SEARCH_BAR_H * 1.5 },
  search: {
    flex: 1, height: SEARCH_BAR_H, borderRadius: 14, backgroundColor: colors.card, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 14, elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text, paddingVertical: 0 },
  clear: { fontSize: 15, color: colors.muted, paddingLeft: 8 },
  tripBtn: {
    width: SEARCH_BAR_H, height: SEARCH_BAR_H, borderRadius: 14, backgroundColor: colors.text,
    alignItems: 'center', justifyContent: 'center', elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  tripBtnOn: { backgroundColor: colors.accent },
  tripCount: {
    position: 'absolute', right: -5, top: -5, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: colors.accent, color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center',
    lineHeight: 17, borderWidth: 1.5, borderColor: '#fff', overflow: 'hidden',
  },
  toast: {
    position: 'absolute', alignSelf: 'center', backgroundColor: colors.text, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 9, elevation: 8,
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
