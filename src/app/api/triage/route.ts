import { NextResponse } from "next/server";
import { rankMechanics } from "@/lib/matching";
import { triage } from "@/lib/triage";
import type { VehicleType } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Live triage preview. Called while the driver is still typing, so the app can
 * show safety advice within a second of the SOS screen opening - long before
 * anyone has accepted the job.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    symptomText: string;
    vehicleType?: VehicleType;
    lat?: number;
    lng?: number;
  };

  const vehicleType = body.vehicleType ?? "car";
  const result = triage(body.symptomText ?? "", vehicleType);

  const candidates =
    typeof body.lat === "number" && typeof body.lng === "number"
      ? rankMechanics({ lat: body.lat, lng: body.lng }, result, vehicleType).slice(0, 4)
      : [];

  return NextResponse.json({ triage: result, candidates });
}
