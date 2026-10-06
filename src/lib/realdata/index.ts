import type {
  DataSources, GeoInfo, IncidentLocation, LatLng, NearbyPlaces, RouteInfo, Weather,
} from "../types";
import { describeLocation, reverseGeocode } from "./nominatim";
import { currentWeather } from "./openmeteo";
import { roadRoute } from "./osrm";
import { EMPTY_NEARBY, nearbyPlaces } from "./overpass";
import type { Sourced } from "./http";

const BUDGET_MS = 5000;

export interface Enrichment {
  location: IncidentLocation;
  highwayRef: string;
  weather: Weather | null;
  nearby: NearbyPlaces;
  route: RouteInfo | null;
  sources: DataSources;
}

function withBudget<T>(p: Promise<Sourced<T>>, fallback: Sourced<T>): Promise<Sourced<T>> {
  return Promise.race([
    p,
    new Promise<Sourced<T>>((r) => setTimeout(() => r(fallback), BUDGET_MS)),
  ]);
}

function settled<T>(r: PromiseSettledResult<Sourced<T>>, fallback: Sourced<T>): Sourced<T> {
  return r.status === "fulfilled" ? r.value : fallback;
}

/** Road route for the one dispatched mechanic, always resolves. */
export async function routeFor(
  mechanic: { id: string; location: LatLng },
  incident: LatLng,
  via: LatLng[] = []
): Promise<Sourced<RouteInfo>> {
  const r = await roadRoute(mechanic.location, incident, via);
  return { source: r.source, data: { mechanicId: mechanic.id, ...r.data } };
}

/**
 * Fetch every real source in parallel under one 5 s budget. Never throws:
 * each block independently falls back to the seeded / haversine behaviour.
 */
export async function enrich(
  location: LatLng,
  mechanic?: { id: string; location: LatLng },
  via: LatLng[] = []
): Promise<Enrichment> {
  const noGeo: Sourced<GeoInfo | null> = { source: "fallback", data: null };
  const noWx: Sourced<Weather | null> = { source: "fallback", data: null };
  const noOsm: Sourced<NearbyPlaces> = { source: "fallback", data: EMPTY_NEARBY };
  const noRoute: Sourced<RouteInfo | null> = { source: "fallback", data: null };

  const [geo, wx, osm, route] = await Promise.allSettled([
    withBudget<GeoInfo | null>(reverseGeocode(location), noGeo),
    withBudget(currentWeather(location), noWx),
    withBudget(nearbyPlaces(location), noOsm),
    mechanic
      ? withBudget<RouteInfo | null>(routeFor(mechanic, location, via), noRoute)
      : Promise.resolve(noRoute),
  ]);

  const g = settled(geo, noGeo);
  const w = settled(wx, noWx);
  const o = settled(osm, noOsm);
  const r = settled(route, noRoute);
  const geoData = g.source === "live" ? g.data : null;

  return {
    location: { ...location, ...(geoData ?? {}) },
    highwayRef: describeLocation(location, geoData),
    weather: w.data,
    nearby: o.data,
    route: r.data,
    sources: { geocode: g.source, weather: w.source, osm: o.source, route: r.source },
  };
}
