import type { ReactNode } from 'react';
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_VERSION, openGuide } from './guide';
import { colors, radius } from './theme';

/** Tappable inline link. */
function Link({ url, children }: { url: string; children: string }) {
  return (
    <Text style={styles.link} onPress={() => Linking.openURL(url)}>
      {children}
    </Text>
  );
}

/** Rounded pill link, like the Directions / Notes / eBird pills on a bird's page. */
function Pill({ label, onPress, tint = 'blue' }: { label: string; onPress: () => void; tint?: 'blue' | 'green' | 'teal' }) {
  return (
    <Pressable style={({ pressed }) => [styles.pill, styles[`pill_${tint}`], pressed && styles.pressed]} onPress={onPress}>
      <Text style={[styles.pillText, styles[`pillText_${tint}`]]}>{label}</Text>
    </Pressable>
  );
}

/** A white card: an emoji avatar, a name and a one-line role, then its body. */
function Card({ icon, title, role, children }: { icon: string; title: string; role?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.ava}><Text style={styles.avaText}>{icon}</Text></View>
        <View style={styles.cardHeadText}>
          <Text style={styles.cardTitle}>{title}</Text>
          {role ? <Text style={styles.cardRole}>{role}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const open = (url: string) => () => Linking.openURL(url);

/**
 * About / attribution screen. Keep in sync with docs/SOURCES.MD — the eBird
 * credit and photo-license terms here are what those sources require.
 */
export default function AboutModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  // iOS shows this as a page sheet (swipe down to close), which sits below the status bar.
  // Android draws it full screen, under the status bar, so pad by its height.
  const top = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) + 8 : 0;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: top }]}>
        <View style={styles.grab} />
        <View style={styles.hdr}>
          <View style={styles.logo}>
            <Image source={require('../assets/icon.png')} style={styles.logoImage} />
          </View>
          <View style={styles.hdrMain}>
            <Text style={styles.title}>About</Text>
            <Text style={styles.sub}>Birder's Best Friend{APP_VERSION ? ` · version ${APP_VERSION}` : ''}</Text>
          </View>
          <Pressable style={styles.close} onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={styles.intro}>
            Rare bird sightings in Los Angeles and Orange Counties, whether each bird is still being seen,
            and Refound or Dipped reports from birders. Free, non-commercial, no ads, no accounts.
          </Text>

          {/* The guide website: tour, what's new, privacy */}
          <View style={styles.guide}>
            <Text style={styles.guideEyebrow}>New to the app?</Text>
            <Text style={styles.guideTitle}>📖 The guide</Text>
            <Text style={styles.guideText}>A tour of every screen, and what changed in each update.</Text>
            <View style={styles.guideBtns}>
              <Pressable style={({ pressed }) => [styles.guideBtn, styles.guideBtnMain, pressed && styles.pressed]} onPress={() => openGuide('tour')}>
                <Text style={[styles.guideBtnText, styles.guideBtnMainText]}>Take the tour</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.guideBtn, pressed && styles.pressed]} onPress={() => openGuide('whats-new')}>
                <Text style={styles.guideBtnText}>What's new</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.group}>Where the birds come from</Text>

          <Card icon="🐦" title="eBird" role="Notable sightings, notes and hotspots">
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
            <View style={styles.pills}><Pill label="ebird.org ↗" tint="teal" onPress={open('https://ebird.org')} /></View>
          </Card>

          <Card icon="🔍" title="iNaturalist" role="Rare observations and bird photos">
            <Text style={styles.p}>
              Rare-bird observations and bird photos come from the iNaturalist community. Only "research grade"
              observations are shown: ones where at least two community members agree on the ID.
            </Text>
            <View style={styles.pills}><Pill label="inaturalist.org ↗" tint="green" onPress={open('https://www.inaturalist.org')} /></View>
          </Card>

          <Card icon="🎧" title="BirdWeather & BirdNET" role="Microphones that back up a report">
            <Text style={styles.p}>
              On rare birds that birders have already reported, the app may show "Also heard by a
              BirdWeather station": acoustic detections from nearby BirdWeather stations that picked up the
              same species on the same day. BirdWeather audio is processed by BirdNET (Cornell Lab of
              Ornithology and Chemnitz University of Technology). Used with BirdWeather's permission, only to
              support a report that people already made. These detections never create sightings, clusters,
              alerts, or push notifications on their own, and no audio is stored.
            </Text>
            <View style={styles.pills}>
              <Pill label="BirdWeather ↗" onPress={open('https://www.birdweather.com')} />
              <Pill label="BirdNET ↗" onPress={open('https://birdnet.cornell.edu')} />
            </View>
          </Card>

          <Text style={styles.group}>Photos and maps</Text>

          <Card icon="📷" title="Photos" role="Shared by iNaturalist photographers">
            <Text style={styles.p}>
              Bird photos belong to the photographers who shared them on iNaturalist under Creative Commons
              licenses. Each photo shows its credit and license in the corner, as the license requires.
            </Text>
            <Text style={styles.p}>
              Because this app is non-commercial, it shows photos licensed CC0, CC BY, CC BY-SA, CC BY-ND,
              and the non-commercial variants CC BY-NC, CC BY-NC-SA and CC BY-NC-ND. Photos marked "all
              rights reserved" are never shown. Tapping a photo opens the species page on{' '}
              <Link url="https://www.allaboutbirds.org">All About Birds</Link>.
            </Text>
            <View style={styles.pills}><Pill label="License terms ↗" onPress={open('https://creativecommons.org/licenses/')} /></View>
          </Card>

          <Card icon="🗺️" title="Maps" role="OpenStreetMap and Leaflet">
            <Text style={styles.p}>
              Map data © <Link url="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</Link>,
              available under the Open Database License. Maps are drawn with{' '}
              <Link url="https://leafletjs.com">Leaflet</Link>.
            </Text>
          </Card>

          <Text style={styles.group}>Your data</Text>

          <Card icon="🔒" title="Private by design" role="No accounts, no tracking">
            <Text style={styles.p}>
              Refound and Dipped reports are anonymous: they record only the bird, which button you tapped,
              and when. Your location stays on your phone, where it sorts birds by distance and shows how far
              you are from a bird. Push notifications use an anonymous device token, with a count of alerts
              since you last opened the app for the number on its icon.
            </Text>
            <View style={styles.pills}><Pill label="Privacy policy" tint="green" onPress={() => openGuide('privacy')} /></View>
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.grab, marginTop: 8, marginBottom: 4 },

  // Header, like the bird page's: icon, title, close
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  logo: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#1a7392', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // The app icon has wide padding around the pin; oversize it so the pin fills the tile
  logoImage: { width: 72, height: 72 },
  hdrMain: { flex: 1, minWidth: 0 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.6 },
  sub: { fontSize: 13, color: colors.muted, fontWeight: '500', marginTop: 1 },
  close: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 16, color: colors.text },

  body: { paddingHorizontal: 16, gap: 12 },
  intro: { fontSize: 14, lineHeight: 20, color: colors.text, paddingHorizontal: 4, marginBottom: 4 },
  group: {
    paddingHorizontal: 4, paddingTop: 12, fontSize: 12, fontWeight: '800',
    letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted,
  },

  // The guide: a teal hero card, like the rarest-bird card on the list
  guide: { backgroundColor: colors.heroFrom, borderRadius: radius.hero, padding: 18 },
  guideEyebrow: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 1.1 },
  guideTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.4, marginTop: 4 },
  guideText: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  guideBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  guideBtn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  guideBtnMain: { backgroundColor: '#fff' },
  guideBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  guideBtnMainText: { color: colors.heroFrom },

  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 16, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ava: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  avaText: { fontSize: 19 },
  cardHeadText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  cardRole: { fontSize: 12.5, color: colors.muted, fontWeight: '500', marginTop: 1 },
  p: { fontSize: 14, lineHeight: 20, color: '#374151' },
  credit: { backgroundColor: '#f0f7f2', borderLeftWidth: 3, borderLeftColor: colors.accent, borderRadius: 8, padding: 12 },
  creditText: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  link: { color: '#1d4ed8', fontWeight: '600' },

  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  pillText: { fontSize: 13, fontWeight: '700' },
  pill_blue: { backgroundColor: '#e8effd' },
  pillText_blue: { color: '#1d4ed8' },
  pill_green: { backgroundColor: colors.accentSoft },
  pillText_green: { color: colors.accent },
  pill_teal: { backgroundColor: '#e3eff4' },
  pillText_teal: { color: colors.heroFrom },
  pressed: { opacity: 0.7 },
});
