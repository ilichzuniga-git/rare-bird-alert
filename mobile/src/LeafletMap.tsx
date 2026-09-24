import { useEffect, useMemo, useRef } from 'react';
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
  /** If true, render as a target marker: a precise spot parsed from observer notes */
  isExact?: boolean;
  /** Teardrop pin in this color (rarity tier) instead of the default bird icon */
  color?: string;
  /** Show the bird's name in a tag next to the pin */
  tag?: boolean;
  /** Highlight as the currently selected bird */
  selected?: boolean;
}

/** A bird shown in detail on the main map: stakeout circle, earlier reports, observer's spot. */
export interface MapFocus {
  lat: number;
  lng: number;
  circle?: ClusterCircle | null;
  trail?: { lat: number; lng: number }[];
  exact?: { lat: number; lng: number } | null;
}

/** The user's approximate position ("Near me"): binoculars pin inside an accuracy halo. */
export interface UserSpot {
  lat: number;
  lng: number;
  accuracyM?: number | null;
}

export interface ClusterCircle {
  lat: number;
  lng: number;
  radiusM: number;
}

/** Screen space covered by floating UI, so fitting the pins doesn't hide them underneath. */
export interface MapInsets {
  top: number;
  bottom: number;
}

interface Props {
  pins: MapPin[];
  center?: { lat: number; lng: number };
  zoom?: number;
  /** If provided, draws a shaded circle showing the cluster stakeout area */
  clusterCircle?: ClusterCircle | null;
  /** Called with a pin's id when the user taps it (pins sharing a spot show a picker first) */
  onPinPress?: (id: number) => void;
  /** Full-screen mode: no zoom buttons, attribution moved to the top, fit padded by insets */
  insets?: MapInsets;
  /** Pins are re-fitted into view whenever this changes (e.g. a new filter or search) */
  fitKey?: string;
  /** Fly to and decorate this bird; null clears it (the view stays where it is) */
  focus?: MapFocus | null;
  /** Show where the user is; null hides it */
  me?: UserSpot | null;
}

// White bird silhouette from the design renders (renders/shared.js)
// White binoculars for the user's pin (24×24 box; lenses cut out in the pin color)
const BINOCULARS_SVG =
  '<svg viewBox="0 0 24 24"><g fill="#fff">'
  + '<rect x="5" y="4" width="4" height="6" rx="1"/><rect x="15" y="4" width="4" height="6" rx="1"/>'
  + '<rect x="9" y="9" width="6" height="4" rx="1"/>'
  + '<circle cx="7" cy="15" r="5"/><circle cx="17" cy="15" r="5"/></g>'
  + '<g fill="#101a15"><circle cx="7" cy="15" r="2.4"/><circle cx="17" cy="15" r="2.4"/></g></svg>';

const BIRD_PATH =
  'M9 40c7 0 12-4 16-10 4-7 9-11 16-11 5 0 8 3 10 6l8 2-7 3c-1 10-8 17-19 18l-3 8h-4l1-7c-7-1-13-4-18-9z';

function buildHtml(
  pins: MapPin[],
  center: { lat: number; lng: number } | undefined,
  zoom: number | undefined,
  clusterCircle: ClusterCircle | null | undefined,
  interactive: boolean,
  insets: MapInsets | undefined,
): string {
  const centerJson = center ? JSON.stringify(center) : 'null';
  const circleJson = clusterCircle ? JSON.stringify(clusterCircle) : 'null';
  const insetsJson = insets ? JSON.stringify(insets) : 'null';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .tp { width: 30px; height: 30px; border-radius: 50% 50% 50% 4px; transform: rotate(-45deg);
          border: 3px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,.25);
          display: flex; align-items: center; justify-content: center; }
    .tp svg { width: 16px; height: 16px; transform: rotate(45deg); }
    .tp.sel { box-shadow: 0 0 0 6px rgba(31,122,85,.28), 0 4px 10px rgba(0,0,0,.25); }
    .me { width: 34px; height: 34px; border-radius: 50% 50% 50% 4px; transform: rotate(-45deg);
          background: #101a15; border: 3px solid #fff;
          box-shadow: 0 0 0 5px rgba(16,26,21,.18), 0 4px 10px rgba(0,0,0,.3);
          display: flex; align-items: center; justify-content: center; }
    .me svg { width: 19px; height: 19px; transform: rotate(45deg); }
    .tag { position: absolute; left: 30px; top: -2px; background: #fff; border-radius: 9px;
           padding: 3px 8px; font: 700 11px system-ui, sans-serif; color: #101a15;
           white-space: nowrap; box-shadow: 0 3px 10px rgba(0,0,0,.14); }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var center = ${centerJson};
  var zoom   = ${zoom ?? 13};
  var circle = ${circleJson};
  var insets = ${insetsJson};
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

  var map = L.map('map', { zoomControl: !insets, attributionControl: false });
  map.setView(center ? [center.lat, center.lng] : [33.9, -118.2], center ? zoom : 9);
  // OSM attribution is required; in full-screen mode the bottom is covered by the sheet
  L.control.attribution({ position: insets ? 'topright' : 'bottomright' }).addTo(map);
  if (insets) {
    var s = document.createElement('style');
    s.textContent = '.leaflet-top.leaflet-right { margin-top: ' + insets.top + 'px; }';
    document.head.appendChild(s);
  }

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  // Cluster stakeout circle
  if (circle) {
    L.circle([circle.lat, circle.lng], {
      radius: circle.radiusM, color: '#2d6a4f', fillColor: '#52b788',
      fillOpacity: 0.12, weight: 2, dashArray: '6 4',
    }).addTo(map);
  }

  var birdIcon = L.divIcon({
    className: '',
    html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 50" width="36" height="30"><ellipse cx="24" cy="32" rx="14" ry="10" fill="#1d4ed8" transform="rotate(-10 24 32)"/><circle cx="40" cy="22" r="9" fill="#1d4ed8"/><polygon points="48,20 58,22 48,24" fill="#f59e0b"/><polygon points="10,28 0,20 10,38" fill="#1d4ed8"/></svg>',
    iconSize: [36, 30], iconAnchor: [18, 30], popupAnchor: [0, -30]
  });
  var trailIcon = L.divIcon({
    className: '',
    html: '<div style="width:10px;height:10px;border-radius:50%;background:#52b788;border:2px solid #2d6a4f;opacity:0.75;"></div>',
    iconSize: [10, 10], iconAnchor: [5, 5],
  });
  var exactIcon = L.divIcon({
    className: '',
    html: '<div style="width:22px;height:22px;border-radius:50%;background:rgba(234,88,12,0.25);border:3px solid #ea580c;display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:#ea580c;"></div></div>',
    iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -11],
  });
  function teardrop(pin) {
    return L.divIcon({
      className: '',
      html: '<div style="position:relative"><div class="tp' + (pin.selected ? ' sel' : '') + '" style="background:' + esc(pin.color) + '">'
        + '<svg viewBox="0 0 64 64"><path fill="#fff" d="${BIRD_PATH}"/></svg></div>'
        + (pin.tag ? '<div class="tag">' + esc(pin.label) + '</div>' : '') + '</div>',
      // the rotated square's sharp corner sits ~36px below its top edge
      iconSize: [30, 30], iconAnchor: [15, 36], popupAnchor: [0, -34],
    });
  }

  var meIcon = L.divIcon({
    className: '',
    html: '<div class="me">${BINOCULARS_SVG}</div>',
    iconSize: [34, 34], iconAnchor: [17, 41], popupAnchor: [0, -38],
  });

  var meLayer = L.layerGroup().addTo(map);
  var layer = L.layerGroup().addTo(map);
  var focusLayer = L.layerGroup().addTo(map);
  var me = null;          // user's position, included when fitting the pins
  var lastPins = [];

  function fitAll(pins) {
    var bounds = pins.map(function(p) { return [Number(p.lat), Number(p.lng)]; });
    if (me) bounds.push([me.lat, me.lng]);
    if (center || bounds.length === 0) return;
    if (bounds.length === 1) {
      map.setView(bounds[0], me && pins.length === 0 ? 13 : zoom);
    } else {
      map.fitBounds(bounds, insets
        ? { paddingTopLeft: [30, insets.top + 30], paddingBottomRight: [30, insets.bottom + 30] }
        : { padding: [40, 40] });
    }
  }

  // "Near me": binoculars pin with a soft halo for the location's uncertainty
  function showMe(m) {
    meLayer.clearLayers();
    var wasShown = !!me;
    me = m ? { lat: Number(m.lat), lng: Number(m.lng) } : null;
    if (!me) return;
    L.circle([me.lat, me.lng], {
      radius: Math.max(Number(m.accuracyM) || 0, 150), color: '#101a15', weight: 1,
      opacity: 0.25, fillColor: '#101a15', fillOpacity: 0.07, interactive: false,
    }).addTo(meLayer);
    L.marker([me.lat, me.lng], { icon: meIcon, zIndexOffset: 1000 })
      .bindPopup('You are about here').addTo(meLayer);
    if (!wasShown) fitAll(lastPins);
  }
  window.__me = showMe;

  // Selected bird: stakeout circle, trail of earlier reports, observer's exact spot
  function focus(f) {
    focusLayer.clearLayers();
    if (!f) return;
    var pt = L.latLng(Number(f.lat), Number(f.lng));
    var bounds = pt.toBounds(500);
    if (f.circle) {
      var c = L.circle([Number(f.circle.lat), Number(f.circle.lng)], {
        radius: f.circle.radiusM, color: '#1f7a55', fillColor: '#52b788',
        fillOpacity: 0.12, weight: 2, dashArray: '6 4', interactive: false,
      }).addTo(focusLayer);
      bounds = bounds.extend(c.getBounds());
    }
    (f.trail || []).forEach(function(t) {
      L.marker([Number(t.lat), Number(t.lng)], { icon: trailIcon, interactive: false, zIndexOffset: -100 }).addTo(focusLayer);
    });
    if (f.exact) {
      var ex = L.latLng(Number(f.exact.lat), Number(f.exact.lng));
      L.marker(ex, { icon: exactIcon }).bindPopup("Observer's exact spot (from notes)").addTo(focusLayer);
      bounds = bounds.extend(ex);
    }
    map.flyToBounds(bounds, insets
      ? { paddingTopLeft: [30, insets.top + 20], paddingBottomRight: [30, insets.bottom + 20], maxZoom: 16, duration: 0.6 }
      : { padding: [40, 40], maxZoom: 16 });
  }
  window.__focus = focus;

  function render(pins, fit) {
    layer.clearLayers();
    lastPins = pins;
    var groups = {}; // interactive mode: pins at the same spot share one marker
    pins.forEach(function(pin) {
      // lat/lng arrive as strings (Postgres NUMERIC via pg), so coerce first
      var lat = Number(pin.lat), lng = Number(pin.lng);
      if (interactive && !pin.isTrail && pin.id != null) {
        var key = lat.toFixed(5) + ',' + lng.toFixed(5);
        (groups[key] = groups[key] || []).push(pin);
        return;
      }
      var icon = pin.isExact ? exactIcon : pin.isTrail ? trailIcon : pin.color ? teardrop(pin) : birdIcon;
      var popup = '<b>' + esc(pin.label) + '</b>' + (pin.sciName ? '<br><i>' + esc(pin.sciName) + '</i>' : '');
      var marker = L.marker([lat, lng], { icon: icon }).addTo(layer);
      if (!pin.isTrail) marker.bindPopup(popup);
      if (pins.length === 1 && !pin.isTrail) marker.openPopup();
      if (pin.isExact) marker.openPopup();
    });

    Object.keys(groups).forEach(function(key) {
      var group = groups[key];
      var first = group[0];
      var icon = first.color ? teardrop(first) : birdIcon;
      var marker = L.marker([Number(first.lat), Number(first.lng)], { icon: icon }).addTo(layer);
      if (group.length === 1) {
        marker.on('click', function() { openSighting(first.id); });
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

    if (fit) fitAll(pins);
  }
  window.__render = render;
  render(${JSON.stringify(pins)}, true);
</script>
</body>
</html>`;
}

export default function LeafletMap({ pins, center, zoom, clusterCircle, onPinPress, insets, fitKey, focus, me }: Props) {
  const webRef = useRef<WebView>(null);
  const loaded = useRef(false);
  const sent = useRef({ pins: '', fitKey });
  const pinsJson = JSON.stringify(pins);

  // Remount only when the cluster circle arrives (it loads after the map renders);
  // pin changes are pushed into the live page instead of rebuilding it.
  const webViewKey = clusterCircle
    ? `circle-${clusterCircle.lat}-${clusterCircle.lng}-${clusterCircle.radiusM}`
    : 'no-circle';
  const html = useMemo(() => {
    loaded.current = false;
    sent.current = { pins: pinsJson, fitKey };
    return buildHtml(pins, center, zoom, clusterCircle, !!onPinPress, insets);
    // Built once per mount; later pin changes go through pushPins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webViewKey]);

  const pushPins = () => {
    if (!loaded.current || !webRef.current) return;
    if (sent.current.pins === pinsJson && sent.current.fitKey === fitKey) return;
    const fit = sent.current.fitKey !== fitKey;
    sent.current = { pins: pinsJson, fitKey };
    webRef.current.injectJavaScript(`window.__render && window.__render(${pinsJson}, ${fit}); true;`);
  };

  useEffect(pushPins, [pinsJson, fitKey]);

  const focusJson = JSON.stringify(focus ?? null);
  const sentFocus = useRef('null');
  const pushFocus = () => {
    if (!loaded.current || !webRef.current || sentFocus.current === focusJson) return;
    sentFocus.current = focusJson;
    webRef.current.injectJavaScript(`window.__focus && window.__focus(${focusJson}); true;`);
  };
  useEffect(pushFocus, [focusJson]);

  const meJson = JSON.stringify(me ?? null);
  const sentMe = useRef('null');
  const pushMe = () => {
    if (!loaded.current || !webRef.current || sentMe.current === meJson) return;
    sentMe.current = meJson;
    webRef.current.injectJavaScript(`window.__me && window.__me(${meJson}); true;`);
  };
  useEffect(pushMe, [meJson]);

  return (
    <WebView
      ref={webRef}
      key={webViewKey}
      style={styles.map}
      source={{ html }}
      originWhitelist={['*']}
      javaScriptEnabled
      onLoadEnd={() => {
        loaded.current = true;
        pushPins(); // catch up on anything that changed while the page was loading
        sentFocus.current = 'null';
        pushFocus();
        sentMe.current = 'null';
        pushMe();
      }}
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
