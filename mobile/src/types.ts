// Shapes of the backend API responses.

export interface Sighting {
  id: number;
  common_name: string;
  scientific_name: string | null;
  species_code: string | null; // eBird code; the backend fills it in for iNaturalist rows too
  location_name: string | null;
  region_name: string;
  observed_at: string;
  how_many: number | null;
  lat: number | null;
  lng: number | null;
  source: string | null;
  source_id: string | null;
  rarity_count: number | null;
  photo_url: string | null;
  photo_attribution: string | null;
  location_id: string | null;
  // iNaturalist public_positional_accuracy in metres; null for unknown/older backend rows
  location_accuracy_m: number | null;
  // True when iNaturalist (or a sensitive species) has hidden the true location;
  // the public lat/lng is then a randomised point within ±location_accuracy_m
  location_obscured: boolean;
  notes: string | null;
  cluster_id: number | null;
  // Out on the ocean, more than 2 km from any land (a pelagic trip); islands count as land.
  // Missing from older backends.
  at_sea?: boolean;
}

// ---- Cluster types ----
export interface ClusterPin { lat: number; lng: number; observed_at: string; source: string; }

export interface BirdWeatherMatch {
  station_id: string;
  station_name: string;
  station_url: string;
  date: string; // YYYY-MM-DD, Pacific
  detections: number;
  max_confidence: number;
}

export interface ClusterData {
  id: number;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  first_seen: string;
  last_seen: string;
  sighting_count: number;
  checklist_count: number;
  refound_count: number;
  dip_count: number;
  last_refound_at: string | null;
  last_dipped_at: string | null;
  sighting_pins: ClusterPin[] | null;
  status: { label: string; level: 'green' | 'amber' | 'red' | 'gray' };
  /** Last 7 days, oldest first (single-cluster endpoint only) */
  days?: ClusterDay[];
  /** BirdWeather corroboration (single-cluster endpoint only) */
  birdweather?: BirdWeatherMatch[];
}

export interface ClusterDay {
  date: string; // YYYY-MM-DD, Pacific
  sightings: number;
  refound: number;
  dipped: number;
}

// ---- Map modal with lazy-loaded comments ----
export interface CommentEntry { author: string; text: string; created_at: string | null; }

export interface CommentsPayload {
  source: string;
  observer_note: string | null;
  comments: CommentEntry[];
}
