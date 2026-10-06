import { etaFromKm, roadKm } from "../geo";
import type { LatLng } from "../types";
import { cached, fetchJson, gridKey, roundKm, type Sourced } from "./http";

export interface RoadRoute {
  /** [lat, lng] pairs */
  geometry: [number, number][];
  distanceKm: number;
  etaMinutes: number;
}

/** Same as the pre-real-data behaviour: haversine x 1.25 and a straight line. */
function fallbackRoute(points: LatLng[]): RoadRoute {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += roadKm(points[i - 1], points[i]);
  return {
    geometry: points.map((p) => [p.lat, p.lng]),
    distanceKm: roundKm(km),
    etaMinutes: etaFromKm(km),
  };
}

/**
 * Real road route from the public OSRM demo server. Call it for ONE mechanic
 * (the one dispatched), never for every candidate: it is a shared free service.
 */
export function roadRoute(
  from: LatLng,
  to: LatLng,
  via: LatLng[] = [],
  noCache = false
): Promise<Sourced<RoadRoute>> {
  const points = [from, ...via, to];
  const key = `osrm:${points.map(gridKey).join(";")}`;
  return cached(key, async () => {
    try {
      const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
      const json = await fetchJson<{
        code: string;
        routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
      }>(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
      const r = json.routes?.[0];
      if (json.code !== "Ok" || !r) throw new Error(json.code);
      return {
        source: "live",
        data: {
          geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          distanceKm: roundKm(r.distance / 1000),
          // OSRM drive time + the same 3 minute mobilisation buffer as the fallback model.
          etaMinutes: Math.max(3, Math.round(r.duration / 60) + 3),
        },
      };
    } catch {
      return { source: "fallback", data: fallbackRoute(points) };
    }
  }, noCache);
}
