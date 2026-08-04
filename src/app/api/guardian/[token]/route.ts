import { NextResponse } from "next/server";
import { getByGuardianToken } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Guardian view. Deliberately returns a reduced payload - a family member
 * watching from home needs the mechanic's identity and the ETA, not the
 * customer's full record.
 */
export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const r = await getByGuardianToken(params.token);
  if (!r) return NextResponse.json({ error: "Link not valid" }, { status: 404 });

  return NextResponse.json({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
    customerName: r.customerName,
    passengers: r.passengers,
    hasChildren: r.hasChildren,
    location: r.location,
    highwayRef: r.highwayRef,
    vehicleModel: r.vehicleModel,
    vehiclePlate: r.vehiclePlate,
    fault: r.triage?.faultLabel ?? "Being assessed",
    severity: r.triage?.severity ?? "medium",
    etaMinutes: r.etaMinutes,
    otpVerified: r.otpVerified,
    mechanic: r.mechanic
      ? {
          name: r.mechanic.name,
          shopName: r.mechanic.shopName,
          phone: r.mechanic.phone,
          rating: r.mechanic.rating,
          verified: r.mechanic.verified,
          plateNumber: r.mechanic.plateNumber,
          arrivalVehicle: r.mechanic.arrivalVehicle,
          location: r.mechanic.location,
        }
      : null,
    planB: r.planB,
    timeline: r.timeline,
  });
}
