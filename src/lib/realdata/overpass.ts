import { haversineKm } from "../geo";
import type { LatLng, NearbyPlaces, OsmPlace } from "../types";
import { TIMEOUT_MS, cached, fetchJson, gridKey, roundKm, type Sourced } from "./http";

/**
 * Real places around the incident from OpenStreetMap, in ONE Overpass query.
 *
 * These are listings, not partners: nobody here has agreed to anything.
 * Dispatch still uses the seeded demo roster in lib/seed.ts.
 */

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const NEAR_KM = 10; // garages, parts
const FAR_KM = 25;  // everything else
const PER_CATEGORY = 5;

export const EMPTY_NEARBY: NearbyPlaces = {
  garages: [], partsShops: [], hospitals: [], police: [],
  fuel: [], busStations: [], railwayStations: [], lodging: [],
};

const LABEL: Record<keyof NearbyPlaces, string> = {
  garages: "Unnamed garage", partsShops: "Unnamed parts shop", hospitals: "Unnamed hospital",
  police: "Police station", fuel: "Fuel station", busStations: "Bus station",
  railwayStations: "Railway station", lodging: "Unnamed lodging",
};

/** (south,west,north,east) box enclosing a circle of radius km. */
function bbox({ lat, lng }: LatLng, km: number): string {
  const dLat = km / 111;
  const dLng = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return `(${[lat - dLat, lng - dLng, lat + dLat, lng + dLng].map((v) => v.toFixed(4)).join(",")})`;
}

// Bounding boxes, not (around:...): measured ~3x faster on the public server
// (~4 s vs ~11 s). parseOverpass trims to the exact radius afterwards. An
// explicit [maxsize] gets the query admitted when the server is busy (a dense
// city centre needs >32 MB). ponytail: a 25 km radius in a metro centre can
// still exceed the 4 s budget and fall back; shrink FAR_KM for cities if needed.
function query(p: LatLng): string {
  const near = bbox(p, NEAR_KM);
  const far = bbox(p, FAR_KM);
  return `[out:json][timeout:10][maxsize:67108864];(
nwr["shop"~"^(car_repair|tyres|motorcycle_repair)$"]${near};
nwr["craft"="car_repair"]${near};
nwr["shop"~"^(car_parts|motorcycle_parts)$"]${near};
nwr["amenity"~"^(hospital|police|fuel|bus_station)$"]${far};
nwr["railway"="station"]["station"!~"^(subway|light_rail|monorail)$"]${far};
nwr["tourism"~"^(hotel|guest_house)$"]${far};
);out center qt;`;
}

function category(t: Record<string, string>): keyof NearbyPlaces | null {
  if (/^(car_repair|tyres|motorcycle_repair)$/.test(t.shop ?? "") || t.craft === "car_repair") return "garages";
  if (/^(car_parts|motorcycle_parts)$/.test(t.shop ?? "")) return "partsShops";
  if (t.amenity === "hospital") return "hospitals";
  if (t.amenity === "police") return "police";
  if (t.amenity === "fuel") return "fuel";
  if (t.amenity === "bus_station") return "busStations";
  if (t.railway === "station") return "railwayStations";
  if (t.tourism === "hotel" || t.tourism === "guest_house") return "lodging";
  return null;
}

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function parseOverpass(origin: LatLng, elements: OverpassElement[]): NearbyPlaces {
  const out = structuredClone(EMPTY_NEARBY);
  for (const el of elements) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const cat = category(tags);
    if (cat === null || lat === undefined || lng === undefined) continue;
    const km = haversineKm(origin, { lat, lng });
    if (km > (cat === "garages" || cat === "partsShops" ? NEAR_KM : FAR_KM)) continue;
    const phone = tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"];
    out[cat].push({
      name: tags.name ?? tags["name:en"] ?? LABEL[cat],
      lat,
      lng,
      ...(phone ? { phone: phone.split(";")[0].trim() } : {}),
      distanceKm: roundKm(km),
    });
  }
  for (const k of Object.keys(out) as (keyof NearbyPlaces)[]) {
    out[k] = out[k].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, PER_CATEGORY);
  }
  return out;
}

export function nearbyPlaces(p: LatLng, noCache = false): Promise<Sourced<NearbyPlaces>> {
  return cached(`osm:${gridKey(p)}`, async () => {
    // Both endpoints share one 4 s deadline, so a fast failure on the
    // primary still leaves time for the mirror.
    const deadline = Date.now() + TIMEOUT_MS;
    const body = new URLSearchParams({ data: query(p) }).toString();
    for (const url of ENDPOINTS) {
      const left = deadline - Date.now();
      if (left < 300) break;
      try {
        const json = await fetchJson<{ elements?: OverpassElement[]; remark?: string }>(
          url,
          { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
          left
        );
        // A remark means out-of-memory or timeout: elements are partial or empty.
        if (json.remark || !Array.isArray(json.elements)) throw new Error(json.remark ?? "no elements");
        return { source: "live", data: parseOverpass(p, json.elements) };
      } catch {
        /* try the next mirror */
      }
    }
    return { source: "fallback", data: EMPTY_NEARBY };
  }, noCache);
}
