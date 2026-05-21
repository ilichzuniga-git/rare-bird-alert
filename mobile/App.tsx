import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
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

const INAT_BASE = 'https://api.inaturalist.org/v1';

// Per-session cache: scientific_name → { url, attribution } (or empty if not found)
type PhotoInfo = { url: string; attribution: string };
const photoCache = new Map<string, PhotoInfo>();

// CC licenses that are commercially usable (no NC)
const COMMERCIAL_LICENSES = new Set(['cc0', 'cc-by', 'cc-by-sa', 'cc-by-nd']);

async function fetchPhotoForSpecies(scientificName: string): Promise<PhotoInfo> {
  if (photoCache.has(scientificName)) return photoCache.get(scientificName)!;
  try {
    const res = await fetch(
      `${INAT_BASE}/taxa?q=${encodeURIComponent(scientificName)}&rank=species&per_page=1`
    );
    const data = await res.json();
    const taxon = data?.results?.[0];
    const photo = taxon?.default_photo;
    const license = (photo?.license_code || '').toLowerCase();
    if (photo?.square_url && COMMERCIAL_LICENSES.has(license)) {
      const info: PhotoInfo = { url: photo.square_url, attribution: photo.attribution ?? '' };
      photoCache.set(scientificName, info);
      return info;
    }
    const empty: PhotoInfo = { url: '', attribution: '' };
    photoCache.set(scientificName, empty);
    return empty;
  } catch {
    const empty: PhotoInfo = { url: '', attribution: '' };
    photoCache.set(scientificName, empty);
    return empty;
  }
}

/** Opens the All About Birds species page for a given common name. */
function openAllAboutBirds(commonName: string) {
  const slug = commonName.trim().replace(/ /g, '_');
  Linking.openURL(`https://www.allaboutbirds.org/guide/${encodeURIComponent(slug)}`);
}

function BirdPhoto({
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
  const [url, setUrl] = useState<string>(photoUrl ?? '');
  const [attribution, setAttribution] = useState<string>(photoAttribution ?? '');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // If no pre-stored photo (e.g. eBird sightings), try lazy fetch from iNat taxa API
    if (!photoUrl && scientificName) {
      fetchPhotoForSpecies(scientificName).then(info => {
        if (mounted.current) {
          setUrl(info.url);
          setAttribution(info.attribution);
        }
      });
    }
    return () => { mounted.current = false; };
  }, [photoUrl, scientificName]);

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

  // Clean up iNaturalist attribution: strip license suffix, keep photographer name
  // e.g. "(c) Jane Smith, some rights reserved (CC BY)" → "© Jane Smith"
  const credit = attribution
    ? attribution.replace(/\(c\)/i, '©').replace(/,?\s*some rights reserved.*$/i, '').replace(/,?\s*no rights reserved.*$/i, '').trim()
    : '';

  return (
    <TouchableOpacity
      style={styles.photoWrapper}
      onPress={() => openAllAboutBirds(commonName)}
      activeOpacity={0.85}
    >
      <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" />
      {credit ? (
        <View style={styles.photoCredit}>
          <Text style={styles.photoCreditText} numberOfLines={1}>{credit}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

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
  source_id: string | null;
  rarity_count: number | null;
  photo_url: string | null;
  photo_attribution: string | null;
  location_id: string | null;
  notes: string | null;
}

type RarityTier = { label: string; bg: string; text: string };

function getRarityTier(rarity_count: number | null): RarityTier {
  if (rarity_count === null) return { label: 'Notable',    bg: '#f1f5f9', text: '#475569' };
  if (rarity_count <= 3)     return { label: 'Exceptional', bg: '#fef2f2', text: '#dc2626' };
  if (rarity_count <= 9)     return { label: 'Very Rare',   bg: '#fff7ed', text: '#ea580c' };
  return                            { label: 'Rare',        bg: '#fffbeb', text: '#d97706' };
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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate().toString();
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

// ---- Map modal with lazy-loaded comments ----
interface CommentEntry { author: string; text: string; created_at: string | null; }
interface CommentsPayload {
  source: string;
  observer_note: string | null;
  comments: CommentEntry[];
}

function MapModal({ sighting, onClose }: { sighting: Sighting | null; onClose: () => void }) {
  const [commentsState, setCommentsState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [payload, setPayload] = useState<CommentsPayload | null>(null);

  useEffect(() => {
    if (!sighting) { setCommentsState('idle'); setPayload(null); return; }
    setCommentsState('loading');
    setPayload(null);
    fetch(`${API_BASE}/api/sightings/${sighting.id}/comments`)
      .then(r => r.json())
      .then(data => { setPayload(data); setCommentsState('done'); })
      .catch(() => setCommentsState('error'));
  }, [sighting?.id]);

  const comments = payload?.comments ?? [];
  const hasContent = payload && (payload.observer_note || comments.length > 0);

  return (
    <Modal visible={sighting !== null} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#2d6a4f' }}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle} numberOfLines={1}>{sighting?.common_name}</Text>
            {sighting?.location_name ? (
              <Text style={styles.modalSub} numberOfLines={1}>{sighting.location_name}</Text>
            ) : null}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Map — fixed height */}
        {sighting && sighting.lat != null && sighting.lng != null ? (
          <View style={styles.modalMapContainer}>
            <LeafletMap
              pins={[toPin(sighting)!]}
              center={{ lat: sighting.lat, lng: sighting.lng }}
              zoom={15}
            />
          </View>
        ) : (
          <View style={[styles.modalMapContainer, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a3a2a' }]}>
            <Text style={{ color: '#aaa', fontSize: 14 }}>No location data</Text>
          </View>
        )}

        {/* Comments panel */}
        <View style={styles.commentsPanel}>
          {commentsState === 'loading' && (
            <View style={styles.commentsCenter}>
              <ActivityIndicator color="#2d6a4f" />
              <Text style={styles.commentsHint}>Loading notes…</Text>
            </View>
          )}
          {commentsState === 'error' && (
            <View style={styles.commentsCenter}>
              <Text style={styles.commentsHint}>Could not load comments</Text>
            </View>
          )}
          {commentsState === 'done' && !hasContent && (
            <View style={styles.commentsCenter}>
              <Text style={styles.commentsHint}>No observer notes or comments for this sighting</Text>
            </View>
          )}
          {commentsState === 'done' && hasContent && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
              {/* Observer note */}
              {payload?.observer_note ? (
                <View style={styles.commentNote}>
                  <Text style={styles.commentNoteLabel}>Observer note</Text>
                  <Text style={styles.commentNoteText}>{payload.observer_note}</Text>
                </View>
              ) : null}

              {/* Community comments */}
              {comments.length > 0 ? (
                <>
                  <Text style={styles.commentsHeading}>
                    {comments.length === 1 ? '1 comment' : `${comments.length} comments`}
                  </Text>
                  {comments.map((c, i) => (
                    <View key={i} style={styles.commentRow}>
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarText}>{c.author[0]?.toUpperCase() ?? '?'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.commentMeta}>
                          <Text style={styles.commentAuthor}>{c.author}</Text>
                          {c.created_at ? (
                            <Text style={styles.commentDate}>{formatDate(c.created_at)}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.commentText}>{c.text}</Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : null}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ---- Sighting card ----
function SightingCard({ item, onMapPress }: { item: Sighting; onMapPress: () => void }) {
  const count = item.how_many != null ? item.how_many + 'x ' : '';
  const hasCoords = item.lat != null && item.lng != null;
  const tier = getRarityTier(item.rarity_count);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const hotspotUrl =
    item.source === 'ebird' && item.location_id
      ? `https://ebird.org/hotspot/${item.location_id}`
      : item.source === 'inaturalist' && item.source_id
      ? `https://www.inaturalist.org/observations/${item.source_id}`
      : null;

  const locationDisplay = item.location_name ?? item.region_name;

  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.commonName}>{count}{item.common_name}</Text>
              <View style={[styles.rarityBadge, { backgroundColor: tier.bg }]}>
                <Text style={[styles.rarityBadgeText, { color: tier.text }]}>{tier.label}</Text>
              </View>
            </View>
            <Text style={styles.date} numberOfLines={1}>{formatDate(item.observed_at)}</Text>
          </View>
          {item.scientific_name ? <Text style={styles.sciName}>{item.scientific_name}</Text> : null}
        </View>
        <BirdPhoto photoUrl={item.photo_url} photoAttribution={item.photo_attribution} scientificName={item.scientific_name} commonName={item.common_name} />
      </View>

      <View style={styles.cardFooter}>
        {/* Location — tappable hotspot link for eBird, plain text otherwise */}
        {hotspotUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(hotspotUrl)} style={styles.hotspotBtn}>
            <Text style={styles.hotspotText} numberOfLines={1}>{'📍'} {locationDisplay}</Text>
            <Text style={styles.hotspotChevron}>›</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.location} numberOfLines={1}>{'📍'} {locationDisplay}</Text>
        )}

        <View style={styles.cardFooterRight}>
          {item.source && (
            <View style={item.source === 'inaturalist' ? styles.sourceTagInat : styles.sourceTag}>
              <Text style={item.source === 'inaturalist' ? styles.sourceTagTextInat : styles.sourceTagText}>{formatSource(item.source)}</Text>
            </View>
          )}
          {hasCoords && (
            <TouchableOpacity style={styles.mapBtn} onPress={onMapPress}>
              <Text style={styles.mapBtnText}>Map</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Expandable observer notes */}
      {item.notes ? (
        <>
          <TouchableOpacity style={styles.notesToggle} onPress={() => setNotesExpanded(e => !e)} activeOpacity={0.7}>
            <Text style={styles.notesToggleText}>Observer notes</Text>
            <Text style={styles.notesChevron}>{notesExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {notesExpanded && (
            <View style={styles.notesBody}>
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
          )}
        </>
      ) : null}
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
                  style={[styles.filterChip, sourceFilter === src && (src === 'inaturalist' ? styles.filterChipActiveInat : styles.filterChipActive)]}
                  onPress={() => setSourceFilter(sourceFilter === src ? null : src)}
                >
                  <Text style={[styles.filterChipText, sourceFilter === src && (src === 'inaturalist' ? styles.filterChipTextActiveInat : styles.filterChipTextActive)]}>
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
      <MapModal sighting={modalSighting} onClose={() => setModalSighting(null)} />
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
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardContent: { flex: 1 },
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardHeaderLeft: { flex: 1, flexDirection: 'column', gap: 4 },
  commonName: { fontSize: 16, fontWeight: '600', color: '#1a3a2a' },
  rarityBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  rarityBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  date: { fontSize: 12, color: '#888', marginTop: 2, minWidth: 52, flexShrink: 0, textAlign: 'right' },
  sciName: { fontSize: 13, fontStyle: 'italic', color: '#555', marginTop: 3 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8, flexWrap: 'wrap' },
  cardFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  location: { fontSize: 13, color: '#2d6a4f', flex: 1 },
  // Tappable hotspot row (eBird only)
  hotspotBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 2 },
  hotspotText: { fontSize: 13, color: '#2d6a4f', flex: 1, textDecorationLine: 'underline' },
  hotspotChevron: { fontSize: 16, color: '#2d6a4f', fontWeight: '700' },
  mapBtn: { backgroundColor: '#e8f5ee', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  mapBtnText: { fontSize: 12, color: '#2d6a4f', fontWeight: '600' },
  // Observer notes
  notesToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e8f0eb', marginTop: 6 },
  notesToggleText: { fontSize: 12, color: '#4a7c59', fontWeight: '600' },
  notesChevron: { fontSize: 10, color: '#4a7c59' },
  notesBody: { paddingTop: 6, paddingBottom: 2 },
  notesText: { fontSize: 13, color: '#374151', lineHeight: 19 },
  sourceTag: { backgroundColor: '#e8f0ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  sourceTagText: { fontSize: 12, color: '#3b5bdb', fontWeight: '600' },
  sourceTagInat: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  sourceTagTextInat: { fontSize: 12, color: '#92400e', fontWeight: '600' },

  filterBar: { backgroundColor: '#f0f4f0', maxHeight: 44 },
  filterBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 3, borderRadius: 14, borderWidth: 1, borderColor: '#2d6a4f' },
  filterChipActive: { backgroundColor: '#2d6a4f' },
  filterChipActiveInat: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  filterChipText: { fontSize: 12, color: '#2d6a4f', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  filterChipTextActiveInat: { color: '#fff' },

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
  modalMapContainer: { height: 280 },
  // Comments panel
  commentsPanel: { flex: 1, backgroundColor: '#fff' },
  commentsCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  commentsHint: { fontSize: 14, color: '#888', textAlign: 'center' },
  commentsHeading: { fontSize: 13, fontWeight: '700', color: '#4a7c59', textTransform: 'uppercase', letterSpacing: 0.5 },
  // Observer note block
  commentNote: { backgroundColor: '#f0f7f2', borderLeftWidth: 3, borderLeftColor: '#2d6a4f', borderRadius: 6, padding: 12 },
  commentNoteLabel: { fontSize: 11, fontWeight: '700', color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  commentNoteText: { fontSize: 14, color: '#1a3a2a', lineHeight: 20 },
  // Community comment rows
  commentRow: { flexDirection: 'row', gap: 10 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2d6a4f', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#1a3a2a' },
  commentDate: { fontSize: 11, color: '#888' },
  commentText: { fontSize: 14, color: '#374151', lineHeight: 20 },
});
