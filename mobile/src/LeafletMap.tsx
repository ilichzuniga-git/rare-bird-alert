import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface MapPin {
  lat: number;
  lng: number;
  label: string;
  sciName?: string | null;
  /** Sighting id — when set and onPinPress is given, tapping the pin reports it */
  id?: number;
  /** Secondary text shown when several pins share a spot (e.g. the date) */
  sublabel?: string;
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
  /** Called with a pin's id when the user taps it (pins sharing a spot show a picker first) */
  onPinPress?: (id: number) => void;
}

function buildHtml(
  pins: MapPin[],
  center?: { lat: number; lng: number },
  zoom?: number,
  clusterCircle?: ClusterCircle | null,
  interactive?: boolean,
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
  var interactive = ${interactive ? 'true' : 'false'};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function openSighting(id) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'openSighting', id: id }));
    }
  }

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
  var groups = {}; // interactive mode: pins at the same spot share one marker
  pins.forEach(function(pin) {
    bounds.push([pin.lat, pin.lng]);
    if (interactive && !pin.isTrail && pin.id != null) {
      // lat/lng arrive as strings (Postgres NUMERIC via pg), so coerce first
      var key = Number(pin.lat).toFixed(5) + ',' + Number(pin.lng).toFixed(5);
      (groups[key] = groups[key] || []).push(pin);
      return;
    }
    var icon = pin.isTrail ? trailIcon : birdIcon;
    var popup = '<b>' + esc(pin.label) + '</b>' + (pin.sciName ? '<br><i>' + esc(pin.sciName) + '</i>' : '');
    var marker = L.marker([pin.lat, pin.lng], { icon: icon }).addTo(map);
    if (!pin.isTrail) marker.bindPopup(popup);
    if (pins.length === 1 && !pin.isTrail) marker.openPopup();
  });

  Object.keys(groups).forEach(function(key) {
    var group = groups[key];
    var marker = L.marker([group[0].lat, group[0].lng], { icon: birdIcon }).addTo(map);
    if (group.length === 1) {
      marker.on('click', function() { openSighting(group[0].id); });
      return;
    }
    // Several birds at one spot (e.g. a busy hotspot): let the user pick
    var html = '<div style="font-size:13px;max-height:220px;overflow-y:auto;">'
      + '<div style="color:#64748b;margin-bottom:6px;">' + group.length + ' sightings here</div>';
    group.forEach(function(p) {
      html += '<a href="#" onclick="openSighting(' + Number(p.id) + ');return false;" '
        + 'style="display:block;padding:7px 0;border-top:1px solid #e2e8f0;color:#1d4ed8;text-decoration:none;">'
        + '<b>' + esc(p.label) + '</b>'
        + (p.sublabel ? ' <span style="color:#64748b;">· ' + esc(p.sublabel) + '</span>' : '')
        + '</a>';
    });
    marker.bindPopup(html + '</div>');
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

export default function LeafletMap({ pins, center, zoom, clusterCircle, onPinPress }: Props) {
  const html = buildHtml(pins, center, zoom, clusterCircle, !!onPinPress);
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
      onMessage={event => {
        if (!onPinPress) return;
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          if (msg?.type === 'openSighting' && typeof msg.id === 'number') onPinPress(msg.id);
        } catch {
          // ignore non-JSON messages
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
