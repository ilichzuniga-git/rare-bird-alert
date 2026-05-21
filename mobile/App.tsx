import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  SectionList,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { registerForPushNotificationsAsync } from './src/notifications';
import LeafletMap, { MapPin } from './src/LeafletMap';

const API_BASE = 'http://localhost:3000';

interface Sighting {
  id: number;
  common_name: string;
  scientific_name: string | null;
  location_name: string | null;
  region_name: string;
  observed_at: string;
  how_many: number | null;
  lat: number | null;
  lng: number | null;
  source: string | null;
}

interface WeekSection {
  weekKey: string;
  title: string;
  count: number;
  data: Sighting[];
}

function formatSource(source: string | null): string {
  if (!source) return 'Unknown';
  if (source.toLowerCase() === 'ebird') return 'eBird';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toPin(s: Sighting): MapPin | null {
  if (s.lat == null || s.lng == null) return null;
  return { lat: s.lat, lng: s.lng, label: s.common_name, sciName: s.scientific_name };
}

// Returns the ISO date string of the Sunday that starts the week containing `date`
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
}

function getWeekLabel(weekKey: string, isCurrentWeek: boolean): string {
  if (isCurrentWeek) return 'This week';
  const sunday = new Date(weekKey + 'T12:00:00');
  const saturday = new Date(sunday);
  saturday.setDate(saturday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return fmt(sunday) + ' - ' + fmt(saturday);
}

function groupByWeek(sightings: Sighting[], currentWeekKey: string): WeekSection[] {
  const map = new Map<string, Sighting[]>();
  for (const s of sightings) {
    const key = getWeekKey(new Date(s.observed_at));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map(key => ({
      weekKey: key,
      title: getWeekLabel(key, key === currentWeekKey),
      count: map.get(key)!.length,
      data: map.get(key)!,
    }));
}

// ---- Sighting card ----
function SightingCard({ item, onMapPress }: { item: Sighting; onMapPress: () => void }) {
  const count = item.how_many != null ? item.how_many + 'x ' : '';
  const hasCoords = item.lat != null && item.lng != null;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.commonName}>{count}{item.common_name}</Text>
        <Text style={styles.date}>{formatDate(item.observed_at)}</Text>
      </View>
      {item.scientific_name ? <Text style={styles.sciName}>{item.scientific_name}</Text> : null}
      <View style={styles.cardFooter}>
        <Text style={styles.location} numberOfLines={1}>
          {'pin'} {item.location_name ?? item.region_name}
        </Text>
        {item.source && (
          <View style={styles.sourceTag}>
            <Text style={styles.sourceTagText}>{formatSource(item.source)}</Text>
          </View>
        )}
        {hasCoords && (
          <TouchableOpacity style={styles.mapBtn} onPress={onMapPress}>
            <Text style={styles.mapBtnText}>Map</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ---- Week section header ----
function WeekHeader({
  section,
  expanded,
  onPress,
}: {
  section: WeekSection;
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.weekHeader} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.weekTitle}>{section.title}</Text>
      <View style={styles.weekHeaderRight}>
        <View style={styles.weekBadge}>
          <Text style={styles.weekBadgeText}>{section.count}</Text>
        </View>
        <Text style={styles.weekChevron}>{expanded ? 'v' : '>'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ---- Main app ----
export default function App() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'map'>('list');
  const [modalSighting, setModalSighting] = useState<Sighting | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const currentWeekKey = useMemo(() => getWeekKey(new Date()), []);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(
    () => new Set([currentWeekKey])
  );

  const fetchSightings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sightings?limit=500`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setSightings(data.sightings);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load sightings');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchSightings().finally(() => setLoading(false));
    registerForPushNotificationsAsync();
  }, [fetchSightings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSightings();
    setRefreshing(false);
  }, [fetchSightings]);

  const toggleWeek = useCallback((weekKey: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  }, []);

  const sources = useMemo(
    () => [...new Set(sightings.map(s => s.source).filter(Boolean))] as string[],
    [sightings]
  );

  const filteredSightings = useMemo(
    () => sourceFilter ? sightings.filter(s => s.source === sourceFilter) : sightings,
    [sightings, sourceFilter]
  );

  const rawSections = useMemo(
    () => groupByWeek(filteredSightings, currentWeekKey),
    [filteredSightings, currentWeekKey]
  );

  // SectionList sections: collapsed sections get empty data array
  const sections = useMemo(
    () =>
      rawSections.map(s => ({
        ...s,
        data: expandedWeeks.has(s.weekKey) ? s.data : [],
      })),
    [rawSections, expandedWeeks]
  );

  const allPins: MapPin[] = filteredSightings.flatMap(s => {
    const p = toPin(s);
    return p ? [p] : [];
  });

  const statusBarHeight = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: statusBarHeight + 12 }]}>
        <Text style={styles.headerTitle}>Rare Bird Alert</Text>
        <Text style={styles.headerSub}>LA & Orange County</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'list' && styles.tabActive]}
          onPress={() => setTab('list')}
        >
          <Text style={[styles.tabText, tab === 'list' && styles.tabTextActive]}>List</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'map' && styles.tabActive]}
          onPress={() => setTab('map')}
        >
          <Text style={[styles.tabText, tab === 'map' && styles.tabTextActive]}>
            {allPins.length > 0 ? 'Map (' + allPins.length + ')' : 'Map'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2d6a4f" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchSightings}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : tab === 'list' ? (
        <View style={{ flex: 1 }}>
          {sources.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterBar}
              contentContainerStyle={styles.filterBarContent}
            >
              <TouchableOpacity
                style={[styles.filterChip, sourceFilter === null && styles.filterChipActive]}
                onPress={() => setSourceFilter(null)}
              >
                <Text style={[styles.filterChipText, sourceFilter === null && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {sources.map(src => (
                <TouchableOpacity
                  key={src}
                  style={[styles.filterChip, sourceFilter === src && styles.filterChipActive]}
                  onPress={() => setSourceFilter(sourceFilter === src ? null : src)}
                >
                  <Text style={[styles.filterChipText, sourceFilter === src && styles.filterChipTextActive]}>
                    {formatSource(src)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <SightingCard item={item} onMapPress={() => setModalSighting(item)} />
          )}
          renderSectionHeader={({ section }) => (
            <WeekHeader
              section={section as WeekSection}
              expanded={expandedWeeks.has((section as WeekSection).weekKey)}
              onPress={() => toggleWeek((section as WeekSection).weekKey)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No sightings yet -- check back soon!</Text>
            </View>
          }
          contentContainerStyle={filteredSightings.length === 0 ? styles.emptyContainer : styles.listContent}
          stickySectionHeadersEnabled={true}
        />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {allPins.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No sightings with GPS coordinates yet.</Text>
            </View>
          ) : (
            <LeafletMap pins={allPins} />
          )}
        </View>
      )}

      {/* Per-sighting map modal */}
      <Modal
        visible={modalSighting !== null}
        animationType="slide"
        onRequestClose={() => setModalSighting(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#2d6a4f' }}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {modalSighting?.common_name}
              </Text>
              {modalSighting?.location_name ? (
                <Text style={styles.modalSub} numberOfLines={1}>
                  {modalSighting.location_name}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalSighting(null)}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
          {modalSighting && modalSighting.lat != null && modalSighting.lng != null && (
            <LeafletMap
              pins={[toPin(modalSighting)!]}
              center={{ lat: modalSighting.lat, lng: modalSighting.lng }}
              zoom={15}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f4f0' },
  header: { backgroundColor: '#2d6a4f', paddingBottom: 14, paddingHorizontal: 20 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: '#b7e4c7', marginTop: 2 },

  tabs: { flexDirection: 'row', backgroundColor: '#245a41' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#fff' },
  tabText: { color: '#8fc9a9', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyContainer: { flexGrow: 1 },
  listContent: { paddingBottom: 100 },

  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e8f0eb',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d0ddd4',
  },
  weekTitle: { fontSize: 14, fontWeight: '700', color: '#1a3a2a' },
  weekHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekBadge: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  weekBadgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  weekChevron: { fontSize: 22, color: '#2d6a4f', fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    marginTop: 8, marginHorizontal: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  commonName: { fontSize: 16, fontWeight: '600', color: '#1a3a2a', flex: 1 },
  date: { fontSize: 12, color: '#888', marginTop: 2 },
  sciName: { fontSize: 13, fontStyle: 'italic', color: '#555', marginTop: 3 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  location: { fontSize: 13, color: '#2d6a4f', flex: 1 },
  mapBtn: { backgroundColor: '#e8f5ee', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  mapBtnText: { fontSize: 12, color: '#2d6a4f', fontWeight: '600' },
  sourceTag: { backgroundColor: '#e8f0ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  sourceTagText: { fontSize: 12, color: '#3b5bdb', fontWeight: '600' },

  filterBar: { backgroundColor: '#f0f4f0', maxHeight: 44 },
  filterBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 3, borderRadius: 14, borderWidth: 1, borderColor: '#2d6a4f' },
  filterChipActive: { backgroundColor: '#2d6a4f' },
  filterChipText: { fontSize: 12, color: '#2d6a4f', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },

  errorText: { color: '#c0392b', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryButton: { backgroundColor: '#2d6a4f', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyText: { fontSize: 15, color: '#666', textAlign: 'center' },

  modalHeader: {
    backgroundColor: '#2d6a4f', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  modalSub: { fontSize: 13, color: '#b7e4c7', marginTop: 2 },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  closeBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
