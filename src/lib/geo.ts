import type { LatLng } from "./types";

const R = 6371; // km

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

/**
 * Road distance is always longer than straight-line. On Indian highways a
 * 1.25x factor tracks reality closely enough for an ETA the user can trust.
 */
export function roadKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * 1.25;
}

/**
 * ETA in minutes. Night riding on a highway shoulder is slower than the
 * open-road speed limit suggests, so we model a realistic 34 km/h average
 * for a mechanic on a two-wheeler plus a 3 minute mobilisation buffer.
 */
export function etaMinutes(a: LatLng, b: LatLng, avgKmph = 34): number {
  const km = roadKm(a, b);
  return Math.max(3, Math.round((km / avgKmph) * 60) + 3);
}

/** Approximate highway marker for a coordinate. Demo-friendly, deterministic. */
export function highwayRefFor(p: LatLng): string {
  const highways = ["NH-44", "NH-48", "NH-16", "NH-27", "NH-19", "SH-9"];
  const idx = Math.abs(Math.round((p.lat + p.lng) * 7)) % highways.length;
  const km = Math.abs(Math.round(p.lat * 1000)) % 480;
  return `${highways[idx]}, KM ${km}`;
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
