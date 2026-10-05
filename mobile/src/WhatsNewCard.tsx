import { useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openGuide, WHATS_NEW, type GuideTab } from './guide';
import { colors, radius } from './theme';

/**
 * Shown once after an update (see WHATS_NEW in guide.ts): the release's highlights and a way
 * into the guide website. Any button, or tapping outside, counts as seen.
 */
export default function WhatsNewCard({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  // iOS won't present the browser while this modal is still closing, so wait for onDismiss there
  const pending = useRef<GuideTab | null>(null);
  const go = (tab: GuideTab) => {
    onDone();
    if (Platform.OS === 'ios') pending.current = tab;
    else openGuide(tab);
  };
  const dismissed = () => {
    if (pending.current) openGuide(pending.current);
    pending.current = null;
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone} onDismiss={dismissed} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onDone} accessibilityLabel="Close">
        {/* Inner Pressable swallows taps so only the backdrop closes the card */}
        <Pressable style={[styles.card, { marginBottom: insets.bottom + 16 }]} onPress={() => {}}>
          <Text style={styles.eyebrow}>What's new in {WHATS_NEW.version}</Text>
          <Text style={styles.title}>{WHATS_NEW.title}</Text>

          <View style={styles.list}>
            {WHATS_NEW.highlights.map(h => (
              <View key={h.text} style={styles.row}>
                <View style={styles.icon}><Text style={styles.iconText}>{h.icon}</Text></View>
                <Text style={styles.rowText}>{h.text}</Text>
              </View>
            ))}
          </View>

          <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={() => go('whats-new')}>
            <Text style={styles.primaryText}>See what's new</Text>
          </Pressable>
          <View style={styles.secondaryRow}>
            <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={() => go('tour')}>
              <Text style={styles.secondaryText}>Take the tour</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={onDone}>
              <Text style={[styles.secondaryText, styles.muted]}>Not now</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(16,26,21,0.45)', justifyContent: 'flex-end', paddingHorizontal: 12 },
  card: {
    backgroundColor: colors.card, borderRadius: radius.sheet, padding: 22, paddingTop: 24,
    width: '100%', maxWidth: 480, alignSelf: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  eyebrow: { fontSize: 11, fontWeight: '800', color: colors.accent, textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.6, marginTop: 4 },
  list: { gap: 14, marginTop: 18, marginBottom: 22 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 17 },
  rowText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text, paddingTop: 1 },
  primary: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secondary: { flex: 1, backgroundColor: colors.bg, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  muted: { color: colors.muted },
  pressed: { opacity: 0.7 },
});
