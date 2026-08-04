import { NextResponse } from "next/server";
import { getRequest, saveRequest } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Arrival handshake.
 *
 * The mechanic cannot start work until the customer reads out a 4 digit code.
 * It proves to the family that the person who just walked up in the dark is
 * the same person the app dispatched, and it timestamps arrival for billing.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const r = await getRequest(params.id);
  if (!r) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const { code } = (await req.json()) as { code: string };

  if (String(code).trim() !== r.otp) {
    return NextResponse.json(
      { error: "Incorrect code. Do not allow work to begin.", verified: false },
      { status: 401 }
    );
  }

  r.otpVerified = true;
  r.status = "arrived";
  r.timeline.push({
    at: new Date().toISOString(),
    label: "Arrival verified",
    detail: `${r.mechanic?.name ?? "Mechanic"} confirmed on site with the correct code`,
  });

  await saveRequest(r);
  return NextResponse.json({ request: r, verified: true });
}
