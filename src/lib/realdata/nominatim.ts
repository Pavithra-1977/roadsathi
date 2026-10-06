import { highwayRefFor } from "../geo";
import type { GeoInfo, LatLng } from "../types";
import { TIMEOUT_MS, cached, fetchJson, gridKey, type Sourced } from "./http";

const EMPTY: GeoInfo = { roadRef: null, roadName: null, place: null, district: null, state: null };

// Nominatim usage policy: max 1 request per second. Requests are spaced
// through this slot; if the queue is longer than our timeout we fall back.
let nextSlot = 0;

interface NominatimResponse {
  name?: string;
  address?: Record<string, string>;
  namedetails?: Record<string, string> | null;
}

export function parseNominatim(json: NominatimResponse): GeoInfo {
  const a = json.address ?? {};
  return {
    roadRef: json.namedetails?.ref ?? null,
    roadName: a.road ?? (json.name || null),
    place: a.village ?? a.town ?? a.neighbourhood ?? a.hamlet ?? a.suburb ?? a.city ?? null,
    district: a.state_district ?? a.county ?? a.city ?? null,
    state: a.state ?? null,
  };
}

export function reverseGeocode(p: LatLng, noCache = false): Promise<Sourced<GeoInfo>> {
  return cached(`geo:${gridKey(p)}`, async () => {
    const wait = Math.max(0, nextSlot - Date.now());
    if (wait > TIMEOUT_MS / 2) return { source: "fallback", data: EMPTY };
    nextSlot = Date.now() + wait + 1000;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const json = await fetchJson<NominatimResponse & { error?: string }>(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}` +
          `&zoom=16&addressdetails=1&namedetails=1&accept-language=en`,
        {},
        TIMEOUT_MS - wait
      );
      if (json.error) throw new Error(json.error);
      return { source: "live", data: parseNominatim(json) };
    } catch {
      return { source: "fallback", data: EMPTY };
    }
  }, noCache);
}

/** "NH44, near Bhoothpur, Mahabubnagar". Falls back to the old fake marker. */
export function describeLocation(p: LatLng, geo: GeoInfo | null): string {
  if (!geo) return highwayRefFor(p);
  const parts = [
    geo.roadRef ?? geo.roadName,
    geo.place ? `near ${geo.place}` : null,
    geo.district !== geo.place ? geo.district : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : highwayRefFor(p);
}
