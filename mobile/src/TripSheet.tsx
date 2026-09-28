import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, FlatList, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import CarIcon from './CarIcon';
import { BirdRow } from './RaritiesSheet';
import { colors, radius } from './theme';
import { MAX_STOPS, type TripBird } from './trip';
import type { Bird } from './birds';

// ---------------------------------------------------------------------------
// Header (the draggable part of the sheet)
// ---------------------------------------------------------------------------

export function TripHeader({ count, stops, fromYou, onDirections, onClear, onClose }: {
  count: number;
  /** Stops with coordinates, i.e. what Directions can route through */
  stops: number;
  /** Route starts at the user's location (vs. the first saved bird) */
  fromYou: boolean;
  onDirections: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  // Clearing is a two-tap action so a stray tap doesn't lose the whole trip
  const [arming, setArming] = useState(false);
  useEffect(() => {
    if (!arming) return;
    const t = setTimeout(() => setArming(false), 3000);
    return () => clearTimeout(t);
  }, [arming]);

  const routed = Math.min(stops, MAX_STOPS);
  return (
    <View>
      <View style={styles.hd}>
        <View style={styles.badge}><CarIcon size={24} cut={colors.text} /></View>
        <View style={styles.hdMain}>
          <Text style={styles.title}>Trip</Text>
          <Text style={styles.sub}>
            {count === 0 ? `No birds saved yet · up to ${MAX_STOPS} stops`
              : count > MAX_STOPS ? `${count} birds · directions cover ${MAX_STOPS} stops`
              : `${count} of ${MAX_STOPS} stops · ${fromYou ? 'in driving order' : 'on this phone only'}`}
          </Text>
        </View>
        <Pressable style={styles.close} onPress={onClose} hitSlop={8} accessibilityLabel="Back to all rarities">
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      {count > 0 ? (
        <View style={styles.actions}>
          <Pressable style={[styles.btn, styles.go, !routed && styles.off]} onPress={onDirections} disabled={!routed}>
            <Text style={styles.goText}>
              ➤ Directions · {routed} stop{routed === 1 ? '' : 's'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btn, arming ? styles.clearArmed : styles.clear]}
            onPress={() => { if (arming) { setArming(false); onClear(); } else setArming(true); }}
          >
            <Text style={[styles.clearText, arming && styles.clearTextArmed]}>{arming ? 'Tap to clear' : 'Clear'}</Text>
          </Pressable>
        </View>
      ) : null}
      {stops > MAX_STOPS ? (
        <Text style={styles.over}>
          Google Maps directions take up to {MAX_STOPS} stops, so {stops === MAX_STOPS + 1 ? `stop ${stops} is` : `stops ${MAX_STOPS + 1}–${stops} are`} left out.
          Swipe some birds away to fit them in.
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// List: saved birds in route order, swipe sideways to remove
// ---------------------------------------------------------------------------

export function TripList({ route, distanceOf, onSelect, onRemove, bottomPadding }: {
  route: TripBird[];
  distanceOf: (b: Bird) => number | null;
  onSelect: (b: Bird) => void;
  onRemove: (key: string) => void;
  bottomPadding: number;
}) {
  if (!route.length) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}><CarIcon size={34} color={colors.accent} cut={colors.accentSoft} /></View>
        <Text style={styles.emptyTitle}>Plan a birding trip</Text>
        <Text style={styles.emptyText}>
          Open a bird and tap the car to save it here. You'll get its latest status and one-tap directions through up to {MAX_STOPS} stops.
        </Text>
        <Text style={styles.emptyNote}>Your trip is saved on this phone only. No account needed.</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={route}
      keyExtractor={t => t.bird.key}
      renderItem={({ item, index }) => (
        <>
        {index === MAX_STOPS ? <Text style={styles.cut}>Not in directions · over {MAX_STOPS} stops</Text> : null}
        <SwipeToRemove onRemove={() => onRemove(item.bird.key)}>
          <BirdRow
            bird={item.bird}
            first={index === 0 || index === MAX_STOPS}
            last={index === route.length - 1 || index === MAX_STOPS - 1}
            distance={distanceOf(item.bird)}
            onPress={() => onSelect(item.bird)}
            stop={index + 1}
            stale={item.stale}
          />
        </SwipeToRemove>
        </>
      )}
      ListFooterComponent={<Text style={styles.hint}>Swipe a bird sideways to remove it.</Text>}
      contentContainerStyle={{ paddingBottom: bottomPadding + 24 }}
      keyboardShouldPersistTaps="handled"
    />
  );
}

function SwipeToRemove({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const pan = useRef(PanResponder.create({
    // Only claim clearly sideways drags, so the list still scrolls and rows still tap
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => x.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > width * 0.35 || Math.abs(g.vx) > 0.8) {
        Animated.timing(x, { toValue: Math.sign(g.dx || g.vx) * width, duration: 160, useNativeDriver: true })
          .start(() => onRemove());
      } else {
        Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
      }
    },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
  })).current;
  const opacity = x.interpolate({ inputRange: [-width * 0.6, 0, width * 0.6], outputRange: [0.2, 1, 0.2] });
  return (
    <Animated.View style={{ transform: [{ translateX: x }], opacity }} {...pan.panHandlers}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hd: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  badge: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  hdMain: { flex: 1, minWidth: 0 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.6 },
  sub: { fontSize: 13, color: colors.muted, fontWeight: '500', marginTop: 1 },
  close: { alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 16, color: colors.text },

  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 14 },
  btn: { borderRadius: radius.control, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center' },
  go: { flex: 1, backgroundColor: colors.accent },
  off: { opacity: 0.5 },
  goText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  clear: { backgroundColor: colors.bg },
  clearArmed: { backgroundColor: colors.dippedSoft },
  clearText: { fontWeight: '700', fontSize: 14, color: colors.muted },
  clearTextArmed: { color: colors.red },

  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 32, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  emptyNote: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 4, fontWeight: '600' },
  over: {
    marginHorizontal: 20, marginTop: -4, marginBottom: 12, padding: 10, borderRadius: 10,
    backgroundColor: '#fdf3e1', color: '#8a5a00', fontSize: 12.5, fontWeight: '600', lineHeight: 17,
  },
  cut: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6, fontSize: 12, fontWeight: '800',
    letterSpacing: 0.8, textTransform: 'uppercase', color: colors.amber,
  },
  hint: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 14 },
});
