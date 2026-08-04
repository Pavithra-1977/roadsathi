import { NextResponse } from "next/server";
import { getRequest, saveRequest } from "@/lib/db";
import { buildPlanB } from "@/lib/matching";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const r = await getRequest(params.id);
  if (!r) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  r.planB = buildPlanB(r.location, r.passengers, r.hasChildren);
  r.status = "plan_b";
  r.timeline.push({
    at: new Date().toISOString(),
    label: "Plan B engaged",
    detail: "Vehicle not roadworthy tonight - arranging safe onward travel and secure custody",
  });

  await saveRequest(r);
  return NextResponse.json({ request: r, planB: r.planB });
}
