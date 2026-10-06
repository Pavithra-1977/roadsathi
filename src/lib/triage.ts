import { FAULTS, type FaultDefinition } from "./knowledgeBase";
import type { TriageResult, VehicleType } from "./types";

/**
 * Triage engine.
 *
 * Runs a weighted keyword classifier over the driver's description (which may be
 * typed, dictated, or produced by an image caption model) and returns the most
 * likely fault plus the tools and parts the mechanic must bring.
 *
 * This deterministic path always works - no API key, no network, no cold start.
 * The LangGraph agent (lib/agent/graph.ts) builds on it and falls back to it.
 */

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Scored {
  fault: FaultDefinition;
  score: number;
  hits: string[];
}

export function scoreFaults(text: string, vehicleType: VehicleType): Scored[] {
  const t = ` ${normalise(text)} `;
  const scored: Scored[] = [];

  for (const fault of FAULTS) {
    if (fault.vehicleTypes !== "all" && !fault.vehicleTypes.includes(vehicleType)) {
      continue;
    }
    let score = 0;
    const hits: string[] = [];
    for (const [keyword, weight] of Object.entries(fault.keywords)) {
      if (t.includes(` ${keyword} `) || t.includes(` ${keyword}`) || t.includes(keyword)) {
        score += weight;
        hits.push(keyword);
      }
    }
    if (score > 0) scored.push({ fault, score, hits });
  }

  return scored.sort((a, b) => b.score - a.score);
}

export function triage(
  symptomText: string,
  vehicleType: VehicleType
): TriageResult {
  const ranked = scoreFaults(symptomText, vehicleType);

  if (ranked.length === 0) {
    return {
      faultId: "unknown",
      faultLabel: "Needs on-site inspection",
      confidence: 0.2,
      severity: "medium",
      roadsideFixable: true,
      estimatedFixMinutes: 45,
      estimatedCostRange: [500, 3000],
      requiredSkills: ["general"],
      requiredTools: ["General tool kit", "Multimeter", "Torch", "Jack"],
      requiredParts: [],
      safetyAdvice: [
        "Switch on hazard lights immediately and keep parking lights on.",
        "Move every passenger OUT of the vehicle and behind the crash barrier.",
        "Place a warning triangle or reflective object 50-100 m behind the vehicle.",
      ],
      reasoning:
        "The description did not match a known fault pattern, so a general-purpose mechanic is being dispatched with a full tool kit for on-site diagnosis.",
      source: "knowledge-base",
    };
  }

  const top = ranked[0];
  const runnerUp = ranked[1];

  // Confidence: how decisively the top fault beat everything else.
  const total = ranked.reduce((s, r) => s + r.score, 0);
  const margin = runnerUp ? (top.score - runnerUp.score) / top.score : 1;
  const share = top.score / total;
  const confidence = Math.min(0.97, Math.max(0.3, share * 0.6 + margin * 0.4));

  const f = top.fault;

  const reasoningParts = [
    `Matched "${f.label}" on the terms: ${top.hits.slice(0, 5).join(", ")}.`,
  ];
  if (runnerUp) {
    reasoningParts.push(
      `Next most likely was "${runnerUp.fault.label}" - the mechanic is being told to rule it out on arrival.`
    );
  }
  reasoningParts.push(
    f.roadsideFixable
      ? "This is normally repairable at the roadside with the right parts."
      : "This usually cannot be fixed at the roadside, so the Plan B safety flow is being prepared in parallel."
  );

  return {
    faultId: f.id,
    faultLabel: f.label,
    confidence: Number(confidence.toFixed(2)),
    severity: f.severity,
    roadsideFixable: f.roadsideFixable,
    estimatedFixMinutes: f.fixMinutes,
    estimatedCostRange: f.costRange,
    requiredSkills: f.skills,
    requiredTools: f.tools,
    requiredParts: f.parts,
    safetyAdvice: f.safetyAdvice,
    reasoning: reasoningParts.join(" "),
    source: "knowledge-base",
  };
}
