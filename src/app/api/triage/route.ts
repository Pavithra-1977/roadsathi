import { NextResponse } from "next/server";
import { rankMechanics } from "@/lib/matching";
import { runTriageAgent } from "@/lib/agent/graph";
import { keywordSearch, toCitation } from "@/lib/rag/retriever";
import { triage } from "@/lib/triage";
import type { TriageResult, VehicleType } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Live triage preview. Called while the driver is still typing, so the app can
 * show safety advice within a second of the SOS screen opening - long before
 * anyone has accepted the job. That preview stays deterministic and instant.
 *
 * With `agent: true` it runs the LangGraph + RAG workflow instead (up to 8 s).
 * If that returns needsClarification, the client asks the driver the question
 * and calls again with { symptomText (original), clarification: {question, answer} }.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    symptomText: string;
    vehicleType?: VehicleType;
    lat?: number;
    lng?: number;
    agent?: boolean;
    vehicleModel?: string;
    hasChildren?: boolean;
    clarification?: { question: string; answer: string } | null;
  };

  const vehicleType = body.vehicleType ?? "car";
  const loc =
    typeof body.lat === "number" && typeof body.lng === "number" ? { lat: body.lat, lng: body.lng } : undefined;
  const result = body.agent
    ? await runTriageAgent({
        symptomText: body.symptomText ?? "",
        vehicleType: body.vehicleType,
        vehicleModel: body.vehicleModel,
        hasChildren: body.hasChildren,
        location: loc,
        clarification: body.clarification ?? null,
      })
    : withCitations(triage(body.symptomText ?? "", vehicleType), vehicleType, body.symptomText ?? "");

  const candidates =
    loc
      ? rankMechanics(loc, result, vehicleType).slice(0, 4)
      : [];

  return NextResponse.json({ triage: result, candidates });
}

/** Instant preview: deterministic triage plus keyword-retrieved guide citations. */
function withCitations(t: TriageResult, vehicleType: VehicleType, text: string): TriageResult {
  return {
    ...t,
    citations: keywordSearch(`${vehicleType} ${text}`, 3).map(toCitation),
    agent: { path: ["deterministic"], source: "deterministic", retrieval: "keyword" },
  };
}
