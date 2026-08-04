import { NextResponse } from "next/server";
import { saveRequest } from "@/lib/db";
import { highwayRefFor } from "@/lib/geo";
import { guardianToken, otp, requestId } from "@/lib/ids";
import { planParts, quotePrice, rankMechanics } from "@/lib/matching";
import { triage } from "@/lib/triage";
import type { AssistanceRequest, VehicleType } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * SMS fallback.
 *
 * Highways have dead zones. An assistance app that needs 4G to summon help
 * fails at exactly the place it is needed most. This endpoint is shaped like a
 * Twilio / Gupshup inbound webhook, so a plain text message with one bar of
 * signal still creates a full request with triage and dispatch.
 *
 * Expected message format:
 *   SOS <plate> <lat>,<lng> <what is wrong>
 * Example:
 *   SOS TS09AB1234 17.385,78.486 front left tyre puncture, wife and kid with me
 */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  let from = "";
  let text = "";

  if (contentType.includes("application/json")) {
    const b = (await req.json()) as { From?: string; Body?: string; from?: string; body?: string };
    from = b.From ?? b.from ?? "";
    text = b.Body ?? b.body ?? "";
  } else {
    const form = await req.formData();
    from = String(form.get("From") ?? "");
    text = String(form.get("Body") ?? "");
  }

  const parsed = parseSms(text);
  if (!parsed) {
    return NextResponse.json(
      {
        reply:
          "RoadSathi could not read that. Send: SOS <plate> <lat>,<lng> <problem>",
      },
      { status: 400 }
    );
  }

  const location = { lat: parsed.lat, lng: parsed.lng };
  const vehicleType: VehicleType = /bike|scooter|two.?wheeler/i.test(parsed.symptom)
    ? "bike"
    : "car";

  const t = triage(parsed.symptom, vehicleType);
  const ranked = rankMechanics(location, t, vehicleType);
  const best = ranked[0];
  const partsPlan = best ? planParts(location, best.mechanic, t.requiredParts) : null;
  const quote = best ? quotePrice(t, best.distanceKm, partsPlan?.totalDetourKm ?? 0) : null;

  const now = new Date().toISOString();
  const request: AssistanceRequest = {
    id: requestId(),
    createdAt: now,
    status: "open",
    customerName: "SMS traveller",
    customerPhone: from || "unknown",
    passengers: 1,
    hasChildren: /kid|child|baby|family/i.test(parsed.symptom),
    location,
    highwayRef: highwayRefFor(location),
    vehicleType,
    vehicleModel: "Reported by SMS",
    vehiclePlate: parsed.plate,
    symptomText: parsed.symptom,
    triage: t,
    partsPlan,
    mechanicId: null,
    mechanic: null,
    etaMinutes: best?.etaMinutes ?? null,
    quotedPriceInr: quote?.total ?? null,
    otp: otp(),
    otpVerified: false,
    guardianToken: guardianToken(),
    guardianPhone: null,
    planB: null,
    resolutionNote: null,
    timeline: [
      { at: now, label: "SOS received by SMS", detail: "No data connection required" },
      { at: now, label: "Triage complete", detail: t.faultLabel },
    ],
  };

  await saveRequest(request);

  const reply =
    `RoadSathi ${request.id}. Likely: ${t.faultLabel}. ` +
    (best ? `${best.mechanic.name} is ${best.etaMinutes} min away. ` : "Finding a mechanic. ") +
    `Your code is ${request.otp} - only share it when they arrive. ` +
    (quote ? `Approx Rs ${quote.total}. ` : "") +
    t.safetyAdvice[0];

  return NextResponse.json({ requestId: request.id, reply, request });
}

function parseSms(text: string): { plate: string; lat: number; lng: number; symptom: string } | null {
  const coord = text.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!coord) return null;

  const lat = Number(coord[1]);
  const lng = Number(coord[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const before = text.slice(0, coord.index ?? 0);
  const after = text.slice((coord.index ?? 0) + coord[0].length);

  const plate =
    before.replace(/^\s*sos\s*/i, "").trim().split(/\s+/)[0]?.toUpperCase() ?? "";

  return { plate, lat, lng, symptom: after.trim() || before.trim() };
}
