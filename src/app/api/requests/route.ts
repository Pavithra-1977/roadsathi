import { NextResponse } from "next/server";
import { listRequests, saveRequest, usingSupabase } from "@/lib/db";
import { guardianToken, otp, requestId } from "@/lib/ids";
import { planParts, quotePrice, rankMechanics } from "@/lib/matching";
import { enrich } from "@/lib/realdata";
import { triageWithLLM } from "@/lib/triage";
import type {
  AssistanceRequest, CreateRequestInput, RequestStatus,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const statuses = status
    ? (status.split(",") as RequestStatus[])
    : undefined;
  const rows = await listRequests(statuses);
  return NextResponse.json({ requests: rows, storage: usingSupabase ? "supabase" : "memory" });
}

export async function POST(req: Request) {
  let body: CreateRequestInput;
  try {
    body = (await req.json()) as CreateRequestInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.lat !== "number" || typeof body.lng !== "number") {
    return NextResponse.json(
      { error: "lat and lng are required - we cannot send help without a location" },
      { status: 400 }
    );
  }
  if (!body.customerPhone) {
    return NextResponse.json({ error: "customerPhone is required" }, { status: 400 });
  }

  const location = { lat: body.lat, lng: body.lng };
  const vehicleType = body.vehicleType ?? "car";

  // 1. Work out what is probably wrong.
  const triage = await triageWithLLM(
    body.symptomText ?? "",
    vehicleType,
    body.vehicleModel ?? "unknown"
  );

  // 2. Find who can actually fix it, fastest.
  const ranked = rankMechanics(location, triage, vehicleType);
  const best = ranked[0];

  // 3. Work out where the missing parts are, before anyone sets off.
  const partsPlan = best
    ? planParts(location, best.mechanic, triage.requiredParts)
    : null;

  // 4. Lock the price now, while the customer still has a choice.
  const quote = best
    ? quotePrice(triage, best.distanceKm, partsPlan?.totalDetourKm ?? 0)
    : null;

  // 5. Real-world context: road, weather, nearby OSM places, road route.
  //    Each block falls back to demo data on its own; this never throws.
  const real = await enrich(
    location,
    best?.mechanic,
    partsPlan?.pickups.map((p) => p.location)
  );
  const eta = real.sources.route === "live" && real.route
    ? real.route.etaMinutes
    : best?.etaMinutes ?? null;

  const now = new Date().toISOString();
  const request: AssistanceRequest = {
    id: requestId(),
    createdAt: now,
    status: "open",
    customerName: body.customerName || "Traveller",
    customerPhone: body.customerPhone,
    passengers: body.passengers ?? 1,
    hasChildren: Boolean(body.hasChildren),
    location: real.location,
    highwayRef: real.highwayRef,
    vehicleType,
    vehicleModel: body.vehicleModel || "Unspecified",
    vehiclePlate: body.vehiclePlate || "",
    symptomText: body.symptomText || "",
    triage,
    partsPlan,
    mechanicId: null,
    mechanic: null,
    etaMinutes: eta,
    quotedPriceInr: quote?.total ?? null,
    otp: otp(),
    otpVerified: false,
    guardianToken: guardianToken(),
    guardianPhone: body.guardianPhone ?? null,
    planB: null,
    resolutionNote: null,
    timeline: [
      { at: now, label: "SOS raised", detail: real.highwayRef },
      {
        at: now,
        label: "Triage complete",
        detail: `${triage.faultLabel} (${Math.round(triage.confidence * 100)}% confidence)`,
      },
      {
        at: now,
        label: "Broadcast to nearby mechanics",
        detail: `${ranked.length} mechanic${ranked.length === 1 ? "" : "s"} notified`,
      },
    ],
    weather: real.weather,
    nearby: real.nearby,
    route: real.route,
    sources: real.sources,
  };

  await saveRequest(request);

  return NextResponse.json({
    request,
    candidates: ranked.slice(0, 5),
    quote,
  });
}
