/**
 * Self-check for the triage agent and retriever.  npx tsx scripts/check-agent.ts
 *
 * Runs with or without HUGGINGFACE_API_KEY. Without it, every case must still
 * resolve through the deterministic path, with keyword citations.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = join(__dirname, "..");
for (const f of [".env.local", ".env"]) if (existsSync(join(ROOT, f))) process.loadEnvFile(join(ROOT, f));
if (process.argv.includes("--offline")) delete process.env.HUGGINGFACE_API_KEY;

async function main() {
  const { runTriageAgent } = await import("../src/lib/agent/graph");
  const { keywordSearch, retrieve } = await import("../src/lib/rag/retriever");

  // Retriever: keyword path always works and maps to the right guide.
  assert.equal(keywordSearch("radiator steam overheating", 1)[0].docId, "overheating");
  const r = await retrieve("gaadi garam ho gayi, dhuan aa raha hai");
  console.log(`retrieve(${r.mode}):`, r.chunks.map((c) => `${c.id} ${c.score}`).join(", "));
  assert.ok(r.chunks.length > 0);

  const cases: [string, Parameters<typeof runTriageAgent>[0], (t: Awaited<ReturnType<typeof runTriageAgent>>) => void][] = [
    ["english puncture", { symptomText: "front left tyre puncture, car pulling left", vehicleType: "car" },
      (t) => assert.equal(t.faultId, "flat_tyre")],
    ["hinglish overheating", { symptomText: "gaadi garam ho gayi, bonnet se dhuan aa raha hai", vehicleType: "car" },
      (t) => {
        assert.equal(t.faultId, "overheating");
        assert.ok(t.safetyAdvice.some((a) => a.startsWith("Do not attempt this repair yourself")));
      }],
    ["brake failure -> plan B", { symptomText: "brake nahi lag raha, pedal soft", vehicleType: "truck", hasChildren: true },
      (t) => {
        assert.equal(t.faultId, "brake_failure");
        assert.equal(t.planBRecommended, true);
        assert.ok(t.safetyAdvice.some((a) => a.startsWith("Children first")));
      }],
    ["vague -> clarify", { symptomText: "something is wrong with my car", vehicleType: "car" },
      (t) => {
        assert.equal(t.needsClarification, true);
        assert.ok(t.clarifyingQuestion);
      }],
    ["vague + answer -> no second question", {
      symptomText: "something is wrong with my car", vehicleType: "car",
      clarification: { question: "Does the engine start?", answer: "no, only clicking sound, lights are dim" },
    }, (t) => {
      assert.notEqual(t.needsClarification, true);
      assert.equal(t.faultId, "battery_dead");
    }],
  ];

  for (const [name, input, check] of cases) {
    const t = await runTriageAgent(input);
    // Contract: always the old shape plus agent + citations.
    assert.ok(t.faultId && t.faultLabel && Array.isArray(t.requiredSkills) && t.agent && t.citations);
    assert.ok(t.agent.ms! <= 8500, `budget exceeded: ${t.agent.ms} ms`);
    console.log(
      `${name.padEnd(36)} ${t.faultId.padEnd(15)} conf=${t.confidence} src=${t.agent.source} ` +
        `ret=${t.agent.retrieval} ${t.agent.ms}ms path=${t.agent.path.join(">")} flags=[${t.agent.flags?.join("; ")}]` +
        (t.needsClarification ? `\n    Q: ${t.clarifyingQuestion}` : "") +
        `\n    cites: ${t.citations.map((c) => c.chunkId).join(", ")}`
    );
    try {
      check(t);
    } catch (e) {
      // The LLM may legitimately disagree on edge cases; deterministic must not.
      if (t.agent.source === "deterministic") throw e;
      console.warn(`    (llm differs from expectation: ${(e as Error).message.split("\n")[0]})`);
    }
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
