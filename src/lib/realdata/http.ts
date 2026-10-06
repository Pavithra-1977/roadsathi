import type { DataSource, LatLng } from "../types";

/**
 * Shared plumbing for the free public data sources.
 *
 * Every source must be optional: a slow or dead third-party API degrades a
 * block to seeded demo data, it never breaks the SOS flow.
 */

export const USER_AGENT = "RoadSathi/1.0 (prototype)";
export const TIMEOUT_MS = 4000;
const TTL_MS = 10 * 60 * 1000;

export interface Sourced<T> {
  source: DataSource;
  data: T;
}

/** Cache key: ~110 m grid, so repeat SOS calls from one spot reuse results. */
export function gridKey(p: LatLng): string {
  return `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
}

// ponytail: unbounded in-memory Map per serverless instance; add LRU eviction if it ever grows.
const g = globalThis as unknown as { __roadsathiRealdata?: Map<string, { at: number; value: unknown }> };
const cache = (g.__roadsathiRealdata ??= new Map());

/** Only live results are cached, so a source that recovers is picked up immediately. */
export async function cached<T>(
  key: string,
  load: () => Promise<Sourced<T>>,
  noCache = false
): Promise<Sourced<T>> {
  const hit = cache.get(key);
  if (!noCache && hit && Date.now() - hit.at < TTL_MS) return hit.value as Sourced<T>;
  const value = await load();
  if (value.source === "live") cache.set(key, { at: Date.now(), value });
  return value;
}

/** fetch + JSON with a hard timeout. Throws on any failure; callers catch. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = TIMEOUT_MS
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1, timeoutMs));
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init.headers },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function roundKm(km: number): number {
  return Number(km.toFixed(2));
}
