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
  location: LatLng;
  highwayRef: string;      // e.g. "NH-44, KM 212"
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
}
