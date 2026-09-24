// Shared sample data + helpers for the three UI mockups in this folder.
// Mockups only — nothing here is used by the app.

window.BIRDS = [
  { id: 1, name: 'Nazca Booby', sci: 'Sula granti', tier: 'Exceptional', count: 1,
    loc: 'Point Fermin Park', region: 'Los Angeles', time: '7:42 AM', ago: '38 min ago', day: 'Today',
    status: 'green', statusLabel: 'Refound 38 min ago', reports: 6, dist: '31 km', src: 'eBird',
    hue: 200, x: 118, y: 406 },
  { id: 2, name: 'Yellow-green Vireo', sci: 'Vireo flavoviridis', tier: 'Exceptional', count: 1,
    loc: 'Huntington Central Park', region: 'Orange', time: '9:10 AM', ago: '2 h ago', day: 'Today',
    status: 'green', statusLabel: 'Continuing · seen 2 h ago', reports: 11, dist: '44 km', src: 'eBird',
    hue: 75, x: 262, y: 468 },
  { id: 3, name: 'Red-throated Pipit', sci: 'Anthus cervinus', tier: 'Very Rare', count: 2,
    loc: 'Bolsa Chica Ecological Reserve', region: 'Orange', time: '4:05 PM', ago: 'Yesterday', day: 'Yesterday',
    status: 'amber', statusLabel: 'Not reported today', reports: 3, dist: '40 km', src: 'eBird',
    hue: 25, x: 228, y: 436 },
  { id: 4, name: 'Painted Bunting', sci: 'Passerina ciris', tier: 'Very Rare', count: 1,
    loc: 'Madrona Marsh Preserve', region: 'Los Angeles', time: '8:20 AM', ago: 'Yesterday', day: 'Yesterday',
    status: 'red', statusLabel: 'Dipped by 3 birders', reports: 4, dist: '22 km', src: 'iNaturalist',
    hue: 330, x: 150, y: 332 },
  { id: 5, name: 'Tropical Kingbird', sci: 'Tyrannus melancholicus', tier: 'Rare', count: 2,
    loc: 'Ballona Freshwater Marsh', region: 'Los Angeles', time: '3:30 PM', ago: 'Sep 21', day: 'Sep 21',
    status: 'green', statusLabel: 'Continuing · seen 5 h ago', reports: 8, dist: '14 km', src: 'eBird',
    hue: 50, x: 132, y: 214 },
  { id: 6, name: 'Black-and-white Warbler', sci: 'Mniotilta varia', tier: 'Rare', count: 1,
    loc: 'Legg Lake', region: 'Los Angeles', time: '10:15 AM', ago: 'Sep 21', day: 'Sep 21',
    status: 'gray', statusLabel: 'Single report', reports: 1, dist: '12 km', src: 'eBird',
    hue: 0, x: 300, y: 180 },
  { id: 7, name: 'Northern Parula', sci: 'Setophaga americana', tier: 'Rare', count: 1,
    loc: 'San Joaquin Wildlife Sanctuary', region: 'Orange', time: '7:55 AM', ago: 'Sep 20', day: 'Sep 20',
    status: 'amber', statusLabel: 'Last seen 3 days ago', reports: 2, dist: '52 km', src: 'iNaturalist',
    hue: 210, x: 318, y: 510 },
];

window.TIER_ORDER = { Exceptional: 0, 'Very Rare': 1, Rare: 2 };

// Stylised bird silhouette standing in for real iNaturalist photos.
window.birdSilhouette = (fill) => `
  <svg viewBox="0 0 64 64" aria-hidden="true"><path fill="${fill}" d="M9 40c7 0 12-4 16-10 4-7 9-11 16-11 5 0 8 3 10 6l8 2-7 3c-1 10-8 17-19 18l-3 8h-4l1-7c-7-1-13-4-18-9z"/><circle cx="46" cy="24" r="1.6" fill="#fff" opacity=".85"/></svg>`;

// Fake-but-plausible LA/OC coastline map. `c` supplies theme colours.
window.mapSvg = (c) => `
<svg class="map-svg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="waterLines" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M0 5h10" stroke="${c.waterLine}" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="390" height="844" fill="${c.land}"/>
  <path d="M0 116 C40 156 60 180 70 220 C80 260 70 292 95 332 C115 364 90 388 110 416 C130 444 180 436 210 460 C250 488 300 508 340 548 C360 568 375 580 390 591 L390 844 L0 844 Z" fill="${c.water}"/>
  ${c.waterLine ? `<path d="M0 116 C40 156 60 180 70 220 C80 260 70 292 95 332 C115 364 90 388 110 416 C130 444 180 436 210 460 C250 488 300 508 340 548 C360 568 375 580 390 591 L390 844 L0 844 Z" fill="url(#waterLines)" opacity=".5"/>` : ''}
  <g fill="${c.park}">
    <ellipse cx="140" cy="212" rx="26" ry="16"/><ellipse cx="300" cy="180" rx="22" ry="14"/>
    <ellipse cx="262" cy="468" rx="24" ry="14"/><ellipse cx="150" cy="332" rx="16" ry="12"/>
    <ellipse cx="318" cy="510" rx="18" ry="12"/><ellipse cx="220" cy="44" rx="60" ry="26"/>
    <ellipse cx="330" cy="364" rx="30" ry="18"/>
  </g>
  <g fill="none" stroke="${c.road}" stroke-linecap="round">
    <path d="M60 120 L390 180" stroke-width="${c.roadW * 1.6}"/>
    <path d="M110 0 C150 200 180 420 240 640 C260 720 300 780 330 844" stroke-width="${c.roadW * 1.6}"/>
    <path d="M0 330 C120 350 260 300 390 280" stroke-width="${c.roadW}"/>
    <path d="M90 470 C200 460 300 480 390 440" stroke-width="${c.roadW}"/>
    <path d="M250 0 C260 200 300 400 390 560" stroke-width="${c.roadW}"/>
    <path d="M120 600 C200 590 300 610 390 640" stroke-width="${c.roadW}"/>
  </g>
  <g stroke="${c.minor}" stroke-width=".7" fill="none" opacity=".9">
    ${Array.from({ length: 14 }, (_, i) => `<path d="M${40 + i * 26} 0 L${10 + i * 30} 844"/>`).join('')}
    ${Array.from({ length: 16 }, (_, i) => `<path d="M0 ${40 + i * 52} L390 ${60 + i * 50}"/>`).join('')}
  </g>
  <path d="M0 116 C40 156 60 180 70 220 C80 260 70 292 95 332 C115 364 90 388 110 416 C130 444 180 436 210 460 C250 488 300 508 340 548 C360 568 375 580 390 591 L390 844 L0 844 Z" fill="${c.water}" opacity="${c.waterLine ? 0.55 : 1}"/>
  <g font-family="${c.font}" font-size="10" fill="${c.label}" letter-spacing="1.5">
    <text x="200" y="290">LOS ANGELES</text>
    <text x="30" y="600" font-style="italic" letter-spacing="3">PACIFIC OCEAN</text>
    <text x="290" y="420">ORANGE CO.</text>
    <text x="150" y="245" font-size="8">Ballona</text>
    <text x="240" y="494" font-size="8">Huntington Beach</text>
  </g>
</svg>`;
