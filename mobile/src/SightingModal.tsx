import { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  StatusBar as RNStatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Location from 'expo-location';
import LeafletMap, { type MapPin, type ClusterCircle } from './LeafletMap';
import BirdPhoto from './BirdPhoto';
import { API_BASE, distanceMetres, formatDistance, formatSource, formatDate, formatDateTime, openInMaps, findNoteCoordinates, toPin } from './util';
import type { Sighting, ClusterData, CommentsPayload } from './types';

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
  } catch (e) {
    // Sound is best-effort — never block the UI
  }
}

const STATUS_COLORS: Record<string, string> = {
  green: '#2d6a4f', amber: '#b45309', red: '#b91c1c', gray: '#64748b',
};

export default function MapModal({
  sighting,
  reports,
  onSelectReport,
  onClose,
}: {
  sighting: Sighting | null;
  /** Every report of this bird (same cluster), newest first — includes `sighting` */
  reports: Sighting[];
  onSelectReport: (s: Sighting) => void;
  onClose: () => void;
}) {
  const [commentsState, setCommentsState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [payload, setPayload] = useState<CommentsPayload | null>(null);
  const [cluster, setCluster] = useState<ClusterData | null>(null);
  // confirm: null=hidden, 'refound'|'dipped'=waiting for user confirmation
  const [confirm, setConfirm] = useState<'refound' | 'dipped' | null>(null);
  const [reporting, setReporting] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    if (!sighting) {
      setCommentsState('idle'); setPayload(null); setCluster(null); setConfirm(null);
      return;
    }
    // Fetch comments
    setCommentsState('loading'); setPayload(null);
    fetch(`${API_BASE}/api/sightings/${sighting.id}/comments`)
      .then(async r => {
        const data = await r.json();
        // Always settle as 'done' — backend now returns empty arrays instead of errors
        setPayload(data);
        setCommentsState('done');
      })
      .catch(() => setCommentsState('error'));

    // Fetch cluster if this sighting belongs to one
    if (sighting.cluster_id) {
      fetch(`${API_BASE}/api/clusters/${sighting.cluster_id}`)
        .then(r => r.json())
        .then(data => setCluster(data.cluster ?? null))
        .catch(() => {});
    } else {
      setCluster(null);
    }
  }, [sighting?.id]);

  /** Request GPS and store result in userLocation when confirm sheet opens. */
  const openConfirm = async (type: 'refound' | 'dipped') => {
    setConfirm(type);
    setUserLocation(null);
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    } catch (_) {
      // GPS is best-effort — the report can still be submitted without it
    }
    setLocationLoading(false);
  };

  const submitReport = async (type: 'refound' | 'dipped') => {
    if (!sighting?.cluster_id) return;
    setReporting(true);
    try {
      const body: Record<string, unknown> = { type };
      if (userLocation) {
        body.lat = userLocation.lat;
        body.lng = userLocation.lng;
      }
      const res = await fetch(`${API_BASE}/api/clusters/${sighting.cluster_id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok && cluster) {
        setCluster(prev => prev ? { ...prev, status: data.status } : prev);
      }
      if (type === 'refound') await playChirp();
    } catch (_) {}
    setReporting(false);
    setConfirm(null);
  };

  const comments = payload?.comments ?? [];
  const hasContent = payload && (payload.observer_note || comments.length > 0);

  const reportPoint = sighting?.lat != null && sighting?.lng != null
    ? { lat: Number(sighting.lat), lng: Number(sighting.lng) }
    : null;
  const exactSpot = useMemo(
    () => reportPoint && payload
      ? findNoteCoordinates([payload.observer_note, ...comments.map(c => c.text)], reportPoint)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload, reportPoint?.lat, reportPoint?.lng]
  );

  // Build map pins: trail dots for older cluster sightings, main pin for this one
  const mapPins: MapPin[] = [];
  if (cluster?.sighting_pins) {
    for (const p of cluster.sighting_pins) {
      if (p.lat && p.lng) {
        mapPins.push({ lat: p.lat, lng: p.lng, label: sighting?.common_name ?? '', isTrail: true });
      }
    }
  }
  if (sighting?.lat != null && sighting?.lng != null) {
    mapPins.push(toPin(sighting)!);
  }
  if (exactSpot) {
    mapPins.push({ ...exactSpot, label: "Observer's exact spot (from notes)", isExact: true });
  }

  const clusterCircle: ClusterCircle | null = cluster
    ? { lat: cluster.center_lat, lng: cluster.center_lng, radiusM: cluster.radius_m }
    : null;

  const statusColor = cluster ? STATUS_COLORS[cluster.status.level] ?? '#64748b' : null;

  return (
    <Modal visible={sighting !== null} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#2d6a4f' }}>
        {/* Header */}
        <View style={[styles.modalHeader, { paddingTop: (Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0) + 12 }]}>
          {/* Photo with its full credit + license: the list's small avatars have no room for one */}
          {sighting ? (
            <View>
              <BirdPhoto
                photoUrl={sighting.photo_url}
                photoAttribution={sighting.photo_attribution}
                scientificName={sighting.scientific_name}
                commonName={sighting.common_name}
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle} numberOfLines={1}>{sighting?.common_name}</Text>
            {sighting?.location_name ? (
              <Text style={styles.modalSub} numberOfLines={1}>{sighting.location_name}</Text>
            ) : null}
            {cluster && (
              <Text style={[styles.modalStatus, { color: statusColor ?? '#b7e4c7' }]} numberOfLines={1}>
                {cluster.status.label}
              </Text>
            )}
            {sighting?.species_code ? (
              <TouchableOpacity
                style={styles.speciesLink}
                onPress={() => Linking.openURL(`https://ebird.org/species/${encodeURIComponent(sighting.species_code!)}`)}
              >
                <Text style={styles.speciesLinkText}>eBird species page ↗</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Map */}
        {sighting ? (
          <View style={styles.modalMapContainer}>
            <LeafletMap
              pins={mapPins.length > 0 ? mapPins : [toPin(sighting)!].filter(Boolean) as MapPin[]}
              center={sighting.lat != null && sighting.lng != null ? { lat: Number(sighting.lat), lng: Number(sighting.lng) } : undefined}
              zoom={15}
              clusterCircle={clusterCircle}
            />
          </View>
        ) : (
          <View style={[styles.modalMapContainer, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a3a2a' }]}>
            <Text style={{ color: '#aaa', fontSize: 14 }}>No location data</Text>
          </View>
        )}

        {/* Refound / Dipped buttons */}
        {sighting?.cluster_id && (
          <View style={styles.reportBar}>
            <TouchableOpacity
              style={[styles.reportBtn, styles.refoundBtn]}
              onPress={() => openConfirm('refound')}
              disabled={reporting}
            >
              <Text style={styles.reportBtnText}>✓ Refound</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reportBtn, styles.dippedBtn]}
              onPress={() => openConfirm('dipped')}
              disabled={reporting}
            >
              <Text style={styles.reportBtnText}>✗ Dipped</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Which report is shown, and its exact spot */}
        {sighting ? (
          <View style={styles.reportsBar}>
            {reports.length > 1 ? (
              <>
                <Text style={styles.reportsHeading}>
                  {reports.length} reports of this bird — tap one for its exact spot and notes
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {reports.map(r => {
                    const active = r.id === sighting.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.reportChip, active && styles.reportChipActive]}
                        onPress={() => onSelectReport(r)}
                      >
                        <Text style={[styles.reportChipText, active && styles.reportChipTextActive]}>
                          {formatDateTime(r.observed_at)}
                        </Text>
                        <Text style={[styles.reportChipSub, active && styles.reportChipTextActive]}>
                          {formatSource(r.source)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}
            {sighting.lat != null && sighting.lng != null ? (
              <TouchableOpacity
                style={styles.openMapsBtn}
                onPress={() => openInMaps(Number(sighting.lat), Number(sighting.lng), sighting.common_name)}
              >
                <Text style={styles.openMapsText}>
                  📍 Open this report's location in Maps ({Number(sighting.lat).toFixed(5)}, {Number(sighting.lng).toFixed(5)})
                </Text>
              </TouchableOpacity>
            ) : null}
            {exactSpot && reportPoint ? (
              <TouchableOpacity
                style={styles.openMapsBtn}
                onPress={() => openInMaps(exactSpot.lat, exactSpot.lng, `${sighting.common_name} (observer's spot)`)}
              >
                <Text style={[styles.openMapsText, styles.exactSpotText]}>
                  🎯 Open observer's exact spot in Maps ({exactSpot.lat.toFixed(5)}, {exactSpot.lng.toFixed(5)})
                  {' · '}~{formatDistance(distanceMetres(exactSpot.lat, exactSpot.lng, reportPoint.lat, reportPoint.lng))} from the report pin
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

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
              {payload?.observer_note ? (
                <View style={styles.commentNote}>
                  <Text style={styles.commentNoteLabel}>Observer note</Text>
                  <Text style={styles.commentNoteText}>{payload.observer_note}</Text>
                </View>
              ) : null}
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
      </View>

      {/* Confirmation sheet */}
      <Modal visible={confirm !== null} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>
              {confirm === 'refound' ? '🐦 You found it!' : '😔 You dipped'}
            </Text>
            <Text style={styles.confirmBody}>
              {confirm === 'refound'
                ? 'Confirm you personally observed this bird right now at this location?'
                : 'Confirm you searched and could not find this bird?'}
            </Text>
            {/* GPS distance row */}
            {locationLoading ? (
              <View style={styles.confirmDistRow}>
                <ActivityIndicator size="small" color="#64748b" style={{ marginRight: 6 }} />
                <Text style={styles.confirmDistText}>Getting your location…</Text>
              </View>
            ) : userLocation && cluster ? (() => {
              const distM = distanceMetres(
                userLocation.lat, userLocation.lng,
                cluster.center_lat, cluster.center_lng,
              );
              const isFar = distM > 1000;
              return (
                <View>
                  <View style={styles.confirmDistRow}>
                    <Text style={styles.confirmDistText}>
                      📍 You are ~{formatDistance(distM)} from this spot
                    </Text>
                  </View>
                  {isFar && (
                    <View style={styles.confirmDistWarning}>
                      <Text style={styles.confirmDistWarningText}>
                        ⚠️ You appear to be far from this location
                      </Text>
                    </View>
                  )}
                </View>
              );
            })() : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirm(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmOk, confirm === 'refound' ? styles.confirmOkGreen : styles.confirmOkRed]}
                onPress={() => confirm && submitReport(confirm)}
                disabled={reporting}
              >
                {reporting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmOkText}>Yes, I'm sure</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalHeader: {
    backgroundColor: '#2d6a4f', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  modalSub: { fontSize: 13, color: '#b7e4c7', marginTop: 2 },
  modalStatus: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  reportBar: { flexDirection: 'row', backgroundColor: '#1a3a2a', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  reportBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  refoundBtn: { backgroundColor: '#2d6a4f' },
  dippedBtn:  { backgroundColor: '#7f1d1d' },
  reportBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'flex-end' },
  confirmSheet: { width: '100%', backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
  confirmTitle: { fontSize: 20, fontWeight: '700', color: '#1a3a2a', textAlign: 'center' },
  confirmBody:  { fontSize: 15, color: '#374151', textAlign: 'center', lineHeight: 22 },
  confirmButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  confirmCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  confirmCancelText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  confirmOk: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmOkGreen: { backgroundColor: '#2d6a4f' },
  confirmOkRed:   { backgroundColor: '#b91c1c' },
  confirmOkText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  confirmDistRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginTop: 4 },
  confirmDistText: { fontSize: 13, color: '#475569' },
  confirmDistWarning: { backgroundColor: '#fffbeb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6 },
  confirmDistWarningText: { fontSize: 13, color: '#b45309' },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  closeBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  speciesLink: {
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)',
  },
  speciesLinkText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  modalMapContainer: { flex: 2 },
  reportsBar: {
    backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  reportsHeading: { fontSize: 12, color: '#64748b' },
  reportChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1',
  },
  reportChipActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  reportChipText: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  reportChipSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  reportChipTextActive: { color: '#fff' },
  openMapsBtn: { paddingVertical: 2 },
  openMapsText: { fontSize: 13, color: '#1d4ed8', fontWeight: '600' },
  exactSpotText: { color: '#c2410c' },
  commentsPanel: { flex: 1, backgroundColor: '#fff', minHeight: 0 },
  commentsCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  commentsHint: { fontSize: 14, color: '#888', textAlign: 'center' },
  commentsHeading: { fontSize: 13, fontWeight: '700', color: '#4a7c59', textTransform: 'uppercase', letterSpacing: 0.5 },
  commentNote: { backgroundColor: '#f0f7f2', borderLeftWidth: 3, borderLeftColor: '#2d6a4f', borderRadius: 6, padding: 12 },
  commentNoteLabel: { fontSize: 11, fontWeight: '700', color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  commentNoteText: { fontSize: 14, color: '#1a3a2a', lineHeight: 20 },
  commentRow: { flexDirection: 'row', gap: 10 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2d6a4f', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#1a3a2a' },
  commentDate: { fontSize: 11, color: '#888' },
  commentText: { fontSize: 14, color: '#374151', lineHeight: 20 },
});
