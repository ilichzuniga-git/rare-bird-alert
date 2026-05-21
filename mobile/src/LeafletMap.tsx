import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface MapPin {
  lat: number;
  lng: number;
  label: string;
  sciName?: string | null;
}

interface Props {
  pins: MapPin[];
  // If provided, map centers here at this zoom; otherwise fits all pins
  center?: { lat: number; lng: number };
  zoom?: number;
}

function buildHtml(pins: MapPin[], center?: { lat: number; lng: number }, zoom?: number): string {
  const pinsJson = JSON.stringify(pins);
  const centerJson = center ? JSON.stringify(center) : 'null';
  const zoomVal = zoom ?? 13;

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
  var pins = ${pinsJson};
  var center = ${centerJson};
  var zoom = ${zoomVal};

  var map;

  if (center) {
    map = L.map('map').setView([center.lat, center.lng], zoom);
  } else if (pins.length > 0) {
    // Will fit bounds after adding markers
    map = L.map('map');
  } else {
    // Default: LA area
    map = L.map('map').setView([34.05, -118.25], 10);
  }

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  var bounds = [];
  pins.forEach(function(pin) {
    var popup = '<b>' + pin.label + '</b>' + (pin.sciName ? '<br><i>' + pin.sciName + '</i>' : '');
    var marker = L.marker([pin.lat, pin.lng]).addTo(map).bindPopup(popup);
    if (pins.length === 1) marker.openPopup();
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

export default function LeafletMap({ pins, center, zoom }: Props) {
  const html = buildHtml(pins, center, zoom);
  return (
    <WebView
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
