/**
 * Triage evaluation.  npx tsx scripts/eval.ts
 *
 * Runs a self-written, labelled test set through
 *   1. the deterministic pipeline (keyword classifier on the raw text), and
 *   2. the LangGraph pipeline (intake -> RAG -> LLM -> validate ...),
 * prints accuracy, top-3 accuracy and misses for each, and writes
 * data/eval-results.json (shown on /evidence).
 *
 * The phrases were written from how a stranded driver describes symptoms,
 * deliberately NOT from the knowledge base's keyword lists, and the knowledge
 * base must not be tuned against them afterwards - that would make the score
 * meaningless. Without HUGGINGFACE_API_KEY the LangGraph pipeline runs its
 * deterministic fallback (intake normalisation + keyword classifier).
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { VehicleType } from "../src/lib/types";

const ROOT = join(__dirname, "..");
for (const f of [".env.local", ".env"]) if (existsSync(join(ROOT, f))) process.loadEnvFile(join(ROOT, f));
if (process.argv.includes("--offline")) delete process.env.HUGGINGFACE_API_KEY;

type Kind = "en" | "hinglish" | "typo" | "vague";
interface Case { text: string; expected: string; kind: Kind; vehicle?: VehicleType }

// prettier-ignore
const CASES: Case[] = [
  { expected: "flat_tyre", kind: "en", text: "car keeps drifting to the left and one wheel looks squashed" },
  { expected: "flat_tyre", kind: "hinglish", text: "tyre mein se hawa nikal gayi, kil ghus gayi lagti hai" },
  { expected: "flat_tyre", kind: "en", text: "rear wheel completely sat down after we drove over some broken glass" },
  { expected: "tyre_burst", kind: "en", text: "heard a huge pop and the car swerved, the rubber is torn to pieces" },
  { expected: "tyre_burst", kind: "typo", text: "tayar phat gaya highway pe, bahut zor ki awaaz aayi" },
  { expected: "tyre_burst", kind: "en", text: "the side of the tyre has ripped open, you can see the threads" },
  { expected: "battery_dead", kind: "en", text: "turned the key and nothing happens, the dashboard is totally black" },
  { expected: "battery_dead", kind: "en", text: "left the headlights on all night, now the car is completely lifeless" },
  { expected: "battery_dead", kind: "hinglish", text: "gaadi start nahi ho rahi, sirf tik tik ki awaaz aa rahi hai" },
  { expected: "alternator_fail", kind: "en", text: "while driving all the lights slowly went dim and then the engine cut out" },
  { expected: "alternator_fail", kind: "en", text: "the red battery symbol lit up on the highway and now the radio and wipers stopped" },
  { expected: "alternator_fail", kind: "typo", text: "put in a new batery last week but it keeps going flat after an hour of driving" },
  { expected: "overheating", kind: "en", text: "needle shot up to H and white vapour is coming from under the hood" },
  { expected: "overheating", kind: "hinglish", text: "engine bahut garam ho gaya, bonnet se bhaap nikal rahi hai" },
  { expected: "overheating", kind: "en", text: "stuck in traffic and the engine gauge keeps climbing towards the top" },
  { expected: "fuel_empty", kind: "en", text: "ran dry, the needle was on E and I thought I could make it to the next pump" },
  { expected: "fuel_empty", kind: "hinglish", text: "tanki khaali ho gayi, petrol pump 20 km door hai" },
  { expected: "fuel_empty", kind: "en", text: "engine coughed a few times and died, the fuel light had been blinking since morning" },
  { expected: "fan_belt", kind: "en", text: "something snapped at the front with a loud slap and now the steering is very heavy" },
  { expected: "fan_belt", kind: "en", text: "shrieking noise from the engine bay then the battery and temperature lights came on together" },
  { expected: "fan_belt", kind: "en", text: "the rubber strip that turns the pulleys is lying on the road behind us" },
  { expected: "brake_failure", kind: "en", text: "I press the pedal and it goes all the way to the floor, the car barely slows" },
  { expected: "brake_failure", kind: "typo", text: "brek nahi lag rahe, pedal bilkul naram ho gaya" },
  { expected: "brake_failure", kind: "en", text: "fluid dripping near the back wheel and stopping is really weak" },
  { expected: "clutch_failure", kind: "en", text: "engine revs but the car won't move forward, smells like something is cooking" },
  { expected: "clutch_failure", kind: "en", text: "the left pedal stays stuck down and I can't get it into first" },
  { expected: "clutch_failure", kind: "hinglish", text: "gear daalne pe ghar ghar awaaz, gaadi aage nahi badh rahi" },
  { expected: "starter_motor", kind: "en", text: "lights and horn work fine but turning the key gives one click and then silence" },
  { expected: "starter_motor", kind: "en", text: "when I crank there is a whirr but the engine itself doesn't spin" },
  { expected: "starter_motor", kind: "hinglish", text: "self motor kharab lagta hai, battery bilkul theek hai" },
  { expected: "spark_plug", kind: "en", text: "the car shudders and loses power when I accelerate, check engine light is flashing" },
  { expected: "spark_plug", kind: "en", vehicle: "bike", text: "bike keeps cutting out and popping, not picking up speed" },
  { expected: "spark_plug", kind: "en", text: "engine runs rough at idle like it is missing a beat" },
  { expected: "radiator_leak", kind: "en", text: "there is a pink puddle forming under the front of the car" },
  { expected: "radiator_leak", kind: "en", text: "a pipe near the front of the engine split and liquid is spraying out" },
  { expected: "radiator_leak", kind: "hinglish", text: "gaadi ke neeche se hara paani tapak raha hai" },
  { expected: "chain_snap", kind: "en", vehicle: "bike", text: "on my bike the engine revs but the back wheel doesn't turn" },
  { expected: "chain_snap", kind: "en", vehicle: "bike", text: "heard a clatter and now something is dragging under the motorcycle" },
  { expected: "chain_snap", kind: "hinglish", vehicle: "bike", text: "bike ki chain utar gayi aur pahiya ghoom nahi raha" },
  { expected: "electrical_fuse", kind: "en", text: "headlamps died suddenly but the engine is still running" },
  { expected: "electrical_fuse", kind: "en", text: "my indicators and horn both stopped working at the same time" },
  { expected: "electrical_fuse", kind: "en", text: "smell of melting plastic from under the dashboard and the wipers are dead" },
  { expected: "key_lockout", kind: "en", text: "I shut the door and the keys are still hanging in the ignition" },
  { expected: "key_lockout", kind: "en", text: "can't find my car key anywhere, we searched the whole rest stop" },
  { expected: "key_lockout", kind: "hinglish", text: "chaabi gaadi ke andar reh gayi aur darwaza band ho gaya" },
  { expected: "engine_seize", kind: "en", text: "loud metallic banging from the engine and then it froze, won't turn at all" },
  { expected: "engine_seize", kind: "en", text: "oil warning came on, I kept driving, now there is a horrible hammering sound" },
  { expected: "engine_seize", kind: "hinglish", text: "engine se zor zor ki khat khat aur phir band, ab ghoom hi nahi raha" },
  { expected: "suspension", kind: "en", text: "hit a deep pit in the road and now the front wheel is leaning inwards" },
  { expected: "suspension", kind: "en", text: "loud thud over every bump and the car pulls hard to one side" },
  { expected: "suspension", kind: "en", text: "one corner of the car is sagging after the speed breaker" },
  { expected: "accident_damage", kind: "en", text: "a truck rear-ended us and the bumper is hanging off" },
  { expected: "accident_damage", kind: "en", text: "we skidded into the divider and my father has a cut on his head" },
  { expected: "accident_damage", kind: "en", text: "the car flipped onto its side in the ditch" },
  { expected: "unknown", kind: "vague", text: "something is not right with the car" },
  { expected: "unknown", kind: "vague", text: "help please we are stuck" },
  { expected: "unknown", kind: "vague", text: "the car feels strange" },
  { expected: "unknown", kind: "vague", text: "kuch problem hai gaadi mein" },
  { expected: "unknown", kind: "vague", text: "it just stopped" },
  { expected: "unknown", kind: "vague", text: "not sure what happened, can you send someone" },
];

interface Row { text: string; expected: string; kind: Kind; predicted: string; top3: string[]; ms: number }
interface Summary { accuracy: number; top3Accuracy: number; correct: number; top3Correct: number; byKind: Record<string, string>; misses: Row[] }

function summarise(rows: Row[]): Summary {
  const pct = (n: number, d: number) => Number(((100 * n) / d).toFixed(1));
  const correct = rows.filter((r) => r.predicted === r.expected).length;
  const top3Correct = rows.filter((r) => r.top3.includes(r.expected)).length;
  const kinds = [...new Set(rows.map((r) => r.kind))];
  return {
    accuracy: pct(correct, rows.length),
    top3Accuracy: pct(top3Correct, rows.length),
    correct,
    top3Correct,
    byKind: Object.fromEntries(
      kinds.map((k) => {
        const ks = rows.filter((r) => r.kind === k);
        return [k, `${ks.filter((r) => r.predicted === r.expected).length}/${ks.length}`];
      })
    ),
    misses: rows.filter((r) => r.predicted !== r.expected),
  };
}

function print(name: string, s: Summary, n: number) {
  console.log(`\n== ${name}: accuracy ${s.accuracy}% (${s.correct}/${n}), top-3 ${s.top3Accuracy}% (${s.top3Correct}/${n})`);
  console.log(`   by kind: ${Object.entries(s.byKind).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  for (const m of s.misses) console.log(`   MISS [${m.kind}] expected ${m.expected}, got ${m.predicted} (top3 ${m.top3.join("/")}): "${m.text}"`);
}

async function main() {
  const { scoreFaults, triage } = await import("../src/lib/triage");
  const { runTriageAgent, DEFAULT_HF_MODEL } = await import("../src/lib/agent/graph");

  // 1. Deterministic: the existing keyword classifier on the raw text.
  const det: Row[] = CASES.map((c) => {
    const t0 = Date.now();
    const v = c.vehicle ?? "car";
    const ranked = scoreFaults(c.text, v).map((x) => x.fault.id);
    return { ...c, predicted: triage(c.text, v).faultId, top3: ranked.length ? ranked.slice(0, 3) : ["unknown"], ms: Date.now() - t0 };
  });

  // 2. LangGraph, 4 at a time to stay polite to the free tier.
  const agent: Row[] = new Array(CASES.length);
  let sources: Record<string, number> = {};
  for (let i = 0; i < CASES.length; i += 4) {
    await Promise.all(
      CASES.slice(i, i + 4).map(async (c, j) => {
        const t = await runTriageAgent({ symptomText: c.text, vehicleType: c.vehicle ?? "car" });
        const src = t.agent?.source ?? "deterministic";
        sources = { ...sources, [src]: (sources[src] ?? 0) + 1 };
        agent[i + j] = { ...c, predicted: t.faultId, top3: [t.faultId, ...(t.alternatives ?? [])].slice(0, 3), ms: t.agent?.ms ?? 0 };
      })
    );
    process.stdout.write(`langgraph ${Math.min(i + 4, CASES.length)}/${CASES.length}\r`);
  }

  const d = summarise(det);
  const a = summarise(agent);
  const llm = Boolean(process.env.HUGGINGFACE_API_KEY);
  print("Deterministic (keyword classifier)", d, CASES.length);
  print(`LangGraph (${llm ? "LLM + RAG" : "no API key: deterministic fallback"})`, a, CASES.length);
  console.log(`   answered by: ${JSON.stringify(sources)}, avg ${Math.round(agent.reduce((s, r) => s + r.ms, 0) / agent.length)} ms`);

  const out = {
    generatedAt: new Date().toISOString(),
    testSet: {
      size: CASES.length,
      description:
        "Self-written labelled phrases, written independently of the knowledge-base keyword lists. " +
        "Not a real-world dataset. The knowledge base is not tuned against these phrases.",
      byKind: Object.fromEntries([...new Set(CASES.map((c) => c.kind))].map((k) => [k, CASES.filter((c) => c.kind === k).length])),
      labels: 19,
    },
    deterministic: { name: "Keyword classifier (raw text)", ...d },
    langgraph: {
      name: "LangGraph: intake, RAG, LLM, validate",
      llmUsed: llm,
      model: llm ? process.env.HF_MODEL || DEFAULT_HF_MODEL : null,
      answeredBy: sources,
      avgMs: Math.round(agent.reduce((s, r) => s + r.ms, 0) / agent.length),
      ...a,
    },
  };
  writeFileSync(join(ROOT, "data", "eval-results.json"), JSON.stringify(out, null, 2));
  console.log("\nwrote data/eval-results.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
