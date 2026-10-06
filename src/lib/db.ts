import type { AssistanceRequest, RequestStatus } from "./types";

/**
 * Storage adapter.
 *
 * Default: an in-memory map, so the app deploys and demos with zero
 * configuration. A demo should never die because someone forgot to paste a key.
 *
 * Optional: Upstash Redis over its REST API (plain fetch, no SDK) when both
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set. That makes a
 * request raised on a phone visible on a laptop. Values are JSON, 24 h TTL.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const storage: "memory" | "redis" = REDIS_URL && REDIS_TOKEN ? "redis" : "memory";

const TTL_S = 24 * 60 * 60;
const INDEX = "rs:requests"; // sorted set: id scored by created time
const reqKey = (id: string) => `rs:req:${id}`;
const guardianKey = (token: string) => `rs:guardian:${token}`;

// ---------------------------------------------------------------- memory store
const g = globalThis as unknown as { __roadsathi?: Map<string, AssistanceRequest> };
if (!g.__roadsathi) g.__roadsathi = new Map();
const mem = g.__roadsathi;

// ---------------------------------------------------------------- redis (REST)
type Cmd = (string | number)[];

/** Runs commands through Upstash's /pipeline endpoint, returns each result. */
async function redis(cmds: Cmd[]): Promise<unknown[]> {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  const err = out.find((r) => r.error);
  if (err) throw new Error(`Upstash: ${err.error}`);
  return out.map((r) => r.result);
}

function parse(raw: unknown): AssistanceRequest | null {
  return typeof raw === "string" ? (JSON.parse(raw) as AssistanceRequest) : null;
}

// ---------------------------------------------------------------- public API
export async function saveRequest(r: AssistanceRequest): Promise<AssistanceRequest> {
  if (storage === "memory") {
    mem.set(r.id, r);
    return r;
  }
  const now = Date.now();
  await redis([
    ["SET", reqKey(r.id), JSON.stringify(r), "EX", TTL_S],
    ["SET", guardianKey(r.guardianToken), r.id, "EX", TTL_S],
    ["ZADD", INDEX, Date.parse(r.createdAt) || now, r.id],
    ["ZREMRANGEBYSCORE", INDEX, 0, now - TTL_S * 1000],
  ]);
  return r;
}

export async function getRequest(id: string): Promise<AssistanceRequest | null> {
  if (storage === "memory") return mem.get(id) ?? null;
  const [raw] = await redis([["GET", reqKey(id)]]);
  return parse(raw);
}

export async function getByGuardianToken(
  token: string
): Promise<AssistanceRequest | null> {
  if (storage === "memory") {
    for (const r of mem.values()) if (r.guardianToken === token) return r;
    return null;
  }
  const [id] = await redis([["GET", guardianKey(token)]]);
  return typeof id === "string" ? getRequest(id) : null;
}

export async function listRequests(
  statuses?: RequestStatus[]
): Promise<AssistanceRequest[]> {
  let rows: AssistanceRequest[];
  if (storage === "memory") {
    rows = [...mem.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else {
    const [ids] = await redis([["ZRANGE", INDEX, 0, 99, "REV"]]);
    const list = (ids as string[] | null) ?? [];
    if (list.length === 0) return [];
    const [raws] = await redis([["MGET", ...list.map(reqKey)]]);
    rows = ((raws as unknown[]) ?? []).map(parse).filter((r): r is AssistanceRequest => r !== null);
  }
  return rows.filter((r) => !statuses || statuses.includes(r.status));
}
