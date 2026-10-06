import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AssistanceRequest, RequestStatus } from "./types";

/**
 * Storage adapter.
 *
 * With Supabase env vars set, every request is persisted to Postgres and is
 * visible across devices and browsers - which is what you want when the
 * customer is on a phone and the mechanic is on a laptop.
 *
 * Without them the app transparently falls back to an in-memory store so it
 * still deploys and demos on Vercel with zero configuration. A demo should
 * never die because someone forgot to paste a key.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const usingSupabase = Boolean(url && serviceKey);

let client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!client) client = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  return client;
}

const TABLE = "assistance_requests";

// ---------------------------------------------------------------- memory store
const g = globalThis as unknown as { __roadsathi?: Map<string, AssistanceRequest> };
if (!g.__roadsathi) g.__roadsathi = new Map();
const mem = g.__roadsathi;

// ---------------------------------------------------------------- row mapping
/* eslint-disable @typescript-eslint/no-explicit-any */
function toRow(r: AssistanceRequest): Record<string, any> {
  return {
    id: r.id,
    created_at: r.createdAt,
    status: r.status,
    customer_name: r.customerName,
    customer_phone: r.customerPhone,
    passengers: r.passengers,
    has_children: r.hasChildren,
    lat: r.location.lat,
    lng: r.location.lng,
    highway_ref: r.highwayRef,
    vehicle_type: r.vehicleType,
    vehicle_model: r.vehicleModel,
    vehicle_plate: r.vehiclePlate,
    symptom_text: r.symptomText,
    triage: r.triage,
    parts_plan: r.partsPlan,
    mechanic_id: r.mechanicId,
    mechanic: r.mechanic,
    eta_minutes: r.etaMinutes,
    quoted_price_inr: r.quotedPriceInr,
    otp: r.otp,
    otp_verified: r.otpVerified,
    guardian_token: r.guardianToken,
    guardian_phone: r.guardianPhone,
    plan_b: r.planB,
    resolution_note: r.resolutionNote,
    timeline: r.timeline,
    // Everything from the real-data layer lives in one jsonb column.
    realdata: r.sources
      ? {
          geo: {
            roadRef: r.location.roadRef ?? null,
            roadName: r.location.roadName ?? null,
            place: r.location.place ?? null,
            district: r.location.district ?? null,
            state: r.location.state ?? null,
          },
          weather: r.weather ?? null,
          nearby: r.nearby ?? null,
          route: r.route ?? null,
          sources: r.sources,
        }
      : null,
  };
}

function fromRow(row: any): AssistanceRequest {
  const real = row.realdata;
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    passengers: row.passengers,
    hasChildren: row.has_children,
    location: { lat: Number(row.lat), lng: Number(row.lng), ...(real?.geo ?? {}) },
    highwayRef: row.highway_ref,
    vehicleType: row.vehicle_type,
    vehicleModel: row.vehicle_model,
    vehiclePlate: row.vehicle_plate,
    symptomText: row.symptom_text,
    triage: row.triage,
    partsPlan: row.parts_plan,
    mechanicId: row.mechanic_id,
    mechanic: row.mechanic,
    etaMinutes: row.eta_minutes,
    quotedPriceInr: row.quoted_price_inr,
    otp: row.otp,
    otpVerified: row.otp_verified,
    guardianToken: row.guardian_token,
    guardianPhone: row.guardian_phone,
    planB: row.plan_b,
    resolutionNote: row.resolution_note,
    timeline: row.timeline ?? [],
    ...(real
      ? { weather: real.weather, nearby: real.nearby ?? undefined, route: real.route, sources: real.sources }
      : {}),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------- public API
export async function saveRequest(r: AssistanceRequest): Promise<AssistanceRequest> {
  if (!usingSupabase) {
    mem.set(r.id, r);
    return r;
  }
  const row = toRow(r);
  let { error } = await sb().from(TABLE).upsert(row);
  // Table created before the real-data layer: save without it rather than fail
  // the SOS. Run supabase/schema.sql again to add the column.
  if (error?.message.includes("realdata")) {
    delete row.realdata;
    ({ error } = await sb().from(TABLE).upsert(row));
  }
  if (error) throw new Error(`saveRequest: ${error.message}`);
  return r;
}

export async function getRequest(id: string): Promise<AssistanceRequest | null> {
  if (!usingSupabase) return mem.get(id) ?? null;
  const { data, error } = await sb().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getRequest: ${error.message}`);
  return data ? fromRow(data) : null;
}

export async function getByGuardianToken(
  token: string
): Promise<AssistanceRequest | null> {
  if (!usingSupabase) {
    for (const r of mem.values()) if (r.guardianToken === token) return r;
    return null;
  }
  const { data, error } = await sb()
    .from(TABLE)
    .select("*")
    .eq("guardian_token", token)
    .maybeSingle();
  if (error) throw new Error(`getByGuardianToken: ${error.message}`);
  return data ? fromRow(data) : null;
}

export async function listRequests(
  statuses?: RequestStatus[]
): Promise<AssistanceRequest[]> {
  if (!usingSupabase) {
    return [...mem.values()]
      .filter((r) => !statuses || statuses.includes(r.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  let q = sb().from(TABLE).select("*").order("created_at", { ascending: false }).limit(100);
  if (statuses?.length) q = q.in("status", statuses);
  const { data, error } = await q;
  if (error) throw new Error(`listRequests: ${error.message}`);
  return (data ?? []).map(fromRow);
}
