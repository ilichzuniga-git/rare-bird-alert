import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Location from 'expo-location';
import BirdPhoto from './BirdPhoto';
import { refoundLabel, statusWord, type Bird } from './birds';
import { colors, radius, STATUS_DOT } from './theme';
import {
  API_BASE, distanceMetres, findNoteCoordinates, formatDate, formatDateTime, formatDistance, formatSource, openInMaps,
} from './util';
import type { ClusterData, ClusterDay, CommentsPayload, Sighting } from './types';

/** Play the bundled bird chirp sound. */
async function playChirp() {
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
    const player = createAudioPlayer(require('../assets/chirp.wav'));
    player.play();
    // expo-audio players aren't garbage-collected automatically — remove once done
    const sub = player.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) {
        sub.remove();
        player.remove();
      }
    });
  } catch {
    // Sound is best-effort — never block the UI
  }
}

type ReportType = 'refound' | 'dipped';

// ---------------------------------------------------------------------------
// State for the selected sighting (shared by the sheet header and body)
// ---------------------------------------------------------------------------

export function useSightingDetail(sighting: Sighting | null) {
  const [commentsState, setCommentsState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [payload, setPayload] = useState<CommentsPayload | null>(null);
  const [cluster, setCluster] = useState<ClusterData | null>(null);
  const [confirm, setConfirm] = useState<ReportType | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const clusterId = sighting?.cluster_id ?? null;
  const loadCluster = useCallback(() => {
    if (clusterId == null) { setCluster(null); return; }
    fetch(`${API_BASE}/api/clusters/${clusterId}`)
      .then(r => r.json())
      .then(data => setCluster(data.cluster ?? null))
      .catch(() => {});
  }, [clusterId]);

  useEffect(() => {
    setCommentsState('idle'); setPayload(null); setConfirm(null);
    if (!sighting) return;
    setCommentsState('loading');
    fetch(`${API_BASE}/api/sightings/${sighting.id}/comments`)
      .then(async r => { setPayload(await r.json()); setCommentsState('done'); })
      .catch(() => setCommentsState('error'));
  }, [sighting?.id]);

  // Reports of the same bird share a cluster; don't refetch it when switching between them
  useEffect(() => { setCluster(null); loadCluster(); }, [loadCluster]);

  /** Show the confirmation and fetch GPS for the distance check. */
  const openConfirm = async (type: ReportType) => {
    setConfirm(type);
    setReportError(null);
    setUserLocation(null);
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    } catch {
      // GPS is best-effort — the report can still be submitted without it
    }
    setLocationLoading(false);
  };

  const submitReport = async (type: ReportType) => {
    if (clusterId == null) return;
    setReporting(true);
    try {
      const body: Record<string, unknown> = { type };
      if (userLocation) { body.lat = userLocation.lat; body.lng = userLocation.lng; }
      const res = await fetch(`${API_BASE}/api/clusters/${clusterId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Report failed');
      if (type === 'refound') await playChirp();
      setConfirm(null);
      loadCluster(); // refresh status and today's cell in the strip
    } catch (e: any) {
      setReportError(e.message ?? "Couldn't send the report — try again later");
    }
    setReporting(false);
  };

  const comments = payload?.comments ?? [];
  const reportPoint = sighting?.lat != null && sighting?.lng != null
    ? { lat: Number(sighting.lat), lng: Number(sighting.lng) }
    : null;
  const exactSpot = useMemo(
    () => reportPoint && payload
      ? findNoteCoordinates([payload.observer_note, ...comments.map(c => c.text)], reportPoint)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload, reportPoint?.lat, reportPoint?.lng],
  );

  return {
    commentsState, payload, comments, cluster, exactSpot, reportPoint,
    confirm, setConfirm, openConfirm, submitReport, reporting, reportError, userLocation, locationLoading,
  };
}

export type SightingDetailState = ReturnType<typeof useSightingDetail>;

// ---------------------------------------------------------------------------
// Header (the sheet's draggable part)
// ---------------------------------------------------------------------------

export function DetailHeader({ bird, sighting, distance, onClose }: {
  bird: Bird;
  sighting: Sighting;
  distance: number | null;
  onClose: () => void;
}) {
  const place = [sighting.location_name ?? sighting.region_name, distance != null ? formatDistance(distance) : null]
    .filter(Boolean).join(' · ');
  return (
    <View style={styles.hdr}>
      {/* 64px photo with its credit + license (list avatars are too small for one) */}
      <BirdPhoto
        photoUrl={sighting.photo_url}
        photoAttribution={sighting.photo_attribution}
        scientificName={sighting.scientific_name}
        commonName={sighting.common_name}
      />
      <View style={styles.hdrMain}>
        <Text style={[styles.badge, { backgroundColor: bird.tier.soft, color: bird.tier.color }]}>{bird.tier.name}</Text>
        <Text style={styles.name} numberOfLines={2}>
          {bird.count && bird.count > 1 ? `${bird.count}× ` : ''}{sighting.common_name}
        </Text>
        <Text style={styles.place} numberOfLines={1}>{place}</Text>
      </View>
      <Pressable style={styles.close} onPress={onClose} hitSlop={8} accessibilityLabel="Back to the list">
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

function DayStrip({ days }: { days: ClusterDay[] }) {
  return (
    <View style={styles.strip}>
      {days.map((d, i) => {
        const seen = d.sightings + d.refound > 0;
        const dipped = !seen && d.dipped > 0;
        const today = i === days.length - 1;
        return (
          <View
            key={d.date}
            style={[styles.day, { backgroundColor: seen ? colors.accentSoft : dipped ? colors.dippedSoft : colors.bg }]}
            accessibilityLabel={`${d.date}: ${d.sightings + d.refound} seen, ${d.dipped} dipped`}
          >
            <Text style={[styles.dayText, { color: seen ? colors.green : dipped ? colors.red : colors.gray }]}>
              {today ? 'Today' : String(Number(d.date.slice(8)))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function DetailBody({ detail, bird, sighting, onSelectReport, bottomPadding }: {
  detail: SightingDetailState;
  bird: Bird;
  sighting: Sighting;
  onSelectReport: (s: Sighting) => void;
  bottomPadding: number;
}) {
  const { cluster, payload, comments, commentsState, exactSpot, reportPoint } = detail;
  const scrollRef = useRef<ScrollView>(null);
  const notesY = useRef(0);

  const status = refoundLabel(bird) ?? (cluster ? cluster.status.label : statusWord(bird));
  const level = cluster?.status.level ?? bird.cluster?.status.level ?? 'gray';
  const weekReports = cluster?.days?.reduce((n, d) => n + d.sightings, 0);
  const noteCount = (payload?.observer_note ? 1 : 0) + comments.length;
  const target = exactSpot ?? reportPoint;

  return (
    <>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPadding + 24 }}>
        {cluster?.days?.length ? <DayStrip days={cluster.days} /> : null}

        {status ? (
          <Text style={[styles.status, { color: STATUS_DOT[level] }]}>
            ● {status}{weekReports ? ` · ${weekReports} report${weekReports === 1 ? '' : 's'} this week` : ''}
          </Text>
        ) : null}

        {sighting.cluster_id ? (
          <View style={styles.cta}>
            <Pressable style={[styles.ctaBtn, styles.ctaYes]} onPress={() => detail.openConfirm('refound')} disabled={detail.reporting}>
              <Text style={styles.ctaYesText}>✓ I refound it</Text>
            </Pressable>
            <Pressable style={[styles.ctaBtn, styles.ctaNo]} onPress={() => detail.openConfirm('dipped')} disabled={detail.reporting}>
              <Text style={styles.ctaNoText}>✗ I dipped</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.links}>
          {target ? (
            <Pressable onPress={() => openInMaps(target.lat, target.lng, exactSpot ? `${sighting.common_name} (observer's spot)` : sighting.common_name)}>
              <Text style={styles.link}>➤ Directions</Text>
            </Pressable>
          ) : null}
          {noteCount ? (
            <Pressable onPress={() => scrollRef.current?.scrollTo({ y: notesY.current, animated: true })}>
              <Text style={styles.link}>Notes ({noteCount})</Text>
            </Pressable>
          ) : null}
          {sighting.species_code ? (
            <Pressable onPress={() => Linking.openURL(`https://ebird.org/species/${encodeURIComponent(sighting.species_code!)}`)}>
              <Text style={styles.link}>eBird ↗</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Individual reports: each has its own coordinates and notes */}
        {bird.reports.length > 1 ? (
          <>
            <Text style={styles.section}>{bird.reports.length} reports · tap one for its exact spot and notes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {bird.reports.map(r => {
                const active = r.id === sighting.id;
                return (
                  <Pressable key={r.id} style={[styles.chip, active && styles.chipOn]} onPress={() => onSelectReport(r)}>
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>{formatDateTime(r.observed_at)}</Text>
                    <Text style={[styles.chipSub, active && styles.chipTextOn]}>{formatSource(r.source)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {reportPoint ? (
          <Pressable style={styles.mapsRow} onPress={() => openInMaps(reportPoint.lat, reportPoint.lng, sighting.common_name)}>
            <Text style={styles.mapsText}>
              📍 This report's location ({reportPoint.lat.toFixed(5)}, {reportPoint.lng.toFixed(5)})
            </Text>
          </Pressable>
        ) : null}
        {exactSpot && reportPoint ? (
          <Pressable style={styles.mapsRow} onPress={() => openInMaps(exactSpot.lat, exactSpot.lng, `${sighting.common_name} (observer's spot)`)}>
            <Text style={[styles.mapsText, styles.exactText]}>
              🎯 Observer's exact spot ({exactSpot.lat.toFixed(5)}, {exactSpot.lng.toFixed(5)}) · ~
              {formatDistance(distanceMetres(exactSpot.lat, exactSpot.lng, reportPoint.lat, reportPoint.lng))} from the report pin
            </Text>
          </Pressable>
        ) : null}

        {/* Notes */}
        <View onLayout={e => { notesY.current = e.nativeEvent.layout.y; }}>
          {commentsState === 'loading' ? (
            <View style={styles.notesHint}><ActivityIndicator color={colors.accent} /><Text style={styles.hint}>Loading notes…</Text></View>
          ) : commentsState === 'error' ? (
            <Text style={[styles.hint, styles.notesHint]}>Could not load notes</Text>
          ) : commentsState === 'done' && !noteCount ? (
            <Text style={[styles.hint, styles.notesHint]}>No observer notes or comments for this report</Text>
          ) : null}
          {payload?.observer_note ? (
            <View style={styles.note}>
              <Text style={styles.noteLabel}>Observer note</Text>
              <Text style={styles.noteText}>{payload.observer_note}</Text>
            </View>
          ) : null}
          {comments.map((c, i) => (
            <View key={i} style={styles.comment}>
              <View style={styles.commentAva}><Text style={styles.commentAvaText}>{c.author[0]?.toUpperCase() ?? '?'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.commentMeta}>
                  <Text style={styles.commentAuthor}>{c.author}</Text>
                  {c.created_at ? `  ${formatDate(c.created_at)}` : ''}
                </Text>
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <ConfirmReport detail={detail} />
    </>
  );
}

function ConfirmReport({ detail }: { detail: SightingDetailState }) {
  const { confirm, setConfirm, submitReport, reporting, reportError, userLocation, locationLoading, cluster } = detail;
  const dist = userLocation && cluster
    ? distanceMetres(userLocation.lat, userLocation.lng, cluster.center_lat, cluster.center_lng)
    : null;
  return (
    <Modal visible={confirm !== null} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
      <View style={styles.overlay}>
        <View style={styles.confirm}>
          <Text style={styles.confirmTitle}>{confirm === 'refound' ? '🐦 You found it!' : '😔 You dipped'}</Text>
          <Text style={styles.confirmBody}>
            {confirm === 'refound'
              ? 'Confirm you personally observed this bird right now at this location?'
              : 'Confirm you searched and could not find this bird?'}
          </Text>
          {locationLoading ? (
            <View style={styles.distRow}>
              <ActivityIndicator size="small" color={colors.muted} />
              <Text style={styles.distText}>Getting your location…</Text>
            </View>
          ) : dist != null ? (
            <>
              <Text style={[styles.distText, styles.distRow]}>📍 You are ~{formatDistance(dist)} from this spot</Text>
              {dist > 1000 ? <Text style={styles.far}>⚠️ You appear to be far from this location</Text> : null}
            </>
          ) : null}
          {reportError ? <Text style={styles.far}>{reportError}</Text> : null}
          <View style={styles.confirmBtns}>
            <Pressable style={styles.cancel} onPress={() => setConfirm(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.ok, { backgroundColor: confirm === 'refound' ? colors.accent : colors.red }]}
              onPress={() => confirm && submitReport(confirm)}
              disabled={reporting}
            >
              {reporting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.okText}>Yes, I'm sure</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // header
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 12 },
  hdrMain: { flex: 1, minWidth: 0 },
  badge: { alignSelf: 'flex-start', fontSize: 10.5, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.badge, overflow: 'hidden' },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginTop: 3 },
  place: { fontSize: 13, color: colors.muted, fontWeight: '500', marginTop: 1 },
  close: { alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 16, color: colors.text },

  // strip + status
  strip: { flexDirection: 'row', gap: 6, marginTop: 2, marginBottom: 10 },
  day: { flex: 1, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 10.5, fontWeight: '700' },
  status: { fontSize: 13, fontWeight: '600', marginBottom: 12 },

  // actions
  cta: { flexDirection: 'row', gap: 10 },
  ctaBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaYes: { backgroundColor: colors.accent },
  ctaNo: { backgroundColor: colors.dippedSoft },
  ctaYesText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  ctaNoText: { color: colors.red, fontWeight: '800', fontSize: 14 },
  links: { flexDirection: 'row', gap: 18, marginTop: 14, marginBottom: 6 },
  link: { fontSize: 13, fontWeight: '700', color: colors.accent },

  // reports
  section: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 14, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  chipSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  chipTextOn: { color: '#fff' },
  mapsRow: { marginTop: 10 },
  mapsText: { fontSize: 13, fontWeight: '600', color: '#1d4ed8' },
  exactText: { color: '#c2410c' },

  // notes
  notesHint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  hint: { fontSize: 13, color: colors.muted },
  note: { marginTop: 16, backgroundColor: '#f0f7f2', borderLeftWidth: 3, borderLeftColor: colors.accent, borderRadius: 8, padding: 12 },
  noteLabel: { fontSize: 11, fontWeight: '800', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  noteText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  comment: { flexDirection: 'row', gap: 10, marginTop: 14 },
  commentAva: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  commentAvaText: { fontSize: 13, fontWeight: '700', color: colors.accent },
  commentMeta: { fontSize: 11, color: colors.muted, marginBottom: 2 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: colors.text },
  commentText: { fontSize: 14, color: '#374151', lineHeight: 20 },

  // confirm dialog
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  confirm: { backgroundColor: colors.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: 24, paddingBottom: 40 },
  confirmTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
  confirmBody: { fontSize: 15, color: '#374151', lineHeight: 22 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  distText: { fontSize: 13, color: colors.muted },
  far: { fontSize: 13, color: '#b45309', marginTop: 8 },
  confirmBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancel: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center' },
  cancelText: { fontWeight: '700', color: colors.text },
  ok: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  okText: { fontWeight: '800', color: '#fff' },
});
