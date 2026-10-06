import { NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/realdata/nominatim";
import { currentWeather } from "@/lib/realdata/openmeteo";
import { roadRoute } from "@/lib/realdata/osrm";
import { nearbyPlaces } from "@/lib/realdata/overpass";

export const dynamic = "force-dynamic";

async function ping<T>(name: string, run: () => Promise<{ source: string; data: T }>, detail: (d: T) => unknown) {
  const t0 = Date.now();
  const r = await run();
  return { name, status: r.source === "live" ? "up" : "down", source: r.source, latencyMs: Date.now() - t0, detail: detail(r.data) };
}

/** Pings every real-data source (bypassing the cache) and reports status + latency. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat") ?? 17.385);
  const lng = Number(searchParams.get("lng") ?? 78.486);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "lat and lng must be valid coordinates" }, { status: 400 });
  }
  const p = { lat, lng };
  // A point ~2 km north-east, so OSRM has something to route.
  const q = { lat: lat + 0.015, lng: lng + 0.015 };

  const sources = await Promise.all([
    ping("nominatim", () => reverseGeocode(p, true), (d) => d),
    ping("open-meteo", () => currentWeather(p, true), (d) => d && { summary: d.summary, temperatureC: d.temperatureC }),
    ping("overpass", () => nearbyPlaces(p, true), (d) =>
      Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.length]))),
    ping("osrm", () => roadRoute(q, p, [], true), (d) => ({ distanceKm: d.distanceKm, etaMinutes: d.etaMinutes })),
  ]);

  return NextResponse.json({
    at: new Date().toISOString(),
    location: p,
    ok: sources.every((s) => s.status === "up"),
    sources,
  });
}
