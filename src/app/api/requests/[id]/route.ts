import { NextResponse } from "next/server";
import { getRequest, saveRequest } from "@/lib/db";
import { buildPlanB } from "@/lib/matching";
import type { RequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const r = await getRequest(params.id);
  if (!r) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  return NextResponse.json({ request: r });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const r = await getRequest(params.id);
  if (!r) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const body = (await req.json()) as {
    status?: RequestStatus;
    resolutionNote?: string;
    etaMinutes?: number;
  };

  const now = new Date().toISOString();

  if (typeof body.etaMinutes === "number") r.etaMinutes = body.etaMinutes;

  if (body.status && body.status !== r.status) {
    r.status = body.status;
    const labels: Record<RequestStatus, string> = {
      open: "Reopened - searching again",
      assigned: "Mechanic assigned",
      arrived: "Mechanic on site",
      resolved: "Vehicle repaired",
      plan_b: "Plan B engaged - safety first",
      cancelled: "Request cancelled",
    };
    r.timeline.push({ at: now, label: labels[body.status], detail: body.resolutionNote });

    // Not fixable tonight? Immediately work out how to get everyone home safely.
    if (body.status === "plan_b" && !r.planB) {
      r.planB = buildPlanB(r.location, r.passengers, r.hasChildren);
      r.timeline.push({
        at: now,
        label: "Onward travel and vehicle custody arranged",
        detail: `${r.planB.length} safe options prepared`,
      });
    }
  }

  if (body.resolutionNote) r.resolutionNote = body.resolutionNote;

  await saveRequest(r);
  return NextResponse.json({ request: r });
}
