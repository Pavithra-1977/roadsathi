export type VehicleType = "car" | "bike" | "suv" | "truck" | "auto";

export type RequestStatus =
  | "open"          // SOS raised, looking for a mechanic
  | "assigned"      // mechanic accepted, en route
  | "arrived"       // OTP verified, work started
  | "resolved"      // fixed roadside
  | "plan_b"        // not fixable, safety fallback engaged
  | "cancelled";

export type Severity = "low" | "medium" | "high" | "critical";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Where a real-data block came from. "fallback" = seeded/haversine demo data. */
export type DataSource = "live" | "fallback";

/** Reverse-geocoded context for the incident (Nominatim). */
export interface GeoInfo {
  roadRef: string | null;   // e.g. "NH44"
  roadName: string | null;
  place: string | null;
  district: string | null;
  state: string | null;
}

export interface IncidentLocation extends LatLng, Partial<GeoInfo> {}

export interface Weather {
  temperatureC: number;
  precipitationMm: number;
  weatherCode: number;
  summary: string;
  visibilityM: number | null;
  windKmh: number;
  isDay: boolean;
  /** Rule-based advice for heavy rain, fog, night, heat */
  safety: string[];
}

/** A real place from OpenStreetMap. Never a RoadSathi partner. */
export interface OsmPlace {
  name: string;
  lat: number;
  lng: number;
  phone?: string;
  distanceKm: number;
}

export interface NearbyPlaces {
  garages: OsmPlace[];
  partsShops: OsmPlace[];
  hospitals: OsmPlace[];
  police: OsmPlace[];
  fuel: OsmPlace[];
  busStations: OsmPlace[];
  railwayStations: OsmPlace[];
  lodging: OsmPlace[];
}

export interface RouteInfo {
  /** Mechanic this route was computed for */
  mechanicId: string;
  /** [lat, lng] pairs, ready for Leaflet */
  geometry: [number, number][];
  distanceKm: number;
  etaMinutes: number;
}

export interface DataSources {
  geocode: DataSource;
  weather: DataSource;
  osm: DataSource;
  route: DataSource;
}

export interface Mechanic {
  id: string;
  name: string;
  shopName: string;
  phone: string;
  photoUrl?: string;
  /** Government ID verified during onboarding */
  verified: boolean;
  rating: number;
  jobsCompleted: number;
  /** Skills this mechanic can handle roadside */
  skills: string[];
  vehicleTypes: VehicleType[];
  location: LatLng;
  online: boolean;
  /** Jobs done in the last 7 days. Drives the idle-shop priority boost. */
  jobsLast7Days: number;
  /** Vehicle the mechanic rides to the scene */
  arrivalVehicle: string;
  plateNumber: string;
}

export interface PartsShop {
  id: string;
  name: string;
  location: LatLng;
  openNow: boolean;
  open24h: boolean;
  /** part sku -> units in stock */
  inventory: Record<string, number>;
  phone: string;
}

export interface TriageResult {
  faultId: string;
  faultLabel: string;
  confidence: number;
  severity: Severity;
  /** Can a mechanic realistically fix this at the roadside? */
  roadsideFixable: boolean;
  estimatedFixMinutes: number;
  estimatedCostRange: [number, number];
  requiredSkills: string[];
  requiredTools: string[];
  requiredParts: string[];
  /** What the stranded person should do RIGHT NOW, before help arrives */
  safetyAdvice: string[];
  reasoning: string;
  source: "knowledge-base" | "llm";

  // Added by the LangGraph agent (optional: absent on older requests)
  /** Knowledge-base passages the diagnosis and advice are grounded in */
  citations?: Citation[];
  agent?: AgentTrace;
  /** Confidence too low: ask the driver this one question, then re-run */
  needsClarification?: boolean;
  clarifyingQuestion?: string | null;
  /** High severity or not roadside-fixable: prepare the Plan B flow early */
  planBRecommended?: boolean;
  /** Next most likely fault ids, best first (for the mechanic to rule out) */
  alternatives?: string[];
}

export interface Citation {
  docTitle: string;
  snippet: string;
  /** Chunk id, e.g. "overheating#0" */
  chunkId?: string;
  source?: string;
}

export interface AgentTrace {
  /** Graph nodes visited, in order */
  path: string[];
  source: "llm+rag" | "deterministic";
  retrieval?: "embedding" | "keyword";
  language?: "en" | "hi" | "hinglish";
  /** e.g. "low agreement", "timeout", "no api key" */
  flags?: string[];
  model?: string | null;
  ms?: number;
}

export interface PartsPlan {
  needed: string[];
  /** Shops the mechanic should pass through, in order */
  pickups: {
    shopId: string;
    shopName: string;
    phone: string;
    location: LatLng;
    parts: string[];
    detourKm: number;
    openNow: boolean;
  }[];
  unavailable: string[];
  totalDetourKm: number;
}

export interface PlanBOption {
  kind: "bus" | "train" | "cab" | "custody" | "hotel";
  title: string;
  detail: string;
  etaMinutes?: number;
  distanceKm?: number;
  priceInr?: number;
  location?: LatLng;
  contact?: string;
}

export interface TimelineEvent {
  at: string;
  label: string;
  detail?: string;
}

export interface AssistanceRequest {
  id: string;
  createdAt: string;
  status: RequestStatus;

  // Who + where
  customerName: string;
  customerPhone: string;
  passengers: number;
  hasChildren: boolean;
  location: IncidentLocation;
  highwayRef: string;      // e.g. "NH44, near Bhoothpur, Mahabubnagar"
  vehicleType: VehicleType;
  vehicleModel: string;
  vehiclePlate: string;

  // What is wrong
  symptomText: string;
  triage: TriageResult | null;
  partsPlan: PartsPlan | null;

  // Assignment
  mechanicId: string | null;
  mechanic: Mechanic | null;
  etaMinutes: number | null;
  quotedPriceInr: number | null;   // locked BEFORE dispatch. no surge gouging.

  // Safety
  otp: string;
  otpVerified: boolean;
  guardianToken: string;
  guardianPhone: string | null;

  // Outcome
  planB: PlanBOption[] | null;
  resolutionNote: string | null;

  timeline: TimelineEvent[];

  // Real data (optional: absent on requests created before the real-data layer)
  weather?: Weather | null;
  nearby?: NearbyPlaces;
  route?: RouteInfo | null;
  sources?: DataSources;
}

export interface CreateRequestInput {
  customerName: string;
  customerPhone: string;
  passengers: number;
  hasChildren: boolean;
  lat: number;
  lng: number;
  vehicleType: VehicleType;
  vehicleModel: string;
  vehiclePlate: string;
  symptomText: string;
  guardianPhone?: string | null;
  /** Answer to the agent's clarifying question, sent back with the original text */
  clarification?: { question: string; answer: string } | null;
}
