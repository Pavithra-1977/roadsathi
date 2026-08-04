import { NextResponse } from "next/server";
import { getRequest, saveRequest } from "@/lib/db";
import { planParts, quotePrice, rankMechanics } from "@/lib/matching";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const r = await getRequest(params.id);
  if (!r) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  if (r.mechanicId) {
    return NextResponse.json(
      { error: "This job has already been accepted by another mechanic" },
      { status: 409 }
    );
  }

  const { mechanicId } = (await req.json()) as { mechanicId: string };
  const ranked = rankMechanics(r.location, r.triage, r.vehicleType);
  const chosen = ranked.find((m) => m.mechanic.id === mechanicId);

  if (!chosen) {
    return NextResponse.json(
      { error: "That mechanic is not available for this vehicle type" },
      { status: 400 }
    );
  }

  const partsPlan = planParts(r.location, chosen.mechanic, r.triage?.requiredParts ?? []);
  const quote = quotePrice(r.triage, chosen.distanceKm, partsPlan.totalDetourKm);

  r.mechanicId = chosen.mechanic.id;
  r.mechanic = chosen.mechanic;
  r.etaMinutes = chosen.etaMinutes;
  r.partsPlan = partsPlan;
  r.quotedPriceInr = quote.total;
  r.status = "assigned";

  const now = new Date().toISOString();
  r.timeline.push({
    at: now,
    label: `${chosen.mechanic.name} accepted`,
    detail: `${chosen.mechanic.shopName} - ETA ${chosen.etaMinutes} min`,
  });
  if (partsPlan.pickups.length) {
    r.timeline.push({
      at: now,
      label: "Parts pickup routed",
      detail: partsPlan.pickups.map((p) => p.shopName).join(" then "),
    });
  }
  if (r.guardianPhone) {
    r.timeline.push({
      at: now,
      label: "Guardian notified",
      detail: `Live tracking link sent to ${r.guardianPhone}`,
    });
  }

  await saveRequest(r);
  return NextResponse.json({ request: r, quote });
}
