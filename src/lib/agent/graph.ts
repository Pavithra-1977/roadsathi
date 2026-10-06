import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { FAULTS } from "../knowledgeBase";
import { currentWeather } from "../realdata/openmeteo";
import { guideChunk, keywordSearch, retrieve, toCitation, type RetrievedChunk } from "../rag/retriever";
import { scoreFaults, triage } from "../triage";
import type { AgentTrace, LatLng, Severity, TriageResult, VehicleType } from "../types";

/**
 * LangGraph triage workflow.
 *
 *   intake -> retrieve -> classify -> validate -> safety -+-> clarify ----+-> plan_b_hint -> END
 *                                                         +---------------+-> END
 *
 * The LLM only ADVISES on which known fault this is. Skills, parts, tools and
 * cost always come from the knowledge-base definition of that fault, so dispatch
 * and pricing stay deterministic. Every node has its own timeout, the whole run
 * has an 8 s budget, and any error falls back to the deterministic classifier.
 */

const BUDGET_MS = 8000;
const RETRIEVE_MS = 4000;
const CLASSIFY_MAX_MS = 5000;
const WEATHER_MS = 1500;
const HF_BASE_URL = "https://router.huggingface.co/v1";
export const DEFAULT_HF_MODEL = "openai/gpt-oss-20b:groq";

/** 18 knowledge-base faults + "unknown" (needs on-site inspection) = 19 ids. */
const FAULT_IDS: [string, ...string[]] = ["unknown", ...FAULTS.map((f) => f.id)];
const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export interface AgentInput {
  symptomText: string;
  vehicleType?: VehicleType;
  vehicleModel?: string;
  hasChildren?: boolean;
  location?: LatLng;
  /** The driver's answer to an earlier clarifying question */
  clarification?: { question: string; answer: string } | null;
}

// ------------------------------------------------------------------ helpers
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), Math.max(1, ms))),
  ]);
}

// Hinglish and common typos -> English. Expansions are APPENDED, so the
// original words still reach the keyword classifier and the embedder.
const EXPANSIONS: [RegExp, string][] = [
  [/\b(punch?ar|pancher|panchar)\b/, "puncture flat tyre"],
  [/\bhawa\b/, "air flat tyre"],
  [/\bphat (gaya|gayi)\b/, "burst"],
  [/\b(start|self) (nahi|nhi|nai)\b/, "not starting starter"],
  [/\bband ho (gaya|gayi)\b/, "stopped engine died"],
  [/\bgaram\b/, "overheating hot temperature"],
  [/\bdhu(a|aa|an|aan)\b/, "smoke"],
  [/\bkhatam\b/, "empty no fuel"],
  [/\bcha+bi\b/, "key"],
  [/\bbrake (nahi|nhi|fail)\b/, "brake failure no brakes"],
  [/\bawaa?z\b/, "noise"],
  [/\b(toot|tut) (gaya|gayi)\b/, "snapped broke"],
  [/\bpaani\b/, "water coolant leak"],
  [/\btel\b/, "oil"],
  [/\bjhatk(a|e)\b/, "jerking misfire"],
  [/\bbachch?(a|e|i)\b|\bbaccha\b/, "children"],
  [/\braat\b/, "night"],
  [/\bba+rish\b/, "rain"],
  [/\b(tyer|tyr|tayar)\b/, "tyre"],
  [/\b(batery|battry|betri|bettery)\b/, "battery"],
  [/\bengin\b/, "engine"],
  [/\bbrek\b/, "brake"],
  [/\bclucth\b/, "clutch"],
  [/\bradiater\b/, "radiator"],
  [/\bpetrl\b/, "petrol"],
];
const HINGLISH_MARKERS = /\b(hai|hain|nahi|nhi|gaya|gayi|ho|raha|rahi|kya|mein|mera|meri|gaadi|gadi|chal|band|bhai|lag)\b/;

function detectVehicle(t: string): VehicleType | null {
  if (/\b(bike|motorcycle|scooter|scooty|two.?wheeler|activa|splendor|pulsar)\b/.test(t)) return "bike";
  if (/\b(truck|lorry|tempo)\b/.test(t)) return "truck";
  if (/\b(auto|rickshaw)\b/.test(t)) return "auto";
  if (/\bsuv\b/.test(t)) return "suv";
  if (/\bcar\b/.test(t)) return "car";
  return null;
}

function isNightInIndia(): boolean {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  return h >= 19 || h < 6;
}

// ------------------------------------------------------------------ state
const LlmOutput = z.object({
  faultId: z.enum(FAULT_IDS),
  severity: z.enum(["low", "medium", "high", "critical"]),
  roadsideFixable: z.boolean(),
  requiredSkills: z.array(z.string()),
  tools: z.array(z.string()),
  parts: z.array(z.string()),
  confidence: z.number().describe("0 to 1"),
  reasoning: z.string().describe("One or two sentences. Cite chunk ids in square brackets, e.g. [overheating#0]."),
  citedChunkIds: z.array(z.string()),
  clarifyingQuestion: z.string().describe("One short question that would most improve the diagnosis, or empty string"),
});
type LlmOutput = z.infer<typeof LlmOutput>;

const State = Annotation.Root({
  input: Annotation<AgentInput>,
  deadline: Annotation<number>,
  text: Annotation<string>,
  normalized: Annotation<string>,
  language: Annotation<"en" | "hi" | "hinglish">,
  vehicleType: Annotation<VehicleType>,
  keywords: Annotation<string[]>,
  chunks: Annotation<RetrievedChunk[]>,
  retrievalMode: Annotation<"embedding" | "keyword">,
  llm: Annotation<LlmOutput | null>,
  model: Annotation<string | null>,
  result: Annotation<TriageResult>,
  path: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  flags: Annotation<string[]>({ reducer: (a, b) => [...new Set([...a, ...b])], default: () => [] }),
});
type S = typeof State.State;

// ------------------------------------------------------------------ nodes
function intake(s: S): Partial<S> {
  const { symptomText, clarification } = s.input;
  // The LLM sees the full Q&A; classification and retrieval see only the
  // driver's own words, so the question's wording cannot skew the match.
  const text = clarification?.answer
    ? `${symptomText}. Asked: ${clarification.question} Answer: ${clarification.answer}`
    : symptomText;
  const own = clarification?.answer ? `${symptomText}. ${clarification.answer}` : symptomText;
  const lower = own.toLowerCase().replace(/\s+/g, " ").trim();
  const added = EXPANSIONS.filter(([re]) => re.test(lower)).map(([, en]) => en);
  const normalized = added.length ? `${lower} (${added.join(", ")})` : lower;

  const language = /[ऀ-ॿ]/.test(text) ? "hi" : HINGLISH_MARKERS.test(lower) ? "hinglish" : "en";
  const vehicleType = s.input.vehicleType ?? detectVehicle(lower) ?? "car";
  const keywords = [...new Set(scoreFaults(normalized, vehicleType).slice(0, 3).flatMap((x) => x.hits))];

  return { text, normalized, language, vehicleType, keywords, path: ["intake"] };
}

async function retrieveNode(s: S): Promise<Partial<S>> {
  const left = Math.min(RETRIEVE_MS, s.deadline - Date.now() - 2500);
  const query = `${s.vehicleType} breakdown: ${s.normalized}`;
  // left < 0: not enough budget to embed, keyword search is instant.
  const r = left > 300 ? await retrieve(query, 4, left) : { mode: "keyword" as const, chunks: keywordSearch(query, 4) };
  return { chunks: r.chunks, retrievalMode: r.mode, path: ["retrieve"] };
}

async function classify(s: S): Promise<Partial<S>> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) return { llm: null, model: null, path: ["classify"], flags: ["no api key"] };

  const model = process.env.HF_MODEL || DEFAULT_HF_MODEL;
  const ms = Math.min(CLASSIFY_MAX_MS, s.deadline - Date.now() - 800);
  if (ms < 800) return { llm: null, model, path: ["classify"], flags: ["classify skipped: budget"] };

  const llm = new ChatOpenAI({
    model,
    apiKey: key,
    temperature: 0,
    maxRetries: 0,
    timeout: ms,
    configuration: { baseURL: HF_BASE_URL },
    // gpt-oss is a reasoning model; low effort keeps it inside the budget.
    ...(/gpt-oss/.test(model) ? { modelKwargs: { reasoning_effort: "low" } } : {}),
  }).withStructuredOutput(LlmOutput, { name: "roadside_triage", method: "jsonSchema", strict: true });

  const faults = FAULTS.map((f) => `${f.id}: ${f.label} (severity ${f.severity}, roadside-fixable ${f.roadsideFixable})`).join("\n");
  const context = s.chunks.map((c) => `[${c.id}] ${c.title}: ${c.text}`).join("\n\n");
  const candidates = scoreFaults(s.normalized, s.vehicleType).slice(0, 3).map((x) => x.fault.id).join(", ") || "none";

  try {
    const out = await withTimeout(
      llm.invoke(
        [
          {
            role: "system",
            content:
              "You triage vehicle breakdowns for a roadside assistance service on Indian highways. " +
              "Drivers may write in English, Hindi or Hinglish, with typos. Pick exactly one faultId from the list; " +
              'use "unknown" if the description is too vague. Base your reasoning on the provided guide chunks and cite their ids. ' +
              "Be conservative: when unsure, lower the confidence. You do not decide dispatch or price.",
          },
          {
            role: "user",
            content:
              `Vehicle: ${s.input.vehicleModel ?? "unknown"} (${s.vehicleType})\n` +
              `Driver says: "${s.text}"\nNormalised: ${s.normalized}\n` +
              `Keyword classifier candidates: ${candidates}\n\nKnown faults:\n${faults}\n\nGuide chunks:\n${context}`,
          },
        ],
        { signal: AbortSignal.timeout(ms) }
      ),
      ms,
      "classify"
    );
    return { llm: out, model, path: ["classify"] };
  } catch (e) {
    const msg = (e as Error).message;
    return { llm: null, model, path: ["classify"], flags: [/timed? ?out|abort/i.test(msg) ? "timeout" : `llm error: ${msg.slice(0, 80)}`] };
  }
}

function validate(s: S): Partial<S> {
  const det = triage(s.normalized, s.vehicleType);
  const llm = s.llm;
  const ids = new Set(s.chunks.map((c) => c.id));
  const cited = llm?.citedChunkIds.filter((id) => ids.has(id)) ?? [];
  const ordered = [...s.chunks].sort((a, b) => Number(cited.includes(b.id)) - Number(cited.includes(a.id)));
  const citations = ordered.map(toCitation);

  if (!llm) return { result: { ...det, citations }, path: ["validate"] };

  const confidence = Math.min(0.99, Math.max(0, llm.confidence));
  const agree = llm.faultId === det.faultId;
  if (!agree && confidence < 0.7) {
    return { result: { ...det, citations }, path: ["validate"], flags: ["low agreement"] };
  }

  const f = FAULTS.find((x) => x.id === llm.faultId);
  // "unknown" from the LLM: keep the classifier's general-inspection result.
  const base = f
    ? {
        ...det,
        faultId: f.id,
        faultLabel: f.label,
        severity: f.severity,
        roadsideFixable: f.roadsideFixable,
        estimatedFixMinutes: f.fixMinutes,
        estimatedCostRange: f.costRange,
        requiredSkills: f.skills,
        requiredTools: f.tools,
        requiredParts: f.parts,
        safetyAdvice: f.safetyAdvice,
      }
    : triage("", s.vehicleType);

  const severity = SEVERITY_RANK[llm.severity] > SEVERITY_RANK[base.severity] ? llm.severity : base.severity;
  return {
    result: {
      ...base,
      severity,
      // Conservative: not fixable if either side says so.
      roadsideFixable: base.roadsideFixable && llm.roadsideFixable,
      // Tools are advisory (shown to the mechanic); skills and parts stay from the KB.
      requiredTools: [...new Set([...base.requiredTools, ...llm.tools])].slice(0, 8),
      confidence: Number((agree ? Math.max(confidence, det.confidence) : confidence).toFixed(2)),
      reasoning: llm.reasoning || det.reasoning,
      source: "llm",
      citations,
    },
    path: ["validate"],
    flags: agree ? ["agrees with keyword classifier"] : ["llm overrode keyword classifier"],
  };
}

const DO_NOT_ATTEMPT: Record<string, string> = {
  overheating: "the cooling system is pressurised and hot coolant can cause serious burns.",
  radiator_leak: "the cooling system may be hot and pressurised.",
  brake_failure: "brake faults must never be tested or patched at the roadside.",
  engine_seize: "restarting can make the damage worse.",
  suspension: "a damaged wheel or ball joint can fail completely.",
  accident_damage: "hidden damage to steering, brakes or fuel lines may not be visible.",
  alternator_fail: "it needs workshop tools and the electrics may fail completely.",
  clutch_failure: "it usually needs the gearbox separated in a workshop.",
};

async function safety(s: S): Promise<Partial<S>> {
  const r = s.result;
  const t = s.normalized;
  const extra: string[] = [];
  const flags: string[] = [];

  if (/\b(children|child|kid|kids|baby|infant)\b/.test(t) || s.input.hasChildren) {
    extra.push("Children first: move them out on the side away from traffic, keep hold of small hands, and never leave them in the vehicle.");
  }
  if (isNightInIndia() || /\bnight\b/.test(t)) {
    extra.push("It is dark: keep hazards and parking lights on, use a phone torch to be seen, and wait behind the barrier, not between the vehicle and traffic.");
  }
  let raining = /\b(rain|raining|storm)\b/.test(t);
  if (!raining && s.input.location) {
    try {
      const w = await withTimeout(currentWeather(s.input.location), Math.min(WEATHER_MS, s.deadline - Date.now()), "weather");
      raining = Boolean(w.data && (w.data.precipitationMm >= 1 || /rain|showers|thunder/i.test(w.data.summary)));
    } catch {
      flags.push("weather unavailable");
    }
  }
  if (raining) {
    extra.push("Rain: other drivers will see you late. Stand well back from the road and do not attempt repairs on wet, sloping ground.");
  }
  if (/\b(highway|nh|nh\d+|expressway|shoulder)\b/.test(t) || s.input.location) {
    extra.push("On a highway shoulder, stop as far left as possible and never stand behind the vehicle.");
  }
  const reason = DO_NOT_ATTEMPT[r.faultId] ?? (!r.roadsideFixable || r.severity === "critical" ? "this fault is not safe to fix at the roadside." : null);
  const citations = [...(r.citations ?? [])];
  if (reason) {
    extra.unshift(`Do not attempt this repair yourself: ${reason}`);
    const guide = guideChunk("when-not-to-repair");
    if (guide && !citations.some((c) => c.chunkId === guide.id)) citations.push(toCitation(guide));
  }

  return {
    result: { ...r, safetyAdvice: [...new Set([...extra, ...r.safetyAdvice])], citations },
    path: ["safety"],
    flags,
  };
}

const GENERIC_QUESTION =
  "What happened just before it stopped - any bang, noise, smoke, burning smell or warning light? And does the engine still start?";

function clarify(s: S): Partial<S> {
  return {
    result: {
      ...s.result,
      needsClarification: true,
      clarifyingQuestion: s.llm?.clarifyingQuestion?.trim() || GENERIC_QUESTION,
    },
    path: ["clarify"],
  };
}

function planBHint(s: S): Partial<S> {
  return { result: { ...s.result, planBRecommended: true }, path: ["plan_b_hint"] };
}

// ------------------------------------------------------------------ edges
const wantsPlanB = (s: S) => s.result.severity === "high" || s.result.severity === "critical" || !s.result.roadsideFixable;
// One clarification round only: if the driver already answered, do not ask again.
const wantsClarify = (s: S) => s.result.confidence < 0.55 && !s.input.clarification?.answer;

const graph = new StateGraph(State)
  .addNode("intake", intake)
  .addNode("retrieve", retrieveNode)
  .addNode("classify", classify)
  .addNode("validate", validate)
  .addNode("safety", safety)
  .addNode("clarify", clarify)
  .addNode("plan_b_hint", planBHint)
  .addEdge(START, "intake")
  .addEdge("intake", "retrieve")
  .addEdge("retrieve", "classify")
  .addEdge("classify", "validate")
  .addEdge("validate", "safety")
  .addConditionalEdges("safety", (s) => (wantsClarify(s) ? "clarify" : wantsPlanB(s) ? "plan_b_hint" : END), ["clarify", "plan_b_hint", END])
  .addConditionalEdges("clarify", (s) => (wantsPlanB(s) ? "plan_b_hint" : END), ["plan_b_hint", END])
  .addEdge("plan_b_hint", END)
  .compile();

// ------------------------------------------------------------------ entry point
// ponytail: per-instance memo so /api/triage then /api/requests with the same text
// does not pay for the LLM twice. Unbounded; add eviction if traffic grows.
const g = globalThis as unknown as { __roadsathiAgent?: Map<string, { at: number; value: TriageResult }> };
const memo = (g.__roadsathiAgent ??= new Map());
const MEMO_MS = 10 * 60 * 1000;

/** Deterministic triage dressed with keyword citations, used on any failure. */
function deterministic(input: AgentInput, flags: string[], started: number): TriageResult {
  const vehicleType = input.vehicleType ?? "car";
  const base = triage(input.symptomText, vehicleType);
  const trace: AgentTrace = { path: ["deterministic"], source: "deterministic", retrieval: "keyword", flags, ms: Date.now() - started };
  return {
    ...base,
    citations: keywordSearch(`${vehicleType} ${input.symptomText}`, 4).map(toCitation),
    agent: trace,
    planBRecommended: base.severity === "high" || base.severity === "critical" || !base.roadsideFixable,
  };
}

export async function runTriageAgent(input: AgentInput): Promise<TriageResult> {
  const started = Date.now();
  const key = JSON.stringify([input.symptomText, input.vehicleType, input.vehicleModel, input.hasChildren, input.clarification]);
  const hit = memo.get(key);
  if (hit && started - hit.at < MEMO_MS) return hit.value;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), BUDGET_MS);
  try {
    const s = (await withTimeout(
      graph.invoke({ input, deadline: started + BUDGET_MS }, { signal: ctrl.signal }),
      BUDGET_MS,
      "agent"
    )) as S;
    const llmUsed = s.result.source === "llm";
    const value: TriageResult = {
      ...s.result,
      agent: {
        path: s.path,
        source: llmUsed ? "llm+rag" : "deterministic",
        retrieval: s.retrievalMode,
        language: s.language,
        flags: s.flags,
        model: llmUsed ? s.model : null,
        ms: Date.now() - started,
      },
    };
    memo.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    const msg = (e as Error).message;
    return deterministic(input, [/timed out|abort/i.test(msg) ? "timeout" : `error: ${msg.slice(0, 80)}`], started);
  } finally {
    clearTimeout(timer);
  }
}
