import type { ReactNode } from 'react';
import {
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

/** Tappable inline link. */
function Link({ url, children }: { url: string; children: string }) {
  return (
    <Text style={styles.link} onPress={() => Linking.openURL(url)}>
      {children}
    </Text>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * About / attribution screen. Keep in sync with docs/SOURCES.MD — the eBird
 * credit and photo-license terms here are what those sources require.
 */
export default function AboutModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#2d6a4f' }}>
        <View style={[styles.header, { paddingTop: (Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0) + 12 }]}>
          <Text style={styles.headerTitle}>About</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.intro}>
            Birder's Best Friend shows rare bird sightings in Los Angeles and Orange Counties, tracks
            whether a bird is still being seen, and lets birders report Refound or Dipped. It is free,
            non-commercial, and has no ads.
          </Text>

          <Section title="eBird">
            <View style={styles.credit}>
              <Text style={styles.creditText}>
                Data from eBird (Cornell Lab of Ornithology, <Link url="https://ebird.org">ebird.org</Link>)
              </Text>
            </View>
            <Text style={styles.p}>
              Notable sightings, observer notes, hotspot links and species pages come from the eBird API,
              used under its non-commercial terms. Notable sightings are reported by eBird users and may
              not yet have been confirmed by eBird's regional reviewers. This app is not affiliated with or
              endorsed by the Cornell Lab.
            </Text>
          </Section>

          <Section title="iNaturalist">
            <Text style={styles.p}>
              Rare-bird observations and bird photos come from the{' '}
              <Link url="https://www.inaturalist.org">iNaturalist</Link> community. Only "research grade"
              observations are shown — ones where at least two community members agree on the ID.
            </Text>
          </Section>

          <Section title="Photos">
            <Text style={styles.p}>
              Bird photos belong to the photographers who shared them on iNaturalist under Creative Commons
              licenses. Each photo shows its credit and license in the corner, as the license requires.
            </Text>
            <Text style={styles.p}>
              Because this app is non-commercial, it shows photos licensed CC0, CC BY, CC BY-SA, CC BY-ND,
              and the non-commercial variants CC BY-NC, CC BY-NC-SA and CC BY-NC-ND. Photos marked "all
              rights reserved" are never shown. See{' '}
              <Link url="https://creativecommons.org/licenses/">creativecommons.org/licenses</Link> for the
              license terms.
            </Text>
            <Text style={styles.p}>
              Tapping a photo opens the species page on{' '}
              <Link url="https://www.allaboutbirds.org">All About Birds</Link>.
            </Text>
          </Section>

          <Section title="Maps">
            <Text style={styles.p}>
              Map data © <Link url="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</Link>,
              available under the Open Database License. Maps are drawn with{' '}
              <Link url="https://leafletjs.com">Leaflet</Link>.
            </Text>
          </Section>

          <Section title="Your data">
            <Text style={styles.p}>
              There are no accounts. Refound and Dipped reports are anonymous; if you allow location access,
              your position at the time of the report is sent with it so others can judge how close you
              were. Push notifications use an anonymous device token.
            </Text>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#2d6a4f', paddingHorizontal: 20, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  doneBtn: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  doneText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  body: { flex: 1, backgroundColor: '#fff' },
  bodyContent: { padding: 20, paddingBottom: 48, gap: 20 },
  intro: { fontSize: 15, lineHeight: 22, color: '#1e293b' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 },
  p: { fontSize: 14, lineHeight: 21, color: '#334155' },
  credit: { backgroundColor: '#ecf4ed', borderLeftWidth: 3, borderLeftColor: '#2d6a4f', padding: 12, borderRadius: 6 },
  creditText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  link: { color: '#1d4ed8', textDecorationLine: 'underline' },
});
