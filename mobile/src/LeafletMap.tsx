import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface MapPin {
  lat: number;
  lng: number;
  label: string;
  sciName?: string | null;
  /** If true, render as a smaller "trail" dot (older sighting in a cluster) */
  isTrail?: boolean;
}

export interface ClusterCircle {
  lat: number;
  lng: number;
  radiusM: number;
}

interface Props {
  pins: MapPin[];
  center?: { lat: number; lng: number };
  zoom?: number;
  /** If provided, draws a shaded circle showing the cluster stakeout area */
  clusterCircle?: ClusterCircle | null;
}

function buildHtml(
  pins: MapPin[],
  center?: { lat: number; lng: number },
  zoom?: number,
  clusterCircle?: ClusterCircle | null,
): string {
  const pinsJson        = JSON.stringify(pins);
  const centerJson      = center ? JSON.stringify(center) : 'null';
  const circleJson      = clusterCircle ? JSON.stringify(clusterCircle) : 'null';
  const zoomVal         = zoom ?? 13;

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var pins   = ${pinsJson};
  var center = ${centerJson};
  var zoom   = ${zoomVal};
  var circle = ${circleJson};

  var map;
  if (center) {
    map = L.map('map').setView([center.lat, center.lng], zoom);
  } else if (pins.length > 0) {
    map = L.map('map');
  } else {
    map = L.map('map').setView([34.05, -118.25], 10);
  }

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  // Cluster stakeout circle
  if (circle) {
    L.circle([circle.lat, circle.lng], {
      radius: circle.radiusM,
      color: '#2d6a4f',
      fillColor: '#52b788',
      fillOpacity: 0.12,
      weight: 2,
      dashArray: '6 4',
    }).addTo(map);
  }

  // Primary bird icon
  var birdIcon = L.divIcon({
    className: '',
    html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 50" width="36" height="30"><ellipse cx="24" cy="32" rx="14" ry="10" fill="#1d4ed8" transform="rotate(-10 24 32)"/><circle cx="40" cy="22" r="9" fill="#1d4ed8"/><polygon points="48,20 58,22 48,24" fill="#f59e0b"/><polygon points="10,28 0,20 10,38" fill="#1d4ed8"/></svg>',
    iconSize: [36, 30],
    iconAnchor: [18, 30],
    popupAnchor: [0, -30]
  });

  // Smaller trail dot for older cluster sightings
  var trailIcon = L.divIcon({
    className: '',
    html: '<div style="width:10px;height:10px;border-radius:50%;background:#52b788;border:2px solid #2d6a4f;opacity:0.75;"></div>',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

  var bounds = [];
  pins.forEach(function(pin) {
    var icon = pin.isTrail ? trailIcon : birdIcon;
    var popup = '<b>' + pin.label + '</b>' + (pin.sciName ? '<br><i>' + pin.sciName + '</i>' : '');
    var marker = L.marker([pin.lat, pin.lng], { icon: icon }).addTo(map);
    if (!pin.isTrail) marker.bindPopup(popup);
    if (pins.length === 1 && !pin.isTrail) marker.openPopup();
    bounds.push([pin.lat, pin.lng]);
  });

  if (!center && bounds.length > 0) {
    if (bounds.length === 1) {
      map.setView(bounds[0], zoom);
    } else {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }
</script>
</body>
</html>`;
}

export default function LeafletMap({ pins, center, zoom, clusterCircle }: Props) {
  const html = buildHtml(pins, center, zoom, clusterCircle);
  // Force WebView to remount when the circle arrives (cluster loads async after map renders)
  const webViewKey = clusterCircle
    ? `circle-${clusterCircle.lat}-${clusterCircle.lng}-${clusterCircle.radiusM}`
    : `no-circle-${pins.length}`;
  return (
    <WebView
      key={webViewKey}
      style={styles.map}
      source={{ html }}
      originWhitelist={['*']}
      javaScriptEnabled
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
