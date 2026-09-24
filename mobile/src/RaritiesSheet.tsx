import { memo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { parseCredit, usePhoto } from './BirdPhoto';
import { refoundLabel, statusWord, whenLabel, type Bird, type Period } from './birds';
import { colors, radius, STATUS_DOT } from './theme';
import { formatDistance, formatSource } from './util';

// ---------------------------------------------------------------------------
// Header (the draggable part of the sheet)
// ---------------------------------------------------------------------------

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'Last 30 days' },
  { key: 'near', label: 'Near me' },
];

export function SheetHeader({
  updatedLabel,
  period,
  onPeriod,
  weekCount,
  sources,
  source,
  onSource,
}: {
  updatedLabel: string;
  period: Period;
  onPeriod: (p: Period) => void;
  weekCount: number;
  sources: string[];
  source: string | null;
  onSource: (s: string | null) => void;
}) {
  return (
    <View>
      <View style={styles.hd}>
        <Text style={styles.title}>Rarities</Text>
        <Text style={styles.sub}>LA &amp; Orange County · {updatedLabel}</Text>
      </View>

      <View style={styles.seg}>
        {PERIODS.map(p => {
          const on = p.key === period;
          return (
            <Pressable key={p.key} style={[styles.segItem, on && styles.segOn]} onPress={() => onPeriod(p.key)}>
              <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>
                {p.key === 'week' ? `${p.label} · ${weekCount}` : p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {sources.length > 1 ? (
        <View style={styles.pills}>
          {[null, ...sources].map(s => {
            const on = s === source;
            return (
              <Pressable key={s ?? 'all'} style={[styles.pill, on && styles.pillOn]} onPress={() => onSource(s)}>
                <Text style={[styles.pillText, on && styles.pillTextOn]}>{s ? formatSource(s) : 'All sources'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// List: hero card + grouped rows
// ---------------------------------------------------------------------------

type DistanceOf = (b: Bird) => number | null;

export function SheetList({
  birds,
  period,
  loading,
  error,
  refreshing,
  onRefresh,
  onRetry,
  onSelect,
  distanceOf,
  nearState,
  bottomPadding,
}: {
  /** Already filtered and sorted; the first one becomes the hero card */
  birds: Bird[];
  period: Period;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onSelect: (b: Bird) => void;
  distanceOf: DistanceOf;
  nearState: 'idle' | 'locating' | 'denied' | 'ready';
  bottomPadding: number;
}) {
  if (loading && birds.length === 0) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  }
  if (error && birds.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{error}</Text>
        <Pressable style={styles.retry} onPress={onRetry}><Text style={styles.retryText}>Retry</Text></Pressable>
      </View>
    );
  }
  if (period === 'near' && nearState !== 'ready') {
    return (
      <View style={styles.center}>
        {nearState === 'denied' ? (
          <Text style={styles.emptyText}>Allow location access to see the rarities closest to you.</Text>
        ) : (
          <><ActivityIndicator color={colors.accent} /><Text style={styles.emptyText}>Finding your location…</Text></>
        )}
      </View>
    );
  }

  const [hero, ...rest] = birds;
  const groupTitle = period === 'near' ? 'Also nearby' : period === 'week' ? 'Also this week' : 'Also in the last 30 days';

  return (
    <FlatList
      data={rest}
      keyExtractor={b => b.key}
      renderItem={({ item, index }) => (
        <BirdRow
          bird={item}
          first={index === 0}
          last={index === rest.length - 1}
          distance={distanceOf(item)}
          onPress={() => onSelect(item)}
        />
      )}
      ListHeaderComponent={
        hero ? (
          <>
            <Hero bird={hero} distance={distanceOf(hero)} onPress={() => onSelect(hero)} />
            {rest.length ? <Text style={styles.groupTitle}>{groupTitle}</Text> : null}
          </>
        ) : null
      }
      ListEmptyComponent={
        hero ? null : <View style={styles.center}><Text style={styles.emptyText}>No rarities match.</Text></View>
      }
      contentContainerStyle={{ paddingBottom: bottomPadding + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      windowSize={7}
    />
  );
}

function Hero({ bird, distance, onPress }: { bird: Bird; distance: number | null; onPress: () => void }) {
  const s = bird.latest;
  const photo = usePhoto(s.photo_url, s.photo_attribution, s.scientific_name);
  const credit = photo.url ? parseCredit(photo.attribution) : null;
  const status = refoundLabel(bird) ?? statusWord(bird);
  const meta = [
    s.location_name ?? s.region_name,
    bird.reports.length > 1 ? `${bird.reports.length} reports` : whenLabel(s.observed_at),
    distance != null ? formatDistance(distance) : null,
  ].filter(Boolean).join(' · ');

  return (
    <Pressable style={styles.hero} onPress={onPress}>
      {photo.url ? (
        <>
          {/* the stored photo is iNaturalist's 75px square; the hero needs the larger size */}
          <Image source={{ uri: photo.url.replace(/\/square\.(\w+)$/, '/medium.$1') }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFill, styles.heroShade]} />
        </>
      ) : (
        <Text style={styles.heroGhost}>🐦</Text>
      )}
      <View style={styles.kicker}>
        <Text style={styles.chip}>★ {bird.tier.rank > 0 ? bird.tier.name.toUpperCase() : 'RAREST RIGHT NOW'}</Text>
        {status ? <Text style={styles.chip}>● {status}</Text> : null}
      </View>
      <Text style={styles.heroName} numberOfLines={1}>{bird.count && bird.count > 1 ? `${bird.count}× ` : ''}{s.common_name}</Text>
      <Text style={styles.heroMeta} numberOfLines={1}>{meta}</Text>
      {credit ? (
        <Text style={styles.heroCredit} numberOfLines={1}>
          {/* license first: CC terms need it visible, and a long name then truncates harmlessly */}
          {credit.license ? `${credit.license} · ` : ''}{credit.credit}
        </Text>
      ) : null}
    </Pressable>
  );
}

const BirdRow = memo(function BirdRow({
  bird,
  first,
  last,
  distance,
  onPress,
}: {
  bird: Bird;
  first: boolean;
  last: boolean;
  distance: number | null;
  onPress: () => void;
}) {
  const s = bird.latest;
  const photo = usePhoto(s.photo_url, s.photo_attribution, s.scientific_name);
  const dot = STATUS_DOT[bird.cluster?.status.level ?? 'gray'];
  const place = s.location_name ?? s.region_name;
  const sub = [
    distance != null ? formatDistance(distance) : null,
    place,
    bird.reports.length > 1 ? `${bird.reports.length} reports` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.line }}
      style={[styles.row, first && styles.rowFirst, last && styles.rowLast, !first && styles.rowDivider]}
    >
      <View style={[styles.ava, { backgroundColor: bird.tier.soft }]}>
        {photo.url ? (
          <Image source={{ uri: photo.url }} style={styles.avaImg} />
        ) : (
          <Text style={styles.avaGlyph}>🐦</Text>
        )}
        <View style={[styles.dot, { backgroundColor: dot }]} />
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>
          {bird.count && bird.count > 1 ? `${bird.count}× ` : ''}{s.common_name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={styles.rowEnd}>
        <Text style={[styles.badge, { backgroundColor: bird.tier.soft, color: bird.tier.color }]}>{bird.tier.name}</Text>
        <Text style={styles.when}>{whenLabel(s.observed_at)}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // header
  hd: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.6 },
  sub: { fontSize: 13, color: colors.muted, fontWeight: '500', marginTop: 1 },
  seg: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.control, padding: 3, marginHorizontal: 20, marginBottom: 10 },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segOn: { backgroundColor: colors.card, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  segText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  segTextOn: { color: colors.text },
  pills: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  pill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.bg },
  pillOn: { backgroundColor: colors.accentSoft },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  pillTextOn: { color: colors.accent },

  // states
  center: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 10 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  retry: { backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },

  // hero
  hero: {
    marginHorizontal: 16, marginBottom: 14, height: 176, borderRadius: radius.hero, overflow: 'hidden',
    padding: 16, justifyContent: 'flex-end', backgroundColor: colors.heroFrom,
  },
  heroShade: { backgroundColor: 'rgba(8,30,40,0.45)' },
  heroGhost: { position: 'absolute', right: 6, top: -10, fontSize: 120, opacity: 0.22 },
  kicker: { position: 'absolute', top: 14, left: 16, flexDirection: 'row', gap: 6 },
  chip: {
    fontSize: 11, fontWeight: '800', color: '#fff', backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, overflow: 'hidden',
  },
  heroName: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroMeta: { fontSize: 13, color: '#fff', opacity: 0.9, marginTop: 2 },
  heroCredit: { position: 'absolute', right: 10, bottom: 6, fontSize: 9, color: '#fff', opacity: 0.85, maxWidth: '70%' },

  // rows
  groupTitle: {
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6, fontSize: 12, fontWeight: '800',
    letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14,
    marginHorizontal: 16, backgroundColor: colors.card, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.line,
  },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  rowDivider: { borderTopWidth: 1 },
  ava: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avaImg: { width: 48, height: 48, borderRadius: 24 },
  avaGlyph: { fontSize: 24 },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2.5, borderColor: '#fff' },
  rowMain: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: '500' },
  rowEnd: { alignItems: 'flex-end', flexShrink: 0 },
  badge: { fontSize: 10.5, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.badge, overflow: 'hidden' },
  when: { fontSize: 11, color: colors.muted, marginTop: 4, fontWeight: '600' },
});
